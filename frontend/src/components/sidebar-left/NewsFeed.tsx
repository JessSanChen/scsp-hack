import type { UiGameState, UiNewsItem } from '../../sim/uiState';

interface Props {
  baseline: UiGameState;
  fork: UiGameState | null;
}

interface TaggedItem extends UiNewsItem {
  track: 'B' | 'F';
}

export function NewsFeed({ baseline, fork }: Props) {
  const tagged: TaggedItem[] = baseline.news.map((n) => ({ ...n, track: 'B' }));
  if (fork) {
    for (const n of fork.news) tagged.push({ ...n, track: 'F' });
  }

  // Newest first; within a turn keep insertion order (stable sort).
  const sorted = tagged
    .map((t, i) => ({ ...t, _i: i }))
    .sort((a, b) => {
      if (b.turn !== a.turn) return b.turn - a.turn;
      return b._i - a._i;
    });

  return (
    <>
      <div className="section-label">
        <span>LIVE INTELLIGENCE FEED</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
            {sorted.length} ITEMS
          </span>
          <div className="dot" />
        </div>
      </div>

      <div className="scroll-area" style={{ padding: '4px 0' }}>
        {sorted.map((item) => (
          <FeedItem key={`${item.track}-${item.id}`} item={item} showTrack={fork !== null} />
        ))}
      </div>
    </>
  );
}

function FeedItem({ item, showTrack }: { item: TaggedItem; showTrack: boolean }) {
  const tagClass = `tag tag-${item.tag}`;
  const trackColor = item.track === 'B' ? '#7dd3fc' : '#fbbf24';

  return (
    <div
      style={{
        padding: '10px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        transition: 'background 0.15s',
        cursor: 'default',
        borderLeft: showTrack ? `2px solid ${trackColor}88` : 'none',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(56,189,248,0.05)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {showTrack && (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.12em',
                padding: '1px 6px',
                background: `${trackColor}22`,
                border: `1px solid ${trackColor}66`,
                color: trackColor,
                borderRadius: 2,
              }}
            >
              {item.track}
            </span>
          )}
          <span className={tagClass}>{item.tag}</span>
          {item.faction && (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--text-secondary)',
                letterSpacing: '0.1em',
                fontWeight: 600,
              }}
            >
              {item.faction}
            </span>
          )}
        </div>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--text-secondary)',
            letterSpacing: '0.12em',
          }}
        >
          T-{item.turn}
        </span>
      </div>

      <p
        style={{
          fontSize: 13.5,
          color: 'var(--text-primary)',
          lineHeight: 1.45,
          fontFamily: item.turn === 0 ? 'var(--font-mono)' : 'var(--font-ui)',
          opacity: item.turn === 0 ? 0.75 : 1,
        }}
      >
        {item.text}
      </p>
    </div>
  );
}
