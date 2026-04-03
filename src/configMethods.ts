import * as fs from "fs";
import * as vscode from "vscode";

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
      iniString += `[${sectionName}]\r\n`;
      for (const optionName in data[sectionName]) {
        iniString += `${optionName} = ${data[sectionName][optionName]}\r\n`;
      }
      iniString += "\r\n";
    }
    fs.writeFileSync(filePath, iniString, "utf8");
    return true;
  } catch (error) {
    vscode.window.showErrorMessage(`写入 ini 文件失败: ${error}`);
    return false;
  }
}

export { readIniFile, writeIniFile };
