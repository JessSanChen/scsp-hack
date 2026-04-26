import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { FLIGHT_ROUTES } from '../data/flightRoutes';
import type { FlightRoute, LatLng } from '../data/mapTypes';

function evalBezier(p0: LatLng, p1: LatLng, p2: LatLng, t: number): LatLng {
  const mt = 1 - t;
  return {
    lat: mt * mt * p0.lat + 2 * mt * t * p1.lat + t * t * p2.lat,
    lng: mt * mt * p0.lng + 2 * mt * t * p1.lng + t * t * p2.lng,
  };
}

function sampleBezier(route: FlightRoute, steps = 80): L.LatLngExpression[] {
  const [p0, p1, p2] = route.waypoints;
  if (!p0 || !p1 || !p2) return [];
  return Array.from({ length: steps + 1 }, (_, i) => {
    const pos = evalBezier(p0, p1, p2, i / steps);
    return [pos.lat, pos.lng] as L.LatLngExpression;
  });
}

interface Dot {
  routeIdx: number;
  t: number;
  speed: number;
}

export function FlightLayer() {
  const map = useMap();
  const polyGroupRef = useRef<L.LayerGroup | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dotsRef = useRef<Dot[]>([]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    // Add static arc polylines
    const group = L.layerGroup();
    polyGroupRef.current = group;
    for (const route of FLIGHT_ROUTES) {
      const pts = sampleBezier(route);
      if (pts.length === 0) continue;
      L.polyline(pts, {
        color: 'rgba(56,189,248,0.22)',
        weight: 1,
        dashArray: '4 8',
      }).bindTooltip(route.label, { sticky: true, className: 'flight-tooltip' })
        .addTo(group);
    }
    group.addTo(map);

    // Create canvas overlay for moving dots
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:650;';
    const resize = () => {
      const size = map.getSize();
      canvas.width = size.x;
      canvas.height = size.y;
    };
    resize();
    map.getPanes().overlayPane!.appendChild(canvas);
    canvasRef.current = canvas;

    // Initialize dots
    const dots: Dot[] = [];
    FLIGHT_ROUTES.forEach((route, ri) => {
      for (let d = 0; d < route.dotCount; d++) {
        dots.push({
          routeIdx: ri,
          t: d / route.dotCount, // stagger along route
          speed: 0.018 * route.speedFactor,
        });
      }
    });
    dotsRef.current = dots;

    const redraw = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const size = map.getSize();
      canvas.width = size.x;
      canvas.height = size.y;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const dot of dotsRef.current) {
        const route = FLIGHT_ROUTES[dot.routeIdx];
        if (!route) continue;
        const [p0, p1, p2] = route.waypoints;
        if (!p0 || !p1 || !p2) continue;
        const pos = evalBezier(p0, p1, p2, dot.t);
        try {
          const px = map.latLngToContainerPoint([pos.lat, pos.lng]);
          ctx.beginPath();
          ctx.arc(px.x, px.y, 3, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(56,189,248,0.85)';
          ctx.fill();
          // glow
          ctx.beginPath();
          ctx.arc(px.x, px.y, 5, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(56,189,248,0.2)';
          ctx.fill();
        } catch {
          // latLngToContainerPoint can throw if map not ready
        }
      }
    };

    let lastTs = performance.now();
    const loop = (ts: number) => {
      const dt = (ts - lastTs) / 1000;
      lastTs = ts;
      for (const dot of dotsRef.current) {
        dot.t = (dot.t + dot.speed * dt * 60) % 1;
      }
      redraw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    // Redraw on map movement
    map.on('move zoom', redraw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      map.off('move zoom', redraw);
      if (polyGroupRef.current) {
        map.removeLayer(polyGroupRef.current);
        polyGroupRef.current = null;
      }
      if (canvasRef.current?.parentNode) {
        canvasRef.current.parentNode.removeChild(canvasRef.current);
        canvasRef.current = null;
      }
    };
  }, [map]);

  return null;
}
