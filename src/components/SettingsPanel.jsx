import React from 'react';

const OPTIONS = [
  { value: 'local', label: 'Local only', desc: 'No API calls. Fastest, free, no key required.' },
  { value: 'fallback', label: 'AI fallback', desc: 'Local first. If the pattern matcher is uncertain, send to Claude.' },
  { value: 'always', label: 'Always AI', desc: 'Every parse goes to Claude. Best accuracy on messy input.' },
];

export default function SettingsPanel({ data, update }) {
  return (
    <div className="card" style={{ borderLeft: '3px solid var(--ai)', marginBottom: 16 }}>
      <div className="row space" style={{ marginBottom: 6 }}>
        <span className="eyebrow ai">AI Smart Input Mode</span>
        <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>Affects the Parse buttons on the Log tab</span>
      </div>
      <div className="grid grid-3" style={{ gap: 8, marginTop: 10 }}>
        {OPTIONS.map((o) => {
          const selected = (data.aiPreference || 'fallback') === o.value;
          return (
            <button
              key={o.value}
              onClick={() => update({ aiPreference: o.value })}
              className={`btn ${selected ? 'subtle' : 'outline'}`}
              style={{
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '12px 14px',
                gap: 4,
                textAlign: 'left',
                borderColor: selected ? 'var(--ai)' : 'var(--border-strong)',
                background: selected ? 'var(--ai-soft)' : 'transparent',
                color: selected ? 'var(--ai)' : 'var(--ink-2)',
                height: 'auto',
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 13 }}>{o.label}</span>
              <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 400 }}>{o.desc}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
