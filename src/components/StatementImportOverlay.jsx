// src/components/StatementImportOverlay.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { isApiKeyConfigured } from '../engine/AIParser.js';
import { flattenCategories } from '../lib/categories.js';
import { formatShortDate } from '../lib/dates.js';
import { getCurrency } from '../lib/currencies.js';
import { parseStatement } from '../lib/statementParser.js';
import { dedupeAgainstLog } from '../lib/statementDedup.js';
import { lookup, remember } from '../lib/merchantMemory.js';
import { categorize, CategorizeError } from '../engine/categorizeStatements.js';
import { IconX, IconCheck } from './icons.jsx';

const FOCUSABLE = 'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
const MAX_TX = 2000;

export default function StatementImportOverlay({ open, data, apiKey, onConfirm, update, onClose }) {
  const dialogRef = useRef(null);
  const [step, setStep] = useState('upload'); // upload | working | review | done
  const [pasteText, setPasteText] = useState('');
  const [fileText, setFileText] = useState('');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(null);
  const [rows, setRows] = useState([]);
  const [skippedCount, setSkippedCount] = useState(0);
  const [knownCount, setKnownCount] = useState(0);
  const [memory, setMemory] = useState(() => data.merchantMemory || {});
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    const prevFocus = document.activeElement;
    const dialog = dialogRef.current;
    dialog?.querySelector(FOCUSABLE)?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const items = dialog?.querySelectorAll(FOCUSABLE);
      if (!items || !items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, [open, onClose]);

  const incomeCatSet = useMemo(() => new Set(flattenCategories(data.incomeGroups)), [data.incomeGroups]);
  const expenseCatSet = useMemo(() => new Set(flattenCategories(data.expenseGroups)), [data.expenseGroups]);
  const incomeCats = useMemo(() => flattenCategories(data.incomeGroups), [data.incomeGroups]);
  const expenseCats = useMemo(() => flattenCategories(data.expenseGroups), [data.expenseGroups]);
  const hasKey = isApiKeyConfigured(apiKey);

  if (!open) return null;

  const onFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const texts = await Promise.all(files.map((f) => f.text()));
    setFileText(texts.join('\n'));
    setError('');
  };

  const analyze = async () => {
    setError('');
    const text = [fileText, pasteText].filter(Boolean).join('\n');
    if (!text.trim()) { setError('Add a file or paste some rows first.'); return; }
    const parsed = parseStatement(text);
    if (!parsed.ok) {
      setError(parsed.error === 'empty'
        ? 'This file is empty or not a valid CSV.'
        : 'We couldn’t find any transactions in that file.');
      return;
    }
    if (parsed.needsManualMap) {
      setError('We couldn’t recognize the columns. Make sure your file has date, description, and amount columns.');
      return;
    }
    const { fresh, skipped } = dedupeAgainstLog(parsed.rows, data.transactions);
    setSkippedCount(skipped.length);

    let known = 0;
    const unknown = [];
    const prefilled = fresh.map((r) => {
      const cat = lookup(memory, r.description);
      if (cat) { known++; return { ...r, category: cat, merchant: r.description, confidence: 'high', needsReview: false, _checked: true }; }
      unknown.push(r);
      return null;
    });
    setKnownCount(known);

    if (unknown.length === 0) {
      setRows(prefilled.filter(Boolean));
      setStep('review');
      return;
    }

    setStep('working');
    setProgress({ done: 0, total: Math.ceil(unknown.length / 12) });
    try {
      const categorized = await categorize(unknown, data, apiKey, setProgress);
      let ci = 0;
      const merged = fresh.map((r, i) => (prefilled[i] ? prefilled[i] : { ...categorized[ci++], _checked: true }));
      merged.sort((a, b) => (b.needsReview ? 1 : 0) - (a.needsReview ? 1 : 0));
      setRows(merged);
      setStep('review');
    } catch (err) {
      setError(err instanceof CategorizeError && err.status === 401
        ? 'Your API key was rejected. Check it in Setup.'
        : `Categorization failed. ${err.message || ''}`);
      setStep('upload');
    }
  };

  const setRow = (idx, patch) => setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const onEditCategory = (idx, category) => {
    const r = rows[idx];
    setRow(idx, { category, needsReview: false });
    setMemory((m) => remember(m, r.description, category));
  };
  const toggleAll = (checked) => setRows((rs) => rs.map((r) => ({ ...r, _checked: checked })));
  const flipAllTypes = () =>
    setRows((rs) => rs.map((r) => ({ ...r, type: r.type === 'Income' ? 'Expense' : 'Income' })));

  const selectedCount = rows.filter((r) => r._checked).length;

  const doImport = () => {
    const selected = rows.filter((r) => r._checked);
    if (selected.length === 0) return;
    if (data.transactions.length + selected.length > MAX_TX) {
      setError(`That would pass the ${MAX_TX}-entry limit. You can import ${Math.max(0, MAX_TX - data.transactions.length)} more.`);
      return;
    }
    const results = selected.map((r) => ({
      isNew: !(r.type === 'Income' ? incomeCatSet : expenseCatSet).has(r.category),
      type: r.type,
      category: r.category,
      date: r.date,
      currencyCode: data.primaryCurrency,
      amount: r.amount,
      description: r.description,
    }));
    onConfirm(results);
    let mem = memory;
    selected.forEach((r) => { mem = remember(mem, r.description, r.category); });
    if (update) update((p) => ({ ...p, merchantMemory: mem }));
    setSummary({
      count: selected.length,
      expenses: selected.filter((r) => r.type === 'Expense').length,
      income: selected.filter((r) => r.type === 'Income').length,
    });
    setStep('done');
  };

  const importMore = () => {
    setStep('upload'); setPasteText(''); setFileText(''); setRows([]);
    setError(''); setProgress(null); setSummary(null); setSkippedCount(0); setKnownCount(0);
  };

  const stepNum = step === 'upload' ? 1 : step === 'working' ? 2 : 3;

  return (
    <div className="tutorial-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="card"
        role="dialog"
        aria-modal="true"
        aria-label="Import statement"
        ref={dialogRef}
        style={{ width: 'min(880px, 95vw)', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}
      >
        <button className="btn ghost icon" onClick={onClose} aria-label="Close" style={{ position: 'absolute', top: 12, right: 12 }}>
          <IconX />
        </button>

        {!hasKey ? (
          <div style={{ padding: '8px 4px' }}>
            <h2 style={{ marginBottom: 8 }}>Import a statement</h2>
            <p style={{ color: 'var(--ink-3)', fontSize: 13, marginBottom: 16 }}>
              You need an Anthropic API key to use this feature.
            </p>
            <button className="btn primary" onClick={onClose}>Go to Setup &rarr;</button>
            <p className="muted" style={{ fontSize: 11, marginTop: 10 }}>
              Add your key in the Setup tab, then reopen Import.
            </p>
          </div>
        ) : (
          <>
            <span className="eyebrow accent">Step {stepNum} of 3</span>
            <h2 style={{ marginTop: 4, marginBottom: 12 }}>Import a statement</h2>

            {error && (
              <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--negative)', padding: '8px 12px', background: 'var(--negative-soft)', borderRadius: 8 }}>
                {error}
              </div>
            )}

            {step === 'upload' && (
              <div className="fade-up">
                <label
                  htmlFor="stmt-file"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); onFiles(e.dataTransfer.files); }}
                  style={{ display: 'block', border: '2px dashed var(--border)', borderRadius: 12, padding: 28, textAlign: 'center', cursor: 'pointer', marginBottom: 14 }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Drag your bank or card CSV here, or tap to choose a file</div>
                  <div className="muted" style={{ fontSize: 12 }}>{fileText ? 'File loaded ✓' : '.csv files'}</div>
                  <input id="stmt-file" type="file" accept=".csv,text/csv" multiple style={{ display: 'none' }} onChange={(e) => onFiles(e.target.files)} />
                </label>
                <p className="muted" style={{ fontSize: 12, marginBottom: 6 }}>&hellip;or paste rows copied from your bank, Excel, or Sheets:</p>
                <textarea
                  className="textarea"
                  rows={4}
                  placeholder="Paste statement rows here"
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  style={{ marginBottom: 14, resize: 'vertical' }}
                />
                <button className="btn primary block" onClick={analyze}>Analyze transactions</button>
              </div>
            )}

            {step === 'working' && (
              <div className="fade-up" style={{ padding: '24px 4px' }}>
                <p style={{ marginBottom: 10 }}>We&apos;re sorting your transactions into your categories&hellip;</p>
                <div style={{ height: 8, background: 'var(--surface)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${progress ? Math.round((progress.done / progress.total) * 100) : 0}%`, background: 'var(--accent)', transition: 'width 0.3s' }} />
                </div>
                <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                  {progress ? `Batch ${progress.done} of ${progress.total}` : 'Starting…'}
                </p>
              </div>
            )}

            {step === 'review' && (
              <div className="fade-up">
                <p style={{ fontSize: 13, marginBottom: 10 }}>
                  Found <strong>{rows.length}</strong> to import
                  {skippedCount > 0 && <> &middot; <span className="muted">{skippedCount} already in your log</span></>}
                  {knownCount > 0 && <> &middot; <span className="muted">{knownCount} known merchants</span></>}.
                </p>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                  <button className="btn ghost sm" onClick={() => toggleAll(true)}>Select all</button>
                  <button className="btn ghost sm" onClick={() => toggleAll(false)}>Deselect all</button>
                  <button className="btn ghost sm" onClick={flipAllTypes}>Flip all income/expense</button>
                  <span className="muted" style={{ marginLeft: 'auto', fontSize: 12 }}>{selectedCount} of {rows.length} selected</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '46vh', overflowY: 'auto' }}>
                  {rows.map((r, i) => {
                    const ts = getCurrency(data.primaryCurrency).symbol;
                    const cats = r.type === 'Income' ? incomeCats : expenseCats;
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--bg-elev)', border: `1px solid ${r.needsReview ? 'var(--warning)' : 'var(--border)'}`, borderRadius: 10 }}>
                        <input type="checkbox" checked={!!r._checked} onChange={(e) => setRow(i, { _checked: e.target.checked })} aria-label="Include" />
                        <span style={{ fontSize: 11, color: 'var(--ink-3)', minWidth: 52 }}>{formatShortDate(r.date)}</span>
                        <span title={r.description} className="text-ellipsis" style={{ flex: 1, minWidth: 80, fontSize: 12 }}>
                          {r.description.length > 35 ? `${r.description.slice(0, 35)}…` : r.description}
                        </span>
                        <select className="select sm" value={r.type} onChange={(e) => setRow(i, { type: e.target.value })} style={{ width: 90 }}>
                          <option value="Income">Income</option>
                          <option value="Expense">Expense</option>
                        </select>
                        <input className="input sm" list={`stmt-cat-${i}`} value={r.category} onChange={(e) => onEditCategory(i, e.target.value)} style={{ flex: 1, minWidth: 90 }} />
                        <datalist id={`stmt-cat-${i}`}>{cats.map((c) => <option key={c} value={c} />)}</datalist>
                        <span className="tnum" style={{ minWidth: 70, textAlign: 'right', fontWeight: 600, color: r.type === 'Income' ? 'var(--positive)' : 'var(--negative)' }}>
                          {ts}{r.amount.toFixed(2)}
                        </span>
                        {r.needsReview && <span className="badge info">review</span>}
                      </div>
                    );
                  })}
                </div>

                <button className="btn primary block" onClick={doImport} style={{ marginTop: 14 }} disabled={selectedCount === 0}>
                  <IconCheck /> Import {selectedCount} to Log
                </button>
              </div>
            )}

            {step === 'done' && summary && (
              <div className="fade-up" style={{ padding: '16px 4px', textAlign: 'center' }}>
                <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
                  {summary.count} imported ✓
                </p>
                <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
                  {summary.expenses} expenses &middot; {summary.income} income
                </p>
                <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
                  <button className="btn ghost" onClick={importMore}>Import more</button>
                  <button className="btn primary" onClick={onClose}>Done</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
