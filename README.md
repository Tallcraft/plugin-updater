# Plugin Updater
Updater for Spigot / Bukkit servers. Can automatically detect on which servers plugins are installed
and supports bulk operations.
Written in NodeJS, fully async for performance. Bundled in one binary with no dependencies.

Version 1 has just been released and it's not perfect yet. Bugfixes and features to come.

[Download](https://github.com/Tallcraft/plugin-updater/releases)

## A Common Use Case
You have several servers which share some of their plugins, e.g. `NoCheatPlus`. Instead of copying
plugin updates over one by one you can run:
```
pupdater update -S servers/ -P plugins/
```
The application will automatically copy the plugins from `plugins/` to your server
directories after performing some sanity checks, such as:
 - Does the server have the plugin installed?
 - Is the plugin file valid?
 - Is the plugin file a newer version than the one installed?

## Screenshots
![screenshot](screenshot1.png)

### Update command
![screenshot](screenshot2.png)