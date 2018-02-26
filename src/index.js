import chalk from 'chalk';

console.log(chalk.green('Hello, World!'));

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
