import React, { useMemo, useState } from 'react';
import { convert, getCurrency } from '../lib/currencies.js';
import { calcHealth } from '../lib/health.js';
import { monthRange } from '../lib/dates.js';
import { formatMoney } from '../lib/format.js';
import HealthGauge from '../components/HealthGauge.jsx';
import { IconPlus, IconSweep, IconTrash } from '../components/icons.jsx';

export default function GoalsTab({ data, update }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', target: '', monthlyContrib: '' });
  const symbol = getCurrency(data.primaryCurrency).symbol;
  const pc = data.primaryCurrency;
  const health = useMemo(() => calcHealth(data), [data]);

  const addGoal = () => {
    if (!form.name.trim() || !form.target || Number(form.target) <= 0) return;
    update((p) => ({
      ...p,
      savingsGoals: [
        ...p.savingsGoals,
        {
          id: p.nextGoalId,
          name: form.name.trim(),
          target: parseFloat(parseFloat(form.target).toFixed(2)),
          current: 0,
          monthlyContrib: Number(form.monthlyContrib) || 0,
          createdAt: new Date().toISOString(),
        },
      ],
      nextGoalId: p.nextGoalId + 1,
    }));
    setForm({ name: '', target: '', monthlyContrib: '' });
    setShowForm(false);
  };

  const contribute = (id, amount) =>
    update((p) => ({
      ...p,
      savingsGoals: p.savingsGoals.map((g) =>
        g.id === id ? { ...g, current: Math.min(g.current + amount, g.target) } : g
      ),
    }));
  const removeGoal = (id) =>
    update((p) => ({ ...p, savingsGoals: p.savingsGoals.filter((g) => g.id !== id) }));

  const totalSaved = data.savingsGoals.reduce((sum, g) => sum + g.current, 0);
  const totalTarget = data.savingsGoals.reduce((sum, g) => sum + g.target, 0);

  // Surplus computation
  const now = new Date();
  const range = monthRange(now.getFullYear(), now.getMonth());
  const mTx = data.transactions.filter((t) => t.date >= range.start && t.date <= range.end);
  const surplusByCat = [];
  let totalSurplus = 0;
  Object.entries(data.budgetTargets).forEach(([cat, cfg]) => {
    if (cfg.monthly <= 0) return;
    const spent = mTx
      .filter((t) => t.type === 'Expense' && t.category === cat)
      .reduce((sum, t) => sum + convert(t.amount, t.currencyCode || pc, pc), 0);
    const diff = cfg.monthly - spent;
    if (diff > 0) {
      surplusByCat.push({ cat, surplus: diff, goalId: cfg.surplusGoalId || null });
      totalSurplus += diff;
    }
  });

  const sweepAll = () => {
    if (totalSurplus <= 0 || data.savingsGoals.length === 0) return;
    update((p) => {
      const goals = [...p.savingsGoals];
      surplusByCat.forEach((s) => {
        let idx = -1;
        if (s.goalId) idx = goals.findIndex((g) => g.id === s.goalId);
        if (idx < 0) idx = 0;
        if (idx >= 0) {
          goals[idx] = {
            ...goals[idx],
            current: Math.min(goals[idx].current + s.surplus, goals[idx].target),
          };
        }
      });
      return { ...p, savingsGoals: goals };
    });
  };

  return (
    <div className="app-section" style={{ maxWidth: 760 }}>
      <div className="row space" style={{ marginBottom: 8 }}>
        <h2>Goals & Health</h2>
        <button className="btn primary" onClick={() => setShowForm((s) => !s)}>
          <IconPlus /> New goal
        </button>
      </div>
      <p className="section-sub">Your financial health score and savings goals.</p>

      <div
        className="card glow"
        style={{ textAlign: 'center', marginBottom: 16 }}
      >
        <HealthGauge score={health.overall} />
        <div className="grid grid-4" style={{ marginTop: 16 }}>
          {[
            { label: 'Savings', score: health.savings.score },
            { label: 'Budget', score: health.adherence.score },
            { label: 'Consistency', score: health.consistency.score },
            { label: 'Goals', score: health.goals.score },
          ].map((m) => (
            <div key={m.label}>
              <div className="eyebrow" style={{ marginBottom: 4 }}>
                {m.label}
              </div>
              <div className="stat-value sm tnum" style={{ color: 'var(--accent)' }}>
                {m.score}
              </div>
            </div>
          ))}
        </div>
      </div>

      {data.savingsGoals.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="row space">
            <div>
              <span className="eyebrow accent">Total Saved</span>
              <div className="stat-value md tnum" style={{ marginTop: 4 }}>
                {formatMoney(symbol, totalSaved)}
                <span className="muted" style={{ fontSize: 13, marginLeft: 8 }}>
                  / {formatMoney(symbol, totalTarget)}
                </span>
              </div>
              <p style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
                {data.savingsGoals.length} goal{data.savingsGoals.length !== 1 ? 's' : ''} ·{' '}
                {totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0}% complete
              </p>
            </div>
          </div>
          <div className="bar-track" style={{ marginTop: 10, height: 6 }}>
            <div
              className="bar-fill positive"
              style={{ width: `${totalTarget > 0 ? Math.min(100, (totalSaved / totalTarget) * 100) : 0}%` }}
            />
          </div>
        </div>
      )}

      {totalSurplus > 0 && data.savingsGoals.length > 0 && (
        <div className="card info-left" style={{ marginBottom: 16 }}>
          <div className="row space" style={{ marginBottom: 6 }}>
            <div>
              <span className="eyebrow info">Budget Surplus Available</span>
              <div className="stat-value md tnum" style={{ color: 'var(--info)', marginTop: 4 }}>
                {formatMoney(symbol, totalSurplus)}
              </div>
            </div>
            <button className="btn primary" onClick={sweepAll}>
              <IconSweep /> Sweep to goals
            </button>
          </div>
          <p style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 8 }}>
            Unspent budget from {surplusByCat.length} categories.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {surplusByCat.map((s) => {
              const goalName = s.goalId
                ? data.savingsGoals.find((g) => g.id === s.goalId)?.name
                : null;
              return (
                <span
                  key={s.cat}
                  style={{
                    fontSize: 11,
                    background: 'var(--surface)',
                    padding: '4px 10px',
                    borderRadius: 6,
                    color: 'var(--ink-2)',
                  }}
                >
                  {s.cat} → <span style={{ color: 'var(--positive)' }}>{formatMoney(symbol, s.surplus)}</span>
                  {goalName && <span style={{ color: 'var(--ink-3)' }}> · {goalName}</span>}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {showForm && (
        <div className="card slide-in" style={{ marginBottom: 16 }}>
          <div className="grid grid-3" style={{ marginBottom: 8 }}>
            <div>
              <label className="field-label">Goal name</label>
              <input
                className="input"
                placeholder="Emergency Fund"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="field-label">Target ({symbol})</label>
              <input
                className="input"
                type="number"
                min="0"
                value={form.target}
                onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))}
              />
            </div>
            <div>
              <label className="field-label">Monthly ({symbol})</label>
              <input
                className="input"
                type="number"
                min="0"
                value={form.monthlyContrib}
                onChange={(e) => setForm((f) => ({ ...f, monthlyContrib: e.target.value }))}
              />
            </div>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn primary" onClick={addGoal}>
              Create
            </button>
            <button className="btn ghost" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {data.savingsGoals.length === 0 && !showForm ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <p className="muted" style={{ marginBottom: 14 }}>
            No goals yet. Set your first savings goal to start tracking progress.
          </p>
          <button className="btn primary" onClick={() => setShowForm(true)}>
            <IconPlus /> Create first goal
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {data.savingsGoals.map((g) => {
            const pct = g.target > 0 ? (g.current / g.target) * 100 : 0;
            const remaining = g.target - g.current;
            const mLeft = g.monthlyContrib > 0 ? Math.ceil(remaining / g.monthlyContrib) : 0;
            return (
              <div key={g.id} className="card slide-in">
                <div className="row space" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: 17, marginBottom: 2 }}>{g.name}</h3>
                    <p style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                      {formatMoney(symbol, g.current)} of {formatMoney(symbol, g.target)}
                    </p>
                  </div>
                  <span
                    className="tnum"
                    style={{
                      fontFamily: 'Fraunces, serif',
                      fontSize: 22,
                      fontWeight: 600,
                      color: pct >= 100 ? 'var(--positive)' : 'var(--accent-2)',
                    }}
                  >
                    {pct.toFixed(0)}%
                  </span>
                </div>
                <div className="bar-track" style={{ marginTop: 10, height: 8 }}>
                  <div
                    className="bar-fill positive"
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
                <div className="grid grid-3" style={{ marginTop: 10, fontSize: 12 }}>
                  <div>
                    <div className="eyebrow">Remaining</div>
                    <div className="tnum" style={{ marginTop: 2 }}>
                      {formatMoney(symbol, remaining)}
                    </div>
                  </div>
                  <div>
                    <div className="eyebrow">Monthly</div>
                    <div className="tnum" style={{ marginTop: 2 }}>
                      {formatMoney(symbol, g.monthlyContrib)}
                    </div>
                  </div>
                  <div>
                    <div className="eyebrow">Est. months left</div>
                    <div className="tnum" style={{ marginTop: 2 }}>
                      {mLeft || '—'}
                    </div>
                  </div>
                </div>
                <div className="row" style={{ marginTop: 12, gap: 6 }}>
                  {[25, 100, 500].map((a) => (
                    <button key={a} className="btn subtle sm" onClick={() => contribute(g.id, a)}>
                      +{symbol}
                      {a}
                    </button>
                  ))}
                  <span className="spacer" />
                  <button className="btn danger sm" onClick={() => removeGoal(g.id)}>
                    <IconTrash />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
