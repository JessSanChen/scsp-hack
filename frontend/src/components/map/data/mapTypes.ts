export type UnitDomain = 'air' | 'sea' | 'land';
export type Faction = 'USA' | 'PRC' | 'ROC';

export interface LatLng { lat: number; lng: number; }

export interface TacticalUnit {
  id: string;
  name: string;
  label: string;
  faction: Faction;
  domain: UnitDomain;
  turnPositions: Record<0 | 1 | 2 | 3, LatLng>;
  threatRadiusNm?: number;
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
