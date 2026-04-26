declare module '*.png' {
  const value: string;
  export default value;
}

import type L from 'leaflet';

declare module 'leaflet' {
  function heatLayer(
    latlngs: [number, number, number][],
    options?: {
      minOpacity?: number;
      maxZoom?: number;
      max?: number;
      radius?: number;
      blur?: number;
      gradient?: Record<string, string>;
    }
  ): L.Layer;
}
