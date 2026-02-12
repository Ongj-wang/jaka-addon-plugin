// designer.js
let fields = [];
let workspace;

function addField(type) {
  const name = "FIELD_" + fields.length;
  let field;

  if (type === "label") {
    field = { type: "text", text: prompt("Label text:", "Hello") || "Hello" };
  } else if (type === "input") {
    field = { type: "field_input", name, text: "default" };
  } else if (type === "number") {
    field = { type: "field_number", name, value: 0, min: 0 };
  } else if (type === "dropdown") {
    field = {
      type: "field_dropdown",
      name,
      options: [
        ["Option A", "A"],
        ["Option B", "B"],
      ],
    };
  } else if (type === "statement") {
    field = { type: "input_statement", name };
  }

  fields.push(field);
  renderFieldsList();
}

function renderFieldsList() {
  const list = document.getElementById("fieldsList");
  list.innerHTML = fields
    .map(
      (f, i) =>
        `<div>[${f.type}] ${f.name || f.text} <button onclick="removeField(${i})">x</button></div>`,
    )
    .join("");
}

function removeField(index) {
  fields.splice(index, 1);
  renderFieldsList();
}

function buildBlockDefinition() {
  const blockType = document.getElementById("blockType").value;
  const colorHex = document.getElementById("blockColor").value;
  const colorHue = hexToHue(colorHex); // Blockly uses hue (0-360)

  // 构建 message0 和 args0
  let message = "";
  let args = [];
  let placeholderIndex = 1;

  fields.forEach((f) => {
    if (f.type === "text") {
      message += f.text + " ";
    } else if (f.type === "input_statement") {
      message += "%" + placeholderIndex + " ";
      args.push({ type: f.type, name: f.name });
      placeholderIndex++;
    } else {
      message += "%" + placeholderIndex + " ";
      args.push(f);
      placeholderIndex++;
    }
  });

  // 确保不以空格结尾
  message = message.trim();

  // 连接器配置
  let connections = {};
  if (blockType === "statement") {
    connections.previousStatement = null;
    connections.nextStatement = null;
  } else if (blockType === "reporter") {
    connections.output = "String"; // 可扩展为类型选择
  } else if (blockType === "boolean") {
    connections.output = "Boolean";
  }
  // hat: no connections

  return {
    type: "custom_block",
    message0: message,
    args0: args,
    colour: colorHue,
    ...connections,
  };
}

function hexToHue(hex) {
  // 简化：将 hex 转为近似 hue（实际可用更精确算法）
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h;
  if (max === min) h = 0;
  else if (max === r) h = ((g - b) / (max - min)) * 60;
  else if (max === g) h = ((b - r) / (max - min)) * 60 + 120;
  else h = ((r - g) / (max - min)) * 60 + 240;
  return (h + 360) % 360;
}

function updatePreview() {
  // 清除旧定义
  if (Blockly.Blocks["custom_block"]) {
    delete Blockly.Blocks["custom_block"];
  }

  const def = buildBlockDefinition();

  // 注册新块
  Blockly.Blocks["custom_block"] = {
    init: function () {
      this.jsonInit(def);
    },
  };

  // 重新初始化工作区
  if (workspace) workspace.dispose();
  workspace = Blockly.inject("blocklyDiv", {
    toolbox: '<xml><block type="custom_block"></block></xml>',
    readOnly: false,
    scrollbars: true,
  });
}

function exportJSON() {
  const def = buildBlockDefinition();
  const blob = new Blob([JSON.stringify(def, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "custom_block.json";
  a.click();
}

// 初始化
window.onload = () => {
  addField("label"); // 默认加一个标签
  updatePreview();
};
