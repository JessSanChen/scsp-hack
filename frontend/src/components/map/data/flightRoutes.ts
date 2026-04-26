import type { FlightRoute } from './mapTypes';

// Major ICAO civil aviation corridors through Taipei FIR.
// waypoints[0]=origin, waypoints[1]=midpoint control, waypoints[2]=destination
// Quadratic bezier arc at zoom 7-9 approximates great-circle routing.
export const FLIGHT_ROUTES: FlightRoute[] = [
  {
    id: 'tpe-nrt',
    label: 'TPE↔NRT',
    waypoints: [
      { lat: 25.07, lng: 121.55 }, // Taipei Taoyuan
      { lat: 29.50, lng: 127.00 }, // mid arc over East China Sea
      { lat: 35.55, lng: 139.78 }, // Tokyo Haneda
    ],
    dotCount: 2,
    speedFactor: 0.9,
  },
  {
    id: 'tpe-icn',
    label: 'TPE↔ICN',
    waypoints: [
      { lat: 25.07, lng: 121.55 },
      { lat: 30.20, lng: 123.50 },
      { lat: 37.46, lng: 126.45 }, // Seoul Incheon
    ],
    dotCount: 1,
    speedFactor: 0.8,
  },
  {
    id: 'tpe-hkg',
    label: 'TPE↔HKG',
    waypoints: [
      { lat: 25.07, lng: 121.55 },
      { lat: 23.80, lng: 118.00 }, // mid over strait (contested airspace, stylized)
      { lat: 22.31, lng: 113.91 }, // Hong Kong
    ],
    dotCount: 2,
    speedFactor: 1.1,
  },
  {
    id: 'tpe-mnl',
    label: 'TPE↔MNL',
    waypoints: [
      { lat: 25.07, lng: 121.55 },
      { lat: 20.00, lng: 121.80 },
      { lat: 14.51, lng: 121.02 }, // Manila
    ],
    dotCount: 1,
    speedFactor: 1.0,
  },
  {
    id: 'tpe-sin',
    label: 'TPE↔SIN',
    waypoints: [
      { lat: 25.07, lng: 121.55 },
      { lat: 15.00, lng: 117.00 },
      { lat: 1.36, lng: 103.99 }, // Singapore Changi
    ],
    dotCount: 1,
    speedFactor: 0.7,
  },
  {
    id: 'tpe-lax',
    label: 'TPE→LAX',
    waypoints: [
      { lat: 25.07, lng: 121.55 },
      { lat: 38.00, lng: 150.00 }, // polar arc over N. Pacific
      { lat: 33.94, lng: -118.40 }, // Los Angeles
    ],
    dotCount: 1,
    speedFactor: 0.5,
  },
];
