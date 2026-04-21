export type BlocklyService = ReturnType<typeof blocklyService>;

export const blocklyService = () => {
  let workspace: any = null;

  const defaultMediaPath = new URL("./media/", window.location.href).toString();

  // const registeredTypes = new Set<string>();
  /** 初始化 workspace */
  const init = (container: HTMLElement, options?: any) => {
    workspace = window.Blockly.inject(container, {
      // toolbox: { kind: "flyoutToolbox", contents: [] },
      pathToMedia: defaultMediaPath,
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
    block.initSvg();
    block.render();
    block.moveBy(50, 50);
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
