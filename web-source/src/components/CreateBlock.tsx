import { GlobalOutlined } from "@ant-design/icons-vue";
import {
  Button,
  Card,
  Empty,
  Input,
  Modal,
  Popover,
  Select,
  Space,
  Switch,
  Table,
} from "ant-design-vue";
import type { SelectValue } from "ant-design-vue/es/select";
import { defineComponent, nextTick, onMounted, reactive, ref, watch } from "vue";

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
import type { Block, BlockTypeOption, FieldType } from "../domain/block.types";
import { blocklyService } from "../services/blockly.service";


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
const booleanDefaultOptions = [
  { label: "false", value: "false" },
  { label: "true", value: "true" },
];

export default defineComponent({
  setup() {
    const cloneBlock = (source: Block): Block => ({
      ...source,
      fields: source.fields.map((field) => ({
        ...field,
        defaultValue:
          field.defaultValue && typeof field.defaultValue === "object"
            ? JSON.parse(JSON.stringify(field.defaultValue))
            : field.defaultValue,
        options: field.options?.map((option) => ({
          ...option,
          label:
            option.label && typeof option.label === "object"
              ? JSON.parse(JSON.stringify(option.label))
              : option.label,
        })),
      })),
    });

    const applyBlockToEditor = (target: Block, source: Block) => {
      const nextBlock = cloneBlock(source);
      target.id = nextBlock.id;
      target.name = nextBlock.name;
      target.kind = nextBlock.kind;
      target.selectedType = nextBlock.selectedType;
      target.output = nextBlock.output;
      target.color = nextBlock.color;
      target.fields = nextBlock.fields;
      target.lang = nextBlock.lang;
      target.openUrl = nextBlock.openUrl;
    };

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
          if (record.type === "boolean") {
            return (
              <Select
                style="width:160px"
                options={booleanDefaultOptions}
                v-model:value={record.defaultValue}
              />
            );
          }

          if (record.type === "dropdown") {
            if (typeof record.defaultValue === "object") {
              record.defaultValue = "";
            }

            return (
              <Input
                placeholder="用逗号分隔，如 1,2,3,4"
                v-model:value={record.defaultValue}
                class="w-[160px]"
              />
            );
          }

          if (record.type === "array") {
            record.defaultValue = "";

            return (
              <Input
                disabled
                placeholder="数组类型不支持默认值"
                value=""
                class="w-[160px]"
              />
            );
          }

          if (!showLang.includes(record.type)) {
            // 保证 defaultValue 是普通值
            if (typeof record.defaultValue === "object") {
              record.defaultValue = "";
            }

            return (
              <Input
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
    const blockListColumns = [
      {
        title: "名称",
        key: "name",
        customRender: ({ record }: any) => record.name || record.id,
      },
      {
        title: "类型",
        key: "selectedType",
        customRender: ({ record }: any) =>
          blockTypeOptions[record.selectedType as string]?.label ?? record.selectedType ?? "-",
      },
      {
        title: "语言",
        key: "lang",
        dataIndex: "lang",
      },
      {
        title: "字段数",
        key: "fieldCount",
        customRender: ({ record }: any) => record.fields?.length ?? 0,
      },
      {
        title: "操作",
        key: "action",
        customRender: ({ record }: any) => (
          <Space size="small">
            <Button size="small" type="link" onClick={() => onSelectBlock(record)}>
              编辑
            </Button>
            <Button danger size="small" type="link" onClick={() => onDeleteBlock(record)}>
              删除
            </Button>
          </Space>
        ),
      },
    ];
    // blockly
    const block = reactive<Block>(createDefaultBlock());
    const blockList = ref<Block[]>([]);
    const currentBlockId = ref<string>(block.id);
    const editorVisible = ref(false);
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

    const syncWorkspaceBlock = (recreate = false) => {
      if (!created.value || !containerRef.value) return;

      const json = buildBlocklyJson(block);
      if (recreate) {
        service.clear();
      }
      service.registerCustomBlock(json);
      if (recreate) {
        service.createBlock(block.id);
      }
    };

    const ensureWorkspaceReady = async (recreate = true) => {
      await nextTick();
      if (!containerRef.value) return;

      if (!created.value) {
        service.init(containerRef.value, {
          readOnly: false,
          scrollbars: true,
          grid: { spacing: 20, length: 3, colour: "#e0e0e0", snap: true },
          zoom: { controls: true, wheel: true, startScale: 0.9 },
        });

        created.value = true;
        service.onChange((json) => {
          console.log("workspace json:", json);
        });
      }

      syncWorkspaceBlock(recreate);
    };

    const openEditor = async () => {
      editorVisible.value = true;
      await ensureWorkspaceReady(true);
    };

    const onSelectBlock = async (selectedBlock: Block) => {
      currentBlockId.value = selectedBlock.id;
      applyBlockToEditor(block, selectedBlock);
      await openEditor();
    };

    const onCreateBlock = async () => {
      const nextBlock = createDefaultBlock();
      currentBlockId.value = nextBlock.id;
      applyBlockToEditor(block, nextBlock);
      await openEditor();
    };

    const onCloseEditor = () => {
      editorVisible.value = false;
    };

    const saveBlockList = async (nextList: Block[], successMessage: string) => {
      const response = await fetch("http://localhost:8080/blocks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(nextList, null, 2),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log("保存成功：", result);
      blockList.value = nextList;
      onCloseEditor();
      Modal.success({ title: "保存成功", content: successMessage });
    };

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
        onOk: async() => {
          const nextBlock = cloneBlock(block);
          const nextList = [...blockList.value];
          const existingIndex = nextList.findIndex((item) => item.id === nextBlock.id);
          if (existingIndex >= 0) {
            nextList.splice(existingIndex, 1, nextBlock);
          } else {
            nextList.push(nextBlock);
          }

          // 向本地服务器下发post请求
          try {
            await saveBlockList(nextList, "数据已成功发送到服务器");
          }catch (error){
            console.log("保存失败:",error);
            Modal.error({title:"保存失败",content:"请检查网络或服务器状态"})
          }
        }
      });
    };

    const onDeleteBlock = (targetBlock: Block) => {
      Modal.confirm({
        title: "删除块",
        content: "删除后将无法恢复，确定继续吗？",
        okText: "删除",
        okButtonProps: { danger: true },
        cancelText: "取消",
        onOk: async () => {
          const nextList = blockList.value.filter((item) => item.id !== targetBlock.id);

          try {
            await saveBlockList(nextList, "块已删除");

            if (currentBlockId.value === targetBlock.id) {
              const firstBlock = nextList[0];
              if (firstBlock) {
                currentBlockId.value = firstBlock.id;
                applyBlockToEditor(block, firstBlock);
              } else {
                const nextBlock = createDefaultBlock();
                currentBlockId.value = nextBlock.id;
                applyBlockToEditor(block, nextBlock);
              }
              onCloseEditor();
            }
          } catch (error) {
            console.log("删除失败:", error);
            Modal.error({ title: "删除失败", content: "请检查网络或服务器状态" });
          }
        },
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
        if (!editorVisible.value) return;
        syncWorkspaceBlock(false);
      },
      { deep: true },
    );

    onMounted(() => {
      // 向本地服务器发送get请求获取指令块参数
      fetch("http://localhost:8080/blocks")
      .then(async (response) => {
        console.log("服务器响应：",response);
        if (!response.ok){
          throw new Error(`HTTP eror! status: ${response.status}`);
        }
        const data:Block[] = await response.json();
        console.log("获取到的指令块参数：",data);
        if (Array.isArray(data)) {
          blockList.value = data.map((item) => cloneBlock(item));
        } else {
          console.warn("返回数据格式不正确，无法初始化指令块列表");
        }
      })
      .catch(error => {
        console.error("获取指令块参数失败：", error);
      });
    });

    return () => (
      <div class="space-y-[10px]">
        <Card title="指令块列表"  extra={<Button type="primary" onClick={onCreateBlock}>创建新块</Button>}>
          <Table
            dataSource={blockList.value}
            columns={blockListColumns}
            rowKey="id"
            pagination={false}
            locale={{ emptyText: <Empty description="暂无块数据" /> }}
            rowClassName={(record: Block) =>
              currentBlockId.value === record.id ? "ant-table-row-selected" : ""
            }
            customRow={(record: Block) => ({
              onClick: () => onSelectBlock(record),
              style: { cursor: "pointer" },
            })}
          />
        </Card>
        <Modal
          open={editorVisible.value}
          title="编辑块"
          width={"100%"}
          // footer={null}
          forceRender
          destroyOnClose={false}
          maskClosable={false}
          onCancel={onCloseEditor}
          onUpdate:open={(value: boolean) => {
            editorVisible.value = value;
          }}
          onOk={onSave}
          cancelText={"取消"}
          okText={"确定"}
        >
          <div class="space-y-[16px]">
            <div class="w-full flex gap-[20px]">
              <div ref={containerRef} class="w-[400px] h-[300px]"></div>
              <div class="flex-1 space-y-[10px]">
                <div>
                  <div class="flex items-center flex-wrap gap-[10px]">
                    <Space>
                      <label>名称</label>
                      <Input class="w-[140px]" v-model:value={block.name} />
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
          </div>
        </Modal>
      </div>
    );
  },
});
