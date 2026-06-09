import React, { useEffect, useState } from 'react';
import { subscribeDataSync, dismissRemoteChangeNotice } from '../lib/dataSync.js';

// "Online awareness" mitigation for the pre-existing single-document
// last-write-wins model (PLAN-IOS-PWA.md Risks) — not conflict detection,
// just a nudge that something changed elsewhere so the user can reload
// before their next edit overwrites it.
export default function RemoteChangeNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => subscribeDataSync((s) => setVisible(s.remoteChange)), []);

  if (!visible) return null;

  return (
    <div className="pwa-toast" role="status">
      <span>This data was changed elsewhere — reload to see the latest.</span>
      <button type="button" className="btn primary sm" onClick={() => window.location.reload()}>
        Reload
      </button>
      <button type="button" className="btn ghost sm" onClick={dismissRemoteChangeNotice}>
        Dismiss
      </button>
    </div>
  );
}
