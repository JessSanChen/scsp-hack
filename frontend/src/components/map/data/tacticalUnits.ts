import type { TacticalUnit } from './mapTypes';

export const TACTICAL_UNITS: TacticalUnit[] = [
  // ── USA ─────────────────────────────────────────────────────
  {
    id: 'usa-csg5',
    name: 'USS Ronald Reagan (CSG-5)',
    label: 'CSG-5',
    faction: 'USA',
    domain: 'sea',
    threatRadiusNm: 200,
    turnPositions: {
      0: { lat: 26.0, lng: 125.8 },
      1: { lat: 25.6, lng: 124.5 },
      2: { lat: 25.2, lng: 123.5 },
      3: { lat: 25.0, lng: 123.0 },
    },
  },
  {
    id: 'usa-csg3',
    name: 'USS Abraham Lincoln (CSG-3)',
    label: 'CSG-3',
    faction: 'USA',
    domain: 'sea',
    threatRadiusNm: 200,
    turnPositions: {
      0: { lat: 29.5, lng: 130.2 },
      1: { lat: 28.0, lng: 128.5 },
      2: { lat: 26.8, lng: 127.0 },
      3: { lat: 26.0, lng: 126.0 },
    },
  },
  {
    id: 'usa-f35c',
    name: 'F-35C (VFA-147)',
    label: 'F-35C',
    faction: 'USA',
    domain: 'air',
    turnPositions: {
      0: { lat: 26.4, lng: 126.2 },
      1: { lat: 25.9, lng: 124.9 },
      2: { lat: 25.6, lng: 124.1 },
      3: { lat: 25.3, lng: 123.4 },
    },
  },
  {
    id: 'usa-marines',
    name: 'USMC Expeditionary Unit (N. Philippines)',
    label: 'USMC',
    faction: 'USA',
    domain: 'land',
    turnPositions: {
      0: { lat: 18.2, lng: 121.5 },
      1: { lat: 18.2, lng: 121.5 },
      2: { lat: 18.4, lng: 121.5 },
      3: { lat: 18.6, lng: 121.5 },
    },
  },

  // ── PRC ─────────────────────────────────────────────────────
  {
    id: 'prc-plan-surface',
    name: 'PLAN Surface Action Group',
    label: 'PLAN',
    faction: 'PRC',
    domain: 'sea',
    turnPositions: {
      0: { lat: 26.0, lng: 120.8 },
      1: { lat: 25.5, lng: 121.2 },
      2: { lat: 25.0, lng: 121.8 },
      3: { lat: 24.5, lng: 122.2 },
    },
  },
  {
    id: 'prc-ssn',
    name: 'PLAN Type-093 SSN',
    label: 'SSN',
    faction: 'PRC',
    domain: 'sea',
    turnPositions: {
      0: { lat: 27.0, lng: 122.5 },
      1: { lat: 26.2, lng: 123.0 },
      2: { lat: 25.6, lng: 123.4 },
      3: { lat: 25.2, lng: 123.2 }, // inside CSG screen at T3
    },
  },
  {
    id: 'prc-j20',
    name: 'J-20 Squadron (PLA Air Force)',
    label: 'J-20',
    faction: 'PRC',
    domain: 'air',
    turnPositions: {
      0: { lat: 26.0, lng: 119.3 }, // Fujian base
      1: { lat: 25.3, lng: 120.1 },
      2: { lat: 24.8, lng: 120.8 },
      3: { lat: 24.5, lng: 121.5 }, // entering strait ADIZ
    },
  },
  {
    id: 'prc-df21',
    name: 'DF-21D ASBMs (Fujian)',
    label: 'DF-21',
    faction: 'PRC',
    domain: 'land',
    turnPositions: {
      0: { lat: 25.5, lng: 118.6 },
      1: { lat: 25.5, lng: 118.6 },
      2: { lat: 25.5, lng: 118.6 },
      3: { lat: 25.5, lng: 118.6 },
    },
  },

  // ── ROC ─────────────────────────────────────────────────────
  {
    id: 'roc-frigate',
    name: 'ROC Keelung-class Destroyer',
    label: 'ROC-DD',
    faction: 'ROC',
    domain: 'sea',
    turnPositions: {
      0: { lat: 25.1, lng: 121.7 }, // Keelung port
      1: { lat: 25.3, lng: 122.2 }, // patrol position
      2: { lat: 25.1, lng: 122.5 },
      3: { lat: 24.9, lng: 122.3 },
    },
  },
  {
    id: 'roc-idf',
    name: 'ROCAF IDF Fighter Squadron',
    label: 'IDF',
    faction: 'ROC',
    domain: 'air',
    turnPositions: {
      0: { lat: 23.9, lng: 121.6 }, // Hualien AB
      1: { lat: 24.2, lng: 121.9 }, // ADIZ patrol
      2: { lat: 24.8, lng: 122.1 },
      3: { lat: 25.0, lng: 122.4 },
    },
  },
  {
    id: 'roc-ground',
    name: 'ROC Army Armor Brigade',
    label: 'ROC-A',
    faction: 'ROC',
    domain: 'land',
    turnPositions: {
      0: { lat: 25.05, lng: 121.52 }, // Taipei defense
      1: { lat: 25.05, lng: 121.52 },
      2: { lat: 25.05, lng: 121.52 },
      3: { lat: 25.05, lng: 121.52 },
    },
  },
];
