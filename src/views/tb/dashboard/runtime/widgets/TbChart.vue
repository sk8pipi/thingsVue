<template>
  <div class="tb-chart">
    <VChart :option="option" autoresize />
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import VChart from 'vue-echarts';
  import * as echarts from 'echarts/core';
  import { LineChart } from 'echarts/charts';
  import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
  import { CanvasRenderer } from 'echarts/renderers';

  echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

  // 你后面可以把真实 timeseries 数据通过 props 传进来
  const option = computed(() => ({
    tooltip: { trigger: 'axis' },
    legend: { data: ['温度'] },
    grid: { left: 40, right: 20, top: 30, bottom: 30 },
    xAxis: { type: 'category', data: ['10:00', '10:05', '10:10', '10:15'] },
    yAxis: { type: 'value' },
    series: [{ name: '温度', type: 'line', data: [21, 23, 22, 24], smooth: true }],
  }));
</script>

<style scoped>
  .tb-chart {
    width: 100%;
    height: 100%;
  }
</style>
