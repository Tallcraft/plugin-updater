import chalk from 'chalk';
import yargs from 'yargs';

import updater from './updater';
import pluginInfo from './pluginInfo';

global.DEBUG = true;
const log = console;

// TODO
/*
  Create Update folder if it doesnt exist
  Improve error handling
  Code Cleanup
  TODO: Show plugin versions while updating, compare plugin versions

  Nice to have
    Extract version information from plugins and warn / abort if plugin is newer / up to date
    Flag for resetting plugin config folder and / or config.yml
    Strip build numbers and other metadata in plugin file name.
      E.g. EssentialsX-3.4.5.jar => EssentialsX.jar
    Update mode: either copy to update folder or rename old jar to e.g. .old and place new jar
      directly in plugin folder
    Download plugin via url, then distribute
 */


function runUpdater(argv) {
  // Start updater with user args

  log.info(chalk.bold.underline.green('Starting updater.'));
  updater.run(argv)
    .then(() => {
      log.info(chalk.bold.underline.green('Updater finished successfully.'));
    })
    .catch((error) => {
      log.error(chalk.bold.red('Updater finished with errors.'));
      log.error(chalk.red(error));
    });
}

function runPluginInfo(argv) {

  let func;

  if(argv.version) {
    func = pluginInfo.getVersion;
  } else {
    func = pluginInfo.getPluginInfo;
  }
  // Start pluginInfo tool with user args
  func(argv.plugin)
    .catch((err) => {
      log.error('An error occured', err);
    })
    .then((version) => {
      log.info(chalk.bold.green('Plugin Info:'), version);
    });
}

// Setup app arguments using yargs

// FIXME: no output if no command provided
// FIXME: Issues with command parameters

const a = yargs
  .alias('help', 'h')
  .epilog('Created by Paul Zühlcke - pbz.im')
  .usage('<update|info>')
  .command('info <plugin>', 'Show information about a plugin file', (y) => {
    y.positional('plugin', {
      describe: 'Path to plugin file to fetch information for.',
      type: 'string',
    })
      .option('version', {
        alias: 'v',
        describe: 'Only show plugin version',
        type: Boolean,
      });
  }, runPluginInfo)
  .command(['update', 'u'], 'Update plugin/s on server/s', (y) => {
    y.usage('pupdater [-p plugin] [-s server] [-P plugin-dir] [-S server-dir]')
      .option('plugin', {
        alias: 'p',
        describe: 'Plugin file',
        type: 'string',
      })
      .option('server', {
        alias: 's',
        describe: 'Server directory',
        type: 'string',
      })
      .option('plugin-dir', {
        alias: 'P',
        describe: 'Directory with plugin files.',
        type: 'string',
      })
      .option('server-dir', {
        alias: 'S',
        describe: 'Directory holding server directories',
        type: 'string',
      })
      .option('update-folder', {
        default: 'update',
        describe: 'Plugin update folder name (in server plugin directory)',
        type: 'string',
      })
      .option('simulate', {
        default: false,
        describe: 'Only print copy operations, do not execute.',
        type: Boolean,
      })
      .check((a) => {
      // Check if we have at least one of the server and one of the plugin path options
        if (!(a.server || a.serverDir)) {
          throw new Error('Missing server path. Provide either --server or --server-dir.');
        }

        if (!(a.plugin || a.pluginDir)) {
          throw new Error('Missing plugin path. Provide either --plugin or --plugin-dir');
        }

        return true;
      });
  }, runUpdater).argv;

