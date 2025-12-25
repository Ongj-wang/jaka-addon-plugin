import * as fs from "fs";
import * as path from "path";
import * as tar from "tar";
import * as vscode from "vscode";
import { drawCommandBlock } from "./CommendGenerte";
import { buildAddon, release_build } from "./buildMethods";

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    "extension.generateSettingsJson",
    async () => {
      initSettingsJson();
    }
  );
  // 添加启用 files.exclude 的命令（支持参数）
  const enableFilesExclude = vscode.commands.registerCommand(
    "extension.enableFilesExclude",
    async (specificItems?: string[]) => {
      updateFilesExclude(true, specificItems);
    }
  );

  // 添加禁用 files.exclude 的命令（支持参数）
  const disableFilesExclude = vscode.commands.registerCommand(
    "extension.disableFilesExclude",
    async (specificItems?: string[]) => {
      updateFilesExclude(false, specificItems);
    }
  );

  // 添加AddOn的files.excluded的命令
  const enableAddonFilesExclude = vscode.commands.registerCommand(
    "extension.enableAddonFilesExclude",
    async () => {
      updateFilesExclude(true, [
        "settings.js",
        ".config.**",
        "node_modules",
        ".AddOn.json.backup",
        "customprograms",
        "lib",
        "package.json",
      ]);
    }
  );

  // 添加python addon框架命令
  const addonFramework = vscode.commands.registerCommand(
    "extension.CreatePyaddon",
    async () => {
      initAddonFramework(context);
    }
  );

  // 创建addon包命令
  const buildAddonPackage = vscode.commands.registerCommand(
    "extension.buildAddon",
    async () => {
      // 检查是否有自定义指令配置文件
      const addonProFiles = await findAddonProFiles("**/*.addonpro");
      if (addonProFiles.length > 0) {
        await make_custom_porgrams();
      }
      buildAddon();
    }
  );

  //
  const MakeCustomPorgrams = vscode.commands.registerCommand(
    "extension.MakeCustomPorgrams",
    async () => {
      make_custom_porgrams();
    }
  );

  const BuildRelaseAddon = vscode.commands.registerCommand(
    "extension.BuildRelaseAddon",
    async () => {
      await release_build();
    }
  );
  context.subscriptions.push(disposable);
  context.subscriptions.push(enableFilesExclude);
  context.subscriptions.push(disableFilesExclude);
  context.subscriptions.push(
    enableAddonFilesExclude,
    addonFramework,
    buildAddonPackage,
    MakeCustomPorgrams,
    BuildRelaseAddon
  );
}

// 初始化settings.json的辅助函数
async function initSettingsJson() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage("请先打开一个工作区（Workspace）");
    return;
  }

  const rootPath = workspaceFolders[0].uri.fsPath;
  const vscodeFolder = path.join(rootPath, ".vscode");
  const settingsPath = path.join(vscodeFolder, "settings.json");

  // 确保 .vscode 目录存在
  if (!fs.existsSync(vscodeFolder)) {
    fs.mkdirSync(vscodeFolder);
  }

  // 默认配置内容（可自定义）
  const defaultSettings = {
    "jaka-jks": { "jks-version": 1.0 },
    "[json]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
    "[python]": { "editor.defaultFormatter": "charliermarsh.ruff" },
    "[xml]": { "editor.defaultFormatter": "redhat.vscode-xml" },
    "[javascript]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
    "[typescript]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
    "[css]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
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
      "source.unusedImports": "never",
    },
    "files.exclude": {
      "**/.git": true,
      "**/.svn": true,
      "**/.hg": true,
      "**/.DS_Store": true,
      "**/Thumbs.db": true,
      "**/__pycache__": true,
      "**/**.pyc": true,
      ".python-version": true,
      ".venv": true,
      "uv.lock": true,
    },
  };

  // 如果文件已存在，询问是否覆盖
  if (fs.existsSync(settingsPath)) {
    try {
      // 读取现有配置
      const existingContent = fs.readFileSync(settingsPath, "utf8");
      let existingSettings = {};

      // 如果文件不为空且是有效的JSON，解析它
      if (existingContent.trim()) {
        try {
          existingSettings = JSON.parse(existingContent);
        } catch (parseError) {
          return;
        }
      }

      // 深度合并配置，只更新缺失的部分
      const mergedSettings = deepMergeSettings(
        defaultSettings,
        existingSettings
      );

      // 写入合并后的配置
      fs.writeFileSync(settingsPath, JSON.stringify(mergedSettings, null, 4));
      vscode.window.showInformationMessage(".vscode/settings.json 配置已更新");
    } catch (err) {
      vscode.window.showErrorMessage(`更新文件失败: ${err}`);
    }
  } else {
    // 文件不存在，创建新文件
    try {
      fs.writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 4));
      vscode.window.showInformationMessage(".vscode/settings.json 已生成");
    } catch (err) {
      vscode.window.showErrorMessage(`写入文件失败: ${err}`);
    }
  }
}
/**
 * 深度合并两个配置对象，只在目标对象缺失相应键时才添加默认值
 * @param defaultSettings 默认配置
 * @param existingSettings 现有配置
 * @returns 合并后的配置
 */
function deepMergeSettings(defaultSettings: any, existingSettings: any): any {
  const result = { ...existingSettings };

  for (const key in defaultSettings) {
    if (defaultSettings.hasOwnProperty(key)) {
      // 如果现有配置中没有这个键，则使用默认值
      if (!existingSettings.hasOwnProperty(key)) {
        result[key] = defaultSettings[key];
      }
      // 如果两个值都是对象且不是数组，则深度合并
      else if (
        typeof defaultSettings[key] === "object" &&
        typeof existingSettings[key] === "object" &&
        defaultSettings[key] !== null &&
        existingSettings[key] !== null &&
        !Array.isArray(defaultSettings[key]) &&
        !Array.isArray(existingSettings[key])
      ) {
        result[key] = deepMergeSettings(
          defaultSettings[key],
          existingSettings[key]
        );
      }
      // 对于其他情况，保留现有配置的值
    }
  }

  return result;
}

// 更新 files.exclude 设置的辅助函数（支持指定特定项）
async function updateFilesExclude(enabled: boolean, specificItems?: string[]) {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage("请先打开一个工作区（Workspace）");
    return;
  }

  const rootPath = workspaceFolders[0].uri.fsPath;
  const vscodeFolder = path.join(rootPath, ".vscode");
  const settingsPath = path.join(vscodeFolder, "settings.json");

  initSettingsJson();

  try {
    // 读取现有配置
    const existingContent = fs.readFileSync(settingsPath, "utf8");
    if (!existingContent.trim()) {
      vscode.window.showErrorMessage(".vscode/settings.json 文件为空");
      return;
    }

    const settings = JSON.parse(existingContent);

    // 检查是否存在 files.exclude 配置
    if (!settings.hasOwnProperty("files.exclude")) {
      vscode.window.showErrorMessage(
        ".vscode/settings.json 中没有找到 files.exclude 配置"
      );
      return;
    }

    // 获取当前 files.exclude 配置
    const filesExclude = settings["files.exclude"];

    // 如果提供了特定项，则只更新这些项；否则更新所有项
    if (
      specificItems &&
      Array.isArray(specificItems) &&
      specificItems.length > 0
    ) {
      // 检查指定的项是否存在
      //   const notFoundItems: string[] = [];
      for (const item of specificItems) {
        //     if (!filesExclude.hasOwnProperty(item)) {
        //       notFoundItems.push(item);
        //     } else {
        filesExclude[item] = enabled;
        //     }
      }

      //   if (notFoundItems.length > 0) {
      //     vscode.window.showWarningMessage(
      //       `以下项在 files.exclude 中未找到: ${notFoundItems.join(", ")}`
      //     );
      //   }
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
          ? `files.exclude 中的指定项已启用: ${specificItems.join(", ")}`
          : "files.exclude 所有项已启用"
        : specificItems && specificItems.length > 0
        ? `files.exclude 中的指定项已禁用: ${specificItems.join(", ")}`
        : "files.exclude 所有项已禁用"
    );
  } catch (err) {
    vscode.window.showErrorMessage(`操作失败: ${err}`);
  }
}
// 创建addon框架
async function initAddonFramework(context: vscode.ExtensionContext) {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage("请先打开一个工作区（Workspace）");
    return;
  }
  // 添加控制器版本选择
  const controllerVersion = await vscode.window.showQuickPick(
    [
      { label: "v1.7.2", description: "适用于旧版控制器" },
      { label: "v3.x", description: "适用于新版控制器" },
    ],
    {
      placeHolder: "请选择控制器版本",
      ignoreFocusOut: true,
    }
  );
  // 选择控制器版本
  if (!controllerVersion) {
    vscode.window.showErrorMessage("未选择控制器版本，操作已取消");
    return;
  }
  // 选择addon脚本类型
  const addonType = await vscode.window.showQuickPick(
    [
      { label: "python", description: "Python 脚本" },
      { label: "node-red", description: "node_red" },
    ],
    {
      placeHolder: "请选择addon服务类型",
      ignoreFocusOut: true,
    }
  );
  if (!addonType) {
    vscode.window.showErrorMessage("未选择addon服务类型，操作已取消");
    return;
  }
  // 询问是否创建自定义指令
  let add_customprogramsFlag = false;
  if (addonType.label == "python") {
    const customprogramsFlag = await vscode.window.showQuickPick(
      [
        {
          label: "Yes",
        },
        { label: "No" },
      ],
      {
        placeHolder: "是否创建自定义指令",
        ignoreFocusOut: true,
      }
    );
    if (customprogramsFlag) {
      if (customprogramsFlag.label == "Yes") {
        add_customprogramsFlag = true;
      } else {
        add_customprogramsFlag = false;
      }
    }
  } else {
    add_customprogramsFlag = false;
  }

  const rootPath = workspaceFolders[0].uri.fsPath;
  const projectName = rootPath.split("\\").reverse()[0];

  // 创建addon配置文件
  const addonConfig = path.join(rootPath, `${projectName}_config.ini`);
  const config_settings = `[AddOnInfo]
convention= 2.0
name= ${projectName}
description= None
version= 1.0
type= 3
portal= 1
languageType= ${addonType.label}
service= ${addonType.label == "python" ? "main.py" : "addon.json"}
serviceenabled = 1

;[Requirement]
;dir = requirement
;list = requirement.list
`;
  if (!fs.existsSync(addonConfig)) {
    fs.writeFileSync(addonConfig, config_settings);
  }

  // 创建addon启动文件
  const enterFile = path.join(
    rootPath,
    addonType.label == "python" ? "main.py" : "addon.json"
  );
  if (!fs.existsSync(enterFile)) {
    fs.writeFileSync(enterFile, "");
  }
  // python flask 服务代码
  if (add_customprogramsFlag) {
    const server_path = path.join(rootPath, "server");
    if (!fs.existsSync(server_path)) {
      fs.mkdirSync(server_path);
    }

    // 写服务路由方法
    extractTarGzToWorkspace(context, "FlaskResponse");
    // 写日志管理器方法
  }

  // addon 打包配置
  const package_setting = {
    version: 2.0,
    name: projectName,
    depend: [],
    transform: [],
    no_transform: [
      { source: addonType.label == "python" ? "main.py" : "addon.json" },
      { source: `${projectName}_config.ini` },
    ],
    addon_config: `${projectName}_config.ini`,
    version_check: true,
    clear_code: true,
    output: "output",
    remote_dir: "/home/jakauser/",
    debug_robot: [
      "",
      "",
      controllerVersion.label == "v1.7.2" ? "1.7.2" : "3.2",
    ],
  };
  if (add_customprogramsFlag) {
    package_setting["no_transform"].push(
      { source: "server" },
      { source: "logic" },
      { source: "FlaskResponse" },
      { source: "OldToNew_CustomPrograms.json" }
    );
  }
  fs.writeFileSync(
    path.join(rootPath, "package_log_pro.json"),
    JSON.stringify(package_setting, null, 4)
  );
}

//
async function make_custom_porgrams() {
  if (!vscode.workspace.workspaceFolders) {
    vscode.window.showErrorMessage("请先打开一个工作区（Workspace）");
    return;
  }
  const addonProFiles = await findAddonProFiles("**/*.addonpro");
  if (addonProFiles.length === 0) {
    vscode.window.showErrorMessage("未找到 .addonpro 文件");
    return;
  }
  drawCommandBlock(addonProFiles[0].fsPath);
}

// 在工作区中查找 .addonpro 文件
async function findAddonProFiles(filePattern: string): Promise<vscode.Uri[]> {
  if (
    !vscode.workspace.workspaceFolders ||
    vscode.workspace.workspaceFolders.length === 0
  ) {
    vscode.window.showErrorMessage("请先打开一个工作区（Workspace）");
    return [];
  }

  try {
    // 使用 vscode.workspace.findFiles 查找所有 .addonpro 文件
    const addonProFiles = await vscode.workspace.findFiles(filePattern);
    return addonProFiles;
  } catch (error) {
    vscode.window.showErrorMessage(`查找 .addonpro 文件时出错: ${error}`);
    return [];
  }
}

async function extractTarGz(archivePath: string, targetDir: string) {
  // 确保目标目录存在
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // 使用 tar 模块解压
  await tar.extract({
    gzip: true,
    file: archivePath,
    cwd: targetDir,
  });
}

async function extractTarGzToWorkspace(
  context: vscode.ExtensionContext,
  TarFile: string
) {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage("请先打开一个工作区");
    return;
  }

  // 获取插件资源路径中的压缩包
  const tarGzPath = vscode.Uri.joinPath(
    context.extensionUri,
    "resources",
    `${TarFile}.tar.gz`
  );

  // 获取目标解压路径
  const targetPath = workspaceFolders[0].uri.fsPath;

  try {
    // 解压到目标目录
    await extractTarGz(tarGzPath.fsPath, targetPath);
    vscode.window.showInformationMessage("压缩包解压成功");
  } catch (error) {
    vscode.window.showErrorMessage(`解压失败: ${error}`);
  }
}
export function deactivate() {}
