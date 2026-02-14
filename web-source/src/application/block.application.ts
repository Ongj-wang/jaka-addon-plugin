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
  defaultValue: { zh: "", en: "", ja: "" },
  options: [],
  hidden: false,
});

// entity
export const showLang = ["text", "dropdown"];

const getLangValue = (value: unknown, lang: string) => {
  if (!value) return "";
  if (typeof value === "object") {
    return (value as Record<string, string>)[lang] ?? "";
  }
  return String(value);
};

const generateMessage = (block: Block) => {
  let index = 1;
  const parts: string[] = [block.name];

  block.fields.filter((f) => !f.hidden).forEach((field) => {
    // const label =
    //   typeof field.label === "object"
    //     ? getLangValue(field.label, block.lang)
    //     : field.label || "参数";
    parts.push(`%${index++}`);
  });

  return parts.join(" ");
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
      type: "field_number",
      name: field.id,
      value: typeof field.defaultValue === "number" ? field.defaultValue : 0,
    };
  }

  if (field.type === "boolean") {
    return {
      type: "field_checkbox",
      name: field.id,
      checked: !!field.defaultValue,
    };
  }

  if (field.type === "dropdown") {
    let options: [string, any][] =
      field.options?.map((opt): [string, any] => [
        typeof opt.label === "object"
          ? getLangValue(opt.label, lang)
          : opt.label,
        opt.value,
      ]) ?? [];
    if (options.length === 0) options = [["请选择", ""]];
    return {
      type: "field_dropdown",
      name: field.id,
      options,
    };
  }

  return {
    type: "input_value",
    name: field.id,
    defaultValue: field.defaultValue,
    defaultValueType: field.type, // "number" | "text" | "boolean"
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

  field.defaultValue = "";
};

export const buildBlocklyJson = (block: Block): BlocklyBlockJson => ({
  type: block.id,
  message0: generateMessage(block),
  args0: block.fields.filter((field) => !field.hidden).map((field) => toBlocklyArg(field, block.lang)),
  colour: block.color,
  extensions: [block.output!],
});
