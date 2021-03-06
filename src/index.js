import chalk from 'chalk';
import yargs from 'yargs';
import loglevel from 'loglevel';

import updater from './updater';
import pluginInfo from './pluginInfo';

// File ending to validate / detect plugin files
global.pluginFileEnding = '.jar';
const epilog = 'Created by Paul Zühlcke - pbz.im';

const log = loglevel;
// Collect loggers from other components in array
const loggers = [log, log.getLogger('info'), log.getLogger('update')];

// TODO
/*
  Create Update folder if it doesn't exist
  Code Cleanup
  TODO: Show plugin versions while updating

  Nice to have
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
      log.error(chalk.red(error.message));
      log.trace(error);
    });
}

function runPluginInfo(argv) {
  // Start pluginInfo tool with user args
  pluginInfo.getPluginInfo(argv.plugin)
    .then((info) => {
      if (argv.ver) {
        // only show version number
        log.info(info.version);
      } else {
        log.info(log.info(chalk.bold.green('Plugin Info:'), info));
      }
    })
    .catch((err) => {
      log.error(chalk.bold.red('An error occured'), err.message);
      log.trace(err);
    });
}

// Setup app arguments using yargs

// eslint-disable-next-line prefer-destructuring
const argv = yargs
  .alias('help', 'h')
  .option('debug', {
    describe: 'Print debug messages',
    type: 'boolean',
  })
  .epilog(epilog)
  .usage('<update|info>')
  .command('*', '', {}, () => { log.info('No mode selected. Try --help'); })
  .command('info <plugin>', 'Show information about a plugin file', (y) => {
    y.usage('pupdater info <plugin> [-v]')
      .positional('plugin', {
        describe: 'Path to plugin file to fetch information for.',
        type: 'string',
      })
      .option('ver', {
        describe: 'Only show plugin version',
        type: 'boolean',
      })
      .epilog(epilog);
  }, runPluginInfo)
  .command(['update', 'u'], 'Update plugin/s on server/s', (y) => {
    y.usage('pupdater update [-p plugin] [-s server] [-P plugin-dir] [-S server-dir]')
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
        type: 'boolean',
      })
      .option('skip-checks', {
        default: false,
        describe: 'Force plugin update. Skips sanity checks such as version comparison' +
        'and installed check.',
        type: 'boolean',
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
      })
      .epilog(epilog);
  }, runUpdater)
  .argv;

if (argv.debug) {
  loggers.forEach(logger => logger.setLevel('DEBUG'));
} else {
  loggers.forEach(logger => logger.setLevel('INFO'));
}
log.debug('Set log levels');

