import type {
  Block,
  BlockField,
  BlocklyArg,
  BlocklyBlockJson,
  BlockTypeOption,
  FieldType,
} from "../domain/block.types";

// ****
const createId = (prefix: string) => `${prefix}_${Date.now()}`;

export const createDefaultBlock = (): Block => ({
  id: createId("block"),
  name: "New Block",
  kind: "value",
  output: "output_string",
  color: "#6366f1",
  lang: "zh",
  fields: [],
  openUrl: "",
  selectedType: "string",
});

export const createDefaultField = () => ({
  id: createId("field"),
  label: "参数",
  type: "text" as const,
  defaultValue: "",
  options: [],
  hidden: false,
});

// entity
export const showLang = ["text"];

const getLangValue = (value: unknown, lang: string) => {
  if (!value) return "";
  if (typeof value === "object") {
    return (value as Record<string, string>)[lang] ?? "";
  }
  return String(value);
};

const getInputCheck = (type: FieldType) => {
  if (type === "boolean") return "Boolean";
  if (type === "number") return "Number";
  if (type === "string" || type === "array") return "String";
  return null;
};

const generateMessage = (block: Block) => {
  let index = 1;
  const parts: string[] = [];

  block.fields.filter((f) => !f.hidden).forEach(() => {
    parts.push(`%${index++}`);
  });

  return parts.join(" ") || " ";
};

const toBlocklyArg = (field: BlockField, lang: Block["lang"]): BlocklyArg => {
  if (field.type === "text") {
    return {
      type: "field_label",
      name: field.id,
      text: getLangValue(field.defaultValue, lang),
    };
  }

  if (field.type === "number") {
    return {
      type: "input_value",
      name: field.id,
      defaultValue: String(field.defaultValue ?? ""),
      defaultValueType: "number",
      check: getInputCheck("number"),
    };
  }

  if (field.type === "boolean") {
    return {
      type: "input_value",
      name: field.id,
      defaultValue: String(field.defaultValue ?? ""),
      defaultValueType: "boolean",
      check: getInputCheck("boolean"),
    };
  }

  if (field.type === "dropdown") {
    const rawValue = getLangValue(field.defaultValue, lang);
    const options = rawValue
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item): [string, string] => [item, item]);

    return {
      type: "field_dropdown",
      name: field.id,
      options: options.length > 0 ? options : [["请选择", ""]],
      value: options[0]?.[1] ?? "",
    };
  }

  return {
    type: "input_value",
    name: field.id,
    defaultValue: String(field.defaultValue ?? ""),
    defaultValueType: field.type,
    check: getInputCheck(field.type),
  };
};

export const applyType = (block: Block, typeOption: BlockTypeOption) => {
  block.kind = typeOption.kind;
  block.output = typeOption.output;
};

export const addField = (block: Block) => {
  block.fields.push(createDefaultField());
};

export const deleteField = (block: Block, id: string) => {
  block.fields = block.fields.filter((f) => f.id !== id);
};

export const moveField = (block: Block, fromIndex: number, toIndex: number) => {
  const total = block.fields.length;
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= total ||
    toIndex >= total ||
    fromIndex === toIndex
  ) {
    return;
  }

  const [moved] = block.fields.splice(fromIndex, 1);
  if (!moved) return;
  block.fields.splice(toIndex, 0, moved);
};

export const setFieldType = (
  block: Block,
  fieldId: string,
  type: FieldType,
) => {
  const field = block.fields.find((f) => f.id === fieldId);
  if (!field) return;

  field.type = type;
  if (showLang.includes(type)) {
    if (typeof field.defaultValue !== "object") {
      field.defaultValue = { zh: "", en: "", ja: "" };
    }
    return;
  }

  if (type === "boolean") {
    field.defaultValue = "false";
    return;
  }

  if (type === "number") {
    field.defaultValue = "0";
    return;
  }

  if (type === "array") {
    field.defaultValue = "";
    return;
  }

  field.defaultValue = "";
};

export const buildBlocklyJson = (block: Block): BlocklyBlockJson => ({
  type: block.id,
  message0: generateMessage(block),
  args0: block.fields.filter((field) => !field.hidden).map((field) => toBlocklyArg(field, block.lang)),
  colour: block.color,
  extensions: [block.output!],
});
