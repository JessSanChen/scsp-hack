import type { GameState } from '../../mockData';

const FACTION_COLOR: Record<string, string> = {
  USA: '#3b82f6',
  PRC: '#ef4444',
  ROC: '#22c55e',
};

// Approximate tension-based overlay colors
function tensionFill(level: number): string {
  if (level <= 3) return 'rgba(56,189,248,0.04)';
  if (level <= 5) return 'rgba(245,158,11,0.06)';
  if (level <= 7) return 'rgba(249,115,22,0.09)';
  return 'rgba(239,68,68,0.14)';
}

// Unit markers: region → faction → pixel position
const UNIT_POS: Record<string, Record<string, [number, number]>> = {
  'taiwan-strait':     { USA: [342, 165], PRC: [332, 258], ROC: [390, 258] },
  'taiwan-island':     { ROC: [428, 235], USA: [436, 315] },
  'south-china-sea':   { USA: [330, 445], PRC: [268, 458] },
  'northern-philippines': { USA: [648, 466] },
};

// Region tension overlay rectangles [x, y, w, h, regionId]
const REGION_OVERLAYS: Array<{ id: string; d: string }> = [
  // Taiwan Strait vertical strip
  { id: 'taiwan-strait', d: 'M316,0 L404,0 L404,520 L316,520 Z' },
  // South China Sea lower band
  { id: 'south-china-sea', d: 'M270,395 L700,395 L700,520 L270,520 Z' },
  // Taiwan island glow handled by stroke
  { id: 'taiwan-island', d: '' },
  { id: 'northern-philippines', d: '' },
];

interface Props { state: GameState; }

export function TaiwanMap({ state }: Props) {
  return (
    <svg
      viewBox="0 0 800 520"
      preserveAspectRatio="xMidYMid slice"
      style={{ width: '100%', height: '100%', display: 'block' }}
    >
      <defs>
        {/* Tactical grid */}
        <pattern id="tac-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0L0 0 0 40" fill="none" stroke="rgba(56,189,248,0.06)" strokeWidth="0.5" />
        </pattern>

        {/* Unit glow */}
        <filter id="unit-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>

        {/* Land glow edge */}
        <filter id="land-glow" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>

        {/* Scanline texture */}
        <pattern id="scanlines" width="2" height="3" patternUnits="userSpaceOnUse">
          <rect width="2" height="1" y="0" fill="rgba(0,0,0,0.18)" />
        </pattern>

        {/* Vignette radial */}
        <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.55)" />
        </radialGradient>
      </defs>

      {/* Ocean base */}
      <rect width="800" height="520" fill="#081525" />

      {/* Tactical grid */}
      <rect width="800" height="520" fill="url(#tac-grid)" />

      {/* ── PRC Mainland ── */}
      <path
        d="M0,0 L308,0 L316,52 L320,115 L314,205 L300,305 L285,405 L268,520 L0,520 Z"
        fill="#0f1e2d"
        stroke="rgba(239,68,68,0.22)"
        strokeWidth="1"
      />
      <text x="148" y="235" fill="rgba(239,68,68,0.45)" fontSize="11" textAnchor="middle" fontFamily="var(--font-mono)" letterSpacing="4">PRC</text>
      <text x="148" y="250" fill="rgba(239,68,68,0.28)" fontSize="7.5" textAnchor="middle" fontFamily="var(--font-mono)" letterSpacing="3">MAINLAND</text>

      {/* ── Region tension overlays ── */}
      {REGION_OVERLAYS.filter(r => r.d).map(r => (
        <path
          key={r.id}
          d={r.d}
          fill={tensionFill(state.regions[r.id]?.tensionLevel ?? 5)}
        />
      ))}

      {/* Taiwan Strait tension border lines */}
      <line x1="316" y1="0" x2="316" y2="520" stroke="rgba(56,189,248,0.08)" strokeWidth="0.5" strokeDasharray="4 6" />
      <line x1="404" y1="0" x2="404" y2="520" stroke="rgba(56,189,248,0.08)" strokeWidth="0.5" strokeDasharray="4 6" />

      {/* ── Taiwan Island ── */}
      <path
        d="M406,62 C424,58 448,76 456,106 L461,170 L464,238 L461,302 L452,370 L437,415 L419,428 L404,422 L392,397 L388,328 L386,248 L388,175 L394,108 Z"
        fill="#112218"
        stroke="rgba(34,197,94,0.3)"
        strokeWidth="1"
        filter="url(#land-glow)"
      />
      <text x="425" y="246" fill="rgba(34,197,94,0.5)" fontSize="9" textAnchor="middle" fontFamily="var(--font-mono)" letterSpacing="3">TAIWAN</text>

      {/* ── Northern Philippines ── */}
      <path
        d="M598,438 Q650,420 700,442 Q724,466 700,498 Q668,514 628,507 Q594,492 598,438 Z"
        fill="#0f1e2d"
        stroke="rgba(56,189,248,0.18)"
        strokeWidth="0.8"
      />
      <text x="648" y="494" fill="rgba(255,255,255,0.2)" fontSize="7" textAnchor="middle" fontFamily="var(--font-mono)" letterSpacing="1.5">N. PHILIPPINES</text>

      {/* ── Water labels ── */}
      <text x="353" y="148" fill="rgba(255,255,255,0.18)" fontSize="8" textAnchor="middle" fontFamily="var(--font-mono)" letterSpacing="2">TAIWAN</text>
      <text x="353" y="160" fill="rgba(255,255,255,0.18)" fontSize="8" textAnchor="middle" fontFamily="var(--font-mono)" letterSpacing="2">STRAIT</text>

      <text x="185" y="458" fill="rgba(255,255,255,0.14)" fontSize="9" textAnchor="middle" fontFamily="var(--font-mono)" letterSpacing="2">SOUTH CHINA SEA</text>

      <text x="630" y="260" fill="rgba(255,255,255,0.12)" fontSize="9" textAnchor="middle" fontFamily="var(--font-mono)" letterSpacing="2">PACIFIC</text>
      <text x="630" y="274" fill="rgba(255,255,255,0.12)" fontSize="9" textAnchor="middle" fontFamily="var(--font-mono)" letterSpacing="2">OCEAN</text>

      {/* ── Unit markers ── */}
      {Object.entries(UNIT_POS).map(([regionId, factions]) =>
        Object.entries(factions).map(([faction, [cx, cy]]) => {
          const present = state.regions[regionId]?.presentFactions?.includes(faction);
          if (!present) return null;
          const color = FACTION_COLOR[faction] ?? '#888';
          return (
            <g key={`${regionId}-${faction}`} filter="url(#unit-glow)">
              {/* Outer pulse ring */}
              <circle cx={cx} cy={cy} r={11} fill="none" stroke={color} strokeWidth="0.8" opacity="0.4" />
              {/* Inner fill */}
              <circle cx={cx} cy={cy} r={5} fill={color} opacity="0.9" />
              {/* Label */}
              <text
                x={cx} y={cy + 21}
                fill={color}
                fontSize="7"
                textAnchor="middle"
                fontFamily="var(--font-mono)"
                letterSpacing="1"
                opacity="0.85"
              >
                {faction}
              </text>
            </g>
          );
        })
      )}

      {/* ── Tension bars per region ── */}
      <TensionBar x={330} y={195} level={state.regions['taiwan-strait']?.tensionLevel ?? 5} />
      <TensionBar x={416} y={380} level={state.regions['taiwan-island']?.tensionLevel ?? 5} />
      <TensionBar x={290} y={470} level={state.regions['south-china-sea']?.tensionLevel ?? 5} />
      <TensionBar x={634} y={485} level={state.regions['northern-philippines']?.tensionLevel ?? 3} />

      {/* ── Scanlines overlay ── */}
      <rect width="800" height="520" fill="url(#scanlines)" opacity="0.35" style={{ pointerEvents: 'none' }} />

      {/* ── Vignette ── */}
      <rect width="800" height="520" fill="url(#vignette)" style={{ pointerEvents: 'none' }} />

      {/* ── HUD corners ── */}
      <path d="M8,8 L28,8 M8,8 L8,28" stroke="rgba(56,189,248,0.45)" strokeWidth="1.5" fill="none" />
      <path d="M792,8 L772,8 M792,8 L792,28" stroke="rgba(56,189,248,0.45)" strokeWidth="1.5" fill="none" />
      <path d="M8,512 L28,512 M8,512 L8,492" stroke="rgba(56,189,248,0.45)" strokeWidth="1.5" fill="none" />
      <path d="M792,512 L772,512 M792,512 L792,492" stroke="rgba(56,189,248,0.45)" strokeWidth="1.5" fill="none" />

      {/* ── Compass ── */}
      <g transform="translate(758,56)">
        <circle cx="0" cy="0" r="14" fill="none" stroke="rgba(56,189,248,0.22)" strokeWidth="0.8" />
        <line x1="0" y1="-10" x2="0" y2="10" stroke="rgba(56,189,248,0.35)" strokeWidth="0.8" />
        <line x1="-10" y1="0" x2="10" y2="0" stroke="rgba(56,189,248,0.22)" strokeWidth="0.5" />
        <polygon points="0,-10 -3,-4 0,-7 3,-4" fill="rgba(56,189,248,0.7)" />
        <text x="0" y="-16" fill="rgba(56,189,248,0.5)" fontSize="7" textAnchor="middle" fontFamily="var(--font-mono)">N</text>
      </g>

      {/* ── Bottom status bar ── */}
      <text
        x="16" y="512"
        fill="rgba(56,189,248,0.38)"
        fontSize="8"
        fontFamily="var(--font-mono)"
        letterSpacing="2"
      >
        TURN {state.currentTurn} // TAIWAN STRAIT 2026 // {new Date().toISOString().slice(0,10)}
      </text>
    </svg>
  );
}

function TensionBar({ x, y, level }: { x: number; y: number; level: number }) {
  const color = level >= 7 ? '#ef4444' : level >= 5 ? '#f59e0b' : '#22c55e';
  const pct = level / 10;
  return (
    <g>
      <rect x={x - 22} y={y} width={44} height={3} fill="rgba(255,255,255,0.07)" rx={1.5} />
      <rect x={x - 22} y={y} width={44 * pct} height={3} fill={color} rx={1.5} opacity={0.8} />
    </g>
  );
}
