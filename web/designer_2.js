// web/designer.js
let blocks = []; // 所有积木
let currentBlockId = null;
let workspace;

// 自动保存防抖
let saveTimer;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fetch("/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks }),
    }).catch(console.error);
  }, 500);
}

async function loadBlocks() {
  const res = await fetch("/blocks");
  const data = await res.json();
  blocks = data.blocks || [];
  renderBlockList();
  if (blocks.length > 0) {
    selectBlock(blocks[0].id);
  } else {
    document.getElementById("blockEditor").style.display = "none";
  }
}

function renderBlockList() {
  const listEl = document.getElementById("blockList");
  listEl.innerHTML = blocks
    .map(
      (b) =>
        `<div class="block-item ${b.id === currentBlockId ? "active" : ""}" 
         onclick="selectBlock('${b.id}')">${b.name}</div>`,
    )
    .join("");
}

function addNewBlock() {
  const id = "block_" + Date.now();
  const newBlock = {
    id,
    name: "New Block",
    type: "statement",
    colour: 230,
    message: "",
    fields: [],
  };
  blocks.push(newBlock);
  selectBlock(id);
  scheduleSave();
}

function deleteCurrentBlock() {
  if (!currentBlockId) return;
  if (!confirm("Delete this block?")) return;

  blocks = blocks.filter((b) => b.id !== currentBlockId);
  currentBlockId = blocks.length > 0 ? blocks[0].id : null;
  renderBlockList();
  if (currentBlockId) {
    selectBlock(currentBlockId);
  } else {
    document.getElementById("blockEditor").style.display = "none";
    updatePreview(null);
  }
  scheduleSave();
}

function selectBlock(id) {
  currentBlockId = id;
  const block = blocks.find((b) => b.id === id);
  if (!block) return;

  // 填充表单
  document.getElementById("blockName").value = block.name;
  document.getElementById("blockType").value = block.type;
  document.getElementById("blockColor").value = hueToHex(block.colour);

  // 渲染字段列表
  fields = [...block.fields];
  renderFieldsList();

  renderBlockList();
  updatePreview(block);
  document.getElementById("blockEditor").style.display = "block";
}

// 字段管理（复用之前逻辑）
let fields = [];

function addField(type) {
  const name = "FIELD_" + fields.length;
  let field;
  if (type === "label") {
    field = { type: "text", text: "Label" };
  } else if (type === "input") {
    field = { type: "field_input", name, text: "default" };
  } else if (type === "number") {
    field = { type: "field_number", name, value: 0 };
  } else if (type === "dropdown") {
    field = { type: "field_dropdown", name, options: [["A", "A"]] };
  } else if (type === "statement") {
    field = { type: "input_statement", name };
  }
  fields.push(field);
  renderFieldsList();
  autoUpdatePreview();
}

function removeField(index) {
  fields.splice(index, 1);
  renderFieldsList();
  autoUpdatePreview();
}

function renderFieldsList() {
  const list = document.getElementById("fieldsList");
  list.innerHTML = fields
    .map((f, i) => {
      if (f.type === "text") {
        return `
        <div>
          Label: 
          <input type="text" value="${f.text || ""}" 
                 oninput="updateFieldText(${i}, this.value)" 
                 style="width:100px; font-size:12px;" />
          <button onclick="removeField(${i})">x</button>
        </div>
      `;
      } else {
        const typeName = f.type.replace("field_", "").replace("input_", "");
        return `<div>[${typeName}] ${f.name || ""} <button onclick="removeField(${i})">x</button></div>`;
      }
    })
    .join("");
}

// 表单变化自动更新
document
  .getElementById("blockName")
  .addEventListener("input", autoUpdatePreview);
document
  .getElementById("blockType")
  .addEventListener("change", autoUpdatePreview);
document
  .getElementById("blockColor")
  .addEventListener("input", autoUpdatePreview);

function autoUpdatePreview() {
  if (!currentBlockId) return;
  const block = getCurrentBlockFromForm();
  updatePreview(block);
  // 更新内存中的 block
  const idx = blocks.findIndex((b) => b.id === currentBlockId);
  if (idx >= 0) {
    blocks[idx] = block;
    scheduleSave();
  }
}

function getCurrentBlockFromForm() {
  const name = document.getElementById("blockName").value;
  const type = document.getElementById("blockType").value;
  const colour = hexToHue(document.getElementById("blockColor").value);
  return {
    id: currentBlockId,
    name,
    type,
    colour,
    message: buildMessage(),
    fields: [...fields],
  };
}

function buildMessage() {
  let msg = "";
  let placeholderCount = 0;
  fields.forEach((f) => {
    if (f.type === "text") {
      msg += f.text + " ";
    } else {
      placeholderCount++;
      msg += "%" + placeholderCount + " ";
    }
  });
  return msg.trim() || " "; // 避免空字符串（Blockly 不允许）
}

function updatePreview(blockDef) {
  if (workspace) {
    workspace.dispose();
    workspace = null;
  }

  if (!blockDef || !blockDef.message) {
    workspace = Blockly.inject("blocklyDiv", { readOnly: true });
    return;
  }

  // 创建临时块定义
  const def = {
    message0: blockDef.message,
    args0: [],
    colour: blockDef.colour || 230,
  };

  // 添加非文本字段到 args0
  fields.forEach((f) => {
    if (f.type !== "text") {
      def.args0.push({ ...f, name: f.name || "FIELD_" + def.args0.length });
    }
  });

  // 设置连接器
  if (blockDef.type === "statement") {
    def.previousStatement = null;
    def.nextStatement = null;
  } else if (blockDef.type === "reporter") {
    def.output = "String";
  } else if (blockDef.type === "boolean") {
    def.output = "Boolean";
  }

  // 注册块（正确方式）
  const blockType = "temp_block";
  if (Blockly.Blocks[blockType]) {
    delete Blockly.Blocks[blockType];
  }

  Blockly.Blocks[blockType] = {
    init: function () {
      this.jsonInit(def); // ✅ 正确使用 jsonInit
    },
  };

  try {
    workspace = Blockly.inject("blocklyDiv", {
      toolbox: `<xml><block type="${blockType}"></block></xml>`,
      readOnly: true,
      scrollbars: true,
    });
  } catch (e) {
    console.error("Preview render failed:", e);
    workspace = Blockly.inject("blocklyDiv", { readOnly: true });
  }
}

// 新增：更新 Label 文本
function updateFieldText(index, value) {
  fields[index].text = value;
  autoUpdatePreview(); // 自动刷新预览
}

// 工具函数：颜色转换
function hexToHue(hex) {
  /* ... 同前 ... */
}
function hueToHex(hue) {
  /* 可选实现 */ return "#70a9d4";
}

// 初始化
window.onload = () => {
  loadBlocks();
};
