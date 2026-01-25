<template>
  <!-- 覆盖层：只负责渲染，不负责编辑 -->
  <div ref="gridEl" class="mw-layer grid-stack"></div>
</template>

<script setup lang="ts">
  import { ref, onMounted, onBeforeUnmount, nextTick, watch } from 'vue';
  import { GridStack } from 'gridstack';
  import 'gridstack/dist/gridstack.min.css';

  import { createApp, h } from 'vue';
  import { widgetRegistry, type LocalWidgetKey } from '/@/views/tb/dashboard/runtime/widgets/widgetRegistry';

  type GridItem = { i: string; x: number; y: number; w: number; h: number };
  type WidgetData = { id: string; type: LocalWidgetKey; title: string; config: Record<string, any> };

  const props = defineProps<{
    storageKey: string;
  }>();

  const gridEl = ref<HTMLDivElement | null>(null);
  let grid: GridStack | null = null;

  // mounted 的 Vue 子应用实例（每个 widget 一个）
  const mountedApps = new Map<string, ReturnType<typeof createApp>>();

  function unmountWidget(id: string) {
    const app = mountedApps.get(id);
    if (app) {
      try { app.unmount(); } catch {}
      mountedApps.delete(id);
    }
  }
  function unmountAll() {
    mountedApps.forEach((app) => { try { app.unmount(); } catch {} });
    mountedApps.clear();
  }

  let renderPatched = false;
  function patchGridstackRenderOnce() {
    if (renderPatched) return;
    renderPatched = true;
    GridStack.renderCB = (el, w) => {
      const html = (w as any)?.content ?? '';
      el.innerHTML = String(html);
    };
  }

  function widgetHtml(id: string, title: string) {
    return `
      <div class="mw-widget">
        <div class="mw-title">${title}</div>
        <div class="mw-body">
          <div id="mw-mount-${id}" class="mw-mount"></div>
        </div>
      </div>
    `;
  }

  async function mountWidget(id: string, key: LocalWidgetKey) {
    await nextTick();
    const mountEl = document.getElementById(`mw-mount-${id}`);
    if (!mountEl) return;

    unmountWidget(id);

    const Comp = (widgetRegistry as any)[key];
    if (!Comp) return;

    const app = createApp({ render: () => h(Comp) });
    app.mount(mountEl);
    mountedApps.set(id, app);
  }

  function loadData(): { layout: GridItem[]; widgets: Record<string, WidgetData> } {
    try {
      const raw = localStorage.getItem(props.storageKey);
      if (!raw) return { layout: [], widgets: {} };
      const parsed = JSON.parse(raw);
      return {
        layout: Array.isArray(parsed?.layout) ? parsed.layout : [],
        widgets: parsed?.widgets && typeof parsed.widgets === 'object' ? parsed.widgets : {},
      };
    } catch {
      return { layout: [], widgets: {} };
    }
  }

  function render() {
    if (!grid) return;

    const { layout, widgets } = loadData();

    unmountAll();
    grid.removeAll(false);

    layout.forEach((it) => {
      const w = widgets[it.i];
      const title = w?.title || it.i;
      const type = w?.type as LocalWidgetKey | undefined;

      grid!.addWidget({
        id: it.i,
        x: it.x,
        y: it.y,
        w: it.w,
        h: it.h,
        content: widgetHtml(it.i, title),
      } as any);

      if (type) mountWidget(it.i, type);
    });

    // 展示层：禁止拖拽/缩放
    grid.setStatic(true);
  }

  onMounted(async () => {
    await nextTick();
    if (!gridEl.value) return;

    patchGridstackRenderOnce();

    grid = GridStack.init(
      {
        column: 12,
        cellHeight: 30,
        margin: 10,
        float: true,
        disableResize: true,
        disableDrag: true,
      },
      gridEl.value,
    );

    render();
  });

  // storageKey 变化时重新渲染（比如不同角色）
  watch(
    () => props.storageKey,
    async () => {
      await nextTick();
      render();
    },
  );

  onBeforeUnmount(() => {
    grid?.destroy(false);
    grid = null;
    unmountAll();
  });
</script>

<style scoped>
  /* 覆盖层本身不抢事件，widget 内容再单独开 */
  .mw-layer {
    position: absolute;
    inset: 0;
    z-index: 10;
    pointer-events: none;
  }

  :deep(.grid-stack-item-content) {
    pointer-events: auto;
  }

  :deep(.mw-widget) {
    height: 100%;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: rgba(18, 22, 30, 0.75);
    overflow: hidden;
    display: flex;
    flex-direction: column;
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
</style>
