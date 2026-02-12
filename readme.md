# JAKA AddOn Plugin

JAKA Addon Plugin Development Tool - Simplifies the creation, building, and management of JAKA robot AddOn projects.

## Features

- **Quick AddOn Project Creation** - Rapidly generate standard AddOn project structures via commands.
- **Configuration File Generation** - Automatically create and format .settings.json configuration files.
- **File Management** - Smart enable/disable file exclusion rules.
- **Build Support** - Supports building JAKA AddOn projects.
- **Module Copying** - Adds Python module support.

## Usage

### Command List

Open the command palette with Ctrl+Shift+P and enter the following commands:

- `addon-plugin:format settings.json` - Generate and format the .settings.json configuration file.
- `addon-plugin:enableFilesExclude` - Enable file exclusion rules.
- `addon-plugin:disableFilesExclude` - Disable file exclusion rules.
- `addon-plugin:enableAddonFilesExclude` - Enable addon file exclusion rules in the controller environment.
- `addon-plugin:make new addon` - Create a new AddOn plugin project.
- `addon-plugin:build addon` - Build the development version of the addon.
- `addon-plugin:make custom programs` - Build custom instructions.
- `addon-plugin:build release addon` - Build the release version of the addon.
- `addon-plugin:add anti module` - Add Python auxiliary open modules.

### Quick Start

1. Open your JAKA AddOn project folder.
2. Press Ctrl+Shift+P to open the command palette.
3. Enter addon-plugin:make new addon to create a new AddOn project.
4. Use other features as needed.

## Contributing

Feel free to submit Issues and Pull Requests to improve this plugin.

## License

MIT License

## Support

Repository URL: https://gitee.com/wanghonejie/auto-settings-generator.git
Report Issues: Through the repository's Issues page
