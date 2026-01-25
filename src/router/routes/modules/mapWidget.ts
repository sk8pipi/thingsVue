import type { AppRouteRecordRaw } from '/@/router/types';

const mapWidget: AppRouteRecordRaw = {
  path: '/map-widget',
  name: 'MapWidget',
  component: () => import('/@/views/tb/map/MapWidgetEditor.vue'),
  meta: {
    title: '地图部件',
    ignoreKeepAlive: true,
    // 如果你的权限路由支持 roles，可加：
    // roles: ['SYS_ADMIN','TENANT_ADMIN','CUSTOMER_USER']
    // 或按你项目 Authority 枚举写
  },
};

export default mapWidget;
