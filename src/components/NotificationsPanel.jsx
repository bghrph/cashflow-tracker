import React, { useState, useEffect, useRef } from 'react';
import { IconBell, IconX } from './icons.jsx';

export default function NotificationsPanel({ notifications }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button
        className="btn ghost icon notification-bell"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
      >
        <IconBell />
        {notifications.length > 0 && <span className="notification-dot" />}
      </button>
      {open && (
        <div className="notifications-popover">
          <div className="notifications-popover-header">
            <span className="eyebrow accent">Smart Alerts</span>
            <button className="btn ghost icon xs" onClick={() => setOpen(false)} aria-label="Close">
              <IconX />
            </button>
          </div>
          {notifications.length === 0 ? (
            <div className="notifications-popover-empty">All clear — no alerts right now.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {notifications.map((n, i) => (
                <div key={i} className={`notification ${n.type}`}>
                  <span className="notification-icon">{n.icon}</span>
                  <div>
                    <div className="notification-title">{n.title}</div>
                    <div className="notification-body">{n.body}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
