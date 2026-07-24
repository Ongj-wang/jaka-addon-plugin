# JAKA AddOn Plugin

JAKA Addon Plugin Development Tool - Simplifies the creation, building, and management of JAKA robot AddOn projects.

## Features

- **Quick AddOn Project Creation** - Rapidly generate standard AddOn project structures via commands.
- **Configuration File Generation** - Automatically create and format .settings.json configuration files.
- **File Management** - Smart enable/disable file exclusion rules.
- **Build Support** - Supports building JAKA AddOn projects.
- **Dependency Management** - Download Python modules with smart version comparison, deduplication, and automatic upgrades.

## Usage

### Command List

Open the command palette with Ctrl+Shift+P and enter the following commands:

- `addon-plugin:make new addon` - Create a new AddOn plugin project.
- `addon-plugin:build addon` - Build the development version of the addon.
- `addon-plugin:make custom programs` - Build custom instructions.
- `addon-plugin:open scratch editor` - Open a visual Scratch-based block editor for creating command blocks.
- `addon-plugin:download requirements` - Download Python module dependencies. Supports multiple modules separated by spaces. Automatically compares versions, skips already up-to-date dependencies, and upgrades outdated ones.

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

Repository URL: https://github.com/Ongj-wang/jaka-addon-plugin.git
Report Issues: Through the repository's Issues page
