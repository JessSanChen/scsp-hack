import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { INCIDENTS } from '../data/incidents';
import type { IncidentMarker, Timeline } from '../data/mapTypes';

const INTENSITY_COLOR: Record<IncidentMarker['intensity'], string> = {
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#ef4444',
};

interface Props {
  currentTick: number;
  timeline: Timeline;
}

function turnFor(tick: number): 0 | 1 | 2 | 3 {
  return Math.max(0, Math.min(3, Math.round(tick))) as 0 | 1 | 2 | 3;
}

function makeIncidentIcon(inc: IncidentMarker): L.DivIcon {
  const color = INTENSITY_COLOR[inc.intensity];
  const html = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" style="filter:drop-shadow(0 0 6px ${color})80;overflow:visible">
    <circle cx="12" cy="12" r="9" fill="${color}33" stroke="${color}" stroke-width="1.4">
      <animate attributeName="r" values="6;10;6" dur="1.6s" repeatCount="indefinite"/>
      <animate attributeName="stroke-opacity" values="1;0.4;1" dur="1.6s" repeatCount="indefinite"/>
    </circle>
    <circle cx="12" cy="12" r="3.2" fill="${color}"/>
  </svg>
  <div style="position:absolute;top:26px;left:50%;transform:translateX(-50%);white-space:nowrap;font-family:'Space Mono',monospace;font-size:8px;color:${color};letter-spacing:0.08em;text-shadow:0 0 4px ${color}66;font-weight:600;">${inc.label}</div>`;
  return L.divIcon({
    html,
    className: '',
    iconSize: [24, 36],
    iconAnchor: [12, 12],
    tooltipAnchor: [12, -14],
  });
}

export function IncidentLayer({ currentTick, timeline }: Props) {
  const map = useMap();
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const arrowsRef = useRef<Map<string, L.Polyline>>(new Map());

  // Mount layer; recreate on timeline change to ensure clean state
  useEffect(() => {
    return () => {
      for (const m of markersRef.current.values()) map.removeLayer(m);
      for (const a of arrowsRef.current.values()) map.removeLayer(a);
      markersRef.current.clear();
      arrowsRef.current.clear();
    };
  }, [map, timeline]);

  useEffect(() => {
    const turn = turnFor(currentTick);
    const wantIds = new Set<string>();

    for (const inc of INCIDENTS) {
      if (inc.timeline && inc.timeline !== timeline) continue;
      if (inc.turn !== turn) continue;
      wantIds.add(inc.id);

      let m = markersRef.current.get(inc.id);
      if (!m) {
        m = L.marker([inc.position.lat, inc.position.lng], {
          icon: makeIncidentIcon(inc),
          zIndexOffset: 500,
        });
        m.bindTooltip(`<b>${inc.label}</b><br/>${inc.detail}`, {
          className: 'tactical-tooltip',
          direction: 'top',
          offset: [0, -16],
        });
        m.addTo(map);
        markersRef.current.set(inc.id, m);
      }

      if (inc.vectorTo) {
        let arrow = arrowsRef.current.get(inc.id);
        if (!arrow) {
          arrow = L.polyline(
            [
              [inc.position.lat, inc.position.lng],
              [inc.vectorTo.lat, inc.vectorTo.lng],
            ],
            {
              color: INTENSITY_COLOR[inc.intensity],
              weight: 2.2,
              opacity: 0.85,
              dashArray: '6 6',
            },
          );
          arrow.addTo(map);
          arrowsRef.current.set(inc.id, arrow);
        }
      }
    }

    // Remove incidents that are no longer for this turn
    for (const [id, m] of markersRef.current) {
      if (!wantIds.has(id)) {
        map.removeLayer(m);
        markersRef.current.delete(id);
      }
    }
    for (const [id, a] of arrowsRef.current) {
      if (!wantIds.has(id)) {
        map.removeLayer(a);
        arrowsRef.current.delete(id);
      }
    }
  }, [map, currentTick, timeline]);

  return null;
}
