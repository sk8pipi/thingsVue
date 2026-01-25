<!-- <template>
  <div ref="el" class="tb-cesium">
    <div v-if="err" class="tb-cesium-error">{{ err }}</div>
  </div>
</template>

<script setup lang="ts">
  import { onMounted, onBeforeUnmount, ref } from 'vue';
  import * as Cesium from 'cesium';

  const el = ref<HTMLDivElement | null>(null);
  const err = ref(''); // ✅ 关键：定义 err
  let viewer: Cesium.Viewer | null = null;

  function getCesiumBaseUrl() {
    const base = import.meta.env.BASE_URL || '/';
    // ✅ 强制保证末尾有 /
    return `${base.replace(/\/?$/, '/')}cesium/`.replace('//cesium/', '/cesium/');
    // 更简单也行：return `${base}cesium/`;
  }

  onMounted(async () => {
    if (!el.value) return;

    try {
      err.value = '';

      // ✅ 必须在任何 Cesium 资源加载前设置
      (window as any).CESIUM_BASE_URL = getCesiumBaseUrl();

      viewer = new Cesium.Viewer(el.value, {
        animation: false,
        timeline: false,
        baseLayerPicker: true,
        geocoder: false,
        homeButton: true,
        sceneModePicker: true,
        navigationHelpButton: false,
        fullscreenButton: false,
        infoBox: false,
        selectionIndicator: false,
        shouldAnimate: true,
      });

      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(116.3913, 39.9075, 20000),
      });
    } catch (e: any) {
      // ✅ 把错误展示出来，方便你定位资源路径/Token 等问题
      err.value = e?.message || String(e);
      console.error('[Cesium init error]', e);
    }
  });

  onBeforeUnmount(() => {
    try {
      viewer?.destroy();
    } catch (e) {
      console.warn('[Cesium destroy error]', e);
    } finally {
      viewer = null;
    }
  });
</script>

<style scoped>
  .tb-cesium {
    width: 100%;
    height: 100%;
    position: relative;
    overflow: hidden;
  }

  /* Cesium 自带 UI 的样式需要引入（看第 5 步） */

  .tb-cesium-error {
    position: absolute;
    top: 12px;
    left: 12px;
    z-index: 9999;
    padding: 10px 12px;
    border-radius: 8px;
    background: rgba(220, 38, 38, 0.95);
    color: #fff;
    font-size: 12px;
    max-width: 70%;
    white-space: pre-wrap;
  }
</style> -->
<template>
  <div ref="cesiumEl" class="cesium-container"></div>
</template>

<script setup lang="ts">
  import { onMounted, onBeforeUnmount, ref } from 'vue';
  import * as Cesium from 'cesium';

  // 你需要替换这两项
  const token = import.meta.env.VITE_CESIUM_ION_TOKEN as string;
  const ASSET_ID = 4379830; // 你的 Cesium ion Asset ID（数字）

  const cesiumEl = ref<HTMLDivElement | null>(null);
  let viewer: Cesium.Viewer | undefined;
  let tileset: Cesium.Cesium3DTileset | undefined;

  onMounted(async () => {
    if (!cesiumEl.value) return;

    // 1) 设置 ion token（必须）
    Cesium.Ion.defaultAccessToken = token;

    // 2) 创建 Viewer
    viewer = new Cesium.Viewer(cesiumEl.value, {
      terrain: Cesium.Terrain.fromWorldTerrain(),
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      navigationHelpButton: false,
      sceneModePicker: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
    });

    // 可选：更接近 3D 场景的观感
    viewer.scene.globe.depthTestAgainstTerrain = true;

    try {
      tileset = await Cesium.Cesium3DTileset.fromIonAssetId(ASSET_ID, {
        maximumScreenSpaceError: 16,
      });

      viewer.scene.primitives.add(tileset);

      // 关键：先等 tileset 真正准备好（建议加上）
      await tileset.readyPromise;

      const lon = 127.0;
      const lat = 37.5;
      // 采样地形高度
      const carto = Cesium.Cartographic.fromDegrees(lon, lat);
      const [sampled] = await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, [carto]);
      const ground = sampled.height ?? 0;

      // 给一个抬高偏移，先用 20m 验证，再调小
      const heightOffset = 20;
      const finalHeight = ground + heightOffset;

      // 设置位置与姿态
      tileset.modelMatrix = Cesium.Transforms.headingPitchRollToFixedFrame(
        Cesium.Cartesian3.fromDegrees(lon, lat, finalHeight),
        new Cesium.HeadingPitchRoll(0, 0, 0),
      );
      await viewer.flyTo(tileset, {
        offset: new Cesium.HeadingPitchRange(
          0,
          Cesium.Math.toRadians(-35),
          Math.max(100, tileset.boundingSphere.radius * 2.0),
        ),
      });
    } catch (err) {
      console.error('Failed to load tileset from ion:', err);
    }
  });

  onBeforeUnmount(() => {
    if (viewer && !viewer.isDestroyed()) {
      viewer.destroy();
    }
    viewer = undefined;
    tileset = undefined;
  });
</script>

<style scoped>
  .cesium-container {
    width: 100%;
    height: 100%;
    min-height: 600px; /* 你可按布局调整 */
  }
</style>
