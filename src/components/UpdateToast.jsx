import React, { useEffect, useState } from 'react';
import { subscribePwaUpdate, acceptPwaUpdate, dismissOfflineReady } from '../lib/pwaUpdate.js';

export default function UpdateToast() {
  const [state, setState] = useState({ needRefresh: false, offlineReady: false, fromSibling: false });
  const [reloading, setReloading] = useState(false);

  useEffect(() => subscribePwaUpdate(setState), []);

  if (state.needRefresh) {
    return (
      <div className="pwa-toast" role="status">
        <span>
          {state.fromSibling
            ? 'This app was updated in another tab — reload to stay in sync.'
            : 'Update available — reload to get the latest version.'}
        </span>
        <button
          type="button"
          className="btn primary sm"
          disabled={reloading}
          onClick={() => {
            setReloading(true);
            acceptPwaUpdate();
          }}
        >
          {reloading ? 'Reloading…' : 'Reload'}
        </button>
      </div>
    );
  }

  if (state.offlineReady) {
    return (
      <div className="pwa-toast" role="status">
        <span>CashFlow is ready to work offline.</span>
        <button type="button" className="btn ghost sm" onClick={dismissOfflineReady}>
          Dismiss
        </button>
      </div>
    );
  }

  return null;
}
