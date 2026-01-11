export type WidgetType = 'singleValue' | 'timeseries' | 'table' | 'unknown';

export interface GridItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DashboardWidget {
  id: string;
  type: WidgetType;
  title: string;
  config?: Record<string, any>;
}
