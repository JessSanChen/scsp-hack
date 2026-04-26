import { useState, useCallback } from 'react';
import type { LayerToggles } from '../data/mapTypes';

const DEFAULT: LayerToggles = {
  heatmap: true,
  infra: false,
  flights: true,
  tactical: true,
};

export function useLayerToggles() {
  const [toggles, setToggles] = useState<LayerToggles>(() => {
    try {
      const saved = localStorage.getItem('wargame-layer-toggles');
      return saved ? { ...DEFAULT, ...JSON.parse(saved) } : DEFAULT;
    } catch {
      return DEFAULT;
    }
  });

  const toggle = useCallback((key: keyof LayerToggles) => {
    setToggles(prev => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem('wargame-layer-toggles', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  return { toggles, toggle };
}
