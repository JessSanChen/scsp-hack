import type { NewsItem } from '../../mockData';

interface Props { items: NewsItem[]; }

export function NewsFeed({ items }: Props) {
  // Newest first
  const sorted = [...items].sort((a, b) => b.turn - a.turn);

  return (
    <>
      <div className="section-label">
        <span>LIVE INTELLIGENCE FEED</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 8, color: 'var(--text-secondary)' }}>
            {sorted.length} ITEMS
          </span>
          <div className="dot" />
        </div>
      </div>

      <div className="scroll-area" style={{ padding: '6px 0' }}>
        {sorted.map((item, i) => (
          <FeedItem key={i} item={item} />
        ))}
      </div>
    </>
  );
}

function FeedItem({ item }: { item: NewsItem }) {
  const tagClass = item.tag ? `tag tag-${item.tag}` : 'tag tag-scenario';

  return (
    <div
      style={{
        padding: '8px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        transition: 'background 0.15s',
        cursor: 'default',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(56,189,248,0.04)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Top row: tag + turn marker */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <span className={tagClass}>{item.tag ?? 'event'}</span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 8,
            color: 'var(--text-secondary)',
            letterSpacing: '0.1em',
          }}
        >
          T-{item.turn}
        </span>
      </div>

      {/* Headline */}
      <p
        style={{
          fontSize: 11.5,
          color: 'var(--text-primary)',
          lineHeight: 1.45,
          fontFamily: item.turn === 0 ? 'var(--font-mono)' : 'var(--font-ui)',
          opacity: item.turn === 0 ? 0.6 : 1,
        }}
      >
        {item.text}
      </p>
    </div>
  );
}
