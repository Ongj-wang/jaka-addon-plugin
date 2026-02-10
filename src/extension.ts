import * as fs from "fs";
import * as http from "http";
import * as https from "https";
import * as path from "path";
import * as vscode from "vscode";
import { drawCommandBlock } from "./CommendGenerte";
import { buildAddon, release_build } from "./buildMethods";

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    "extension.generateSettingsJson",
    async () => {
      initSettingsJson();
    },
  );
  // 添加启用 files.exclude 的命令（支持参数）
  const enableFilesExclude = vscode.commands.registerCommand(
    "extension.enableFilesExclude",
    async (specificItems?: string[]) => {
      updateFilesExclude(true, specificItems);
    },
  );

  // 添加禁用 files.exclude 的命令（支持参数）
  const disableFilesExclude = vscode.commands.registerCommand(
    "extension.disableFilesExclude",
    async (specificItems?: string[]) => {
      updateFilesExclude(false, specificItems);
    },
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
    },
  );

  // 添加python addon框架命令
  const addonFramework = vscode.commands.registerCommand(
    "extension.CreatePyaddon",
    async () => {
      initAddonFramework(context);
    },
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
    },
  );

  //
  const MakeCustomPorgrams = vscode.commands.registerCommand(
    "extension.MakeCustomPorgrams",
    async () => {
      make_custom_porgrams();
    },
  );

  const BuildRelaseAddon = vscode.commands.registerCommand(
    "extension.BuildRelaseAddon",
    async () => {
      await release_build();
    },
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
            source:
              "https://gitee.com/api/v5/repos/wanghonejie/FlaskResponse/releases/latest",
          },
          {
            label: "MyFactory",
            description: "一种用于多线程调用实例化对象的方法",
            source:
              "https://gitee.com/api/v5/repos/wanghonejie/MyFactorys/releases/latest",
          },
          {
            label: "ThreadDataBase",
            description: "多线程数据读写方法",
            source:
              "https://gitee.com/api/v5/repos/wanghonejie/thread-data-base/releases/latest",
          },
        ],
        {
          placeHolder: "请选择希望添加的模组",
          ignoreFocusOut: true,
        },
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
          Configs.Requirement.list,
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

      // get请求获取模块仓库的模组信息
      const module_source = JSON.parse(await httpsGet(module_name.source));

      const assets = findModuleConfig(module_source.assets, "whl");
      // 解析模组名和版本信息
      const module_info = assets.name.split("-");
      const moduleInfo = `${module_info[0]}==${module_info[1]}`;

      const MouldDestPath = path.join(RequirementPath, assets.name);
      // 获取插件资源路径中的压缩包
      //   if (module_name.url === undefined) {
      //     const MouldSorcePath = vscode.Uri.joinPath(
      //       context.extensionUri,
      //       "resources",
      //       module_name.source
      //     );
      //     // 复制插件资源
      //     fs.copyFileSync(MouldSorcePath.fsPath, MouldDestPath); // 复制文件
      //   } else {
      await downloadFileFromUrl(assets.browser_download_url, MouldDestPath);
      //   }

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
    },
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
    AddAntiModule,
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
        existingSettings,
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
          existingSettings[key],
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
        ".vscode/settings.json 中没有找到 files.exclude 配置",
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
          : "files.exclude 所有项已禁用",
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
    },
  );
  // 选择控制器版本
  if (!controllerVersion) {
    vscode.window.showErrorMessage("未选择控制器版本，操作已取消");
    return;
  }
  // 选择addon脚本类型
  const ScriptType = [
    { label: "python", description: "Python 脚本" },
    { label: "node-red", description: "node_red" },
  ];
  if (controllerVersion.label == "v3.x") {
    ScriptType[0].label = "python3";
  }
  const addonType = await vscode.window.showQuickPick(ScriptType, {
    placeHolder: "请选择addon服务类型",
    ignoreFocusOut: true,
  });
  if (!addonType) {
    vscode.window.showErrorMessage("未选择addon服务类型，操作已取消");
    return;
  }
  // 询问是否创建自定义指令
  let add_customprogramsFlag = false;
  if (addonType.label.startsWith("python")) {
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
      },
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
  let projectName = path.basename(rootPath);

  // 要求用户输入项目名称
  const projectNameInput = await vscode.window.showInputBox({
    placeHolder: "请输入项目名称(默认使用当前工作区名称)",
    ignoreFocusOut: true,
  });
  if (projectNameInput) {
    projectName = projectNameInput;
  }

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
      service: `${addonType.label.startsWith("python") ? "main.py" : "addon.json"}`,
      serviceenabled: "1",
      url: `http://localhost/${projectName}/client/`,
    },
  };

  if (!fs.existsSync(addonConfig)) {
    writeIniFile(addonConfig, config_settings);
    // 创建addon启动文件
    const enterFile = path.join(
      rootPath,
      addonType.label.startsWith("python") ? "main.py" : "addon.json",
    );
    if (!fs.existsSync(enterFile)) {
      fs.writeFileSync(enterFile, "");
    }
  }

  // python flask 服务代码
  if (add_customprogramsFlag) {
    // const server_path = path.join(rootPath, "server");
    // if (!fs.existsSync(server_path)) {
    //   fs.mkdirSync(server_path);
    // }
    // 写服务路由方法
    // extractTarGzToWorkspace(context, "FlaskResponse");
    // 写日志管理器方法
  }
  // addon 打包配置
  const package_setting = await refrashPackageLog(
    rootPath,
    projectName,
    controllerVersion.label,
  );

  if (add_customprogramsFlag) {
    package_setting["no_transform"].push(
      // { source: "server" },
      // { source: "logic" },
      // { source: "FlaskResponse" },
      { source: "OldToNew_CustomPrograms.json" },
    );
  }
  fs.writeFileSync(
    path.join(rootPath, "package_log_pro.json"),
    JSON.stringify(package_setting, null, 4),
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
  data: { [section: string]: { [option: string]: string } },
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
  data: any,
): Promise<boolean> {
  const packagPath = path.join(workspacePath, "package_log_pro.json");
  const packagsetting = JSON.parse(fs.readFileSync(packagPath, "utf-8"));
  const ConfigPath = path.join(workspacePath, packagsetting.addon_config);
  return await writeIniFile(ConfigPath, data);
}

/**
 * 从URL下载文件到指定路径（支持重定向）
 * @param url - 要下载的文件URL
 * @param destPath - 目标保存路径
 * @returns Promise<boolean> - 下载是否成功
 */
function downloadFileFromUrl(url: string, destPath: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);

    // 根据URL协议选择合适的客户端
    const client = url.startsWith("https") ? https : http;

    const request = client.get(url, (response) => {
      // 处理重定向
      if (
        response.statusCode === 301 ||
        response.statusCode === 302 ||
        response.statusCode === 307
      ) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          // 关闭当前文件流
          file.close();
          fs.unlink(destPath, () => {}); // 删除不完整的文件

          // 递归调用，使用新的重定向URL
          downloadFileFromUrl(redirectUrl, destPath)
            .then(resolve)
            .catch(reject);
          return;
        } else {
          vscode.window.showErrorMessage(`重定向失败: 无法获取重定向位置`);
          file.close();
          fs.unlink(destPath, () => {});
          resolve(false);
          return;
        }
      }

      if (response.statusCode !== 200) {
        vscode.window.showErrorMessage(`下载失败: HTTP ${response.statusCode}`);
        file.close();
        fs.unlink(destPath, () => {}); // 删除不完整的文件
        resolve(false);
        return;
      }

      response.pipe(file);

      file.on("finish", () => {
        file.close();
        vscode.window.showInformationMessage(`文件下载成功: ${destPath}`);
        resolve(true);
      });
    });

    request.on("error", (err) => {
      file.close();
      fs.unlink(destPath, () => {}); // 删除不完整的文件
      vscode.window.showErrorMessage(`下载出错: ${err.message}`);
      resolve(false);
    });

    request.setTimeout(30000, () => {
      // 30秒超时
      request.abort();
      file.close();
      fs.unlink(destPath, () => {});
      vscode.window.showErrorMessage("下载超时");
      resolve(false);
    });
  });
}

/**
 * 发送 HTTPS GET 请求并返回响应数据
 * @param url - 请求的 URL
 * @returns Promise<string> - 返回响应数据的字符串形式
 */
function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;

    const request = client.get(url, (response) => {
      let data = "";

      // 处理重定向
      if (
        response.statusCode === 301 ||
        response.statusCode === 302 ||
        response.statusCode === 307
      ) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          // 递归调用，使用新的重定向URL
          httpsGet(redirectUrl).then(resolve).catch(reject);
          return;
        } else {
          reject(new Error("重定向失败: 无法获取重定向位置"));
          return;
        }
      }

      if (response.statusCode !== 200) {
        reject(new Error(`请求失败: HTTP ${response.statusCode}`));
        return;
      }

      // 接收数据
      response.on("data", (chunk) => {
        data += chunk;
      });

      // 数据接收完成
      response.on("end", () => {
        resolve(data);
      });
    });

    request.on("error", (err) => {
      reject(new Error(`请求出错: ${err.message}`));
    });

    request.setTimeout(30000, () => {
      // 30秒超时
      request.abort();
      reject(new Error("请求超时"));
    });
  });
}

/**
 * 根据文件类型获取模块配置
 */
function findModuleConfig(
  asserts: Array<{ browser_download_url: string; name: string }>,
  fileType: string,
): { browser_download_url: string; name: string } {
  const result = asserts.find((item) => item.name.endsWith(fileType));
  if (!result) {
    vscode.window.showErrorMessage(`未找到 ${fileType} 文件`);
    throw new Error(`未找到 ${fileType} 文件`);
  }
  return result;
}
/**
 *
 */
async function refrashPackageLog(
  workspace: string,
  projectName: string,
  controllerVersion: string,
) {
  /**
   * 向打包配置中添加项
   */
  type packageType = {
    version: number;
    name: string;
    depend: any[];
    transform: { source: string }[]; // 显式声明 transform 类型
    no_transform: { source: string }[];
    addon_config: string;
    version_check: boolean;
    clear_code: boolean;
    output: string;
    remote_dir: string;
    debug_robot: string[];
  };

  function addPackageItem(
    key: "transform" | "no_transform",
    item: { source: string },
  ): void {
    const index = package_setting[key].findIndex(
      (existingItem) =>
        existingItem.source == item.source ||
        existingItem.source == `./${item.source}`,
    );
    if (index === -1) {
      package_setting[key].push(item);
    } else {
      package_setting[key][index] = item;
    }
  }
  const configs = await readIniFile(
    path.join(workspace, `${projectName}_config.ini`),
  );
  const packagPath = path.join(workspace, "package_log_pro.json");
  let package_setting: packageType = {
    version: 2.0,
    name: projectName,
    depend: [],
    transform: [],
    no_transform: [
      { source: configs.AddOnInfo.service },
      { source: `${projectName}_config.ini` },
    ],
    addon_config: `${projectName}_config.ini`,
    version_check: true,
    clear_code: true,
    output: "output",
    remote_dir: "/home/jakauser/",
    debug_robot: ["", "", controllerVersion == "v1.7.2" ? "1.7.2" : "3.2"],
  };
  if (fs.existsSync(packagPath)) {
    package_setting = JSON.parse(
      fs.readFileSync(packagPath, "utf-8"),
    ) as packageType;
  }
  if (configs.Requirement != undefined) {
    addPackageItem("no_transform", { source: configs.Requirement.dir });
    addPackageItem("no_transform", { source: configs.Requirement.list });
  }
  if (configs.AddOnInfo.service.endsWith(".py")) {
    const myModules = await extractCustomModules(
      path.join(workspace, configs.AddOnInfo.service),
      workspace,
    );
    myModules.map((module) => {
      addPackageItem("transform", { source: module });
    });
  }

  return package_setting;
}
/**
 *
 */
async function extractCustomModules(
  scriptPath: string,
  workspaceRoot: string,
): Promise<string[]> {
  const visitedModules = new Set<string>();
  const result: string[] = [];
  /**
   * 递归解析模块文件
   * @param modulePath - 模块文件路径
   */
  async function parseModule(modulePath: string): Promise<void> {
    if (visitedModules.has(modulePath)) return; // 防止重复解析
    visitedModules.add(modulePath);

    try {
      const content = fs.readFileSync(modulePath, "utf-8");
      const lines = content.split("\n");

      for (const line of lines) {
        const trimmedLine = line.trim();

        // 匹配 import 语句
        const importMatch = trimmedLine.match(/^import\s+([a-zA-Z_][\w.]*)/);
        if (importMatch) {
          const moduleName = importMatch[1];
          await processModule(moduleName, modulePath);
        }

        // 匹配 from ... import 语句
        const fromImportMatch = trimmedLine.match(
          /^from\s+(\w+)(?:\.\w+)*?\s+import/,
        );
        if (fromImportMatch) {
          const moduleName = fromImportMatch[1];
          await processModule(moduleName, modulePath);
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(`解析模块失败: ${error}`);
    }
  }

  /**
   * 处理模块名称，判断是否为自定义模块并递归解析
   * @param moduleName - 模块名称
   * @param currentScriptPath - 当前脚本路径
   */
  async function processModule(
    moduleName: string,
    currentScriptPath: string,
  ): Promise<void> {
    // 忽略标准库模块（简单过滤常见标准库）
    const stdLibModules = [
      "os",
      "sys",
      "json",
      "re",
      "pathlib",
      "typing",
      "collections",
      "datetime",
    ];
    if (stdLibModules.includes(moduleName)) return;

    // 构造模块文件路径
    const moduleFileName = path.join(workspaceRoot, `${moduleName}.py`);
    const moduleDir = path.join(workspaceRoot, moduleName);

    // 检查模块文件是否存在
    if (fs.existsSync(moduleFileName)) {
      if (!result.includes(moduleName)) {
        result.push(`${moduleName}.py`); // 添加到结果数组
      }
      await parseModule(moduleFileName); // 递归解析子模块
    }
    if (fs.existsSync(moduleDir)) {
      if (!result.includes(moduleName)) {
        result.push(moduleName);
      }
    }
  }

  // 开始解析主脚本
  await parseModule(scriptPath);

  return result;
}
export function deactivate() {}
