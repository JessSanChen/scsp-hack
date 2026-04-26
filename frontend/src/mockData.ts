export interface FactionState {
  id: string;
  politicalWill: number;
  forceReadiness: number;
  casualties: number;
  posture: string;
  statusFlags: string[];
}

export interface RegionState {
  id: string;
  presentFactions: string[];
  controllingFaction?: string;
  tensionLevel: number;
  recentIncidents: string[];
}

export type Consequentiality = 1 | 2 | 3 | 4 | 5;

export interface OutcomeCandidate {
  id: string;
  summary: string;
  rationale: string;
  probability: number;
  consequentiality: Consequentiality;
  confidence: number;
}

export interface TurnData {
  turn: number;
  candidates: OutcomeCandidate[];
  selectedCandidateId: string;
  escalation?: {
    reasons: string[];
    question: string;
    humanResponseText?: string;
  };
}

export interface NewsItem {
  turn: number;
  text: string;
  tag?: 'military' | 'diplomatic' | 'incident' | 'scenario';
}

export interface HistoricalStat {
  turn: number;
  USA_will: number; PRC_will: number; ROC_will: number;
  USA_ready: number; PRC_ready: number; ROC_ready: number;
}

export interface GameState {
  scenarioName: string;
  currentTurn: number;
  totalTurns: number;
  status: 'running' | 'pending' | 'complete';
  factions: Record<string, FactionState>;
  regions: Record<string, RegionState>;
  turns: TurnData[];
  pendingCandidates: OutcomeCandidate[];
  pendingQuestion?: string;
  news: NewsItem[];
  historicalStats: HistoricalStat[];
}

export const MOCK_STATE: GameState = {
  scenarioName: 'Taiwan Strait 2026',
  currentTurn: 2,
  totalTurns: 4,
  status: 'pending',

  factions: {
    USA: {
      id: 'USA',
      politicalWill: 72,
      forceReadiness: 85,
      casualties: 0,
      posture: '5th CSG holds station. 3rd CSG 48h out. INDOPACOM at elevated combat posture.',
      statusFlags: ['alert-level-2'],
    },
    PRC: {
      id: 'PRC',
      politicalWill: 88,
      forceReadiness: 91,
      casualties: 0,
      posture: 'Full exercise posture. PLAN submarine activity confirmed near CSG screen.',
      statusFlags: ['exercise-ongoing', 'mso-declared'],
    },
    ROC: {
      id: 'ROC',
      politicalWill: 64,
      forceReadiness: 78,
      casualties: 12,
      posture: 'Full military alert. Emergency cabinet convened. Civilian sheltering active.',
      statusFlags: ['alert-level-3', 'domestic-pressure'],
    },
  },

  regions: {
    'taiwan-strait': {
      id: 'taiwan-strait',
      presentFactions: ['USA', 'PRC', 'ROC'],
      tensionLevel: 8,
      recentIncidents: [
        'PLAN destroyer crossed median line 0342Z',
        'USS Reagan replenishment-at-sea under PRC air shadow',
        'ROC coast guard harassed by maritime militia near Kinmen',
      ],
    },
    'taiwan-island': {
      id: 'taiwan-island',
      presentFactions: ['ROC', 'USA'],
      controllingFaction: 'ROC',
      tensionLevel: 6,
      recentIncidents: [
        'US advisors relocated to hardened facilities',
        'PLAAF fighters penetrate ADIZ at two ingress points',
      ],
    },
    'south-china-sea': {
      id: 'south-china-sea',
      presentFactions: ['USA', 'PRC'],
      tensionLevel: 5,
      recentIncidents: ['CCG vessels shadow USS Lincoln battle group'],
    },
    'northern-philippines': {
      id: 'northern-philippines',
      presentFactions: ['USA'],
      tensionLevel: 3,
      recentIncidents: [],
    },
  },

  turns: [
    {
      turn: 1,
      selectedCandidateId: 'c1-tense',
      candidates: [
        {
          id: 'c1-deescalate',
          summary: 'Mutual naval pullback reduces collision risk',
          rationale: 'Both sides signal desire to avoid accidental escalation.',
          probability: 0.20,
          consequentiality: 2,
          confidence: 0.70,
        },
        {
          id: 'c1-tense',
          summary: 'PRC harassment of CSG intensifies; OPREP filed',
          rationale: 'PLAN destroyers conduct close-approach maneuvers near USS Reagan.',
          probability: 0.52,
          consequentiality: 3,
          confidence: 0.65,
        },
        {
          id: 'c1-kinetic',
          summary: 'Fire-control radar lock triggers weapons-free posture',
          rationale: 'PLAN vessel locks fire-control radar on CSG escort.',
          probability: 0.28,
          consequentiality: 5,
          confidence: 0.50,
        },
      ],
    },
    {
      turn: 2,
      selectedCandidateId: 'c2-escalate',
      escalation: {
        reasons: ['max-consequentiality >= 4', 'top-probability < 0.50'],
        question: 'PRC has declared a Maritime Security Zone. Does the US maintain its CSG position or withdraw to avoid triggering a kinetic exchange?',
        humanResponseText: 'Maintain position. Signal resolve to allies. Accept elevated risk.',
      },
      candidates: [
        {
          id: 'c2-diplomacy',
          summary: 'Back-channel talks open via Singapore intermediary',
          rationale: 'MFA signals willingness to discuss; Singapore offers channel.',
          probability: 0.30,
          consequentiality: 2,
          confidence: 0.60,
        },
        {
          id: 'c2-escalate',
          summary: 'PRC declares 200nm Maritime Security Zone; PLAN surges',
          rationale: 'Beijing announces exclusion zone citing exercise safety.',
          probability: 0.48,
          consequentiality: 4,
          confidence: 0.58,
        },
        {
          id: 'c2-kinetic',
          summary: 'Warning shots fired across ROC patrol boat bow',
          rationale: 'PLAN frigate fires across bow of ROC vessel at median line.',
          probability: 0.22,
          consequentiality: 5,
          confidence: 0.45,
        },
      ],
    },
  ],

  pendingCandidates: [
    {
      id: 'c3-deescalate',
      summary: 'UN emergency session; international ceasefire call',
      rationale: 'International pressure mounts; both sides accept cooling-off.',
      probability: 0.22,
      consequentiality: 2,
      confidence: 0.62,
    },
    {
      id: 'c3-continue',
      summary: 'US reinforces; B-21s to Guam; Japan activates SDF',
      rationale: 'US and allies signal expanded commitment to Taiwan guarantee.',
      probability: 0.43,
      consequentiality: 3,
      confidence: 0.60,
    },
    {
      id: 'c3-kinetic',
      summary: 'PLAN submarine detected inside CSG screen; SOSUS alert',
      rationale: 'PLAN SSN at 8nm from USS Reagan triggers full ASW response.',
      probability: 0.35,
      consequentiality: 5,
      confidence: 0.52,
    },
  ],

  pendingQuestion:
    'PLAN submarine has been detected inside the CSG screen. Does the US escalate to active ASW pursuit, risking kinetic contact, or maintain passive tracking to avoid triggering engagement?',

  news: [
    { turn: 2, text: 'BREAKING: PRC declares 200nm Maritime Security Zone around Taiwan Strait', tag: 'military' },
    { turn: 2, text: 'USS Ronald Reagan holds station; INDOPACOM issues OPREP-3 PINNACLE', tag: 'military' },
    { turn: 2, text: 'Japan Cabinet Security Committee convenes emergency session in Tokyo', tag: 'diplomatic' },
    { turn: 2, text: 'ROC President addresses nation; civilian evacuation protocols announced', tag: 'diplomatic' },
    { turn: 2, text: 'PRC MFA: "US and Taiwan bear full responsibility for consequences"', tag: 'diplomatic' },
    { turn: 1, text: 'PLAN destroyer crosses Taiwan Strait median line at 0342Z', tag: 'incident' },
    { turn: 1, text: 'US 7th Fleet issues FLASH precedence message to INDOPACOM', tag: 'military' },
    { turn: 1, text: 'ROC emergency cabinet convenes; raises alert to equivalent DEFCON 2', tag: 'diplomatic' },
    { turn: 1, text: 'Australian PM convenes NSC; ANZUS consultations begin', tag: 'diplomatic' },
    { turn: 0, text: 'June 2026: PRC MFA warns US is "playing with fire"', tag: 'scenario' },
    { turn: 0, text: 'June 2026: 5th CSG (USS Ronald Reagan) deploys toward Taiwan Strait', tag: 'scenario' },
    { turn: 0, text: 'June 2026: PRC/PLAN joint exercises encircle Taiwan', tag: 'scenario' },
    { turn: 0, text: 'May 2026: US announces major weapons package plus 1,000 advisors for Taiwan', tag: 'scenario' },
  ],

  historicalStats: [
    { turn: 0, USA_will: 75, PRC_will: 75, ROC_will: 75, USA_ready: 75, PRC_ready: 75, ROC_ready: 75 },
    { turn: 1, USA_will: 74, PRC_will: 80, ROC_will: 68, USA_ready: 82, PRC_ready: 87, ROC_ready: 80 },
    { turn: 2, USA_will: 72, PRC_will: 88, ROC_will: 64, USA_ready: 85, PRC_ready: 91, ROC_ready: 78 },
  ],
};
