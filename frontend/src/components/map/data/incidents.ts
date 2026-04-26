/**
 * Per-turn map incidents that flesh out the narrative on top of the
 * tactical-unit movements. Each incident is keyed to a turn (0..3) and
 * optionally a timeline ('baseline' | 'fork'); when timeline is omitted
 * it shows on both.
 */

import type { IncidentMarker } from './mapTypes';

export const INCIDENTS: IncidentMarker[] = [
  // ── T1 (limited incident) – both timelines share this turn ──
  {
    id: 'inc-t1-median',
    turn: 1,
    position: { lat: 24.6, lng: 121.0 },
    label: 'PLAN destroyer crosses median line',
    detail: 'Type-052D PLAN destroyer crosses Taiwan Strait median line at 0342Z. ROC issues protest; US INDOPACOM issues OPREP-3.',
    intensity: 'medium',
  },
  {
    id: 'inc-t1-buzz',
    turn: 1,
    position: { lat: 24.3, lng: 124.5 },
    label: 'PLAN buzzes CSG-5 screen',
    detail: 'PLAN destroyers conduct close-approach manoeuvres near USS Reagan. Maritime militia exchange warnings with USN escorts.',
    intensity: 'medium',
  },

  // ── T2 baseline (deconfliction / mutual pause) ──
  {
    id: 'inc-t2-base-deconflict',
    turn: 2,
    position: { lat: 25.0, lng: 121.8 },
    label: 'Deconfliction channel opens',
    detail: 'Both sides accept Singapore-mediated deconfliction line. PLAN SAG and CSG-5 step back from contact.',
    intensity: 'low',
    timeline: 'baseline',
  },

  // ── T2 fork (USA pre-emptive strike on PRC mainland) ──
  {
    id: 'inc-t2-fork-strike',
    turn: 2,
    position: { lat: 25.6, lng: 118.8 }, // DF-21 launchers in Fujian
    label: 'US LR strike on Fujian DF-21 sites',
    detail: 'B-21 / JASSM-ER salvo against PRC DF-21 mobile launchers in Fujian. Multiple launchers reported destroyed; PRC C2 nodes degraded.',
    intensity: 'high',
    timeline: 'fork',
    vectorTo: { lat: 25.6, lng: 118.8 },
  },
  {
    id: 'inc-t2-fork-cyber',
    turn: 2,
    position: { lat: 26.0, lng: 119.3 },
    label: 'USCYBERCOM disrupts PLAAF C2',
    detail: 'Coordinated cyber operation against PLAAF and PLA Rocket Force C2 networks in Eastern Theatre Command.',
    intensity: 'medium',
    timeline: 'fork',
  },

  // ── T3 baseline (broad escalation) ──
  {
    id: 'inc-t3-base-asw',
    turn: 3,
    position: { lat: 24.8, lng: 124.0 },
    label: 'PLAN SSN inside CSG screen',
    detail: 'PLAN Type-093 SSN tracked at 8nm from USS Reagan. CSG goes weapons-free; full ASW response active.',
    intensity: 'high',
    timeline: 'baseline',
  },
  {
    id: 'inc-t3-base-strikes',
    turn: 3,
    position: { lat: 23.7, lng: 119.6 },
    label: 'PRC kinetic strikes on ROC outer islands',
    detail: 'PLA Rocket Force conducts standoff strikes against ROC Penghu radar and command facilities. Casualties spike across the theatre.',
    intensity: 'high',
    timeline: 'baseline',
  },
  {
    id: 'inc-t3-base-mob',
    turn: 3,
    position: { lat: 25.05, lng: 121.52 },
    label: 'ROC partial mobilisation',
    detail: 'Reserve battalions activated in Taipei and Kaohsiung. Civil defence brigades stand to.',
    intensity: 'medium',
    timeline: 'baseline',
  },

  // ── T3 fork (mutual pause after USA strike) ──
  {
    id: 'inc-t3-fork-pause',
    turn: 3,
    position: { lat: 25.0, lng: 121.5 },
    label: 'Mutual pause / face-saving deconfliction',
    detail: 'Both sides accept face-saving deconfliction. Both navies pull back; cyber operations stand down.',
    intensity: 'low',
    timeline: 'fork',
  },
  {
    id: 'inc-t3-fork-disperse',
    turn: 3,
    position: { lat: 23.96, lng: 121.62 },
    label: 'ROC fighters disperse to hardened sites',
    detail: 'ROCAF disperses fighter squadrons to Hualien and Chia-shan hardened sites pending PRC reaction.',
    intensity: 'low',
    timeline: 'fork',
  },

  // ── T4 baseline (continued broad escalation) ──
  {
    id: 'inc-t4-base-cas',
    turn: 3, // we cap currentTick at 3, so T4 incidents are layered on tick 3
    position: { lat: 25.0, lng: 121.5 },
    label: 'Casualty count rises across theatre',
    detail: 'ROC casualties pass 80; allies activate consultations under ANZUS. Political will erodes on all sides.',
    intensity: 'high',
    timeline: 'baseline',
  },
];
