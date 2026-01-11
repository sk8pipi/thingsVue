<template>
  <div ref="el" class="tb-cesium"></div>
</template>

<script setup lang="ts">
  import { onMounted, onBeforeUnmount, ref } from 'vue';
  import * as Cesium from 'cesium';
  const el = ref<HTMLDivElement | null>(null);
  let viewer: Cesium.Viewer | null = null;

  onMounted(() => {
    if (!el.value) return;

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

    // 示例：飞到一个位置（你后面可以换成设备经纬度）
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(116.3913, 39.9075, 20000),
    });
  });

  onBeforeUnmount(() => {
    try {
      viewer?.destroy();
    } finally {
      viewer = null;
    }
  });
</script>

<style scoped>
  .tb-cesium {
    width: 100%;
    height: 100%;
  }
</style>
