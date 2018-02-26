import chalk from 'chalk';

const log = console;
const fs = require('fs');
const path = require('path');

// File ending to validate / detect plugin files
const pluginFileEnding = '.jar';


export default {
  /**
   * Run updater tasks
   * @param argv - User arguments
   */
  run(argv) {
    return new Promise((resolve, reject) => {
      log.debug('Running updater with args', argv);

      if (argv.simulate) {
        log.info(chalk.bold.blue('Simulation: All copy operations will be printed only'));
      }

      // Fill server/plugin path arrays for update tasks

      Promise.all([
        new Promise((res, rej) => {
          if (argv.server) {
            return res([argv.server]);
          }
          return this.getPaths('server', argv.serverDir)
            .catch(rej)
            .then(s => res(s));
        }),

        new Promise((res, rej) => {
          if (argv.plugin) {
            return res([argv.plugin]);
          }
          return this.getPaths('plugin', argv.pluginDir)
            .catch(rej)
            .then(p => res(p));
        })])
        .catch((error) => {
          log.error(error);
          return reject(new Error('Error while processing server / plugin path'));
        })
        .then(([servers, plugins]) => {
          if (servers.length === 0) {
            return reject(new Error('No Server/s found. Check your server argument.'));
          }

          if (plugins.length === 0) {
            return reject(new Error('No Plugin/s found. Check your plugin argument.'));
          }

          // Arrays filled, call update method for every plugin / server dir
          log.info(chalk.bold('Servers'), servers);
          log.info(chalk.bold('Plugins'), plugins);

          const updatePromises = [];

          plugins.forEach((pluginPath) => {
            servers.forEach((serverPath) => {
              updatePromises.push(this.updatePlugin(serverPath, pluginPath, argv.simulate));
            });
          });

          // Once all update operations are done resolve
          return Promise.all(updatePromises)
            .then(resolve);
        });
    });
  },
  /**
   * Copy plugin to update folder of server
   * @param {String} serverPath - Path to server folder
   * @param {String} pluginPath - Path to plugin file
   * @param {Boolean} simulate - Only print copy operations, do not run
   * @returns {Promise} - Resolves when operation has finished
   */
  updatePlugin(serverPath, pluginPath, simulate = false) {
    return new Promise((resolve) => {
      log.debug('updatePlugin', serverPath, pluginPath, simulate);

      const pluginFileName = path.basename(pluginPath);

      this.pluginInstalled(serverPath, pluginFileName)
        .then((isInstalled) => {
          if (!isInstalled) {
            log.debug('Plugin is not installed. Abort');
            return resolve();
          }
          log.debug('Plugin is installed. Update');

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
            }
            log.info(chalk.italic.yellow(copyMsg));
            return resolve();
          });
        });
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
          this.isPluginFile(p)
            .then((isPlugin) => {
              if (isPlugin) {
                // resolve with valid plugin path
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
    const pluginFile = pluginName.endsWith(pluginFileEnding)
      ? pluginName : `pluginName${pluginFileEnding}`;
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
   * Checks if a given path holds a plugin file
   * @param {String} pluginPath
   * @async
   * @returns {Promise<Boolean>} true if file is plugin and exists, false otherwise
   */
  isPluginFile(pluginPath) {
    log.debug('isPluginFile', pluginPath);
    return new Promise((resolve) => {
      // Plugins must have file ending jar
      log.debug('Checking file extension', pluginPath);
      if (path.extname(pluginPath) !== pluginFileEnding) {
        log.debug('Invalid plugin file extension');
        return resolve(false);
      }
      // Extension valid
      // Does the plugin file exist?
      return this.pathExists(pluginPath).then(resolve);
    });
  },
  /**
   * Check if a given directory / file exists
   * @param {String} p - Path
   * @returns {Promise<any>} true if directory / file exists, false otherwise
   */
  pathExists(...p) {
    log.debug('pathExists', p);
    return new Promise((resolve) => {
      const cleanDir = path.join(...p);
      log.debug('Checking dir', cleanDir);
      fs.access(cleanDir, fs.constants.F_OK, err => resolve(!err));
    });
  },
};
