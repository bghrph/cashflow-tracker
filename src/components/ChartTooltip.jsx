import React from 'react';
import { formatMoney } from '../lib/format.js';

export default function ChartTooltip({ active, payload, label, symbol }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: 'var(--bg-elev)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '10px 12px',
        boxShadow: 'var(--shadow-md)',
        fontSize: 12,
      }}
    >
      {label && (
        <div style={{ color: 'var(--ink-3)', marginBottom: 6, fontSize: 11 }}>{label}</div>
      )}
      {payload.map((p, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: i > 0 ? 3 : 0,
          }}
        >
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: 2,
              background: p.color || p.fill,
            }}
          />
          <span style={{ color: 'var(--ink-2)', flex: 1 }}>{p.name}</span>
          <span className="tnum" style={{ fontWeight: 600, color: 'var(--ink)' }}>
            {formatMoney(symbol || '$', p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}
