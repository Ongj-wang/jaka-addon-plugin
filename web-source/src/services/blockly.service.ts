export type BlocklyService = ReturnType<typeof blocklyService>;

export const blocklyService = () => {
  let workspace: any = null;
  const blockDefinitions = new Map<string, any>();

  const defaultMediaPath = new URL("./media/", window.location.href).toString();

  const registerShadowBlocks = () => {
    if (window.Blockly.Blocks.jaka_boolean_shadow) return;

    window.Blockly.Blocks.jaka_boolean_shadow = {
      init: function () {
        this.jsonInit({
          message0: "%1",
          args0: [{ type: "field_checkbox", name: "BOOL", checked: false }],
          output: "Boolean",
          outputShape: window.Blockly.OUTPUT_SHAPE_HEXAGONAL,
          colour: window.Blockly.Colours.textField,
          colourSecondary: window.Blockly.Colours.textField,
          colourTertiary: window.Blockly.Colours.textField,
        });
      },
    };
  };

  const createShadowBlock = (arg: any) => {
    if (!workspace) return null;

    if (arg.defaultValueType === "boolean") {
      const shadow = workspace.newBlock("jaka_boolean_shadow");
      if (typeof shadow.setShadow === "function") {
        shadow.setShadow(true);
      }
      shadow.setFieldValue(
        String(arg.defaultValue).toLowerCase() === "true" ? "TRUE" : "FALSE",
        "BOOL",
      );
      return shadow;
    }

    if (arg.defaultValueType === "number") {
      const shadow = workspace.newBlock("math_number");
      if (typeof shadow.setShadow === "function") {
        shadow.setShadow(true);
      }
      shadow.setFieldValue(String(arg.defaultValue || "0"), "NUM");
      return shadow;
    }

    if (arg.defaultValueType === "string" || arg.defaultValueType === "array") {
      const shadow = workspace.newBlock("text");
      if (typeof shadow.setShadow === "function") {
        shadow.setShadow(true);
      }
      shadow.setFieldValue(String(arg.defaultValue ?? ""), "TEXT");
      return shadow;
    }

    return null;
  };

  const attachDefaultInputs = (block: any, json: any) => {
    if (!workspace || !json?.args0) return;

    json.args0.forEach((arg: any) => {
      if (arg.type !== "input_value") return;

      const input = block.getInput(arg.name);
      if (!input?.connection || input.connection.isConnected()) return;

      const shadow = createShadowBlock(arg);
      if (!shadow?.outputConnection) return;

      shadow.initSvg();
      shadow.render();
      input.connection.connect(shadow.outputConnection);
    });
  };

  const placeBlockInViewport = (block: any) => {
    if (!workspace) return;

    const metrics = workspace.getMetrics?.();
    const size = block.getHeightWidth?.();
    if (!metrics || !size) return;

    const targetX = metrics.viewLeft + 24;
    const targetY = metrics.viewTop + 24;
    const current = block.getRelativeToSurfaceXY?.();
    if (!current) return;

    block.moveBy(targetX - current.x, targetY - current.y);
  };

  // const registeredTypes = new Set<string>();
  /** 初始化 workspace */
  const init = (container: HTMLElement, options?: any) => {
    registerShadowBlocks();
    workspace = window.Blockly.inject(container, {
      pathToMedia: defaultMediaPath,
      toolbox: { kind: "flyoutToolbox", contents: [] },
      ...options,
    });
  };

  /** 监听 workspace 改动 */
  const onChange = (callback: (json: any) => void) => {
    if (!workspace) return;
    workspace.addChangeListener(() => {
      const blocks = workspace.getAllBlocks(false);
      const json = blocks.map((b: any) => b.toJSON?.() || b);
      callback(json);
    });
  };

  /** 获取当前 workspace block JSON */
  const getJson = () => {
    if (!workspace) return null;
    return workspace.getAllBlocks(false).map((b: any) => b.toJSON?.() || b);
  };

  /** 清空 workspace */
  const clear = () => {
    workspace?.clear();
  };

  /** 销毁 workspace */
  const destroy = () => {
    workspace?.dispose();
    workspace = null;
  };

  /** 注册自定义 block */
  const registerCustomBlock = (json: any) => {
    if (!json?.type) return;
    blockDefinitions.set(json.type, json);

    window.Blockly.Blocks[json.type] = {
      init: function () {
        this.jsonInit(json);
      },
    };

    // registeredTypes.add(json.type);
    refreshBlocks(json.type);
  };

  /** 刷新 workspace 中指定类型 block */
  const refreshBlocks = (type: string) => {
    if (!workspace) return;

    workspace
      .getAllBlocks(false)
      .filter((b: any) => b.type === type)
      .forEach((oldBlock: any) => {
        const pos = oldBlock.getRelativeToSurfaceXY();
        oldBlock.dispose(false);
        const newBlock = workspace.newBlock(type);
        attachDefaultInputs(newBlock, blockDefinitions.get(type));
        newBlock.initSvg();
        newBlock.render();
        newBlock.moveBy(pos.x, pos.y);
      });
  };

  /** 更新 toolbox */
  const updateToolbox = (xmlOrContents: string | any[]) => {
    if (!workspace) return;
    if (typeof xmlOrContents === "string") {
      // xml 字符串
      workspace.updateToolbox(xmlOrContents);
    } else {
      // json 对象
      workspace.updateToolbox({
        kind: "flyoutToolbox",
        contents: xmlOrContents,
      });
    }
  };

  /** 在 workspace 中创建 block */
  const createBlock = (type: string) => {
    if (!workspace) return;
    const block = workspace.newBlock(type);
    attachDefaultInputs(block, blockDefinitions.get(type));
    block.initSvg();
    block.render();
    placeBlockInViewport(block);
  };

  return {
    init,
    onChange,
    getJson,
    clear,
    destroy,
    registerCustomBlock,
    updateToolbox,
    createBlock,
  };
};
