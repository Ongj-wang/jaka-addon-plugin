import { spawn } from "child_process";
import * as fs from "fs";
import * as http from "http";
import * as https from "https";
import * as path from "path";
import * as vscode from "vscode";
import { buildAddon, release_build } from "./buildMethods";
import { drawCommandBlock } from "./CommandGenerate";
import { readIniFile, writeIniFile } from "./configMethods";
import { createServer, lastRequestTime } from "./EditorServer";
import { CustomCommandBlock } from "./types";

let server: http.Server;
let timeoutInterval: NodeJS.Timeout | null = null; // 存储定时器引用

export function activate(context: vscode.ExtensionContext) {
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

      const make_ret = await make_custom_programs();

      // 校验是否由python依赖配置
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage("请先打开一个工作区（Workspace）");
        return;
      }
      const rootPath = workspaceFolders[0].uri.fsPath;
      const config = await readAddonConfig(rootPath);
      if (!config || typeof config !== "object") {
        console.error("读取addon配置失败:", config);
        await buildAddon(); // 默认构建
        return;
      }
      if (Object.keys(config).includes("Requirement")) {
        await buildAddon(true, config["Requirement"]);
      } else {
        await buildAddon();
      }
      if (make_ret == 1) {
        fs.unlinkSync(path.join(rootPath, "programs.addonpro"));
      }
    },
  );

  //
  const MakeCustomprograms = vscode.commands.registerCommand(
    "extension.MakeCustomprograms",
    async () => {
      make_custom_programs();
    },
  );

  const BuildReleaseAddon = vscode.commands.registerCommand(
    "extension.BuildReleaseAddon",
    async () => {
      await release_build();
    },
  );

  const StartScratchEditor = vscode.commands.registerCommand(
    "extension.open_scratch_editor",
    async () => {
      const port = 8080;
      const webDir = path.join(context.extensionPath, "web");

      // 获取当前工作区根路径（用于读写 CustomCommand.json）
      const workspaceFolder =
        vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceFolder) {
        vscode.window.showWarningMessage("请先打开一个工作区文件夹");
        return;
      }

      // 关闭旧服务器（避免端口占用）
      if (server) server.close();

      // 创建 HTTP 服务器（静态 + API）
      server = createServer(webDir, workspaceFolder, port);

      // 定时器：每分钟检查一次是否超时
      timeoutInterval = setInterval(() => {
        const timeoutMinutes: number = 10;
        const currentTime = Date.now();
        if (currentTime - lastRequestTime > timeoutMinutes * 60 * 1000) {
          // 超过设定时间未收到请求，关闭服务器
          vscode.window.showInformationMessage(
            `服务器因长时间无请求已自动关闭（超时时间：${timeoutMinutes}分钟）`,
          );
          server.close();
          if (timeoutInterval != null) {
            clearInterval(timeoutInterval); // 清除定时器
          }
          timeoutInterval = null;
        }
      }, 5 * 1000); // 每分钟检查一次

      server.listen(port, "127.0.0.1", () => {
        vscode.env.openExternal(vscode.Uri.parse(`http://localhost:${port}`));
      });
    },
  );
  const DownloadRequirements = vscode.commands.registerCommand(
    "extension.download_requirements",
    async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage("请先打开一个工作区（Workspace）");
        return;
      }
      const rootPath = workspaceFolders[0].uri.fsPath;

      // 要求用户输入希望下载的python moudle名字
      const MoudleNameInput = await vscode.window.showInputBox({
        placeHolder: `Please enter module name`,
        // 请输入项目名称(默认使用当前工作区名称)",
        ignoreFocusOut: true,
      });
      if (!MoudleNameInput) {
        return;
      }
      let RequirementPath = "";
      const config = await readAddonConfig(rootPath);
      if (Object.keys(config).includes("Requirement")) {
        RequirementPath = path.join(rootPath, config.Requirement.dir);
      } else {
        RequirementPath = path.join(rootPath, "requirement");
        config.Requirement = {
          dir: "requirement",
          list: "requirement.list",
        };
        await writeAddonConfig(rootPath, config);
      }
      if (!fs.existsSync(RequirementPath)) {
        fs.mkdirSync(RequirementPath);
      }
      let moduleList = "";
      // 将python moudle下载到requirement文件夹
      vscode.window.showInformationMessage("获取依赖项...");
      const antiModule = await getAntiModule(
        MoudleNameInput.toLowerCase(),
        RequirementPath,
      );
      let targetModule = "";
      if (antiModule) {
        if (MoudleNameInput.toLowerCase() == "flaskresponse") {
          targetModule = "flask";
        } else {
          targetModule = "";
        }
      } else {
        targetModule = MoudleNameInput;
      }
      if (targetModule) {
        const deps = await getModuleDependencies(targetModule);
        deps.push(targetModule);
        console.log(`deps : ${deps}`);

        for (const dep of deps) {
          const moduleInfo = await downloadModule(dep, RequirementPath);
          if (moduleInfo) {
            moduleList += `${moduleInfo}\n`;
          }
        }
      }
      if (antiModule) {
        moduleList += `${antiModule}\n`;
      }
      const requirementListPath = path.join(rootPath, config.Requirement.list);
      fs.appendFileSync(requirementListPath, moduleList, "utf-8");
      vscode.window.showInformationMessage(`依赖${MoudleNameInput}下载完成！`);
    },
  );
  context.subscriptions.push(
    addonFramework,
    buildAddonPackage,
    MakeCustomprograms,
    BuildReleaseAddon,
    StartScratchEditor,
    DownloadRequirements,
  );

  // 插件停用时关闭服务器
  context.subscriptions.push({
    dispose: () => {
      if (server) {
        server.close();
      }
      if (timeoutInterval != null) {
        clearInterval(timeoutInterval);
      }
      timeoutInterval = null;
    },
  });
}
// 创建addon框架
async function initAddonFramework(context: vscode.ExtensionContext) {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage("请先打开一个工作区（Workspace）");
    return;
  }
  // 添加控制器版本选择
  // const controllerVersion = await vscode.window.showQuickPick(
  //   [
  //     { label: "v1.7.2", description: "适用于旧版控制器" },
  //     { label: "v3.x", description: "适用于新版控制器" },
  //   ],
  //   {
  //     placeHolder: "请选择控制器版本",
  //     ignoreFocusOut: true,
  //   },
  // );
  // // 选择控制器版本
  // if (!controllerVersion) {
  //   vscode.window.showErrorMessage("未选择控制器版本，操作已取消");
  //   return;
  // }
  const controllerVersion = { label: "v3.x", description: "适用于新版控制器" };
  // 选择addon脚本类型
  const ScriptType = [
    { label: "python", description: "Python 脚本" },
    { label: "node-red", description: "node_red" },
  ];
  if (controllerVersion.label == "v3.x") {
    ScriptType[0].label = "python3";
  }
  const addonType = await vscode.window.showQuickPick(ScriptType, {
    placeHolder: "Please select language type",
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
        placeHolder: "Whether to use custom programs?",
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
    placeHolder: `Please enter project name(default: ${projectName})`,
    // 请输入项目名称(默认使用当前工作区名称)",
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
  const package_setting = await refreshPackageLog(
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
async function make_custom_programs() {
  if (!vscode.workspace.workspaceFolders) {
    vscode.window.showErrorMessage("请先打开一个工作区（Workspace）");
    return -1;
  }
  let autoPro = 0;
  const workspaceFolder = vscode.workspace.workspaceFolders[0].uri.fsPath;
  const CommandJsonPath = path.join(workspaceFolder, "CustomCommand.json");
  if (fs.existsSync(CommandJsonPath)) {
    const CommandBlocks = JSON.parse(fs.readFileSync(CommandJsonPath, "utf-8"));
    fs.writeFileSync(
      path.join(workspaceFolder, "programs.addonpro"),
      changeJson2Addonpro(CommandBlocks),
    );
    autoPro = 1;
  }
  const addonProFiles = await findAddonProFiles("**/*.addonpro");
  if (addonProFiles.length === 0) {
    vscode.window.showErrorMessage("未找到 .addonpro 文件");
    return -1;
  }
  drawCommandBlock(addonProFiles[0].fsPath);
  return autoPro;
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

// 读 addon 配置的方法
async function readAddonConfig(workspacePath: string): Promise<any> {
  const packagePath = path.join(workspacePath, "package_log_pro.json");
  if (!fs.existsSync(packagePath)) {
    console.error(`package_log_pro.json 文件不存在: ${packagePath}`);
    return {};
  }
  try {
    const packageSetting = JSON.parse(fs.readFileSync(packagePath, "utf-8"));
    const ConfigPath = path.join(workspacePath, packageSetting.addon_config);
    if (!fs.existsSync(ConfigPath)) {
      console.error(`addon配置文件不存在: ${ConfigPath}`);
      return {};
    }
    return await readIniFile(ConfigPath);
  } catch (error) {
    console.error(`读取addon配置失败: ${error}`);
    return {};
  }
}

// 写 addon 配置的方法
async function writeAddonConfig(
  workspacePath: string,
  data: any,
): Promise<boolean> {
  const packagePath = path.join(workspacePath, "package_log_pro.json");
  const packageSetting = JSON.parse(fs.readFileSync(packagePath, "utf-8"));
  const ConfigPath = path.join(workspacePath, packageSetting.addon_config);
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
async function refreshPackageLog(
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
  const packagePath = path.join(workspace, "package_log_pro.json");
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
  if (fs.existsSync(packagePath)) {
    package_setting = JSON.parse(
      fs.readFileSync(packagePath, "utf-8"),
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
  if (configs.AddOnInfo.url != undefined && configs.AddOnInfo.type > 1) {
    const match_result = configs.AddOnInfo.url.match(
      /http:\/\/localhost\/(\w+)\/(.+)/,
    );

    if (match_result) {
      let files = match_result[2].split("/");
      // 根据files组合文件路径
      let UIPath;
      while (files.length > 0) {
        UIPath = path.join(workspace, files.join("/"));
        if (fs.existsSync(UIPath)) {
          addPackageItem("no_transform", { source: `./${files.join("/")}` });
          break;
        } else {
          files.pop(files.length - 1);
        }
      }
      if (files.length == 0) {
        vscode.window.showErrorMessage(`未找到前端页面文件 ${match_result[2]}`);
      }

      // if (fs.existsSync(path.join(workspace, match_result[2]))) {
      //   addPackageItem("no_transform", { source: `./${match_result[2]}` });
      // } else {
      //   vscode.window.showErrorMessage(`未找到 ${match_result[2]} 文件`);
      // }
    }
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
      "shutil",
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
function changeJson2Addonpro(command: Array<CustomCommandBlock>): string {
  let ProFileText = "";
  const block_kind = {
    statement: ["***", "***"],
    number: ["(((", ")))"],
    string: ['"""', '"""'],
    array: ["[[[", "]]]"],
    boolean: ["&&&", "&&&"],
  };
  const field_kind = {
    text: ":",
    number: "(default)",
    dropdown: "^",
    array: "[]",
    string: '"default"',
    boolean: "&&&default&&&",
  };
  for (const block of command) {
    ProFileText += `\`${block.name}\` // id ${block.id}\n`;
    ProFileText += `${block_kind[block.selectedType][0]}\n`;

    let field_description = "";
    for (const field of block.fields) {
      const field_flag = field_kind[field.type].includes("default")
        ? field_kind[field.type].replace(
            "default",
            String(field.defaultValue ?? ""),
          )
        : field_kind[field.type];
      ProFileText += `${field_flag}${field.hidden ? "!" : ""}${field.label} `;
      if (field.type == "text") {
        // 将 defaultValue 断言为 Record<string, any> 以允许字符串索引访问
        const defaultValueObj = field.defaultValue as Record<string, any>;

        // 确保 defaultValueObj 是对象且不为 null，防止运行时错误
        if (defaultValueObj && typeof defaultValueObj === "object") {
          let desctiption: string[] = []; // 修正变量名拼写错误 (可选)
          for (const option of Object.keys(defaultValueObj)) {
            // 使用断言后的对象进行索引访问
            desctiption.push(`${option}:"${defaultValueObj[option]}"`);
          }
          // 更新 field_description，使用 JSON.stringify 时同样使用断言后的对象
          field_description += `- ${field.label} = ${desctiption.join(",")};\n`;
        }
      }
      if (field.type == "dropdown") {
        const defaultValueString = field.defaultValue as string;
        const ValueString = defaultValueString
          .replace(/\s/g, "")
          .split(",")
          .map((option) => `"${option}"`);
        field_description += `- ${field.label} = zh:[${ValueString}],en:[${ValueString}],ja:[${ValueString}];\n`;
      }
    }
    ProFileText += `\n${block_kind[block.selectedType][1]}\n\n${field_description}`;
    ProFileText += `\$color = ${block.color}\n`;
    if (block.openUrl) {
      ProFileText += `\$openUrl = ${block.openUrl}\n`;
    }
  }
  return ProFileText;
}
function downloadModule(
  moduleName: string,
  modulePath: string,
): Promise<string> {
  return new Promise(async (resolve, reject) => {
    // 查询modulePath中是否已存在模块包
    if (fs.existsSync(modulePath)) {
      const moduleFiles = fs.readdirSync(modulePath);
      if (moduleFiles.some((file) => file.startsWith(moduleName))) {
        vscode.window.showInformationMessage(`模块 ${moduleName} 已存在`);
        resolve("");
        return;
      }
    }
    vscode.window.showInformationMessage(`正在下载模块 ${moduleName}`);
    // 自动下载python module离线安装包
    const python = spawn("pip", [
      "download",
      moduleName,
      "--platform",
      "manylinux_2_17_x86_64",
      "--python-version",
      "3.11",
      "--no-deps",
      "--only-binary=:all",
      "--prefer-binary",
      "--dest",
      modulePath,
      "-i",
      // "https://mirrors.tuna.tsinghua.edu.cn/pypi/web/simple",
      "https://mirrors.huaweicloud.com/repository/pypi/simple",
    ]);

    let stdoutData = "";
    let stderrData = "";

    // python.stdout.on("data", (data) => {
    //   stdoutData += data.toString();
    //   console.log(`pip stdout: ${data}`);
    // });

    // python.stderr.on("data", (data) => {
    //   stderrData += data.toString();
    //   console.error(`pip stderr: ${data}`);
    // });

    python.on("close", (code) => {
      if (code === 0) {
        vscode.window.showInformationMessage(`模块 ${moduleName} 下载成功`);

        // 返回module名字和版本号
        if (fs.existsSync(modulePath)) {
          const moduleFiles = fs.readdirSync(modulePath);
          const downloadFile = moduleFiles.find(
            (file) =>
              file.startsWith(moduleName.toLowerCase()) &&
              file.endsWith(".whl"),
          );
          console.log("downloadFile", downloadFile);
          if (downloadFile) {
            // 从 wheel 文件名解析版本
            const versionMatch = downloadFile.match(
              /^[^-]+-([^-]+)(?:-.*)?\.(?:whl|tar\.gz)$/,
            );
            if (versionMatch) {
              resolve(`${moduleName}==${versionMatch[1]}`);
              return;
            } else {
              console.log("无法从 wheel 文件名中解析版本");
              reject(new Error("无法从 wheel 文件名中解析版本"));
              return;
            }
          } else {
            reject(new Error("无法找到下载的模块文件"));
            return;
          }
        }
      } else {
        const errorMsg = stderrData || `进程退出码: ${code}`;
        vscode.window.showErrorMessage(
          `模块 ${moduleName} 下载失败: ${errorMsg}`,
        );
        reject(new Error(errorMsg));
        return;
      }
    });

    python.on("error", (err) => {
      vscode.window.showErrorMessage(`无法启动 pip 进程: ${err.message}`);
      reject(err);
    });
  });
}
/**
 * 从 PyPI 获取模块的依赖列表
 * @param moduleName 模块名称
 * @param version 可选，指定版本，默认为最新
 */
const PYTHON_3_11_STD_LIBS = new Set([
  "abc",
  "aifc",
  "argparse",
  "array",
  "ast",
  "asynchat",
  "asyncio",
  "asyncore",
  "atexit",
  "audioop",
  "base64",
  "bdb",
  "binascii",
  "binhex",
  "bisect",
  "builtins",
  "bz2",
  "calendar",
  "cgi",
  "cgitb",
  "chunk",
  "cmath",
  "cmd",
  "code",
  "codecs",
  "codeop",
  "collections",
  "colorsys",
  "compileall",
  "concurrent",
  "configparser",
  "contextlib",
  "contextvars",
  "copy",
  "copyreg",
  "cProfile",
  "crypt",
  "csv",
  "ctypes",
  "curses",
  "dataclasses",
  "datetime",
  "dbm",
  "decimal",
  "difflib",
  "dis",
  "distutils",
  "doctest",
  "email",
  "encodings",
  "enum",
  "errno",
  "faulthandler",
  "fcntl",
  "filecmp",
  "fileinput",
  "fnmatch",
  "formatter",
  "fractions",
  "ftplib",
  "functools",
  "gc",
  "getopt",
  "getpass",
  "gettext",
  "glob",
  "grp",
  "gzip",
  "hashlib",
  "heapq",
  "hmac",
  "html",
  "http",
  "idlelib",
  "imaplib",
  "imghdr",
  "imp",
  "importlib",
  "inspect",
  "io",
  "ipaddress",
  "itertools",
  "json",
  "keyword",
  "lib2to3",
  "linecache",
  "locale",
  "logging",
  "lzma",
  "mailbox",
  "mailcap",
  "marshal",
  "math",
  "mimetypes",
  "mmap",
  "modulefinder",
  "multiprocessing",
  "netrc",
  "nis",
  "nntplib",
  "numbers",
  "operator",
  "optparse",
  "os",
  "ossaudiodev",
  "parser",
  "pathlib",
  "pdb",
  "pickle",
  "pickletools",
  "pipes",
  "pkgutil",
  "platform",
  "plistlib",
  "poplib",
  "posix",
  "posixpath",
  "pprint",
  "profile",
  "pstats",
  "pty",
  "pwd",
  "py_compile",
  "pyclbr",
  "pydoc",
  "queue",
  "quopri",
  "random",
  "re",
  "readline",
  "reprlib",
  "resource",
  "rlcompleter",
  "runpy",
  "sched",
  "secrets",
  "select",
  "selectors",
  "shelve",
  "shlex",
  "shutil",
  "signal",
  "site",
  "smtpd",
  "smtplib",
  "sndhdr",
  "socket",
  "socketserver",
  "spwd",
  "sqlite3",
  "ssl",
  "stat",
  "statistics",
  "string",
  "stringprep",
  "struct",
  "subprocess",
  "sunau",
  "symtable",
  "sys",
  "sysconfig",
  "syslog",
  "tabnanny",
  "tarfile",
  "telnetlib",
  "tempfile",
  "termios",
  "test",
  "textwrap",
  "threading",
  "time",
  "timeit",
  "tkinter",
  "token",
  "tokenize",
  "trace",
  "traceback",
  "tracemalloc",
  "tty",
  "turtle",
  "turtledemo",
  "types",
  "typing",
  "unicodedata",
  "unittest",
  "urllib",
  "uu",
  "uuid",
  "venv",
  "warnings",
  "wave",
  "weakref",
  "webbrowser",
  "winreg",
  "winsound",
  "wsgiref",
  "xdrlib",
  "xml",
  "xmlrpc",
  "zipapp",
  "zipfile",
  "zipimport",
  "zlib",
  "_thread",

  "importlib-metadata",
]);

async function getModuleDependencies(
  moduleName: string,
  version?: string,
): Promise<string[]> {
  const url = version
    ? `https://pypi.org/pypi/${moduleName}/${version}/json`
    : `https://pypi.org/pypi/${moduleName}/json`;

  try {
    const response = await httpsGet(url); // 复用你已有的 httpsGet 函数
    const data = JSON.parse(response);

    // requires_dist 包含了所有依赖，格式如: "Flask (>=2.0)", "Werkzeug (>=2.0)"
    const requiresDist = data.info.requires_dist;

    if (!requiresDist) {
      return [];
    }

    // 过滤掉当前平台/环境不需要的依赖 (optional dependencies)
    // 注意：简单的过滤可能不完美，但对于离线下载通常足够。
    // 更严谨的做法是解析 environment markers，但这里我们只提取包名
    const dependencies: string[] = [];

    for (const req of requiresDist) {
      // 1. 检查是否有可选依赖
      if (req.includes("extra ==")) {
        console.log(`跳过可选依赖: ${req}`);
        continue;
      }

      const match = req.match(/^([a-zA-Z0-9_-]+)/);

      let rawName = match[1];
      // 标准化包名：转小写，将连字符替换为下划线，以便与标准库列表匹配
      // const normalizedName = rawName.toLowerCase().replace(/-/g, "_");

      // 2. 检查是否为标准库
      if (PYTHON_3_11_STD_LIBS.has(rawName)) {
        console.log(`跳过标准库依赖: ${rawName}`);
        continue;
      }

      dependencies.push(rawName);
    }
    return dependencies;
  } catch (error) {
    console.error(`获取 ${moduleName} 依赖失败:`, error);
    return [];
  }
}
async function getAntiModule(
  moduleName: string,
  requiremethPath: string,
): Promise<string> {
  return new Promise(async (resolve, reject) => {
    const modulesList = {
      flaskresponse: {
        source:
          "https://gitee.com/api/v5/repos/wanghonejie/FlaskResponse/releases/latest",
      },
      myfactory: {
        description: "一种用于多线程调用实例化对象的方法",
        source:
          "https://gitee.com/api/v5/repos/wanghonejie/MyFactorys/releases/latest",
      },
      threaddatabase: {
        description: "多线程数据读写方法",
        source:
          "https://gitee.com/api/v5/repos/wanghonejie/thread-data-base/releases/latest",
      },
    };
    const isValidModuleName = (
      name: string,
    ): name is keyof typeof modulesList => {
      return name in modulesList;
    };
    if (!isValidModuleName(moduleName)) {
      console.log(`${moduleName}不存在特殊module列表中`);
      resolve("");
      return;
    }
    const module_name = modulesList[moduleName];
    // get请求获取模块仓库的模组信息
    const module_source = JSON.parse(await httpsGet(module_name.source));

    const assets = findModuleConfig(module_source.assets, "whl");
    // 解析模组名和版本信息
    const module_info = assets.name.split("-");
    console.log(module_info);
    const moduleInfo = `${module_info[0]}==${module_info[1]}`;
    const MouldDestPath = path.join(requiremethPath, assets.name);

    await downloadFileFromUrl(assets.browser_download_url, MouldDestPath);
    resolve(moduleInfo);
    return;
  });
}
export function deactivate() {}
