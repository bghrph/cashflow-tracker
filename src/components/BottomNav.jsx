import React from 'react';
import { NAV_ITEMS } from './navConfig.js';

export default function BottomNav({ tab, setTab }) {
  return (
    <nav className="bottom-nav">
      {NAV_ITEMS.map((n) => {
        const Icon = n.icon;
        return (
          <button
            key={n.id}
            className={`bottom-nav-item ${tab === n.id ? 'active' : ''}`}
            data-testid={`bottom-nav-${n.id}`}
            onClick={() => setTab(n.id)}
          >
            <Icon size={16} />
            {n.label}
          </button>
        );
      })}
    </nav>
  );
}
