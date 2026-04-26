/**
 * Hardcoded force lay-down for the Taiwan Strait 2026 demo.
 *
 * Tick mapping (mirrors STATE_SNAPSHOT.turn):
 *   0 = initial conditions (game start)
 *   1 = end-of-turn-1 (limited incident; PLAN destroyer crosses median line)
 *   2 = end-of-turn-2 (baseline: deconfliction; fork: USA pre-emptive strike)
 *   3 = end-of-turn-3 (baseline: broad escalation; fork: mutual pause)
 *
 * Coordinates are tuned to tell a clear story on the map:
 *   - CSG-5 (Reagan) holds station east of Taiwan throughout.
 *   - CSG-3 (Lincoln) sails in from the east; arrives in theatre by T3.
 *   - PLAN SAG crosses median line at T1, surges in T3, pulls back in T2/fork.
 *   - PLAN SSN closes on the CSG screen by T3 (baseline only).
 *   - PLAAF J-20 sortie pattern crosses ROC ADIZ from Fujian.
 *   - In the FORK, USA long-range strike trajectory appears at T2 → T3.
 */

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
      0: { lat: 24.2, lng: 124.5 }, // station east of Taiwan
      1: { lat: 24.3, lng: 124.6 }, // holds, alert level 2
      2: { lat: 24.0, lng: 125.0 }, // small step east (deconfliction)
      3: { lat: 24.6, lng: 124.0 }, // combat formation, closes Taiwan
    },
    threatScaleAtTurn: { 0: 1, 1: 1.05, 2: 0.9, 3: 1.4 },
    forkPositions: {
      // Fork: USA more forward at T2 (strike), then pulls back to deconflict
      2: { lat: 24.7, lng: 124.0 },
      3: { lat: 24.3, lng: 125.0 },
    },
    forkVisibleAtTurn: { 0: true, 1: true, 2: true, 3: true },
  },
  {
    id: 'usa-csg3',
    name: 'USS Abraham Lincoln (CSG-3)',
    label: 'CSG-3',
    faction: 'USA',
    domain: 'sea',
    threatRadiusNm: 200,
    turnPositions: {
      0: { lat: 30.5, lng: 134.0 }, // en route from CONUS, far east
      1: { lat: 28.5, lng: 131.0 }, // closing
      2: { lat: 27.0, lng: 128.5 }, // arrives Western Pacific
      3: { lat: 25.5, lng: 126.0 }, // in theatre, reinforcing
    },
    threatScaleAtTurn: { 0: 0.4, 1: 0.7, 2: 0.9, 3: 1.3 },
  },
  {
    id: 'usa-f35c',
    name: 'F-35C (VFA-147)',
    label: 'F-35C',
    faction: 'USA',
    domain: 'air',
    turnPositions: {
      0: { lat: 24.2, lng: 124.0 }, // CSG CAP
      1: { lat: 24.5, lng: 123.2 }, // forward CAP off Taiwan east coast
      2: { lat: 24.5, lng: 123.5 }, // patrol orbit
      3: { lat: 24.8, lng: 122.8 }, // forward, engaged
    },
  },
  {
    id: 'usa-marines',
    name: 'USMC EAB (Northern Luzon)',
    label: 'USMC',
    faction: 'USA',
    domain: 'land',
    threatRadiusNm: 80,
    turnPositions: {
      0: { lat: 18.4, lng: 121.6 },
      1: { lat: 18.4, lng: 121.6 },
      2: { lat: 18.4, lng: 121.6 },
      3: { lat: 18.4, lng: 121.6 },
    },
    threatScaleAtTurn: { 0: 1, 1: 1.1, 2: 1, 3: 1.3 },
  },
  // FORK-ONLY: USA long-range strike trajectory (B-21 / JASSM-ER track)
  {
    id: 'usa-lr-strike',
    name: 'USAF Long-Range Strike Package',
    label: 'B-21/LR',
    faction: 'USA',
    domain: 'air',
    turnPositions: {
      0: { lat: 24.0, lng: 124.0 },
      1: { lat: 24.0, lng: 124.0 },
      2: { lat: 24.5, lng: 122.0 },
      3: { lat: 24.5, lng: 122.0 },
    },
    visibleAtTurn: { 0: false, 1: false, 2: false, 3: false }, // baseline: invisible
    forkPositions: {
      2: { lat: 25.0, lng: 120.5 }, // ingress over strait toward Fujian
      3: { lat: 24.6, lng: 122.5 }, // egress
    },
    forkVisibleAtTurn: { 0: false, 1: false, 2: true, 3: true },
  },

  // ── PRC ─────────────────────────────────────────────────────
  {
    id: 'prc-plan-surface',
    name: 'PLAN Surface Action Group (Type 055/052D)',
    label: 'PLAN-SAG',
    faction: 'PRC',
    domain: 'sea',
    threatRadiusNm: 150,
    turnPositions: {
      0: { lat: 25.5, lng: 119.5 }, // mainland coast
      1: { lat: 24.8, lng: 121.0 }, // crosses median line (T1 incident)
      2: { lat: 25.2, lng: 120.4 }, // pulls back (deconfliction)
      3: { lat: 24.2, lng: 121.6 }, // surges deep into strait
    },
    threatScaleAtTurn: { 0: 1, 1: 1.2, 2: 0.9, 3: 1.6 },
    forkPositions: {
      // Fork: USA struck PRC, so PLAN initially holds defensive then pulls back
      2: { lat: 25.6, lng: 119.9 },
      3: { lat: 25.3, lng: 120.4 },
    },
  },
  {
    id: 'prc-ssn',
    name: 'PLAN Type-093 SSN',
    label: 'SSN',
    faction: 'PRC',
    domain: 'sea',
    threatRadiusNm: 90,
    turnPositions: {
      0: { lat: 27.5, lng: 123.0 }, // patrol box
      1: { lat: 26.5, lng: 123.5 }, // closing
      2: { lat: 26.0, lng: 123.8 }, // standoff (deconfliction)
      3: { lat: 24.8, lng: 124.0 }, // inside CSG screen — broad escalation
    },
    threatScaleAtTurn: { 0: 1, 1: 1.1, 2: 1, 3: 1.5 },
    forkPositions: {
      2: { lat: 26.2, lng: 123.6 }, // holds back after USA strike
      3: { lat: 26.5, lng: 123.5 },
    },
  },
  {
    id: 'prc-j20',
    name: 'PLAAF J-20 Squadron',
    label: 'J-20',
    faction: 'PRC',
    domain: 'air',
    turnPositions: {
      0: { lat: 26.0, lng: 119.3 }, // Fujian base
      1: { lat: 25.2, lng: 120.4 }, // ADIZ ingress
      2: { lat: 25.5, lng: 120.0 }, // CAP, deconfliction
      3: { lat: 24.5, lng: 121.0 }, // active sortie over island west
    },
    forkPositions: {
      2: { lat: 25.8, lng: 119.5 }, // pulled back after strike
      3: { lat: 25.6, lng: 119.7 },
    },
  },
  {
    id: 'prc-df21',
    name: 'DF-21D ASBM Battery (Fujian)',
    label: 'DF-21',
    faction: 'PRC',
    domain: 'land',
    threatRadiusNm: 900,
    turnPositions: {
      0: { lat: 25.6, lng: 118.8 },
      1: { lat: 25.6, lng: 118.8 },
      2: { lat: 25.6, lng: 118.8 },
      3: { lat: 25.6, lng: 118.8 },
    },
    threatScaleAtTurn: { 0: 0.6, 1: 0.85, 2: 0.7, 3: 1.0 },
    forkPositions: {
      // Fork: launchers degraded by US strike at T2
      2: { lat: 25.6, lng: 118.8 },
      3: { lat: 25.6, lng: 118.8 },
    },
  },

  // ── ROC ─────────────────────────────────────────────────────
  {
    id: 'roc-frigate',
    name: 'ROCN Keelung-class DD',
    label: 'ROC-DD',
    faction: 'ROC',
    domain: 'sea',
    threatRadiusNm: 70,
    turnPositions: {
      0: { lat: 25.13, lng: 121.75 }, // Keelung port
      1: { lat: 25.30, lng: 122.10 }, // surge to sea
      2: { lat: 25.10, lng: 122.30 }, // patrol box
      3: { lat: 24.50, lng: 122.50 }, // east coast defence
    },
  },
  {
    id: 'roc-idf',
    name: 'ROCAF IDF Squadron (Hualien)',
    label: 'IDF',
    faction: 'ROC',
    domain: 'air',
    turnPositions: {
      0: { lat: 23.96, lng: 121.62 }, // Hualien AB
      1: { lat: 24.20, lng: 121.95 }, // CAP
      2: { lat: 24.10, lng: 121.80 }, // dispersed CAP
      3: { lat: 24.50, lng: 121.30 }, // intercept
    },
  },
  {
    id: 'roc-anti-ship',
    name: 'ROC Hsiung Feng III Coastal Battery',
    label: 'HF-III',
    faction: 'ROC',
    domain: 'land',
    threatRadiusNm: 200,
    turnPositions: {
      0: { lat: 24.30, lng: 120.55 }, // west coast
      1: { lat: 24.30, lng: 120.55 },
      2: { lat: 24.30, lng: 120.55 },
      3: { lat: 24.30, lng: 120.55 },
    },
    threatScaleAtTurn: { 0: 0.5, 1: 0.85, 2: 0.7, 3: 1.2 },
  },
  {
    id: 'roc-ground',
    name: 'ROC Army Armor Brigade (Taipei)',
    label: 'ROC-A',
    faction: 'ROC',
    domain: 'land',
    turnPositions: {
      0: { lat: 25.05, lng: 121.52 },
      1: { lat: 25.05, lng: 121.52 },
      2: { lat: 25.05, lng: 121.52 },
      3: { lat: 25.05, lng: 121.52 },
    },
  },
];
