import chalk from 'chalk';
import yargs from 'yargs';

const logger = console;

// TODO
/*
  Specs
    Single file or directory with jar plugin files to update
    Destination servers either all in subdir or list of paths
    Validate if folder contains server
    Copy new plugins to <server>/plugins/update (Create folder if not existing)

  Nice to have
    Extract version information from plugins and warn / abort if plugin is newer / up to date
    Flag for resetting plugin config folder and / or config.yml
    Strip build numbers and other metadata in plugin file name.
      E.g. EssentialsX-3.4.5.jar => EssentialsX.jar
 */


// TODO Set up app arguments using yargs

const argv = yargs
  .usage('$0 -p [plugin(-dir)] -s [server-dir]')
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
    describe: 'Directory of with plugin files.',
    type: 'string',
  })
  .option('server-dir', {
    alias: 'S',
    describe: 'Directory holding server directories',
    type: 'string',
  })
  .alias('help', 'h')
  .epilog('Created by Paul Zühlcke - pbz.im')
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
  .argv;

logger.info(chalk.green('Ready!'));
