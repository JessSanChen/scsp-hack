import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { TACTICAL_UNITS } from '../data/tacticalUnits';
import { FACTION_COLOR } from '../data/mapTypes';
import {
  interpolatePosition,
  interpolateThreatScale,
  interpolateVisibility,
} from '../hooks/useMapAnimation';
import type { TacticalUnit, Timeline } from '../data/mapTypes';

const NM_TO_KM = 1.852;

function unitShape(unit: TacticalUnit): string {
  const c = FACTION_COLOR[unit.faction];
  if (unit.domain === 'air') {
    return `<polygon points="12,1 23,23 1,23" fill="${c}" opacity="0.92" stroke="${c}" stroke-width="0.5"/>`;
  }
  if (unit.domain === 'sea') {
    return `<polygon points="12,1 23,12 12,23 1,12" fill="${c}" opacity="0.92" stroke="${c}" stroke-width="0.5"/>`;
  }
  return `<rect x="2" y="2" width="20" height="20" rx="2" fill="${c}" opacity="0.92" stroke="${c}" stroke-width="0.5"/>`;
}

function makeDivIcon(unit: TacticalUnit): L.DivIcon {
  const c = FACTION_COLOR[unit.faction];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" style="filter:drop-shadow(0 0 4px ${c})80;overflow:visible">
    ${unitShape(unit)}
  </svg>
  <div style="position:absolute;top:26px;left:50%;transform:translateX(-50%);white-space:nowrap;font-family:'Space Mono',monospace;font-size:7px;color:${c};letter-spacing:0.08em;text-shadow:0 0 4px ${c}66;">${unit.label}</div>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [24, 38],
    iconAnchor: [12, 12],
    tooltipAnchor: [12, -14],
  });
}

interface Props {
  currentTick: number;
  timeline: Timeline;
}

export function TacticalLayer({ currentTick, timeline }: Props) {
  const map = useMap();
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const circlesRef = useRef<Map<string, L.Circle>>(new Map());
  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    for (const unit of TACTICAL_UNITS) {
      const pos = interpolatePosition(unit, 0, timeline);
      const marker = L.marker([pos.lat, pos.lng], {
        icon: makeDivIcon(unit),
        zIndexOffset: unit.domain === 'air' ? 200 : unit.domain === 'sea' ? 100 : 0,
        opacity: interpolateVisibility(unit, 0, timeline),
      });
      marker.bindTooltip(`<b>${unit.name}</b><br/>${unit.faction} · ${unit.domain.toUpperCase()}`, {
        className: 'tactical-tooltip',
        direction: 'top',
        offset: [0, -16],
      });
      marker.addTo(map);
      markersRef.current.set(unit.id, marker);

      if (unit.threatRadiusNm && unit.domain !== 'air') {
        const scale = interpolateThreatScale(unit, 0);
        const circle = L.circle([pos.lat, pos.lng], {
          radius: unit.threatRadiusNm * NM_TO_KM * 1000 * scale,
          color: FACTION_COLOR[unit.faction],
          weight: 0.6,
          fillColor: FACTION_COLOR[unit.faction],
          fillOpacity: 0.04,
          dashArray: '4 6',
          opacity: 0.55,
        });
        circle.addTo(map);
        circlesRef.current.set(unit.id, circle);
      }
    }

    return () => {
      mountedRef.current = false;
      for (const m of markersRef.current.values()) map.removeLayer(m);
      for (const c of circlesRef.current.values()) map.removeLayer(c);
      markersRef.current.clear();
      circlesRef.current.clear();
    };
  }, [map, timeline]);

  // Imperative position updates per tick
  useEffect(() => {
    for (const unit of TACTICAL_UNITS) {
      const pos = interpolatePosition(unit, currentTick, timeline);
      const ll: L.LatLngExpression = [pos.lat, pos.lng];
      const visibility = interpolateVisibility(unit, currentTick, timeline);
      const m = markersRef.current.get(unit.id);
      m?.setLatLng(ll);
      m?.setOpacity(visibility);

      const c = circlesRef.current.get(unit.id);
      if (c) {
        c.setLatLng(ll);
        if (unit.threatRadiusNm) {
          const scale = interpolateThreatScale(unit, currentTick);
          c.setRadius(unit.threatRadiusNm * NM_TO_KM * 1000 * scale);
          c.setStyle({ opacity: 0.55 * visibility, fillOpacity: 0.04 * visibility });
        }
      }
    }
  });

  return null;
}
