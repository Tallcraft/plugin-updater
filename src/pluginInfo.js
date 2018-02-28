import unzip from 'unzip';
import jsYAML from 'js-yaml';

import updater from './updater';

const fs = require('fs');
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

          // FIXME: Infinite loop if zip file is empty file
          const readStream = fs.createReadStream(pluginPath);

          readStream
            .pipe(unzip.Parse())
            .on('error', (err) => {
              global.DEBUG && log.debug('Stream error while reading plugin jar as zip', err);
              return reject(err);
            })
            .on('entry', (entry) => {
              const fileName = entry.path;
              const { type } = entry;
              if (type === 'File' && fileName === 'plugin.yml') {
                // Process plugin.yml
                global.DEBUG && log.debug('Found plugin.yml in plugin file', pluginPath);

                this.readPluginInfoFile(entry)
                  .catch((err) => {
                    readStream.destroy();
                    return reject(err);
                  })
                  .then((result) => {
                    readStream.destroy();
                    return resolve(result);
                  });
              }
              global.DEBUG && log.debug('-', fileName);
              entry.autodrain(); // If not found
            })
            // End of zip search
            .on('end', () => {
              reject(new Error('Could not find plugin.yml in plugin-file'));
            });
        });
    });
  },
  /**
   * Reads plugin.yml from stream and returns parsed JSON representation of the file
   * @param stream - ReadStream of plugin.yml
   * @returns {Promise<Object>} - parsed JSON representation of plugin.yml
   */
  readPluginInfoFile(stream) {
    return new Promise((resolve, reject) => {
      const chunks = []; // Used to collect file chunks as they are read

      stream.on('error', (err) => {
        global.DEBUG && log.debug('Stream error while reading plugin.yml file', err);
        return reject(err);
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
          } catch (err) {
            return reject(err);
          }
          return resolve(pluginJSON);
        }
        return reject(new Error('Plugin contains invalid plugin.yml file!'));
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
      updater.pathExists(pluginPath).then(resolve);
    });
  },
};

export default pluginInfo;
