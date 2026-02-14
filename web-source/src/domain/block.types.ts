export type FieldType =
  | "text"
  | "boolean"
  | "string"
  | "number"
  | "array"
  | "dropdown";

export interface MultiLangText {
  zh?: string;
  en?: string;
  ja?: string;
}

export type BlockKind = "statement" | "value"; // 指令块或数据块
export type ValueType =
  | "output_boolean"
  | "output_string"
  | "output_number"
  | "shape_statement"; // 输出类型

export type BlockField = {
  id: string;
  label: string | Record<string, string>;
  type: FieldType;
  defaultValue?: any;
  options?: { label: string | Record<string, string>; value: any }[];
  hidden?: boolean;
};

export type Block = {
  id: string;
  name: string;
  kind: BlockKind;
  selectedType?: string;
  output?: ValueType;
  color: string;
  fields: BlockField[];
  lang: "zh" | "en" | "ja";
  openUrl: string;
};

export type BlockTypeOption = {
  label: string;
  kind: BlockKind;
  output: ValueType;
};

// •	field_input
// 普通文本输入框，用户可以输入任意字符串。
// ✅ 用例：文本、变量名等
// 	•	field_number
// 数字输入框，可以限制最大、最小值及精度。
// ✅ 用例：数值参数、坐标、速度
// 	•	field_checkbox
// 复选框，值为 "TRUE" 或 "FALSE"。
// ✅ 用例：布尔开关

// •	field_dropdown
// 下拉选择框，需要配合 options 数组使用，选项可以是 [显示文本, 值] 的形式。
// ✅ 用例：枚举类型、模式选择
// 	•	field_variable
// 变量选择下拉列表，用于选择当前工作区中的变量。
// ✅ 用例：变量参数
// 	•	field_label
// 纯文本标签，不可编辑，只显示文字。
// ✅ 用例：说明文字
// 	•	field_image
// 在块上显示图片，需要提供 src, width, height。
// ✅ 用例：图标、状态标识
// 	•	field_colour
// 颜色选择器。
// ✅ 用例：颜色参数


// •	input_value
// 值输入口，可以连接另一个块的输出值。
// ✅ 用例：接收变量或计算结果
// 	•	input_statement
// 语句输入口，可以连接多条指令块。
// ✅ 用例：循环体、条件块内部的语句
// 	•	input_dummy
// 占位输入口，不接值，仅用于布局对齐。
export type BlocklyArg =
  | { type: "field_label"; name: string; text: string }
  | { type: "field_number"; name: string; value: number }
  | { type: "field_checkbox"; name: string; checked: boolean }
  | { type: "field_dropdown"; name: string; options: [string, any][] }
  | { type: "input_value"; name: string, defaultValue: any, defaultValueType: any }
  ;

export type BlocklyBlockJson = {
  type: string;
  message0: string;
  args0: BlocklyArg[];
  colour: string;
  extensions: ValueType[];
};
