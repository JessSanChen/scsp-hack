import { useEffect, useRef } from 'react';
import { MapContainer as LeafletMapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { LayerToggles, Timeline } from './data/mapTypes';
import { HeatmapLayer } from './layers/HeatmapLayer';
import { InfraLayer } from './layers/InfraLayer';
import { FlightLayer } from './layers/FlightLayer';
import { TacticalLayer } from './layers/TacticalLayer';
import { IncidentLayer } from './layers/IncidentLayer';

// Fix Vite/Leaflet default icon broken URL (DivIcon used throughout, but patch anyway)
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
  shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
});

const ESRI_SATELLITE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

function InvalidateSizeOnResize() {
  const map = useMap();
  const containerRef = useRef<Element | null>(null);

  useEffect(() => {
    const el = map.getContainer();
    containerRef.current = el;
    // Initial invalidation after flexbox settles
    requestAnimationFrame(() => map.invalidateSize());

    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(el);
    return () => observer.disconnect();
  }, [map]);

  return null;
}

interface Props {
  toggles: LayerToggles;
  currentTick: number;
  timeline: Timeline;
}

export function MapContainer({ toggles, currentTick, timeline }: Props) {
  return (
    <LeafletMapContainer
      center={[24.5, 122.5]}
      zoom={7}
      minZoom={5}
      maxZoom={12}
      zoomControl={false}
      attributionControl={false}
      style={{ width: '100%', height: '100%', background: '#060b14' }}
    >
      <InvalidateSizeOnResize />

      {/* Satellite base */}
      <TileLayer url={ESRI_SATELLITE} tileSize={256} maxNativeZoom={19} />

      {/* Conditional overlay layers */}
      {toggles.heatmap  && <HeatmapLayer />}
      {toggles.infra    && <InfraLayer />}
      {toggles.flights  && <FlightLayer />}
      {toggles.tactical && <TacticalLayer currentTick={currentTick} timeline={timeline} />}
      <IncidentLayer currentTick={currentTick} timeline={timeline} />
    </LeafletMapContainer>
  );
}
