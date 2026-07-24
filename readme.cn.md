# JAKA AddOn Plugin

JAKA Addon 插件开发工具 - 用于简化 JAKA 机器人 AddOn 项目的创建、构建和管理

## 功能特性

- **快速创建 AddOn 项目** - 通过命令快速生成标准的 AddOn 项目结构
- **配置文件生成** - 自动创建并格式化 .settings.json 配置文件
- **文件管理** - 智能启用/禁用文件排除规则
- **构建支持** - 支持 JAKA AddOn 项目的构建
- **依赖管理** - 智能下载 Python 依赖模块，支持版本比较、去重和自动升级

## 使用方法

### 命令列表

通过 `Ctrl+Shift+P` 打开命令面板，输入以下命令：

- `addon-plugin:make new addon` - 创建一个 AddOn 插件项目
- `addon-plugin:build addon` - 构建开发版 addon
- `addon-plugin:make custom porgrams` - 构建自定义指令
- `addon-plugin:open scratch editor` - 打开基于 Scratch 的可视化积木编辑器，用于创建指令块
- `addon-plugin:download requirements` - 下载依赖模组，支持空格分隔输入多个模块名，自动比较版本，已存在且版本相同则跳过，版本过旧则自动升级替换

### 快速开始

1. 打开您的 JAKA AddOn 项目文件夹
2. 按 `Ctrl+Shift+P` 打开命令面板
3. 输入 `addon-plugin:make new addon` 创建新的 AddOn 项目
4. 根据需要使用其他功能

## 贡献

欢迎提交 Issue 和 Pull Request 来改进此插件。

## 许可证

MIT License

## 支持

- 仓库地址: https://github.com/Ongj-wang/jaka-addon-plugin.git
- 提交问题: 通过仓库的 Issues 页面
