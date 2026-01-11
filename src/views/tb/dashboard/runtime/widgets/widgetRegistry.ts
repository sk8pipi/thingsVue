import TbCesiumMap from './TbCesiumMap.vue';
import TbChart from './TbChart.vue';

export type LocalWidgetKey = 'cesium3d' | 'chart';

export const widgetRegistry: Record<LocalWidgetKey, any> = {
  cesium3d: TbCesiumMap,
  chart: TbChart,
};
