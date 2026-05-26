import React, { useState, useEffect } from 'react';
import { CURRENCIES, getCurrency } from '../lib/currencies.js';
import { flattenCategories } from '../lib/categories.js';
import CategoryGroup from '../components/CategoryGroup.jsx';
import SettingsPanel from '../components/SettingsPanel.jsx';
import { IconPlus, IconRepeat, IconTrash } from '../components/icons.jsx';
import { saveProfile } from '../lib/firestore.js';

export default function SetupTab({ data, update, uid, apiKey, onApiKeyChange }) {
  const [newIncomeGroup, setNewIncomeGroup] = useState('');
  const [newExpenseGroup, setNewExpenseGroup] = useState('');
  const [keyInput, setKeyInput] = useState(apiKey || '');
  const [keySaving, setKeySaving] = useState(false);
  const [keySaved, setKeySaved] = useState(false);
  const [keyError, setKeyError] = useState('');
  const allExpense = flattenCategories(data.expenseGroups);
  const [selectedCat, setSelectedCat] = useState(allExpense[0] || '');
  const bt = data.budgetTargets[selectedCat] || {
    monthly: 0,
    rollover: 'none',
    rolloverLimit: 0,
    surplusGoalId: null,
  };
  const saveBT = (field, value) =>
    update((p) => ({
      ...p,
      budgetTargets: { ...p.budgetTargets, [selectedCat]: { ...bt, [field]: value } },
    }));
  const symbol = getCurrency(data.primaryCurrency).symbol;

  const saveApiKey = async () => {
    if (!uid) {
      setKeyError('Not signed in. Please refresh and try again.');
      return;
    }
    setKeySaving(true);
    setKeySaved(false);
    setKeyError('');
    try {
      await saveProfile(uid, { anthropicApiKey: keyInput.trim() });
      onApiKeyChange(keyInput.trim());
      setKeySaved(true);
      setTimeout(() => setKeySaved(false), 3000);
    } catch (err) {
      setKeyError(err?.message || 'Failed to save. Try again.');
    } finally {
      setKeySaving(false);
    }
  };

  useEffect(() => {
    setKeyInput(apiKey || '');
  }, [apiKey]);

  const addGroup = (type) => {
    const v = (type === 'income' ? newIncomeGroup : newExpenseGroup).trim();
    if (!v) return;
    const key = type === 'income' ? 'incomeGroups' : 'expenseGroups';
    if (data[key].some((g) => g.name.toLowerCase() === v.toLowerCase())) return;
    update((p) => ({ ...p, [key]: [...p[key], { name: v, categories: [] }] }));
    type === 'income' ? setNewIncomeGroup('') : setNewExpenseGroup('');
  };

  return (
    <div className="app-section" style={{ maxWidth: 760 }}>
      <h2>Setup</h2>
      <p className="section-sub">Configure currency, budgets, recurring transactions, and how the AI parser behaves.</p>

      <SettingsPanel data={data} update={update} />

      <div className="card" style={{ marginBottom: 16 }}>
        <span className="eyebrow">Primary Currency</span>
        <select
          className="select"
          value={data.primaryCurrency}
          onChange={(e) => update((p) => ({ ...p, primaryCurrency: e.target.value }))}
          style={{ maxWidth: 280, marginTop: 6 }}
        >
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.symbol} {c.code} — {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="card positive-left" style={{ marginBottom: 16 }}>
        <span className="eyebrow positive">Monthly Savings Target</span>
        <p style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2, marginBottom: 10 }}>
          How much do you want to save each month?
        </p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            className="input lg"
            type="number"
            min="0"
            value={data.monthlySavingsTarget || ''}
            onChange={(e) =>
              update({ monthlySavingsTarget: Number(e.target.value) || 0 })
            }
            placeholder="0"
            style={{ maxWidth: 180, fontWeight: 600 }}
          />
          <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>{symbol} / month</span>
        </div>
      </div>

      <div className="card accent-left" style={{ marginBottom: 16 }}>
        <span className="eyebrow accent">Budget Targets & Rollover</span>
        <p style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2, marginBottom: 10 }}>
          Set monthly limits per expense category. Surplus can auto-sweep to a savings goal.
        </p>
        {allExpense.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--ink-3)' }}>Add expense categories below first.</p>
        ) : (
          <>
            <select
              className="select"
              value={selectedCat}
              onChange={(e) => setSelectedCat(e.target.value)}
              style={{ marginBottom: 10 }}
            >
              {allExpense.map((c) => (
                <option key={c} value={c}>
                  {c}
                  {data.budgetTargets[c]?.monthly
                    ? ` (${symbol}${data.budgetTargets[c].monthly}/mo)`
                    : ''}
                </option>
              ))}
            </select>
            <div className="grid grid-keep-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div>
                <label className="field-label">Monthly ({symbol})</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={bt.monthly || ''}
                  onChange={(e) => saveBT('monthly', Number(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="field-label">Rollover</label>
                <select
                  className="select"
                  value={bt.rollover || 'none'}
                  onChange={(e) => saveBT('rollover', e.target.value)}
                >
                  <option value="none">None</option>
                  <option value="full">Full surplus</option>
                  <option value="limited">Limited</option>
                  <option value="accumulate">Accumulate</option>
                </select>
              </div>
            </div>
            {bt.rollover === 'limited' && (
              <div style={{ marginTop: 8 }}>
                <label className="field-label">Max rollover ({symbol})</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={bt.rolloverLimit || ''}
                  onChange={(e) => saveBT('rolloverLimit', Number(e.target.value) || 0)}
                  style={{ maxWidth: 160 }}
                />
              </div>
            )}
            <div style={{ marginTop: 10 }}>
              <label className="field-label" style={{ color: 'var(--positive)' }}>
                Sweep surplus to goal
              </label>
              <select
                className="select"
                value={bt.surplusGoalId || ''}
                onChange={(e) =>
                  saveBT('surplusGoalId', e.target.value ? Number(e.target.value) : null)
                }
              >
                <option value="">No auto-sweep</option>
                {data.savingsGoals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({Math.round((g.current / g.target) * 100)}%)
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      <div className="card info-left" style={{ marginBottom: 16 }}>
        <div className="row space" style={{ marginBottom: 6 }}>
          <span className="eyebrow info">
            <IconRepeat /> Recurring Transactions
          </span>
          <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
            Auto-added on the 1st of each month
          </span>
        </div>
        {data.recurringTemplates.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--ink-3)', padding: '10px 0' }}>
            No recurring items yet. Add some from the Log tab.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
            {data.recurringTemplates.map((tpl) => {
              const ts = getCurrency(tpl.currencyCode || data.primaryCurrency).symbol;
              return (
                <div
                  key={tpl.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    background: 'var(--surface)',
                    borderRadius: 8,
                    opacity: tpl.active !== false ? 1 : 0.5,
                  }}
                >
                  <span style={{ display: 'flex', color: 'var(--info)' }}>
                    <IconRepeat />
                  </span>
                  <span className={`badge ${tpl.type === 'Income' ? 'income' : 'expense'}`}>
                    {tpl.type === 'Income' ? 'Inc' : 'Exp'}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{tpl.category}</span>
                  <span
                    className="tnum"
                    style={{
                      fontWeight: 600,
                      color: tpl.type === 'Income' ? 'var(--positive)' : 'var(--negative)',
                    }}
                  >
                    {ts}
                    {tpl.amount.toFixed(2)}
                  </span>
                  <button
                    className="btn ghost xs"
                    onClick={() =>
                      update((p) => ({
                        ...p,
                        recurringTemplates: p.recurringTemplates.map((t) =>
                          t.id === tpl.id ? { ...t, active: !t.active } : t
                        ),
                      }))
                    }
                    style={{ color: tpl.active !== false ? 'var(--positive)' : 'var(--ink-3)' }}
                  >
                    {tpl.active !== false ? 'On' : 'Off'}
                  </button>
                  <button
                    className="btn danger xs"
                    onClick={() =>
                      update((p) => ({
                        ...p,
                        recurringTemplates: p.recurringTemplates.filter((t) => t.id !== tpl.id),
                      }))
                    }
                  >
                    <IconTrash />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card" style={{ borderLeft: '3px solid var(--ai)', marginBottom: 16 }}>
        <span className="eyebrow ai">AI Settings</span>
        <p style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4, marginBottom: 12, lineHeight: 1.6 }}>
          Paste your Anthropic API key to enable AI-powered parsing. Your key is stored privately in your account and never logged.
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            className="input"
            type="password"
            placeholder="sk-ant-..."
            data-testid="api-key-input"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            style={{ flex: 1, fontFamily: 'monospace', fontSize: 13 }}
          />
          <button
            className="btn primary"
            onClick={saveApiKey}
            disabled={keySaving || !keyInput.trim()}
            data-testid="api-key-save"
          >
            {keySaving ? 'Saving…' : keySaved ? 'Saved ✓' : 'Save'}
          </button>
        </div>
        {keyError && (
          <p style={{ fontSize: 11, color: 'var(--negative)', marginTop: 6 }}>
            {keyError}
          </p>
        )}
        {keyInput && !keyInput.startsWith('sk-ant-') && (
          <p style={{ fontSize: 11, color: 'var(--negative)', marginTop: 6 }}>
            Key should start with <code>sk-ant-</code>
          </p>
        )}
      </div>

      <div className="grid grid-keep-2" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {[
          {
            type: 'income',
            accent: 'var(--positive)',
            eyebrowClass: 'positive',
            groups: data.incomeGroups,
            nv: newIncomeGroup,
            setNv: setNewIncomeGroup,
            title: 'Income',
          },
          {
            type: 'expense',
            accent: 'var(--negative)',
            eyebrowClass: 'negative',
            groups: data.expenseGroups,
            nv: newExpenseGroup,
            setNv: setNewExpenseGroup,
            title: 'Expense',
          },
        ].map((col) => (
          <div key={col.type} className="card">
            <div className="row space" style={{ marginBottom: 10 }}>
              <span className={`eyebrow ${col.eyebrowClass}`}>{col.title}</span>
              <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                {col.groups.length}g · {flattenCategories(col.groups).length}c
              </span>
            </div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
              <input
                className="input sm"
                placeholder="New group…"
                value={col.nv}
                onChange={(e) => col.setNv(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addGroup(col.type)}
              />
              <button className="btn primary sm" onClick={() => addGroup(col.type)}>
                <IconPlus />
              </button>
            </div>
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {col.groups.map((g, gi) => (
                <CategoryGroup
                  key={g.name}
                  group={g}
                  groupIndex={gi}
                  type={col.type}
                  accent={col.accent}
                  update={update}
                  allNames={flattenCategories(col.groups)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
