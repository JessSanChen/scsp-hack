import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';
import { POPULATION_DENSITY } from '../data/populationDensity';

export function HeatmapLayer() {
  const map = useMap();
  const layerRef = useRef<L.Layer | null>(null);

  useEffect(() => {
    const heat = L.heatLayer(POPULATION_DENSITY, {
      radius: 28,
      blur: 22,
      max: 1.0,
      minOpacity: 0.3,
      gradient: {
        '0.0': '#060b14',
        '0.2': '#1e3a5f',
        '0.45': '#0ea5e9',
        '0.65': '#f59e0b',
        '0.85': '#ef4444',
        '1.0': '#fef2f2',
      },
    });
    heat.addTo(map);
    layerRef.current = heat;

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map]);

  return null;
}
