import React, { useEffect, useRef } from 'react';
import TutorialVideo from './TutorialVideo.jsx';
import { IconX } from './icons.jsx';

const STEPS = [
  { title: 'Setup', body: 'Set your currency, categories, and budgets' },
  { title: 'Transactions', body: 'Log income & expenses (with AI parsing)' },
  { title: 'Overview', body: 'See your financial health at a glance' },
  { title: 'Goals', body: 'Set targets and track progress' },
];

const FOCUSABLE_SELECTOR = 'button, a[href], video, [tabindex]:not([tabindex="-1"])';

export default function TutorialOverlay({ open, isFirstRun, onComplete, onClose }) {
  const dialogRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    previouslyFocusedRef.current = document.activeElement;
    const dialog = dialogRef.current;
    dialog?.querySelector(FOCUSABLE_SELECTOR)?.focus();

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = dialog?.querySelectorAll(FOCUSABLE_SELECTOR);
      if (!items || items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      previouslyFocusedRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="tutorial-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="tutorial-dialog" role="dialog" aria-modal="true" aria-labelledby="tutorial-heading" ref={dialogRef}>
        <button className="btn ghost icon tutorial-dialog-close" onClick={onClose} aria-label="Close tutorial">
          <IconX />
        </button>
        <h2 id="tutorial-heading" className="tutorial-heading">Welcome to CashFlow Tracker</h2>
        <TutorialVideo />
        <ol className="tutorial-steps">
          {STEPS.map((step) => (
            <li key={step.title}>
              <span className="tutorial-step-title">{step.title}</span>
              <span className="tutorial-step-body">{step.body}</span>
            </li>
          ))}
        </ol>
        <div className="tutorial-actions">
          {isFirstRun && (
            <button type="button" className="tutorial-skip-link" onClick={onClose}>Skip</button>
          )}
          <button className="btn primary" onClick={isFirstRun ? onComplete : onClose}>
            {isFirstRun ? "Got it, let's go →" : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
