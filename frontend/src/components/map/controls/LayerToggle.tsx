import type { LayerToggles } from '../data/mapTypes';

interface Props {
  toggles: LayerToggles;
  toggle: (key: keyof LayerToggles) => void;
}

const LAYERS: { key: keyof LayerToggles; label: string; icon: string }[] = [
  { key: 'heatmap',  label: 'POPULATION', icon: '▓' },
  { key: 'infra',    label: 'INFRA',      icon: '⊕' },
  { key: 'flights',  label: 'FLIGHTS',    icon: '✈' },
  { key: 'tactical', label: 'TACTICAL',   icon: '◆' },
];

export function LayerToggle({ toggles, toggle }: Props) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 10,
        right: 10,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      {LAYERS.map(({ key, label, icon }) => {
        const active = toggles[key];
        return (
          <button
            key={key}
            onClick={() => toggle(key)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 9px',
              background: active ? 'rgba(56,189,248,0.18)' : 'rgba(6,11,20,0.78)',
              border: `1px solid ${active ? 'rgba(56,189,248,0.45)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 3,
              color: active ? '#38bdf8' : 'rgba(255,255,255,0.4)',
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              letterSpacing: '0.12em',
              cursor: 'pointer',
              backdropFilter: 'blur(8px)',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ fontSize: 10 }}>{icon}</span>
            {label}
          </button>
        );
      })}
    </div>
  );
}
