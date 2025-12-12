import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

// 打包addon指令辅助函数
async function buildAddon(rm_output: boolean = true) {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage("请先打开一个工作区（Workspace）");
    return;
  }
  const rootPath = workspaceFolders[0].uri.fsPath;
  if (!fs.existsSync(path.join(rootPath, "package_log_pro.json"))) {
    vscode.window.showErrorMessage("缺少打包配置文件！");
    return;
  }

  const package_setting = JSON.parse(
    fs.readFileSync(path.join(rootPath, "package_log_pro.json"), "utf-8")
  );

  // 创建打包输出目录
  const OutputDir = path.join(rootPath, package_setting.output);
  console.log("OutputDir: ", OutputDir);
  if (!fs.existsSync(OutputDir)) {
    fs.mkdirSync(OutputDir);
  }
  const PackageDir = path.join(OutputDir, package_setting.name);
  if (fs.existsSync(PackageDir)) {
    fs.rmSync(PackageDir, { recursive: true });
  }
  fs.mkdirSync(PackageDir);

  // 复制package_setting["no_transform"]中的文件到PackageDir路径下面
  copyItem(package_setting["no_transform"], rootPath, PackageDir);
  copyItem(package_setting["transform"], rootPath, PackageDir);

  // 创建py转二进制文件列表
  let tansform_list: string[] = [];
  if (Array.isArray(package_setting.transform)) {
    for (const trans of package_setting.transform) {
      if (trans && typeof trans === "object" && trans.source) {
        const folder_path = path.join(rootPath, trans.source);
        tansform_list.push(...findPythonFilesExcludingInit(folder_path));
      }
    }
  }
  fs.writeFileSync(
    path.join(PackageDir, "transform_files.txt"),
    tansform_list.join(",")
  );
  fs.writeFileSync(
    path.join(rootPath, "transform_files.txt"),
    tansform_list.join(",")
  );
  fs.writeFileSync(
    path.join(PackageDir, "setup.py"),
    `from distutils.core import setup
from Cython.Build import cythonize

with open("./transform_files.txt") as f:
    files = f.read().strip('\\n').split(",")
for file in files:
    if ".py" in file:
        setup(ext_modules = cythonize(file))`
  );

  await createTarGz(rm_output);
}
// release打包
async function release_build() {
  await buildAddon(false);
  // 获取设备连接信息
  const robotIP = await vscode.window.showInputBox({
    prompt: "请输入设备 IP 地址",
    placeHolder: "例如: 192.168.1.100",
  });

  if (!robotIP) {
    vscode.window.showErrorMessage("设备 IP 地址不能为空");
    return;
  }

  const username = await vscode.window.showInputBox({
    prompt: "请输入用户名",
    placeHolder: "默认用户名通常是 jakauser",
    value: "jakauser",
  });

  if (!username) {
    vscode.window.showErrorMessage("用户名不能为空");
    return;
  }

  const password = await vscode.window.showInputBox({
    prompt: "请输入密码",
    placeHolder: "",
    value: "",
    password: true,
  });

  if (!password) {
    vscode.window.showErrorMessage("密码不能为空");
    return;
  }
  const zip_file = await uploadAddonToRobotViaSFTP(robotIP, username, password);
  await executeBuildCommandOnRobot(robotIP, username, password, zip_file);
  await downloadFileFromRobotViaSFTP(robotIP, username, password);

  await createTarGz(true);
}

// 将PackageDir打包成tar.gz压缩包
async function createTarGz(rm_output: boolean) {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage("请先打开一个工作区（Workspace）");
    return;
  }
  const rootPath = workspaceFolders[0].uri.fsPath;
  const package_setting = JSON.parse(
    fs.readFileSync(path.join(rootPath, "package_log_pro.json"), "utf-8")
  );
  try {
    // 动态导入 tar 模块，避免类型检查问题
    const addon_config = fs.readFileSync(
      path.join(rootPath, package_setting.addon_config),
      "utf-8"
    );
    const version_match = addon_config.match(/version\s*=\s*(.+?)\n/m);
    const addon_version = (version_match ? version_match[1] : "1.0").replace(
      ".",
      "_"
    );
    const tar = require("tar");
    const projectName = package_setting.name;
    const OutputDir = path.join(rootPath, package_setting.output);
    const tarGzFileName = `${projectName}_v${addon_version}.tar.gz`;
    const tarGzFilePath = path.join(OutputDir, tarGzFileName);

    // 创建 tar.gz 文件
    await tar.c(
      {
        gzip: true,
        file: tarGzFilePath,
        cwd: OutputDir,
      },
      [projectName]
    );

    vscode.window.showInformationMessage(
      `AddOn 压缩包已创建: ${tarGzFilePath}`
    );
    if (rm_output) {
      const PackageDir = path.join(OutputDir, package_setting.name);
      fs.rmSync(PackageDir, { recursive: true, force: true });
    }
  } catch (err) {
    vscode.window.showErrorMessage(`创建压缩包失败: ${err}`);
    console.error(err); // 添加详细错误日志
  }
}
/**
 * 在指定文件夹中查找除 __init__.py 以外的所有 .py 文件
 * @param folderPath 要搜索的文件夹路径
 * @returns 找到的 Python 文件路径数组
 */
function findPythonFilesExcludingInit(folderPath: string): string[] {
  const pythonFiles: string[] = [];
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage("请先打开一个工作区（Workspace）");
    return [];
  }
  const rootPath = workspaceFolders[0].uri.fsPath;
  // 检查文件夹是否存在
  if (!fs.existsSync(folderPath)) {
    return [];
  }
  // 如果传入的路径是文件，则直接返回
  if (fs.lstatSync(folderPath).isFile()) {
    return [folderPath];
  }

  try {
    // 读取文件夹内容
    const entries = fs.readdirSync(folderPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(folderPath, entry.name);

      // 如果是文件且以 .py 结尾，但不是 __init__.py
      if (
        entry.isFile() &&
        entry.name.endsWith(".py") &&
        entry.name !== "__init__.py"
      ) {
        // 将文件相对于工作区的路径加入结果数组
        pythonFiles.push(fullPath.replace(rootPath, ".").replace(/\\/g, "/"));
      }
      // 如果是目录，则递归搜索（可选）
      else if (entry.isDirectory()) {
        // 可以根据需要决定是否递归搜索子目录
        const subDirFiles = findPythonFilesExcludingInit(fullPath);
        pythonFiles.push(...subDirFiles);
      }
    }
  } catch (error) {
    vscode.window.showErrorMessage(`搜索 Python 文件时出错: ${error}`);
  }
  return pythonFiles;
}

function copyItem(
  itemlist: Array<{ source: string; target: string }>,
  rootPath: string,
  PackageDir: string
) {
  if (itemlist && Array.isArray(itemlist)) {
    for (const item of itemlist) {
      const sourcePath = path.join(rootPath, item.source);
      const destPath = path.join(
        PackageDir,
        item.target ? item.target : item.source
      );

      if (fs.existsSync(sourcePath)) {
        // 如果是目录，递归复制整个目录
        if (fs.statSync(sourcePath).isDirectory()) {
          // 确保目标目录存在
          const destDir = path.dirname(destPath);
          if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
          }
          copyDirectory(sourcePath, destPath);
        } else {
          // 如果是文件，直接复制
          // 确保目标目录存在
          const destDir = path.dirname(destPath);
          if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
          }
          fs.copyFileSync(sourcePath, destPath);
        }
        console.log(`已复制: ${item.source}`);
      } else {
        console.warn(`文件或目录不存在: ${item.source}`);
      }
    }
    // vscode.window.showInformationMessage(
    //   `AddOn 文件已成功复制到: ${PackageDir}`
    // );
  }
}

// 辅助函数：递归复制目录
function copyDirectory(src: string, dest: string) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    // 跳过需要忽略的文件和文件夹
    if (shouldSkipEntry(entry.name)) {
      continue;
    }

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      // 跳过 .pyc 文件
      if (!shouldSkipFile(entry.name)) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}
// 判断是否应该跳过的文件夹或文件
function shouldSkipEntry(name: string): boolean {
  // 跳过特定的文件夹
  const skipDirs = [".git", "__pycache__", ".svn", ".hg", "node_modules"];
  return skipDirs.includes(name);
}

// 判断是否应该跳过的文件
function shouldSkipFile(name: string): boolean {
  // 跳过特定的文件类型
  const skipExtensions = [".pyc", ".pyo", ".pyd", ".DS_Store", "Thumbs.db"];
  return skipExtensions.some((ext) => name.endsWith(ext));
}

/**
 * 通过 SFTP 将压缩包上传到机器人
 */
async function uploadAddonToRobotViaSFTP(
  robotIP: string,
  username: string,
  password: string
) {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage("请先打开一个工作区（Workspace）");
    return "";
  }

  const rootPath = workspaceFolders[0].uri.fsPath;

  // 查找最新的压缩包文件
  const packageData = JSON.parse(
    fs.readFileSync(path.join(rootPath, "package_log_pro.json"), "utf8")
  );
  const outputDir = path.join(rootPath, "output");
  if (!fs.existsSync(outputDir)) {
    vscode.window.showErrorMessage("未找到输出目录，请先构建 AddOn 包");
    return "";
  }

  const files = fs.readdirSync(outputDir);
  const tarGzFiles = files.filter((file) => file.endsWith(".tar.gz"));

  if (tarGzFiles.length === 0) {
    vscode.window.showErrorMessage("未找到 .tar.gz 压缩包，请先构建 AddOn 包");
    return "";
  }

  // 选择最新的文件
  let latestFile = tarGzFiles[0];
  let latestTime = fs.statSync(path.join(outputDir, tarGzFiles[0])).mtimeMs;

  for (const file of tarGzFiles) {
    const fileTime = fs.statSync(path.join(outputDir, file)).mtimeMs;
    if (fileTime > latestTime) {
      latestFile = file;
      latestTime = fileTime;
    }
  }

  const localFilePath = path.join(outputDir, latestFile);
  const remoteFilePath = `${packageData.remote}${latestFile}`;

  // 执行上传
  try {
    vscode.window.showInformationMessage(`正在连接到 ${robotIP}...`);

    // 动态导入 ssh2-sftp-client
    const Client = require("ssh2-sftp-client");
    const sftp = new Client();

    await sftp.connect({
      host: robotIP,
      port: 22,
      username: username,
      password: password,
    });

    vscode.window.showInformationMessage("连接成功，开始上传文件...");

    await sftp.put(localFilePath, remoteFilePath);

    await sftp.end();

    vscode.window.showInformationMessage(
      `文件上传成功! 文件路径: ${remoteFilePath}`
    );
  } catch (error) {
    vscode.window.showErrorMessage(`上传失败: ${error}`);
  }
  return latestFile;
}

/**
 * 通过 SSH 登录机器人并执行构建命令
 */
async function executeBuildCommandOnRobot(
  robotIP: string,
  username: string,
  password: string,
  zip_file: string
) {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage("请先打开一个工作区（Workspace）");
    return;
  }

  const rootPath = workspaceFolders[0].uri.fsPath;

  try {
    vscode.window.showInformationMessage(`正在连接到 ${robotIP}...`);

    // 动态导入 ssh2
    const ssh2 = require("ssh2");
    const client = new ssh2.Client();

    // 创建 Promise 来处理异步 SSH 连接
    await new Promise<void>((resolve, reject) => {
      client
        .on("ready", () => {
          vscode.window.showInformationMessage(
            "SSH 连接成功，正在执行构建命令..."
          );

          client.exec(
            `cd /home/jakauser && tar -xzvf ./${zip_file} && rm ./${zip_file} && cd ${zip_file.replace(
              /_v.*?\.tar\.gz/,
              ""
            )} && python ./setup.py build_ext --inplace`,
            (
              err: any,
              stream: {
                on: (
                  arg0: string,
                  arg1: (code: number, signal: any) => void
                ) => {
                  (): any;
                  new (): any;
                  on: {
                    (arg0: string, arg1: (data: string) => void): {
                      (): any;
                      new (): any;
                      stderr: {
                        (): any;
                        new (): any;
                        on: {
                          (arg0: string, arg1: (data: string) => void): void;
                          new (): any;
                        };
                      };
                    };
                    new (): any;
                  };
                };
              }
            ) => {
              if (err) {
                reject(err);
                return;
              }

              let output = "";
              let errorOutput = "";

              stream
                .on("close", (code: number, signal: any) => {
                  client.end();

                  if (code === 0) {
                    vscode.window.showInformationMessage(
                      "构建命令执行成功!\n输出:\n" + output
                    );
                    resolve();
                  } else {
                    vscode.window.showErrorMessage(
                      "构建命令执行失败!\n错误代码: " +
                        code +
                        "\n错误信息:\n" +
                        errorOutput
                    );
                    reject(new Error("命令执行失败"));
                  }
                })
                .on("data", (data: string) => {
                  output += data.toString();
                  console.log("STDOUT: " + data);
                })
                .stderr.on("data", (data: string) => {
                  errorOutput += data.toString();
                  console.log("STDERR: " + data);
                });
            }
          );
        })
        .on("error", (err: Error) => {
          reject(err);
        })
        .connect({
          host: robotIP,
          port: 22,
          username: username,
          password: password,
        });
    });
  } catch (error) {
    vscode.window.showErrorMessage(`SSH 连接或命令执行失败: ${error}`);
  }
}

/** *
 * 通过 SFTP 从机器人下载指定文件
 */
async function downloadFileFromRobotViaSFTP(
  robotIP: string,
  username: string,
  password: string
) {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage("请先打开一个工作区（Workspace）");
    return;
  }

  const packageDate = JSON.parse(
    fs.readFileSync(
      path.join(workspaceFolders[0].uri.fsPath, "package_log_pro.json"),
      "utf-8"
    )
  );
  const remoteFilePath = `${packageDate.remote}${packageDate.name}/`;
  const format_files = fs
    .readFileSync(
      path.join(workspaceFolders[0].uri.fsPath, "transform_files.txt"),
      "utf-8"
    )
    .split(",");
  const packageDir = `${workspaceFolders[0].uri.fsPath}\\${packageDate.output}\\${packageDate.name}`;

  try {
    vscode.window.showInformationMessage(`正在连接到 ${robotIP}...`);

    // 动态导入 ssh2-sftp-client
    const Client = require("ssh2-sftp-client");
    const sftp = new Client();

    await sftp.connect({
      host: robotIP,
      port: 22,
      username: username,
      password: password,
    });

    vscode.window.showInformationMessage("连接成功，开始下载文件...");
    for (const file of format_files) {
      const match = file.match(/(\w+)\.py\n?$/);
      const so_path = `${remoteFilePath}${match ? match[1] : ""}.so`;
      fs.rmSync(file.replace(".", packageDir));
      await sftp.get(
        so_path,
        file.replace(".", packageDir).replace(/\.py\n?/, ".so")
      );
    }

    // 删除远端remoteFilePath路径
    await sftp.rmdir(remoteFilePath, true);
    await sftp.end();
  } catch (error) {
    vscode.window.showErrorMessage(`下载失败: ${error}`);
  }
  vscode.window.showInformationMessage(`文件下载成功!`);
}

export { buildAddon, release_build };
