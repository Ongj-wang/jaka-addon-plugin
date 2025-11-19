import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand('extension.generateSettingsJson', async () => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('请先打开一个工作区（Workspace）');
            return;
        }

        const rootPath = workspaceFolders[0].uri.fsPath;
        const vscodeFolder = path.join(rootPath, '.vscode');
        const settingsPath = path.join(vscodeFolder, 'settings.json');

        // 确保 .vscode 目录存在
        if (!fs.existsSync(vscodeFolder)) {
            fs.mkdirSync(vscodeFolder);
        }

        // 默认配置内容（可自定义）
        const defaultSettings = {
            "jaka-jks":{"jks-version":1.0},
            "[json]": {"editor.defaultFormatter": "esbenp.prettier-vscode"},
            "[python]": {"editor.defaultFormatter": "charliermarsh.ruff"},
            // "[xml]": {"editor.defaultFormatter": "redhat.vscode-xml"},
            "[javascript]": {"editor.defaultFormatter": "esbenp.prettier-vscode"},
            "[typescript]": {"editor.defaultFormatter": "esbenp.prettier-vscode"},
            "[css]": {"editor.defaultFormatter": "esbenp.prettier-vscode"},
            "editor.formatOnSave": true,
            "editor.codeActionsOnSave": {            
                "source.convertImportFormat": "always",
                "source.fixAll": "always",
                "source.fixAll.eslint": "always",
                "source.fixAll.markdownlint": "always",
                "source.fixAll.pylance": "always",
                "source.fixAll.ruff": "always",
                "source.organizeImports": "always",
                "source.organizeImports.ruff": "always",
                "source.organizeLinkDefinitions": "always",
                "source.sort.json": "always",
                "source.unusedImports": "never"
            },
                "files.exclude": {
                    "**/.git": true,
                    "**/.svn": true,
                    "**/.hg": true,
                    "**/.DS_Store": true,
                    "**/Thumbs.db": true,
                    "**/__pychace__":true,
                    "**/**.pyc":true,
                    ".python-version": true,
                    ".venv": true,
                    "uv.lock": true,
                }

        };

        // 如果文件已存在，询问是否覆盖
        if (fs.existsSync(settingsPath)) {
            try {
                // 读取现有配置
                const existingContent = fs.readFileSync(settingsPath, 'utf8');
                let existingSettings = {};
                
                // 如果文件不为空且是有效的JSON，解析它
                if (existingContent.trim()) {
                    try {
                        existingSettings = JSON.parse(existingContent);
                    } catch (parseError) {
                        vscode.window.showErrorMessage('现有 settings.json 文件不是有效的 JSON 格式');
                        return;
                    }
                }
                
                // 合并配置（新配置会覆盖同名的旧配置）
                const mergedSettings = { ...existingSettings, ...defaultSettings };
                
                // 写入合并后的配置
                fs.writeFileSync(settingsPath, JSON.stringify(mergedSettings, null, 4));
                vscode.window.showInformationMessage('.vscode/settings.json 配置已更新');
            } catch (err) {
                vscode.window.showErrorMessage(`更新文件失败: ${err}`);
            }
        }else{
            // 文件不存在，创建新文件
            try {
                fs.writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 4));
                vscode.window.showInformationMessage('.vscode/settings.json 已生成');
            } catch (err) {
                vscode.window.showErrorMessage(`写入文件失败: ${err}`);
            }
        }
            
    });

    // 添加启用 files.exclude 的命令（支持参数）
    const enableFilesExclude = vscode.commands.registerCommand('extension.enableFilesExclude', async (specificItems?: string[]) => {
        updateFilesExclude(true, specificItems);
    });

    // 添加禁用 files.exclude 的命令（支持参数）
    const disableFilesExclude = vscode.commands.registerCommand('extension.disableFilesExclude', async (specificItems?: string[]) => {
        updateFilesExclude(false, specificItems);
    });

    // 添加AddOn的files.excluded的命令
    const enableAddOnFilesExclude = vscode.commands.registerCommand('extension.enableAddOnFilesExclude', async () => {
        updateFilesExclude(true,["settings.js",".config.**","node_modules",".AddOn.json.backup","customprograms","lib","package.json"]);
    });

    context.subscriptions.push(disposable);
    context.subscriptions.push(enableFilesExclude);
    context.subscriptions.push(disableFilesExclude);
    context.subscriptions.push(enableAddOnFilesExclude);
}

// 更新 files.exclude 设置的辅助函数（支持指定特定项）
async function updateFilesExclude(enabled: boolean, specificItems?: string[]) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('请先打开一个工作区（Workspace）');
        return;
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    const vscodeFolder = path.join(rootPath, '.vscode');
    const settingsPath = path.join(vscodeFolder, 'settings.json');

    // 检查 settings.json 是否存在
    if (!fs.existsSync(settingsPath)) {
        vscode.window.showErrorMessage('.vscode/settings.json 文件不存在，请先生成配置文件');
        return;
    }

    try {
        // 读取现有配置
        const existingContent = fs.readFileSync(settingsPath, 'utf8');
        if (!existingContent.trim()) {
            vscode.window.showErrorMessage('.vscode/settings.json 文件为空');
            return;
        }

        const settings = JSON.parse(existingContent);

        // 检查是否存在 files.exclude 配置
        if (!settings.hasOwnProperty('files.exclude')) {
            vscode.window.showErrorMessage('.vscode/settings.json 中没有找到 files.exclude 配置');
            return;
        }

        // 获取当前 files.exclude 配置
        const filesExclude = settings['files.exclude'];

        // 如果提供了特定项，则只更新这些项；否则更新所有项
        if (specificItems && Array.isArray(specificItems) && specificItems.length > 0) {
            // 检查指定的项是否存在
            const notFoundItems: string[] = [];
            for (const item of specificItems) {
                if (!filesExclude.hasOwnProperty(item)) {
                    notFoundItems.push(item);
                } else {
                    filesExclude[item] = enabled;
                }
            }
            
            if (notFoundItems.length > 0) {
                vscode.window.showWarningMessage(`以下项在 files.exclude 中未找到: ${notFoundItems.join(', ')}`);
            }
        } else {
            // 更新 files.exclude 中每个项的状态
            for (const key in filesExclude) {
                filesExclude[key] = enabled;
            }
        }

        // 写入更新后的配置
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 4));
        
        vscode.window.showInformationMessage(
            enabled 
                ? specificItems && specificItems.length > 0 
                    ? `files.exclude 中的指定项已启用: ${specificItems.join(', ')}` 
                    : 'files.exclude 所有项已启用'
                : specificItems && specificItems.length > 0 
                    ? `files.exclude 中的指定项已禁用: ${specificItems.join(', ')}` 
                    : 'files.exclude 所有项已禁用'
        );
    } catch (err) {
        vscode.window.showErrorMessage(`操作失败: ${err}`);
    }
}

export function deactivate() {}