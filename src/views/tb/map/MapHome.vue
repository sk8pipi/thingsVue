<template>
  <div class="map-home">
    <!-- ✅ 全屏 Cesium -->
    <CesiumMap class="map-canvas" />

    <!-- ✅ 左上角设置按钮：跳回原本系统主页（/desktop 或 homePath） -->
    <button class="map-settings-btn" type="button" @click="openHome">设置</button>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { useRouter } from 'vue-router';
  import { useUserStore } from '/@/store/modules/user';
  import { PageEnum } from '/@/enums/pageEnum';
  import CesiumMap from './CesiumMap.vue';

  const router = useRouter();
  const userStore = useUserStore();

  // ✅ 跳回“原本 ThingsBoardVue 正常登录后的首页”
  const homePath = computed(() => {
    return userStore.getUserInfo?.additionalInfo?.homePath || PageEnum.BASE_HOME; // BASE_HOME = '/desktop'
  });

  function openHome() {
    router.push('/desktop/dashboard');
  }
</script>

<style scoped>
  .map-home {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .map-canvas {
    position: absolute;
    inset: 0;
  }

  .map-settings-btn {
    position: absolute;
    left: 12px;
    top: 12px;
    z-index: 2000;
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.7);
    background: rgba(22, 100, 145, 0.92);
    color: #fff;
    cursor: pointer;
  }

  /* Drawer 内部内容全高 */
  :deep(.tb-home-drawer .el-drawer__body) {
    padding: 0;
    height: 100%;
  }
</style>
