import React, { useEffect, useState } from 'react';
import { subscribeDataSync } from '../lib/dataSync.js';

const STATUS_COPY = {
  pending: { label: 'Saving…', className: 'pending' },
  synced: { label: 'Saved', className: 'synced' },
  'offline-queued': { label: 'Saved offline — will sync', className: 'offline' },
  failed: { label: 'Save failed', className: 'failed' },
};

// Surfaces the save pipeline's status (plan item 6) — previously
// `saveFirestoreData` was fire-and-forget with no visible feedback, so queued
// offline writes and failures were invisible to the user.
export default function SaveStatusIndicator() {
  const [status, setStatus] = useState('idle');

  useEffect(() => subscribeDataSync((s) => setStatus(s.saveStatus)), []);

  const copy = STATUS_COPY[status];
  if (!copy) return null;

  return (
    <span className={`save-status save-status-${copy.className}`} role="status">
      {copy.label}
    </span>
  );
}
