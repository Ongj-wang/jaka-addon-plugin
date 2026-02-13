// makeCustomPrograms.ts
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

interface CommandJson {
  initJson: {
    type: string;
    args0: any[];
    colour: string;
    [key: string]: any;
  };
  xml: string;
  message: { [lang: string]: { [key: string]: string } };
}

interface Context {
  [lang: string]: string | string[];
}

class AddonCustomBlock {
  AddonName: string = "";
  CommandName: string = "";
  CommandType: string = "singleline";
  block_type: string = "";
  block_index: number = 0;
  atter_number: number = 0;
  XML_root: any = null;
  Command_json: CommandJson = {
    initJson: {
      type: "",
      args0: [],
      colour: "#FFBF00",
    },
    xml: "",
    message: {},
  };

  constructor() {}

  create(
    AddonName: string,
    CommandName: string,
    CommandType: string | null = null,
    colour: string | null = null,
  ): void {
    this.AddonName = AddonName;
    this.CommandName = CommandName;
    this.CommandType = CommandType || "singleline";
    this.block_type = `${this.generateHash(
      CommandName,
    )}_${AddonName}@${CommandName}`;
    this.block_index = 0;
    this.atter_number = 0;

    this.XML_root = this.defineBlock();

    this.Command_json = {
      initJson: {
        type: this.block_type,
        args0: [],
        colour: colour || "#FFBF00",
      },
      xml: "",
      message: {},
    };
  }

  generateHash(inputString: string): string {
    return crypto.createHash("md5").update(inputString, "utf8").digest("hex");
  }

  defineBlock(): any {
    // 创建 XML 结构
    return `<block type="${this.block_type}" x="20" y="100">`;
  }

  setArgText(lang: string, name: string, text: string): void {
    if (!this.Command_json.message[lang]) {
      this.Command_json.message[lang] = {
        Bool_False: "False",
        Array_: " ",
      };
    }
    this.Command_json.message[lang][name] = text;
  }

  addText(name: string, context: { [lang: string]: string }): number {
    this.atter_number += 1;
    const argName = `${name}@${this.AddonName}@${this.CommandName}`;

    // 添加 XML 元素
    this.XML_root += `<field name="${name}" disabled="false">#${argName}</field>`;

    const args0 = {
      type: "field_label",
      name: name,
      text: argName,
      disabled: false,
    };

    if (!this.Command_json.initJson[`args${this.block_index}`]) {
      this.Command_json.initJson[`args${this.block_index}`] = [];
    }

    this.Command_json.initJson[`args${this.block_index}`].push(args0);

    for (const lang in context) {
      this.setArgText(lang, argName, context[lang]);
    }

    return 0;
  }

  addSelect(
    name: string,
    options: { [lang: string]: string | string[] },
  ): number {
    this.atter_number += 1;

    // 添加 XML 元素
    // if (!this.XML_root.block.field) {
    //   this.XML_root.block.field = [];
    // }

    // this.XML_root.block.field.push({
    //   $: {
    //     name: name,
    //   },
    //   _: "0",
    // });
    this.XML_root += `<field name="${name}">0</field>`;

    const optionList: [string, string][] = [];
    const zhOptions = options["zh"];

    if (Array.isArray(zhOptions)) {
      zhOptions.forEach((opt, index) => {
        optionList.push([
          `${name}@${this.AddonName}@${this.CommandName}${index}`,
          `${index}`,
        ]);
      });
    }

    const args0 = {
      type: "field_dropdown",
      name: name,
      options: optionList,
    };

    if (!this.Command_json.initJson[`args${this.block_index}`]) {
      this.Command_json.initJson[`args${this.block_index}`] = [];
    }

    this.Command_json.initJson[`args${this.block_index}`].push(args0);

    for (const lang in options) {
      let text = options[lang];

      if (typeof text === "string") {
        const match = text.match(/\[(\w*)\]\*(\d+)/);
        if (match !== null) {
          text = Array(parseInt(match[2])).fill(match[1]);
        }
      }

      if (Array.isArray(text)) {
        text.forEach((t, index) => {
          this.setArgText(
            lang,
            `${name}@${this.AddonName}@${this.CommandName}${index}`,
            t,
          );
        });
      }
    }

    return 0;
  }

  addNumberInput(
    name: string,
    value: string | null,
    disable: boolean = false,
  ): number {
    this.atter_number += 1;

    // 添加 XML 元素
    const showEnabled = disable ? "true" : "false";
    this.XML_root += `<value name="${name}" disabled="${showEnabled}"><shadow type="math_number" disabled="${showEnabled}"><field name="NUM">${value || ""}</field></shadow></value>`;

    const args0 = {
      type: "input_value",
      name: name,
      text: value || "",
      check: "Number",
      disabled: false,
    };

    if (!this.Command_json.initJson[`args${this.block_index}`]) {
      this.Command_json.initJson[`args${this.block_index}`] = [];
    }

    this.Command_json.initJson[`args${this.block_index}`].push(args0);
    return 0;
  }

  addStringInput(
    name: string,
    value: string,
    disable: boolean = false,
  ): number {
    this.atter_number += 1;
    const showEnable = disable ? "true" : "false";
    this.XML_root += `<value name="${name}" disabled="${showEnable}"><shadow type="obj_text" disabled="${showEnable}"><field name="TEXT">#${value || ""}</field></shadow></value>`;

    const arg = {
      type: "input_value",
      name: name,
      text: value,
      check: "String",
      disabled: false,
    };

    if (!this.Command_json.initJson[`args${this.block_index}`]) {
      this.Command_json.initJson[`args${this.block_index}`] = [];
    }

    this.Command_json.initJson[`args${this.block_index}`].push(arg);
    return 0;
  }

  addListInput(name: string): number {
    this.atter_number += 1;

    // 添加 XML 元素
    this.XML_root += `<value name="${name}" disabled="false"></value>`;
    const args0 = {
      type: "input_value",
      name: name,
      text: "Array_",
      check: "Array",
      disabled: false,
    };

    if (!this.Command_json.initJson[`args${this.block_index}`]) {
      this.Command_json.initJson[`args${this.block_index}`] = [];
    }

    this.Command_json.initJson[`args${this.block_index}`].push(args0);
    return 0;
  }

  addSubCommandBlock(
    name: string,
    context: { [lang: string]: string },
  ): number {
    // 添加 statement XML 元素
    if (!this.XML_root.block.statement) {
      this.XML_root.block.statement = [];
    }

    this.XML_root.block.statement.push({
      $: {
        name: `JAKA_CUSTOM_SUBSTACK${this.block_index}`,
      },
    });

    // 添加 placeholder field
    const statement_name = `JAKA_CUSTOM_SUBSTACK${this.block_index}`;
    this.XML_root += `<statement name="${statement_name}"></statement><field name="${name}placeholder" disabled="false">#${name}@${this.AddonName}@${this.CommandName}</field>`;

    this.block_index += 1;
    const argsName = `args${this.block_index}`;
    if (!this.Command_json.initJson[argsName]) {
      this.Command_json.initJson[argsName] = [];
    }

    this.Command_json.initJson[argsName].push(
      {
        type: "input_statement",
        name: `JAKA_CUSTOM_SUBSTACK${this.block_index - 1}`,
      },
      {
        type: "field_label",
        name: `${name}placeholder`,
        text: `${name}@${this.AddonName}@${this.CommandName}`,
      },
    );

    this.Command_json.initJson[`message${this.block_index}`] = "%1 %2";

    for (const lang in context) {
      this.setArgText(
        lang,
        `${name}@${this.AddonName}@${this.CommandName}`,
        context[lang],
      );
    }

    return 0;
  }

  debugWriteXml(path: string): void {
    fs.writeFileSync(path, this.XML_root);
  }

  compileJson(): void {
    this.Command_json.initJson[`message0`] = Array.from(
      { length: this.atter_number },
      (_, i) => `%${i + 1}`,
    ).join(" ");

    if (["Multiline", "Singleline"].includes(this.CommandType)) {
      this.Command_json.initJson.previousStatement = null;
      this.Command_json.initJson.nextStatement = null;
    } else if (
      ["output_array", "output_number", "output_string"].includes(
        this.CommandType,
      )
    ) {
      this.Command_json.initJson.extensions = this.CommandType;
    }

    // 将 XML 对象序列化为字符串
    this.Command_json.xml = this.XML_root + "</block>";
  }

  buildCommandJson(openUrl: string = ""): any {
    this.compileJson();
    const resultJson: { [key: string]: any } = {
      JAKA_BLOCK_DATA: JSON.stringify(this.Command_json),
      blockName: this.CommandName,
      BLOCK_TYPE: this.block_type,
      jksUrl: `connected_robot/${this.CommandName}`,
      openUrl: openUrl,
    };
    for (let i = 0; i < this.block_index; i++) {
      resultJson[`jksUrl${i + 1}`] = `connected_robot/${this.CommandName}`;
    }
    return resultJson;
  }

  buildCommandWithConfig(config: { [key: string]: any }): any {
    for (let argIndex = 0; argIndex < Object.keys(config).length; argIndex++) {
      const commandConfig = config[(argIndex + 1).toString()];
      if (!commandConfig) {
        break;
      }

      switch (commandConfig.type) {
        case "text":
          this.addText(commandConfig.name, commandConfig.context);
          break;
        case "select":
          this.addSelect(commandConfig.name, commandConfig.context);
          break;
        case "number_input":
          this.addNumberInput(
            commandConfig.name,
            commandConfig.value || "",
            commandConfig.disable || false,
          );
          break;
        case "string_input":
          this.addStringInput(
            commandConfig.name,
            commandConfig.value || "",
            commandConfig.disable || false,
          );
          break;
        case "list_input":
          this.addListInput(commandConfig.name);
          break;
        case "statement":
          this.addSubCommandBlock(commandConfig.name, commandConfig.context);
          break;
      }
    }

    return this.buildCommandJson(config.openUrl || "");
  }
}

function pickVariable(atter: string, context: { [key: string]: any }): any {
  const atterPatterns: { [key: string]: RegExp } = {
    text: /:\s*(\w+)/,
    number_input: /\((?:\s*(-?\d+(?:\.\d+)?)\s*|\s*)\)\s*(\!?\w+)/,
    list_input: /\[\]\s*(\w+)/,
    select: /\^\s*(\w+)/,
    statement: /#\s*(\w+)/,
    string_input: /"(\s*[^"\s]*\s*)"\s*(\!?\w+)/,
  };

  let atterMatch: RegExpExecArray | null = null;
  let atterType = "";

  for (const [type, pattern] of Object.entries(atterPatterns)) {
    atterMatch = pattern.exec(atter);
    if (atterMatch) {
      atterType = type;
      break;
    }
  }

  if (!atterMatch) {
    return {};
  }

  const result: any = {
    type: atterType,
    name: atterMatch[1],
  };

  if (["text", "statement"].includes(atterType)) {
    result.context = context[atterMatch[1]] || { en: "", zh: "", ja: "" };
  } else if (atterType === "select") {
    const contextSetting = context[atterMatch[1]] || { en: "", zh: "", ja: "" };
    result.context = {};

    for (const lang in contextSetting) {
      const matches = contextSetting[lang].match(/"([^"]*)"/g);
      if (matches) {
        result.context[lang] = matches.map((m: string) => m.slice(1, -1));
      }
    }
  } else if (atterType === "number_input") {
    result.value = atterMatch[1] || " ";
    if (atterMatch[2].startsWith("!")) {
      result.disable = true;
      result.name = atterMatch[2].slice(1);
    } else {
      result.name = atterMatch[2];
    }
    console.log("number_input:", result);
  } else if (atterType === "string_input") {
    result.value = atterMatch[1] || " ";
    if (atterMatch[2].startsWith("!")) {
      result.disable = true;
      result.name = atterMatch[2].slice(1);
    } else {
      result.name = atterMatch[2];
    }
  }

  return result;
}

function readDescription(
  description: string,
): [string, string, string, { [key: string]: any }] {
  const patterns: { [key: string]: RegExp } = {
    line_pattern: /\*\*\*/,
    output_array: /\[{3}[\s\n]*(.*)\]{3}/s,
    output_number: /\({3}[\s\n]*(.*)\){3}/s,
  };

  let pType = "";
  let atters: string[] = [];

  for (const [type, pattern] of Object.entries(patterns)) {
    if (type === "line_pattern") {
      const parts = description.split(pattern);
      if (parts.length > 2) {
        atters = parts.slice(1, -1);
        pType = type;
        break;
      }
    } else {
      const match = pattern.exec(description);
      if (match) {
        atters = [match[1]];
        pType = type;
        break;
      }
    }
  }
  // 提取上下文
  const context: { [key: string]: { [lang: string]: string } } = {};
  const contextMatches = description.matchAll(/\s*-\s*(\w+)\s*=\s*([^;]+);/g);

  for (const match of contextMatches) {
    const variableName = match[1];
    const contextDescription = match[2];

    const contextList = [
      ...contextDescription.matchAll(/(\w+)\s*:\s*"([^"]*)"/g),
    ];
    if (contextList.length > 0) {
      context[variableName] = {};
      contextList.forEach((m) => {
        context[variableName][m[1]] = m[2];
      });
    } else {
      // 处理数组形式
      const arrayMatches = [
        ...contextDescription.matchAll(/(\w+)\s*:\s*\[([^\]]*)\]/g),
      ];
      arrayMatches.forEach((m) => {
        if (!context[variableName]) context[variableName] = {};
        context[variableName][m[1]] = m[2];
      });
    }
  }

  // 组合属性参数
  const variable: { [key: string]: any } = {};
  let index = 0;

  for (const atterStr of atters) {
    const atterParts = atterStr.trim().split(/\s+/);
    for (const atter of atterParts) {
      const variableSetting = pickVariable(atter, context);
      variable[(index + 1).toString()] = variableSetting;
      index += 1;
    }
  }
  console.log(variable);

  // 判断指令类型
  let commandType = "Singleline";
  if (pType === "line_pattern") {
    commandType = atters.length > 1 ? "Multiline" : "Singleline";
  } else {
    commandType = pType;
  }

  // 提取其他指令参数
  const parameters: { [key: string]: string } = {};
  const paramMatches = description.matchAll(/\$\s*(\w+)\s*=\s*([^"\r\n]*)/g);

  for (const match of paramMatches) {
    parameters[match[1].toLowerCase()] = match[2];
  }
  const openUrl = parameters.openurl ?? "";
  const colour = parameters.colour ?? parameters.color ?? "#FFBF00";
  return [commandType, openUrl, colour, variable];
}

function drawCommandBlock(ConfigPath: string): void {
  const commandJson: any[] = [];
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showErrorMessage("请先打开一个工作区（Workspace）");
    return;
  }
  const rootPath = workspaceFolders[0].uri.fsPath;
  const package_setting_path = path.join(rootPath, "package_log_pro.json");
  const package_setting = JSON.parse(
    fs.readFileSync(package_setting_path, "utf-8"),
  );

  const content = fs.readFileSync(ConfigPath, "utf-8");
  const configs = content.matchAll(/`\s*(\w+)\s*`[\s\n]*([^`]+)/g);

  for (const config of configs) {
    const addonCommand = new AddonCustomBlock();
    const name = config[1];
    const description = config[2];
    const [commandType, openUrl, colour, variables] =
      readDescription(description);

    addonCommand.create(package_setting.name, name, commandType, colour);
    variables.openUrl = openUrl;

    commandJson.push(addonCommand.buildCommandWithConfig(variables));

    // 可选：调试时写入XML文件
    // addonCommand.debugWriteXml(`./programs/${name}.xml`);
  }

  const targetPath = path.join(
    vscode.workspace.workspaceFolders![0].uri.fsPath,
    "OldToNew_CustomPrograms.json",
  );
  fs.writeFileSync(targetPath, JSON.stringify(commandJson, null, 4));
}

// 导出类和函数以便在其他文件中使用
export { AddonCustomBlock, drawCommandBlock, pickVariable, readDescription };
