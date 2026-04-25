// 多语言文本值
interface LocalizedText {
  zh?: string;
  en?: string;
  ja?: string;
  [key: string]: string | undefined;
}

// 字段默认值可以是字符串或本地化文本对象
type FieldDefaultValue = string | LocalizedText;

// 单个字段定义
interface BlockField {
  id: string;
  label: string;
  type: "text" | "number" | "dropdown" | "array" | "string"; // 可根据实际支持类型扩展
  defaultValue: FieldDefaultValue;
  options: any[]; // 如果是 select 类型，这里通常包含选项列表
  hidden: boolean;
}

// 完整的命令块定义
interface CustomCommandBlock {
  id: string;
  name: string;
  kind: "statement"; // 可根据实际支持类型扩展
  output?: string;
  color: string;
  lang: "zh" | "en" | "ja" | string;
  fields: BlockField[];
  openUrl: string;
  selectedType: "statement" | "number" | "string" | "array";
}

// 整个配置文件结构（对应 CustomCommand.json）
interface CustomCommandConfig {
  blocks: CustomCommandBlock[];
}

export { CustomCommandBlock };
