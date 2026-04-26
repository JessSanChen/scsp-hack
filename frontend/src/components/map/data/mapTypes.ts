export type UnitDomain = 'air' | 'sea' | 'land';
export type Faction = 'USA' | 'PRC' | 'ROC';

export interface LatLng { lat: number; lng: number; }

export interface TacticalUnit {
  id: string;
  name: string;
  label: string;
  faction: Faction;
  domain: UnitDomain;
  /** Default trajectory (also used as the baseline timeline). */
  turnPositions: Record<0 | 1 | 2 | 3, LatLng>;
  /** Override positions in the fork timeline. Falls back to turnPositions when missing. */
  forkPositions?: Partial<Record<0 | 1 | 2 | 3, LatLng>>;
  /** Optional per-turn visibility flags. Defaults to true. */
  visibleAtTurn?: Partial<Record<0 | 1 | 2 | 3, boolean>>;
  /** Same shape but applied only to the fork timeline. */
  forkVisibleAtTurn?: Partial<Record<0 | 1 | 2 | 3, boolean>>;
  threatRadiusNm?: number;
  /** Threat-radius scaling per turn (e.g. larger when engaged). */
  threatScaleAtTurn?: Partial<Record<0 | 1 | 2 | 3, number>>;
}

export type Timeline = 'baseline' | 'fork';

export interface IncidentMarker {
  id: string;
  turn: 0 | 1 | 2 | 3;
  position: LatLng;
  label: string;
  /** Detail used in tooltip / hover. */
  detail: string;
  intensity: 'low' | 'medium' | 'high';
  /** Optional restriction to a single timeline. */
  timeline?: Timeline;
  /**
   * Optional vector to draw an arrow from `position` toward this point
   * (for strike trajectories). Same units as position (lat/lng).
   */
  vectorTo?: LatLng;
}

export interface FlightRoute {
  id: string;
  label: string;
  waypoints: LatLng[];
  dotCount: number;
  speedFactor: number;
}

export interface InfraFeature {
  id: string;
  type: 'hospital' | 'school' | 'power';
  lat: number;
  lng: number;
  name: string;
}

export interface LayerToggles {
  heatmap: boolean;
  infra: boolean;
  flights: boolean;
  tactical: boolean;
}

export interface AnimationState {
  playing: boolean;
  speed: number;
  currentTick: number;
}

export const FACTION_COLOR: Record<Faction, string> = {
  USA: '#3b82f6',
  PRC: '#ef4444',
  ROC: '#22c55e',
};
