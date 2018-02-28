import yauzl from 'yauzl';
import jsYAML from 'js-yaml';

import updater from './updater';

const path = require('path');

const log = console;


const pluginInfo = {
  /**
   * Get version number from plugin file
   * @param {String} pluginPath - Path to plugin file
   * @returns {Promise<String>} - Semantic version number string
   */
  getVersion(pluginPath) {
    return new Promise((resolve, reject) => {
      this.getPluginInfo(pluginPath)
        .catch(() => reject)
        .then(info => resolve(info.version));
    });
  },
  /**
   * Reads plugin file, extracts plugin.yml and returns contents as json object
   * @param pluginPath
   * @returns {Object} - JSON Object representing plugin YAML file
   */
  getPluginInfo(pluginPath) {
    return new Promise((resolve, reject) => {
      this.isPluginFile(pluginPath)
        .then((isPlugin) => {
          if (!isPlugin) {
            return reject(new Error('Path holds no valid plugin file'));
          }

          global.DEBUG && log.debug('Plugin file is existing, moving on.');

          // Extract version info

          // Stream plugin archive contents
          yauzl.open(pluginPath, { lazyEntries: true }, (zipError, zipfile) => {
            if (zipError) {
              global.DEBUG && log.debug('Error while opening plugin file as zip', zipError);
              return reject(new Error('Error while reading plugin file. Is it a valid archive?'));
            }
            // Opened successfully, read first file
            zipfile.readEntry();
            zipfile
              .on('entry', (entry) => {
                const { fileName } = entry;

                // Skip directories and other files (not plugin info file)
                if (/\/$/.test(fileName) || fileName !== 'plugin.yml') {
                  global.DEBUG && log.debug('-', fileName);
                  // Continue with next file
                  return zipfile.readEntry();
                }

                // Process plugin.yml
                global.DEBUG && log.debug('Found plugin.yml in plugin file', pluginPath);

                return this.readPluginInfoFile(zipfile, entry)
                  .catch(err => reject(err))
                  .then(result => resolve(result));
              })
              // End of zip search
              .on('end', () => {
                reject(new Error('Could not find plugin.yml in plugin-file'));
              });
          });
        });
    });
  },
  /**
   * Reads plugin.yml from stream and returns parsed JSON representation of the file
   * @returns {Promise<Object>} - parsed JSON representation of plugin.yml
   * @param {Object} zipfile - Object representing plugin archive
   * @param {Object} entry - Object representing plugin.yml in plugin archive
   */
  readPluginInfoFile(zipfile, entry) {
    return new Promise((resolve, reject) => {
      const chunks = []; // Used to collect file chunks as they are read

      zipfile.openReadStream(entry, (err, stream) => {
        if (err) {
          return reject(err);
        }

        stream.on('error', (streamError) => {
          global.DEBUG && log.debug('Stream error while reading plugin.yml file', streamError);
          return reject(streamError);
        });
        stream.on('data', (chunk) => {
          chunks.push(chunk.toString());
        });
        // End of plugin.yml read
        stream.on('end', () => {
          const pluginStr = chunks.join('');
          if (pluginStr && pluginStr.length > 0) {
            global.DEBUG && log.debug('Converted to string', pluginStr);

            // YAML Parse and resolve
            let pluginJSON;
            try {
              pluginJSON = jsYAML.safeLoad(pluginStr);
            } catch (e) {
              global.DEBUG && log.debug('Error while parsing YAML', e);
              return reject(new Error('Error while parsing plugin.yml file.'));
            }
            return resolve(pluginJSON);
          }
          return reject(new Error('Plugin contains invalid plugin.yml file!'));
        });
      });
    });
  },
  /**
   * Checks if a given path holds a plugin file
   * @param {String} pluginPath
   * @async
   * @returns {Promise<Boolean>} true if file is plugin and exists, false otherwise
   */
  isPluginFile(pluginPath) {
    return new Promise((resolve) => {
      global.DEBUG && log.debug('isPluginFile', pluginPath);
      // Plugins must have file ending jar
      global.DEBUG && log.debug('Checking file extension', pluginPath);
      if (path.extname(pluginPath) !== global.pluginFileEnding) {
        global.DEBUG && log.debug('Invalid plugin file extension');
        return resolve(false);
      }
      // Extension valid
      // Does the plugin file exist?
      return updater.pathExists(pluginPath).then(resolve);
    });
  },
};

export default pluginInfo;
