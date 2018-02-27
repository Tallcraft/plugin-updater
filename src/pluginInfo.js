import unzip from 'unzip';
import jsYAML from 'js-yaml';

import updater from './updater';

const fs = require('fs');

const log = console;

export default {
  /**
   * Get version number from plugin file
   * @param {String} pluginPath - Path to plugin file
   * @returns {Promise<String>} - Semantic version number string
   */
  getVersion(pluginPath) {
    return new Promise((resolve, reject) => {
      this.getPluginInfo(pluginPath)
        .catch(() => reject)
        .then((pluginInfo) => {
          resolve(pluginInfo.version);
        });
    });
  },
  /**
   * Reads plugin file, extracts plugin.yml and returns contents as json object
   * @param pluginPath
   * @returns {Object} - JSON Object representing plugin YAML file
   */
  getPluginInfo(pluginPath) {
    return new Promise((resolve, reject) => {
      updater.isPluginFile(pluginPath) // TODO: Could be moved to this file once ready
        .then((isPlugin) => {
          if (!isPlugin) {
            return reject(new Error('Path holds no valid plugin file'));
          }

          // Extract version info

          // Chunks of string for building yaml file str
          const chunks = [];

          fs.createReadStream(pluginPath)
            .pipe(unzip.Parse())
            .on('entry', (entry) => {
              const { fileName, type } = entry;
              if (type === 'File' && fileName === 'plugin.yml') {
                // Process plugin.yml
                global.DEBUG && log.debug('Found plugin.yml in plugin file', pluginPath);

                entry.on('data', (chunk) => {
                  chunks.push(chunk.toString());
                });
                // End of plugin.yml read
                entry.on('end', () => {
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
              }
              entry.autodrain(); // If not found
            })
            // End of zip search
            .on('end', () => {
              reject(new Error('Could not find plugin.yml in plugin-file'));
            });
        });
    });
  },
};
