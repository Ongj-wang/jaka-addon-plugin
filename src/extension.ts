import * as fs from "fs";
import * as path from "path";
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
      // 校验是否由python依赖配置
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage("请先打开一个工作区（Workspace）");
        return;
      }
      const rootPath = workspaceFolders[0].uri.fsPath;
      const config = await readAddonConfig(rootPath);
      if (Object.keys(config).includes("Requirement")) {
        await buildAddon(true, config["Requirement"]);
      } else {
        await buildAddon();
      }
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

  const AddAntiModule = vscode.commands.registerCommand(
    "extension.AddAntiModule",
    async () => {
      // 选择模组
      const module_name = await vscode.window.showQuickPick(
        [
          {
            label: "FlaskResponse",
            description: "Flask服务响应辅助方法",
            source: "flaskresponse-0.0.1-py3-none-any.whl",
          },
          {
            label: "MyFactory",
            description: "一种用于多线程调用实例化对象的方法",
            source: "myfactory-0.1.0-py3-none-any.whl",
          },
          {
            label: "ThreadDataBase",
            description: "多线程数据读写方法",
            source: "threaddatabase-1.1.0-py3-none-any.whl",
          },
        ],
        {
          placeHolder: "请选择希望添加的模组",
          ignoreFocusOut: true,
        }
      );
      if (!module_name) return;

      // 获取当前工作区
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage("请先打开一个工作区（Workspace）");
        return;
      }
      const workspacePath = path.join(workspaceFolders[0].uri.fsPath);

      // 读取配置文件, 获取addon依赖管理配置
      const Configs = await readAddonConfig(workspacePath);
      let RequirementPath = path.join(workspacePath, "requirement");
      let RequirementListPath = path.join(workspacePath, "requirement.list");
      if (Object.keys(Configs).includes("Requirement")) {
        RequirementPath = path.join(workspacePath, Configs.Requirement.dir);
        RequirementListPath = path.join(
          workspacePath,
          Configs.Requirement.list
        );
      } else {
        Configs["Requirement"] = {
          dir: "requirement",
          list: "requirement.list",
        };
        fs.mkdirSync(RequirementPath);
        fs.writeFileSync(RequirementListPath, "");
      }
      // 更新配置文件
      writeAddonConfig(workspacePath, Configs);

      // 解析模组名和版本信息
      const module_info = module_name.source.split("-");
      const moduleInfo = `${module_info[0]}==${module_info[1]}`;

      // 获取插件资源路径中的压缩包
      const MouldSorcePath = vscode.Uri.joinPath(
        context.extensionUri,
        "resources",
        module_name.source
      );
      // 复制插件资源
      const MouldDestPath = path.join(RequirementPath, module_name.source);
      fs.copyFileSync(MouldSorcePath.fsPath, MouldDestPath); // 复制文件
      // 更新requirement.list
      const listContext = fs
        .readFileSync(RequirementListPath, "utf-8")
        .trim()
        .split("\n");
      for (const line of listContext) {
        if (line.match(/^${module_info[0]}==.*&/)) {
          listContext.splice(listContext.indexOf(line), 1); // 删除旧行
          break;
        }
      }
      listContext.push(moduleInfo);
      const trimmedContent = listContext.join("\n").trim();
      fs.writeFileSync(RequirementListPath, trimmedContent);
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
    BuildRelaseAddon,
    AddAntiModule
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
  const config_settings = {
    AddOnInfo: {
      convention: "2.0",
      name: `${projectName}`,
      description: "None",
      version: "1.0",
      type: "3",
      portal: "1",
      languageType: `${addonType.label}`,
      service: `${addonType.label == "python" ? "main.py" : "addon.json"}`,
      serviceenabled: "1",
    },
  };

  if (!fs.existsSync(addonConfig)) {
    writeIniFile(addonConfig, config_settings);
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
    // extractTarGzToWorkspace(context, "FlaskResponse");
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

// 读取 ini 文件的方法
async function readIniFile(filePath: string): Promise<any> {
  try {
    if (!fs.existsSync(filePath)) {
      vscode.window.showErrorMessage(`文件不存在: ${filePath}`);
      return null;
    }

    const contentLines = fs.readFileSync(filePath, "utf8").split("\n");
    const parseIni: { [section: string]: { [option: string]: string } } = {};
    let nowSection = "";
    for (const line of contentLines) {
      const lineContent = line.trim().split(";")[0]; // 去除行首尾的空白字符, 并去除注释
      if (lineContent.startsWith("[") && lineContent.endsWith("]")) {
        const sectionName = lineContent.slice(1, -1).trim();
        parseIni[sectionName] = {};
        nowSection = sectionName;
        continue;
      }
      const optionMatch = lineContent.match(/^(\w+)\s*[=:]\s*([^\s+]*)$/);
      if (optionMatch && nowSection != "") {
        const [, optionName, optionValue] = optionMatch;
        parseIni[nowSection][optionName] = optionValue;
        continue;
      }
    }
    return parseIni;
  } catch (error) {
    vscode.window.showErrorMessage(`读取 ini 文件失败: ${error}`);
    return null;
  }
}

// 写入 ini 文件的方法
async function writeIniFile(
  filePath: string,
  data: { [section: string]: { [option: string]: string } }
): Promise<boolean> {
  try {
    let iniString = "";
    for (const sectionName in data) {
      iniString += `[${sectionName}]\n`;
      for (const optionName in data[sectionName]) {
        iniString += `${optionName} = ${data[sectionName][optionName]}\n`;
      }
      iniString += "\n";
    }
    fs.writeFileSync(filePath, iniString, "utf8");
    return true;
  } catch (error) {
    vscode.window.showErrorMessage(`写入 ini 文件失败: ${error}`);
    return false;
  }
}

// 读 addon 配置的方法
async function readAddonConfig(workspacePath: string): Promise<any> {
  const packagPath = path.join(workspacePath, "package_log_pro.json");
  const packagsetting = JSON.parse(fs.readFileSync(packagPath, "utf-8"));
  const ConfigPath = path.join(workspacePath, packagsetting.addon_config);
  return await readIniFile(ConfigPath);
}

// 写 addon 配置的方法
async function writeAddonConfig(
  workspacePath: string,
  data: any
): Promise<boolean> {
  const packagPath = path.join(workspacePath, "package_log_pro.json");
  const packagsetting = JSON.parse(fs.readFileSync(packagPath, "utf-8"));
  const ConfigPath = path.join(workspacePath, packagsetting.addon_config);
  return await writeIniFile(ConfigPath, data);
}
export function deactivate() {}
