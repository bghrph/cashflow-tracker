import React, { useEffect, useState } from 'react';
import { hybridParse } from '../engine/HybridParser.js';
import { isApiKeyConfigured } from '../engine/AIParser.js';
import { flattenCategories } from '../lib/categories.js';
import { formatShortDate } from '../lib/dates.js';
import { IconChevron, IconCheck, IconX, IconSparkle } from './icons.jsx';

export default function SmartInput({ data, onConfirm }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [results, setResults] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorToast, setErrorToast] = useState(null);

  useEffect(() => {
    isApiKeyConfigured().then(setHasApiKey);
  }, []);

  const run = async (preferenceOverride) => {
    if (!text.trim()) return;
    setLoading(true);
    setSaved(false);
    setErrorToast(null);
    try {
      const r = await hybridParse(text, data, {
        preference: preferenceOverride || data.aiPreference,
        hasApiKey,
      });
      setResults(r.results);
      setWarnings(r.warnings);
    } catch (e) {
      setErrorToast(e.message || 'Unexpected error');
    } finally {
      setLoading(false);
    }
  };

  const confirmAll = () => {
    if (results.length === 0) return;
    onConfirm(results);
    setSaved(true);
    setText('');
    setTimeout(() => {
      setResults([]);
      setWarnings([]);
      setSaved(false);
    }, 2500);
  };

  const editRow = (i, field, value) =>
    setResults((r) => r.map((item, idx) => (idx === i ? { ...item, [field]: value } : item)));
  const removeRow = (i) => setResults((r) => r.filter((_, idx) => idx !== i));

  const aiButtonDisabled = !text.trim() || !hasApiKey || loading;

  return (
    <div className="card compact" style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '14px 18px',
          background: 'none',
          border: 'none',
          color: 'var(--ink)',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        <span style={{ color: 'var(--ai)', display: 'flex' }}>
          <IconSparkle size={18} />
        </span>
        <span style={{ flex: 1, textAlign: 'left' }}>Smart Input</span>
        <span className="badge ai">NLP + AI</span>
        <span
          style={{
            color: 'var(--ink-3)',
            transform: open ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 0.2s',
            display: 'flex',
          }}
        >
          <IconChevron />
        </span>
      </button>

      {open && (
        <div className="fade-up" style={{ padding: '0 18px 18px' }}>
          <p style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 10, lineHeight: 1.5 }}>
            Type naturally — separate entries with commas. Try{' '}
            <span style={{ color: 'var(--ink-2)' }}>
              "Salary 5000, rent 1500, groceries 80 yesterday"
            </span>{' '}
            or describe complex things like "3 months rent at 2000 each from tenant".
          </p>

          <textarea
            className="textarea"
            data-testid="smart-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                run();
              }
            }}
            placeholder="What did you spend or earn?"
            rows={3}
            style={{ resize: 'vertical', minHeight: 70, marginBottom: 10 }}
          />

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn primary"
              data-testid="smart-parse-local"
              onClick={() => run('local')}
              disabled={!text.trim() || loading}
            >
              {loading && (data.aiPreference === 'local' || !hasApiKey) ? (
                <span className="spinner" />
              ) : null}
              Parse
            </button>
            <button
              className="btn ai"
              data-testid="smart-parse-ai"
              onClick={() => run('always')}
              disabled={aiButtonDisabled}
              title={!hasApiKey ? 'Set ANTHROPIC_API_KEY in .env to enable' : 'Use Claude AI for parsing'}
            >
              {loading && (data.aiPreference === 'always' || data.aiPreference === 'fallback') ? (
                <span className="spinner" />
              ) : (
                <IconSparkle size={14} />
              )}
              AI Parse
            </button>
            {loading && (
              <span style={{ fontSize: 12, color: 'var(--ai)' }}>
                Analyzing…
              </span>
            )}
            <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-3)' }}>
              Mode:{' '}
              <span style={{ color: 'var(--ink-2)', fontWeight: 600, textTransform: 'capitalize' }}>
                {data.aiPreference}
              </span>{' '}
              {!hasApiKey && (
                <span style={{ color: 'var(--negative)', marginLeft: 6 }}>(no API key)</span>
              )}
            </div>
          </div>

          {warnings.length > 0 && !loading && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {warnings.map((w, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: 11,
                    color: 'var(--warning)',
                    padding: '6px 10px',
                    background: 'var(--warning-soft)',
                    borderRadius: 8,
                  }}
                >
                  {w}
                </div>
              ))}
            </div>
          )}

          {errorToast && (
            <div
              style={{
                marginTop: 12,
                fontSize: 12,
                color: 'var(--negative)',
                padding: '8px 12px',
                background: 'var(--negative-soft)',
                borderRadius: 8,
              }}
            >
              {errorToast}
            </div>
          )}

          {saved && (
            <div
              className="fade-up"
              style={{
                marginTop: 12,
                padding: '10px 14px',
                background: 'var(--positive-soft)',
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: 'var(--positive)',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <IconCheck /> Transactions saved.
            </div>
          )}

          {results.length > 0 && !saved && (
            <div className="fade-up" style={{ marginTop: 16 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <span className="eyebrow accent">
                  {results.length} transaction{results.length > 1 ? 's' : ''} parsed
                </span>
                <button className="btn primary sm" data-testid="smart-confirm" onClick={confirmAll}>
                  <IconCheck /> Confirm All
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {results.map((r, i) => (
                  <ResultRow
                    key={i}
                    row={r}
                    onEdit={(field, value) => editRow(i, field, value)}
                    onRemove={() => removeRow(i)}
                    data={data}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResultRow({ row, onEdit, onRemove, data }) {
  const cats = row.type === 'Income' ? flattenCategories(data.incomeGroups) : flattenCategories(data.expenseGroups);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 10px',
        background: 'var(--bg-elev)',
        border: '1px solid var(--border)',
        borderRadius: 10,
      }}
    >
      <span className={`source-badge ${row.source}`}>{row.source === 'ai' ? 'AI' : 'Local'}</span>
      <select
        className="select sm"
        value={row.type}
        onChange={(e) => onEdit('type', e.target.value)}
        style={{ width: 90 }}
      >
        <option value="Income">Income</option>
        <option value="Expense">Expense</option>
      </select>
      <input
        className="input sm"
        list={`smart-cat-${row.type}`}
        value={row.category}
        onChange={(e) => onEdit('category', e.target.value)}
        style={{ flex: 1, minWidth: 100 }}
      />
      <datalist id={`smart-cat-${row.type}`}>
        {cats.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <input
        type="number"
        className="input sm"
        value={row.amount}
        onChange={(e) => onEdit('amount', parseFloat(e.target.value) || 0)}
        style={{ width: 80, textAlign: 'right' }}
      />
      <span style={{ fontSize: 11, color: 'var(--ink-3)', minWidth: 52 }}>
        {formatShortDate(row.date)}
      </span>
      {row.isNew && <span className="badge info">new cat</span>}
      <button
        className="btn ghost icon xs"
        onClick={onRemove}
        aria-label="Remove"
        style={{ color: 'var(--negative)' }}
      >
        <IconX />
      </button>
    </div>
  );
}
