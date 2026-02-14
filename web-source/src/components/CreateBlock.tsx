import { defineComponent, onMounted, ref, reactive, watch } from "vue";
import {
  Button,
  Card,
  Input,
  Modal,
  Popover,
  Select,
  Space,
  Switch,
  Table,
} from "ant-design-vue";
import { GlobalOutlined } from "@ant-design/icons-vue";
import type { SelectValue } from "ant-design-vue/es/select";

import { blocklyService } from "../services/blockly.service";
import type { BlockTypeOption, Block, FieldType } from "../domain/block.types";
import {
  addField,
  applyType,
  buildBlocklyJson,
  createDefaultBlock,
  deleteField,
  moveField,
  setFieldType,
  showLang,
} from "../application/block.application";


// options
const blockTypeOptions: Record<string, BlockTypeOption> = {
  statement: { label: "指令块", kind: "statement", output: "shape_statement" },
  boolean: { label: "布尔值", kind: "value", output: "output_boolean" },
  string: { label: "字符串", kind: "value", output: "output_string" },
  number: { label: "数字", kind: "value", output: "output_number" },
  array: { label: "数组", kind: "value", output: "output_string" },
};
const fieldTypeOptions = [
  { label: "文本", value: "text" },
  { label: "布尔值", value: "boolean" },
  { label: "字符串", value: "string" },
  { label: "数字", value: "number" },
  { label: "数组", value: "array" },
  { label: "下拉框", value: "dropdown" },
];
const langOptions = [
  { label: "中文", value: "zh" },
  { label: "英文", value: "en" },
  { label: "日语", value: "ja" },
];

// filter
const disabledInput = ["boolean", "array"];

export default defineComponent({
  setup() {
    // table
    const columns = [
      {
        title: "属性名",
        key: "label",
        customRender: ({ record }: any) => (
          <Input v-model:value={record.label} class="w-[150px]" />
        ),
      },
      {
        title: "类型",
        key: "type",
        customRender: ({ record }: any) => (
          <Select
            style="width:120px"
            options={fieldTypeOptions}
            v-model:value={record.type}
            onChange={(val) => setFieldType(block, record.id, val as FieldType)}
          />
        ),
      },
      {
        title: "默认值",
        key: "defaultValue",
        customRender: ({ record }: any) => {
          if (!showLang.includes(record.type)) {
            // 保证 defaultValue 是普通值
            if (typeof record.defaultValue === "object") {
              record.defaultValue = "";
            }

            return (
              <Input
                disabled={disabledInput.includes(record.type)}
                v-model:value={record.defaultValue}
                class="w-[160px]"
              />
            );
          }
          if (!record.defaultValue || typeof record.defaultValue !== "object") {
            record.defaultValue = { zh: "", en: "", ja: "" };
          }

          return (
            <div class="flex items-center gap-[6px] w-[160px]">
              {/* 当前语言输入 */}
              <Input v-model:value={record.defaultValue[block.lang]} />

              {/* 小地球按钮 */}
              <Popover
                trigger="click"
                placement="right"
                v-slots={{
                  title: () => "多语言配置",
                  content: () => (
                    <div class="w-[260px]">
                      <div class="mb-[8px]">
                        中文：
                        <Input v-model:value={record.defaultValue.zh} />
                      </div>

                      <div class="mb-[8px]">
                        英文：
                        <Input v-model:value={record.defaultValue.en} />
                      </div>

                      <div>
                        日语：
                        <Input v-model:value={record.defaultValue.ja} />
                      </div>
                    </div>
                  ),
                }}
              >
                <Button type="text" size="small" icon={<GlobalOutlined />} />
              </Popover>
            </div>
          );
        },
      },
      {
        title: "隐藏",
        key: "hidden",
        customRender: ({ record }: any) => (
          <Switch v-model:checked={record.hidden} />
        ),
      },
      {
        title: "操作",
        key: "action",
        customRender: ({ record }: any) => (
          <Button
            danger
            onClick={() => {
              deleteField(block, record.id);
            }}
          >
            删除
          </Button>
        ),
      },
    ];
    // blockly
    const block = reactive<Block>(createDefaultBlock());
    const containerRef = ref<HTMLDivElement | null>(null);
    const created = ref(false);
    const draggingFieldId = ref<string | null>(null);
    const service = blocklyService();
    const selectOptions = Object.entries(blockTypeOptions).map(
      ([key, val]) => ({
        label: val.label,
        value: key, // ✅ 只用 string
      }),
    );

    const onSave = () => {
      const json = buildBlocklyJson(block);

      // 格式化字符串
      const blockStr = JSON.stringify(block, null, 2);
      const jsonStr = JSON.stringify(json, null, 2);

      // 弹窗显示
      Modal.info({
        title: "Block 保存结果",
        width: 600,
        content: (
          <div class="flex flex-col gap-2 max-h-[400px] overflow-auto">
            <p class="font-semibold">最终 block 配置：</p>
            <pre class="bg-gray-900 text-green-400 p-3 rounded-md overflow-auto text-xs font-mono">
              {blockStr}
            </pre>

            <p class="font-semibold">最终 blockly JSON：</p>
            <pre class="bg-gray-900 text-green-400 p-3 rounded-md overflow-auto text-xs font-mono">
              {jsonStr}
            </pre>
          </div>
        ),
      });
    };

    const onAddField = () => {
      addField(block);
    };

    const onChangeSelectedType = (key: SelectValue) => {
      const typeOption = blockTypeOptions[key as string];
      if (typeOption) {
        applyType(block, typeOption);
      }
    };

    const customRow = (record: any, index?: number) => ({
      draggable: true,
      style: { cursor: "move" },
      onDragstart: () => {
        draggingFieldId.value = record.id;
      },
      onDragover: (e: DragEvent) => {
        e.preventDefault();
      },
      onDrop: (e: DragEvent) => {
        e.preventDefault();
        const fromId = draggingFieldId.value;
        if (!fromId || index === undefined) return;
        const fromIndex = block.fields.findIndex((f) => f.id === fromId);
        moveField(block, fromIndex, index);
        draggingFieldId.value = null;
      },
      onDragend: () => {
        draggingFieldId.value = null;
      },
    });

    watch(
      block,
      () => {
        if (!created.value) return; // 确保 workspace 已创建

        const json = buildBlocklyJson(block);
        service.registerCustomBlock(json);
      },
      { deep: true },
    );

    onMounted(() => {
      service.init(containerRef.value!, {
        readOnly: true,
        grid: { spacing: 20, length: 3, colour: "#e0e0e0", snap: true },
        zoom: { controls: true },
      });

      // 初次注册 block
      const json = buildBlocklyJson(block);
      service.registerCustomBlock(json);

      // 创建 block 到 workspace
      service.createBlock(block.id);
      created.value = true;

      service.onChange((json) => {
        console.log("workspace json:", json);
      });
    });

    return () => (
      <div class="space-y-[10px]">
        <div>
          <Button type="primary" onClick={onSave}>
            保存
          </Button>
        </div>
        <Card>
          <div class="w-full flex space-x-[20px]">
            <div ref={containerRef} class="w-[400px] h-[300px]"></div>
            <div class="flex-1 space-y-[10px]">
              <div>
                <div class="flex items-center flex-wrap gap-[10px]">
                  <Space>
                    <label>名称</label>
                    <Input class="w-[100px]" v-model:value={block.name} />
                  </Space>
                  <Space>
                    <label>指令块类型</label>
                    <Select
                      v-model:value={block.selectedType}
                      class="w-[180px]"
                      placeholder="指令块类型"
                      options={selectOptions}
                      onChange={onChangeSelectedType}
                    />
                  </Space>
                  <Space>
                    <label>颜色</label>
                    <Input
                      v-model:value={block.color}
                      type="color"
                      class="w-[100px]"
                    />
                  </Space>
                  <Space>
                    <label>指令界面</label>
                    <Input v-model:value={block.openUrl} />
                  </Space>
                  <Space>
                    <label>语言</label>
                    <Select
                      v-model:value={block.lang}
                      class="w-[180px]"
                      placeholder="语言"
                      options={langOptions}
                    ></Select>
                  </Space>
                </div>
              </div>
              <div class="space-y-[10px]">
                <Space class="flex flex-row-reverse">
                  <Button onClick={onAddField}>+</Button>
                </Space>
                <Table
                  dataSource={block.fields}
                  columns={columns}
                  rowKey="id"
                  pagination={false}
                  customRow={customRow}
                />
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  },
});
