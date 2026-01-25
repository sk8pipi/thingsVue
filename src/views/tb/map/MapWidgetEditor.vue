<template>
  <div class="mw-editor">
    <!-- ✅ 底图：Cesium 全屏 -->
    <CesiumMap class="mw-cesium" />

    <!-- ✅ 顶部工具条 -->
    <div class="mw-topbar">
      <div class="mw-topbar-left">
        <button class="mw-btn" type="button" @click="onExit">退出</button>
      </div>

      <div class="mw-topbar-right">
        <button v-if="!editMode" class="mw-btn primary" type="button" @click="enterEdit">编辑</button>

        <template v-else>
          <button class="mw-btn" type="button" @click="openAddPanel">添加部件</button>
          <button class="mw-btn" type="button" @click="cancelEdit">取消</button>
          <button class="mw-btn primary" type="button" @click="saveEdit">保存</button>
        </template>
      </div>
    </div>

    <!-- ✅ 添加部件面板（编辑模式才出现） -->
    <div v-if="editMode && addPanelVisible" class="mw-add-panel">
      <div class="mw-add-title">选择要添加的部件</div>

      <div class="mw-add-list">
        <button class="mw-add-item" type="button" @click="addWidgetByKey('chart')">图表（Chart）</button>

        <!-- 你也可以添加更多 widgetKey -->
        <!-- <button class="mw-add-item" type="button" @click="addWidgetByKey('singleValue')">单值卡片</button> -->
      </div>

      <div class="mw-add-footer">
        <button class="mw-btn" type="button" @click="addPanelVisible = false">关闭</button>
      </div>
    </div>

    <!-- ✅ GridStack 叠加层（屏幕空间“放到地图上”） -->
    <div ref="gridEl" class="mw-grid grid-stack" :class="{ 'mw-editing': editMode }"></div>

    <!-- 错误提示 -->
    <div v-if="errorMsg" class="mw-error">{{ errorMsg }}</div>
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
  import { useRouter, useRoute } from 'vue-router';

  import { GridStack } from 'gridstack';
  import 'gridstack/dist/gridstack.min.css';

  import CesiumMap from './CesiumMap.vue';

  // ✅ 复用你之前的本地部件注册表
  // 如果你的 registry 路径不同，请按项目实际路径修改
  import { createApp, h } from 'vue';
  import { widgetRegistry, type LocalWidgetKey } from '/@/views/tb/dashboard/runtime/widgets/widgetRegistry';
  import { getMapWidgetStorageKey } from './mapWidgetStorage';

  type GridItem = { i: string; x: number; y: number; w: number; h: number };
  type WidgetData = { id: string; type: LocalWidgetKey; title: string; config: Record<string, any> };

  const router = useRouter();
  const route = useRoute();

  const gridEl = ref<HTMLDivElement | null>(null);
  let grid: GridStack | null = null;

  const editMode = ref(false);
  const addPanelVisible = ref(false);
  const errorMsg = ref('');

  // 数据：布局 + 部件
  const layout = ref<GridItem[]>([]);
  const widgets = ref<Record<string, WidgetData>>({});

  // 编辑快照（取消要回滚）
  let snapshot: { layout: GridItem[]; widgets: Record<string, WidgetData> } | null = null;

  // ✅ mounted 的 Vue 小组件实例
  const mountedApps = new Map<string, ReturnType<typeof createApp>>();

  // ----------------------------
  // GridStack v11+ 默认 textContent，会把 HTML 当文本显示
  // ✅ 必须改成 innerHTML
  // ----------------------------
  let renderPatched = false;
  function patchGridstackRenderOnce() {
    if (renderPatched) return;
    renderPatched = true;
    GridStack.renderCB = (el, w) => {
      const html = (w as any)?.content ?? '';
      el.innerHTML = String(html);
    };
  }

  // ----------------------------
  // 本地持久化（你后续可以改成保存到 TB dashboard.configuration 或后端）
  // 按角色/租户区分也行，这里先用一个 key
  // ----------------------------
  function storageKey() {
    return getMapWidgetStorageKey();
  }

  function loadFromLocal() {
    try {
      const raw = localStorage.getItem(storageKey());
      if (!raw) return;
      const parsed = JSON.parse(raw);
      layout.value = Array.isArray(parsed?.layout) ? parsed.layout : [];
      widgets.value = parsed?.widgets && typeof parsed.widgets === 'object' ? parsed.widgets : {};
    } catch (e) {
      console.warn('load map widgets failed', e);
    }
  }

  function saveToLocal() {
    localStorage.setItem(
      storageKey(),
      JSON.stringify({
        layout: layout.value,
        widgets: widgets.value,
      }),
    );
  }

  // ----------------------------
  // Vue Widget Mount/Unmount
  // ----------------------------
  function unmountWidget(id: string) {
    const old = mountedApps.get(id);
    if (old) {
      try {
        old.unmount();
      } catch {}
      mountedApps.delete(id);
    }
  }

  function unmountAllWidgets() {
    mountedApps.forEach((app) => {
      try {
        app.unmount();
      } catch {}
    });
    mountedApps.clear();
  }

  async function mountWidget(id: string, key: LocalWidgetKey) {
    await nextTick();
    const mountEl = document.getElementById(`mw-mount-${id}`);
    if (!mountEl) return;

    unmountWidget(id);

    const Comp = (widgetRegistry as any)[key];
    if (!Comp) {
      console.warn('widgetRegistry missing key:', key);
      return;
    }

    const app = createApp({
      render: () => h(Comp),
    });

    app.mount(mountEl);
    mountedApps.set(id, app);
  }

  // ----------------------------
  // HTML 模板：删除按钮 + 标题 + 内容容器
  // 删除按钮默认隐藏，用 CSS hover 显示
  // ----------------------------
  function widgetHtml(id: string, title: string) {
    return `
      <div class="mw-widget">
        <button class="mw-del" data-id="${id}" title="删除">×</button>
        <div class="mw-title">${title}</div>
        <div class="mw-body">
          <div id="mw-mount-${id}" class="mw-mount"></div>
        </div>
      </div>
    `;
  }

  // ----------------------------
  // 渲染 Grid
  // ----------------------------
  function renderGrid() {
    if (!grid) return;

    // 先卸载旧 Vue 子应用
    unmountAllWidgets();

    // 清空旧 item
    grid.removeAll(false);

    layout.value.forEach((it) => {
      const w = widgets.value[it.i];
      const title = w?.title || it.i;
      const type = w?.type;

      grid!.addWidget({
        id: it.i,
        x: it.x,
        y: it.y,
        w: it.w,
        h: it.h,
        content: widgetHtml(it.i, title),
      } as any);

      if (type) {
        mountWidget(it.i, type);
      }
    });
  }

  function syncLayoutFromGrid() {
    if (!grid) return;
    layout.value = grid.engine.nodes.map((n) => ({
      i: String(n.id),
      x: n.x ?? 0,
      y: n.y ?? 0,
      w: n.w ?? 1,
      h: n.h ?? 1,
    }));
  }

  // ----------------------------
  // 删除：事件委托（必须绑在 grid 容器，capture 更稳）
  // ----------------------------
  function onGridClick(e: Event) {
    if (!editMode.value) return;

    const target = e.target as HTMLElement | null;
    const btn = target?.closest?.('.mw-del') as HTMLElement | null;
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    const id = btn.getAttribute('data-id') || '';
    if (!id) return;

    deleteWidgetById(id, btn);
  }

  function deleteWidgetById(id: string, btnEl?: HTMLElement) {
    if (!grid) return;

    // 1) 卸载 Vue
    unmountWidget(id);

    // 2) 找到 grid-stack-item 并删除（✅ 关键：删除“框”，不是只删内容）
    const itemEl =
      (btnEl?.closest('.grid-stack-item') as HTMLElement | null) ||
      (gridEl.value?.querySelector(`.grid-stack-item[gs-id="${id}"]`) as HTMLElement | null) ||
      (gridEl.value?.querySelector(`.grid-stack-item[data-gs-id="${id}"]`) as HTMLElement | null) ||
      null;

    if (itemEl) {
      grid.removeWidget(itemEl, true);
    }

    // 3) 删除数据
    delete widgets.value[id];
    layout.value = layout.value.filter((it) => it.i !== id);

    // 4) 同步 layout
    syncLayoutFromGrid();
  }

  // ----------------------------
  // 添加部件
  // ----------------------------
  function addWidgetByKey(key: LocalWidgetKey) {
    if (!grid) return;
    if (!editMode.value) return;

    const id = `mw_${Date.now()}`;
    const title =
      key === 'chart' ? '图表（Chart）' : key === 'cesium3d' ? '三维地图（Cesium）' : `部件（${String(key)}）`;

    widgets.value[id] = {
      id,
      type: key,
      title,
      config: {},
    };

    // GridStack 自动排布：不给 x/y
    grid.addWidget({
      id,
      w: 5,
      h: 4,
      content: widgetHtml(id, title),
    } as any);

    mountWidget(id, key);

    syncLayoutFromGrid();
    addPanelVisible.value = false;
  }

  // ----------------------------
  // 顶部按钮：退出/编辑/添加/取消/保存
  // ----------------------------
  function onExit() {
    // 退出回 desktop（你要求的）
    router.push('/desktop/dashboard');
  }

  function enterEdit() {
    if (!grid) return;

    snapshot = {
      layout: JSON.parse(JSON.stringify(layout.value)),
      widgets: JSON.parse(JSON.stringify(widgets.value)),
    };

    editMode.value = true;
    addPanelVisible.value = false;

    // ✅ 允许拖拽缩放
    grid.setStatic(false);
    // ✅ 强制开启拖拽/缩放（有的项目里 setStatic 不够）
    grid.enableMove(true);
    grid.enableResize(true);
  }

  function openAddPanel() {
    if (!editMode.value) return;
    addPanelVisible.value = !addPanelVisible.value;
  }

  function cancelEdit() {
    if (!grid) return;

    if (snapshot) {
      layout.value = JSON.parse(JSON.stringify(snapshot.layout));
      widgets.value = JSON.parse(JSON.stringify(snapshot.widgets));
      renderGrid();
    }

    editMode.value = false;
    addPanelVisible.value = false;

    // ✅ 回到查看模式：不可拖拽缩放
    grid.setStatic(true);
  }

  function saveEdit() {
    if (!grid) return;

    // 同步最新 layout
    syncLayoutFromGrid();

    // ✅ 本地保存（你后续改成写回 TB dashboard.configuration 即可）
    saveToLocal();

    editMode.value = false;
    addPanelVisible.value = false;
    grid.setStatic(true);
  }

  // ----------------------------
  // 初始化
  // ----------------------------
  onMounted(async () => {
    await nextTick();
    if (!gridEl.value) return;

    patchGridstackRenderOnce();

    // 先加载本地数据
    loadFromLocal();

    grid = GridStack.init(
      {
        column: 12,
        cellHeight: 30,
        margin: 10,
        float: true,

        // ✅ 关键：允许缩放
        disableResize: false,
        resizable: { handles: 'all' }, // 或 'e, se, s, sw, w' 等

        // ✅ 允许拖拽（你已有的话也保留）
        disableDrag: false,
      },
      gridEl.value,
    );

    // 监听删除按钮
    gridEl.value.addEventListener('click', onGridClick, true);

    // 编辑时同步 layout（查看模式不更新）
    grid.on('change', () => {
      if (!grid) return;
      if (!editMode.value) return;
      syncLayoutFromGrid();
    });

    // 初次渲染
    renderGrid();

    // 默认查看模式：不可拖拽缩放
    grid.setStatic(true);
  });

  onBeforeUnmount(() => {
    gridEl.value?.removeEventListener('click', onGridClick, true);
    grid?.destroy(false);
    grid = null;
    unmountAllWidgets();
  });
</script>

<style scoped>
  .mw-editor {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .mw-cesium {
    position: absolute;
    inset: 0;
    z-index: 1;
  }

  /* 顶部栏 */
  .mw-topbar {
    position: absolute;
    top: 12px;
    left: 12px;
    right: 12px;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: space-between;
    pointer-events: none; /* 让底图可交互 */
  }

  .mw-topbar-left,
  .mw-topbar-right {
    display: flex;
    gap: 10px;
    pointer-events: auto; /* 按钮可点 */
  }

  .mw-btn {
    border: 1px solid rgba(255, 255, 255, 0.55);
    background: rgba(25, 30, 40, 0.72);
    color: #fff;
    padding: 8px 12px;
    border-radius: 10px;
    cursor: pointer;
    font-size: 13px;
    line-height: 1;
    backdrop-filter: blur(6px);
  }

  .mw-btn.primary {
    background: rgba(22, 100, 145, 0.88);
  }

  /* 添加面板 */
  .mw-add-panel {
    position: absolute;
    top: 58px;
    left: 12px;
    z-index: 30;
    width: 260px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: rgba(25, 30, 40, 0.82);
    color: #fff;
    padding: 12px;
    backdrop-filter: blur(10px);
  }

  .mw-add-title {
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 10px;
  }

  .mw-add-list {
    display: grid;
    gap: 8px;
    margin-bottom: 10px;
  }

  .mw-add-item {
    width: 100%;
    text-align: left;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: rgba(255, 255, 255, 0.06);
    color: #fff;
    padding: 10px 10px;
    cursor: pointer;
  }

  .mw-add-footer {
    display: flex;
    justify-content: flex-end;
  }

  /* GridStack overlay */
  .mw-grid {
    position: absolute;
    inset: 0;
    z-index: 10;
    pointer-events: none;
  }

  /* ✅ 编辑模式才让 GridStack 接收鼠标（拖拽/缩放就会恢复） */
  .mw-grid.mw-editing {
    pointer-events: auto;
  }

  /* ✅ 编辑模式下，item 内容也可交互 */
  :deep(.mw-grid.mw-editing .grid-stack-item),
  :deep(.mw-grid.mw-editing .grid-stack-item-content) {
    pointer-events: auto;
  }

  /* widget 外观 */
  :deep(.mw-widget) {
    height: 100%;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: rgba(18, 22, 30, 0.75);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    position: relative;
    backdrop-filter: blur(8px);
  }

  :deep(.mw-title) {
    height: 34px;
    line-height: 34px;
    padding: 0 10px;
    font-size: 13px;
    font-weight: 600;
    color: #fff;
    border-bottom: 1px solid rgba(255, 255, 255, 0.12);
    cursor: move; /* 拖拽手柄 */
    user-select: none;
  }

  :deep(.mw-body) {
    flex: 1;
    padding: 8px;
    min-height: 0;
  }

  :deep(.mw-mount) {
    width: 100%;
    height: 100%;
  }

  /* 删除按钮：默认隐藏，hover 显示（仅编辑模式） */
  :deep(.mw-del) {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 26px;
    height: 26px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.35);
    background: rgba(0, 0, 0, 0.35);
    color: #fff;
    cursor: pointer;
    display: none;
    z-index: 50;
  }

  :deep(.mw-editing .mw-widget:hover .mw-del) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  /* 查看模式：不显示 resize handle，不可拖动 */
  :deep(.grid-stack-item.ui-draggable-disabled .mw-title) {
    cursor: default;
  }

  .mw-error {
    position: absolute;
    left: 12px;
    bottom: 12px;
    z-index: 60;
    max-width: 70%;
    padding: 10px 12px;
    border-radius: 10px;
    background: rgba(220, 38, 38, 0.9);
    color: #fff;
    font-size: 12px;
    white-space: pre-wrap;
  }
</style>
