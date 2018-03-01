import chalk from 'chalk';
import loglevel from 'loglevel';

import pluginInfo from './pluginInfo';

const log = loglevel.getLogger('update');
const fs = require('fs');
const path = require('path');


export default {
  /**
   * Run updater tasks
   * @param argv - User arguments
   */
  run(argv) {
    return new Promise((resolve, reject) => {
      // FIXME: Log level still info at this point when debug flag is provided. Issues with async?
      log.debug('Running updater with args', argv);

      if (argv.simulate) {
        log.info(chalk.bold.blue('Simulation: All copy operations will be printed only'));
      }

      // Fill server/plugin path arrays for update tasks

      const pathTasks = [];

      if (argv.server) {
        // Single server
        pathTasks.push(this.checkPath('server', argv.server));
      } else {
        // Multiple servers
        pathTasks.push(this.getPaths('server', argv.serverDir));
      }

      if (argv.plugin) {
        // Single plugin
        pathTasks.push(this.checkPath('plugin', argv.plugin));
      } else {
        // Multiple plugins
        pathTasks.push(this.getPaths('plugin', argv.pluginDir));
      }

      Promise.all(pathTasks)
        .then(([s, p]) => {
          log.debug('Returned servers, plugins', s, p);
          let servers = s;
          let plugins = p;

          // Tasks can return single item instead of array or undefined (this.checkPath)
          //  convert if needed
          if (!s) {
            servers = [];
          } else if (!Array.isArray(s)) {
            servers = [s];
          }
          if (!p) {
            plugins = [];
          } else if (!Array.isArray(p)) {
            plugins = [p];
          }

          log.debug('Converted servers, plugins', servers, plugins);


          if (servers.length === 0) {
            return reject(new Error('No Server/s found. Check your server argument.'));
          }

          if (plugins.length === 0) {
            return reject(new Error('No Plugin/s found. Check your plugin argument.'));
          }

          // Arrays filled, call update method for every plugin / server dir
          log.info(chalk.blue.bold('Servers'));
          this.printList(servers);

          log.info(chalk.blue.bold('Plugins'));
          this.printList(plugins);

          // TODO: Get source plugins version information so we can use them later

          const updatePromises = [];

          log.info(chalk.yellow.bold('Update'));
          plugins.forEach((pluginPath) => {
            servers.forEach((serverPath) => {
              updatePromises.push(this.updatePlugin(
                serverPath,
                pluginPath,
                argv.simulate,
                argv.skipChecks,
              ));
            });
          });

          // Once all update operations are done resolve
          return Promise.all(updatePromises)
            .then(resolve);
        })
        .catch((error) => {
          log.error(error);
          return reject(new Error('Error while processing server / plugin path'));
        });
    });
  },
  printList(arr) {
    arr.forEach((e) => {
      log.info(chalk.blue(`- ${e}`));
    });
  },
  /**
   * Copy plugin to update folder of server
   * @param {String} serverPath - Path to server folder
   * @param {String} pluginPath - Path to plugin file
   * @param {Boolean} simulate - Only print copy operations, do not run
   * @param {Boolean} skipChecks - Skip any pre-update checks and copy plugin file to update folder.
   * @returns {Promise} - Resolves when operation has finished
   */
  updatePlugin(serverPath, pluginPath, simulate = false, skipChecks = false) {
    return new Promise((resolve) => {
      log.debug('updatePlugin', serverPath, pluginPath, simulate);

      const pluginFileName = path.basename(pluginPath);
      const serverName = path.basename(serverPath);
      let checksPassed;

      if (skipChecks) {
        checksPassed = Promise.resolve();
      } else {
        checksPassed = this.preUpdateChecks(serverPath, pluginPath);
      }

      checksPassed
        .then(() => {
          // Passed preUpdateChecks
          // Copy file

          const src = pluginPath;
          const dst = path.join(serverPath, 'plugins', 'update', pluginFileName);
          const copyMsg = `${src} ===> ${dst}`;

          if (simulate) {
            log.info(chalk.italic.blue(`(SIMULATED) ${copyMsg}`));
            return resolve();
          }
          fs.copyFile(src, dst, undefined, (err) => {
            if (err) {
              log.error('Error while copying file', src, dst, err);
              return resolve();
            }
            log.info(chalk.italic.yellow(copyMsg));
            return resolve();
          });
        })
        .catch((error) => {
          log.info(chalk.yellow(`Skipping plugin ${chalk.bold.yellow(pluginFileName)} for server ${chalk.bold.yellow(serverName)}:`), error.message);
          log.trace(error);
          return resolve();
        });
    });
  },
  preUpdateChecks(serverPath, pluginSourcePath) {
    return new Promise((resolve, reject) => {
      const pluginFileName = path.basename(pluginSourcePath);
      const serverPluginPath = path.join(serverPath, 'plugins', pluginFileName);


      // Retrieve plugin.yml as json for installed version and plugin update file
      Promise.all([
        // TODO: Do not get plugin for pluginSource every time.
        // Should only fetch this once when we discovered paths
        pluginInfo.getPluginInfo(serverPluginPath),
        pluginInfo.getPluginInfo(pluginSourcePath)])
        .then(([installed, update]) => {
          // Check if plugin name in plugin.yml matches (ignore case)
          if (installed.name.toLowerCase() !== update.name.toLowerCase()) {
            return reject(new Error(`File names match, but plugin names do not. Installed: ${installed.name}; Update: ${update.name}`));
          }

          // Compare version numbers of the plugin installed on the server and the update file
          const cmpResult = pluginInfo.comparePluginStrVersion(installed.version, update.version);

          // Same version
          if (cmpResult === 0) {
            return reject(new Error('Plugin version already installed'));
          }

          // Server already has a newer version of the plugin installed
          if (cmpResult === 1) {
            return reject(new Error(`Newer plugin version installed. Installed ${verInstalled}; Update: ${verUpdate}`));
          }

          // All checks passed
          return resolve();
        })
        .catch(reject);
    });
  },
  /**
   * Given either a directory of plugins or a directory of servers
   * @param {String} mode - Either 'server' or 'plugin'
   * @param {String} baseDir - Path to directory to search in
   * @returns {Promise<Array>} - Array of paths to plugins or servers
   */
  getPaths(mode, baseDir) {
    return new Promise((resolve, reject) => {
      log.debug('getPaths', mode);
      fs.readdir(baseDir, undefined, (error, files) => {
        if (error) {
          return reject(error);
        }
        log.debug('Directory contents', files);

        const checkPromises = [];

        // Iterate over all files in directory (can be directory or file)
        files.forEach((file) => {
          const fullPath = path.join(baseDir, file); // Construct path with filename
          checkPromises.push(this.checkPath(mode, fullPath));
        });

        // Wait for all paths to be processed, return array of valid paths for respective mode
        Promise.all(checkPromises)
          .then((paths) => {
            // Remove undefined fields (invalid paths)
            const cleanPaths = paths.filter(p => p);
            log.debug('paths', cleanPaths);
            resolve(cleanPaths);
          });
      });
    });
  },
  /**
   * Check path on if it's a server directory or plugin file (depending on mode)
   * @param {String} mode - Either 'server' or 'plugin'
   * @param {String} p - Full path to either server dir or plugin file
   * @returns {Promise<String|Undefined>} Either path to resource or undefined if invalid
   */
  checkPath(mode, p) {
    return new Promise((resolve) => {
      log.debug('checkPath', mode, p);
      fs.stat(p, (err, stat) => {
        if (err) {
          log.debug('Error while getting file stats for file, skipping', p);
          log.debug(err);
          resolve();
        } else if (mode === 'server' && stat.isDirectory()) {
          log.debug('Is directory', p);
          // Check if directory is valid server directory
          this.isServerDir(p)
            .then((isServer) => {
              if (isServer) {
                // resolve with valid server path
                log.debug('is server directory');
                resolve(p);
              } else {
                log.debug('Is no server directory');
                resolve();
              }
            });
        } else if (mode === 'plugin' && stat.isFile()) {
          log.debug('Is file', p);
          pluginInfo.isPluginFile(p)
            .then((isPlugin) => {
              if (isPlugin) {
                // resolve with valid plugin path
                log.debug('Is plugin file');
                resolve(p);
              } else {
                log.debug('Is no plugin file');
                resolve();
              }
            });
        } else {
          log.debug('Skipping out of scope file', p);
          resolve();
        }
      });
    });
  },
  /**
   * Checks if a given server has a given plugin file in its plugins directory
   * @param {String} serverPath - Server directory to check for plugin
   * @param {String} pluginName - Name of the plugin to check for (extension can be omitted)
   * @returns {Promise<Boolean>} - true if plugin is present, false otherwise
   */
  pluginInstalled(serverPath, pluginName) {
    log.debug('pluginInstalled', pluginName, serverPath);
    const pluginFile = pluginName.endsWith(global.pluginFileEnding)
      ? pluginName : `pluginName${global.pluginFileEnding}`;
    return this.pathExists(serverPath, 'plugins', pluginFile);
  },
  /**
   * Checks if a given path is a server directory
   * @param {String} serverPath
   * @async
   * @returns {Promise<Boolean>} true if directory is server, false otherwise
   */
  isServerDir(serverPath) {
    log.debug('isServerDir', serverPath);
    return this.pathExists(serverPath, 'plugins');
  },
  /**
   * Check if a given directory / file exists
   * @param {String} p - Path
   * @returns {Promise<any>} true if directory / file exists, false otherwise
   */
  pathExists(...p) {
    return new Promise((resolve) => {
      log.debug('pathExists', p);
      const cleanDir = path.join(...p);
      log.debug('Checking dir', cleanDir);
      fs.access(cleanDir, fs.constants.F_OK, err => resolve(!(err && err.code === 'ENOENT')));
    });
  },
};
