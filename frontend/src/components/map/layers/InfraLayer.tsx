import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import type { InfraFeature } from '../data/mapTypes';
import { INFRA_FALLBACK } from '../data/infraFallback';

const OVERPASS_QUERY = `
[out:json][timeout:5];
area["ISO3166-1"="TW"]->.a;
(
  node["amenity"="hospital"](area.a);
  node["amenity"="school"](area.a);
  node["power"="substation"](area.a);
);
out body 80;
`.trim();

const ICON_SVG: Record<InfraFeature['type'], string> = {
  hospital: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14">
    <rect width="14" height="14" rx="2" fill="rgba(239,68,68,0.8)"/>
    <rect x="6" y="2" width="2" height="10" fill="white"/>
    <rect x="2" y="6" width="10" height="2" fill="white"/>
  </svg>`,
  school: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14">
    <rect width="14" height="14" rx="2" fill="rgba(59,130,246,0.8)"/>
    <text x="7" y="10.5" text-anchor="middle" font-size="9" fill="white" font-family="sans-serif">S</text>
  </svg>`,
  power: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14">
    <rect width="14" height="14" rx="2" fill="rgba(245,158,11,0.85)"/>
    <text x="7" y="10.5" text-anchor="middle" font-size="10" fill="white" font-family="sans-serif">⚡</text>
  </svg>`,
};

function makeIcon(type: InfraFeature['type']): L.DivIcon {
  return L.divIcon({
    html: ICON_SVG[type],
    className: '',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

async function fetchInfra(): Promise<InfraFeature[]> {
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: OVERPASS_QUERY,
    signal: AbortSignal.timeout(5000),
  });
  const data = await res.json() as { elements: Array<{ id: number; type: string; lat: number; lon: number; tags: Record<string, string> }> };
  return data.elements
    .filter(el => el.type === 'node' && el.lat && el.lon)
    .map(el => {
      const amenity = el.tags['amenity'] ?? '';
      const power = el.tags['power'] ?? '';
      const type: InfraFeature['type'] =
        amenity === 'hospital' ? 'hospital'
        : amenity === 'school' ? 'school'
        : power ? 'power'
        : 'power';
      return {
        id: String(el.id),
        type,
        lat: el.lat,
        lng: el.lon,
        name: el.tags['name'] ?? el.tags['name:en'] ?? type,
      };
    })
    .slice(0, 80);
}

export function InfraLayer() {
  const map = useMap();
  const groupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    const group = L.layerGroup();
    groupRef.current = group;

    (async () => {
      let features: InfraFeature[];
      try {
        features = await fetchInfra();
      } catch {
        features = INFRA_FALLBACK;
      }

      if (!groupRef.current) return; // unmounted before fetch completed

      for (const f of features) {
        const marker = L.marker([f.lat, f.lng], { icon: makeIcon(f.type) });
        marker.bindTooltip(f.name, {
          className: 'infra-tooltip',
          direction: 'top',
          offset: [0, -8],
        });
        group.addLayer(marker);
      }
      group.addTo(map);
    })();

    return () => {
      if (groupRef.current) {
        map.removeLayer(groupRef.current);
        groupRef.current = null;
      }
    };
  }, [map]);

  return null;
}
