# JAKA AddOn Plugin

JAKA Addon 插件开发工具 - 用于简化 JAKA 机器人 AddOn 项目的创建、构建和管理

## 功能特性

- **快速创建 AddOn 项目** - 通过命令快速生成标准的 AddOn 项目结构
- **配置文件生成** - 自动创建并格式化 .settings.json 配置文件
- **文件管理** - 智能启用/禁用文件排除规则
- **构建支持** - 支持 JAKA AddOn 项目的构建
- **复制模块** - 添加 python 模块支持

## 使用方法

### 命令列表

通过 `Ctrl+Shift+P` 打开命令面板，输入以下命令：

- `addon-plugin:format settings.json` - 生成并格式化 .settings.json 配置文件
- `addon-plugin:enableFilesExclude` - 启用文件排除规则
- `addon-plugin:disableFilesExclude` - 禁用文件排除规则
- `addon-plugin:enableAddonFilesExclude` - 启用控制器环境中的 addon 文件排除规则
- `addon-plugin:make new addon` - 创建一个 AddOn 插件项目
- `addon-plugin:build addon` - 构建开发版 addon
- `addon-plugin:make custom porgrams` - 构建自定义指令
- `addon-plugin:build release addon` - 构建发布版 addon
- `addon-plugin:add anti module` - 添加 python 辅助开放模组

### 快速开始

1. 打开您的 JAKA AddOn 项目文件夹
2. 按 `Ctrl+Shift+P` 打开命令面板
3. 输入 `addon-plugin:make new addon` 创建新的 AddOn 项目
4. 根据需要使用其他功能

## 配置

（如果有配置项的话）

## 贡献

欢迎提交 Issue 和 Pull Request 来改进此插件。

## 许可证

MIT License

## 支持

- 仓库地址: https://gitee.com/wanghonejie/auto-settings-generator.git
- 提交问题: 通过仓库的 Issues 页面
