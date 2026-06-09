// Prompt-to-update lifecycle for the PWA service worker (registerType: 'prompt').
// Coordinates sibling same-origin tabs via BroadcastChannel so they reload onto
// the new build instead of continuing to run on assets the new SW has evicted.
import { registerSW } from 'virtual:pwa-register';

const CHANNEL_NAME = 'cashflow-pwa-update';

const listeners = new Set();
let state = { needRefresh: false, offlineReady: false, fromSibling: false };
let updateSWFn = null;
let channel = null;

function setState(patch) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn(state));
}

export function subscribePwaUpdate(fn) {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

export function initPwaUpdate() {
  if (updateSWFn) return;

  updateSWFn = registerSW({
    immediate: true,
    onNeedRefresh() {
      setState({ needRefresh: true });
    },
    onOfflineReady() {
      setState({ offlineReady: true });
    },
  });

  if (typeof BroadcastChannel !== 'undefined') {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event) => {
        if (event?.data === 'reload') setState({ needRefresh: true, fromSibling: true });
      };
    } catch {
      channel = null;
    }
  }
}

// Sequencing matters: broadcast to sibling tabs *before* activating the waiting
// worker. Activating first lets the new SW start evicting old caches while
// siblings are still mid-reload on the assets it just evicted.
export async function acceptPwaUpdate() {
  if (channel) {
    try {
      channel.postMessage('reload');
    } catch {
      // best-effort — a sibling that misses this still gets the prompt on its
      // own next onNeedRefresh, just not synchronized to this reload
    }
  }
  if (updateSWFn) await updateSWFn(true);
  else window.location.reload();
}

export function dismissOfflineReady() {
  setState({ offlineReady: false });
}
