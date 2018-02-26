import chalk from 'chalk';

const log = console;
const fs = require('fs');
const path = require('path');


export default {
  /**
   * Run updater tasks
   * @param argv - User arguments
   */
  run(argv) {
    log.debug('Running updater with args', argv);


    // Fill arrays

    Promise.all([

      new Promise((resolve) => {
        if (argv.server) {
          return resolve([argv.server]);
        }
        this.getPaths('server', argv.serverDir)
          .then(s => resolve(s));
      }),

      new Promise((resolve) => {
        if (argv.plugin) {
          return resolve([argv.plugin]);
        }
        this.getPaths('plugin', argv.pluginDir)
          .then(p => resolve(p));
      })])

      .then(([servers, plugins]) => {
      // Arrays filled, call update method for every plugin / server dir
        log.info(chalk.bold('Servers'), servers);
        log.info(chalk.bold('Plugins'), plugins);

        const updatePromises = [];

        plugins.forEach((pluginPath) => {
          servers.forEach((serverPath) => {
            updatePromises.push(this.updatePlugin(serverPath, pluginPath));
          });
        });

        Promise.all(updatePromises)
          .then(() => {
            log.info(chalk.bold.green('Update done'));
          });
      });
  },
  updatePlugin(serverPath, pluginPath) {
    return new Promise((resolve) => {
      log.debug('updatePlugin', serverPath, pluginPath);
      // TODO: Start file operations

      this.pluginInstalled(serverPath, path.basename(pluginPath))
        .then((isInstalled) => {
          if (isInstalled) {
            log.debug('Plugin is installed');
          } else {
            log.debug('Plugin is not installed');
          }
          resolve();
        });
    });
  },
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
    const pluginFile = pluginName.endsWith('.jar') ? pluginName : `${pluginName}.jar`;
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
      if (path.extname(pluginPath) !== '.jar') {
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
