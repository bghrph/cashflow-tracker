import React from 'react';
import { IconLogout } from './icons.jsx';
import { NAV_ITEMS } from './navConfig.js';

export default function Sidebar({ tab, setTab, auth, currency, onLogout }) {
  const initials = (auth?.name || auth?.email || '?')
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-mark">C</div>
        <div>
          CashFlow
          <div style={{ fontSize: 10, color: 'var(--ink-3)', fontFamily: 'Inter', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 2 }}>
            {currency}
          </div>
        </div>
      </div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((n) => {
          const Icon = n.icon;
          return (
            <button
              key={n.id}
              className={`sidebar-link ${tab === n.id ? 'active' : ''}`}
              data-testid={`nav-${n.id}`}
              onClick={() => setTab(n.id)}
            >
              <Icon size={16} />
              {n.label}
            </button>
          );
        })}
      </nav>
      <div className="sidebar-user">
        <div className="sidebar-user-avatar">{initials}</div>
        <div style={{ flex: 1, overflow: 'hidden' }} className="text-ellipsis">
          {auth?.name || auth?.email}
        </div>
        <button className="btn ghost icon xs" onClick={onLogout} title="Log out" aria-label="Log out">
          <IconLogout size={14} />
        </button>
      </div>
    </aside>
  );
}
