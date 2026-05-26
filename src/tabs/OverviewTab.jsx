import React, { useMemo, useState } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { convert, getCurrency } from '../lib/currencies.js';
import { MONTH_LONG, MONTH_SHORT, DAYS_OF_WEEK, dateString, monthRange } from '../lib/dates.js';
import { formatMoney } from '../lib/format.js';
import { calcRollover } from '../lib/budget.js';
import { detectRecurring } from '../lib/recurring.js';
import AnimatedNumber from '../components/AnimatedNumber.jsx';
import ChartTooltip from '../components/ChartTooltip.jsx';

const INCOME_PALETTE = ['#0A6B4E', '#10B981', '#34D399', '#6EE7B7'];
const EXPENSE_PALETTE = ['#B91C1C', '#DC2626', '#F87171', '#FCA5A5'];
const SWEEP_PALETTE = ['#0A6B4E', '#B7791F', '#1E40AF', '#6D28D9', '#0F8463', '#D4A24A'];

export default function OverviewTab({ data, incomeCategories, expenseCategories }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const symbol = getCurrency(data.primaryCurrency).symbol;
  const pc = data.primaryCurrency;

  const calc = useMemo(() => {
    const range = monthRange(year, month);
    const mTx = data.transactions.filter((t) => t.date >= range.start && t.date <= range.end);

    const sumBy = (type, cats) =>
      cats.map((cat) => ({
        cat,
        amount: mTx
          .filter((t) => t.type === type && t.category === cat)
          .reduce((sum, t) => sum + convert(t.amount, t.currencyCode || pc, pc), 0),
      }));

    const inc = sumBy('Income', incomeCategories);
    const exp = sumBy('Expense', expenseCategories);
    const incTotal = inc.reduce((s, r) => s + r.amount, 0);
    const expTotal = exp.reduce((s, r) => s + r.amount, 0);

    // 6-month area trend
    const trend = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(year, month - i, 1);
      const r = monthRange(d.getFullYear(), d.getMonth());
      const tx = data.transactions.filter((t) => t.date >= r.start && t.date <= r.end);
      trend.push({
        month: MONTH_SHORT[d.getMonth()],
        income: tx
          .filter((t) => t.type === 'Income')
          .reduce((s, t) => s + convert(t.amount, t.currencyCode || pc, pc), 0),
        expense: tx
          .filter((t) => t.type === 'Expense')
          .reduce((s, t) => s + convert(t.amount, t.currencyCode || pc, pc), 0),
      });
    }

    // Day-of-week heatmap
    const dow = Array(7).fill(0);
    mTx.filter((t) => t.type === 'Expense').forEach((t) => {
      const d = new Date(`${t.date}T12:00:00`);
      dow[d.getDay()] += convert(t.amount, t.currencyCode || pc, pc);
    });

    return { mTx, inc, exp, incTotal, expTotal, balance: incTotal - expTotal, trend, dow };
  }, [data.transactions, year, month, pc, incomeCategories, expenseCategories]);

  const recurring = useMemo(() => detectRecurring(data.transactions, pc), [data.transactions, pc]);

  const sortedExp = [...calc.exp].filter((e) => e.amount > 0).sort((a, b) => b.amount - a.amount);
  const sortedInc = [...calc.inc].filter((e) => e.amount > 0).sort((a, b) => b.amount - a.amount);

  const trendDelta =
    calc.trend.length >= 2
      ? (() => {
          const prev = calc.trend[calc.trend.length - 2];
          const curr = calc.trend[calc.trend.length - 1];
          const prevNet = prev.income - prev.expense;
          const currNet = curr.income - curr.expense;
          return prevNet === 0 ? 0 : ((currNet - prevNet) / Math.abs(prevNet)) * 100;
        })()
      : 0;

  return (
    <div className="app-section">
      <div className="row space" style={{ marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
        <h2>Overview</h2>
        <div className="row" style={{ gap: 6 }}>
          <select
            className="select sm"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            style={{ minWidth: 130 }}
          >
            {MONTH_LONG.map((m, i) => (
              <option key={m} value={i}>
                {m}
              </option>
            ))}
          </select>
          <select
            className="select sm"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {Array.from({ length: 7 }, (_, i) => now.getFullYear() - 3 + i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="section-sub">
        {MONTH_LONG[month]} {year} · {calc.mTx.length} transactions
      </p>

      {/* Summary cards */}
      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="stat-label">Net Balance</div>
          <AnimatedNumber
            value={calc.balance}
            symbol={symbol}
            className="stat-value lg"
            style={{ color: calc.balance >= 0 ? 'var(--positive)' : 'var(--negative)' }}
          />
          {Number.isFinite(trendDelta) && trendDelta !== 0 && (
            <span className={`stat-trend ${trendDelta >= 0 ? 'up' : 'down'}`}>
              {trendDelta >= 0 ? '↑' : '↓'} {Math.abs(trendDelta).toFixed(0)}% vs last
            </span>
          )}
        </div>
        <div className="card">
          <div className="stat-label">Income</div>
          <AnimatedNumber
            value={calc.incTotal}
            symbol={symbol}
            className="stat-value md"
            style={{ color: 'var(--positive)' }}
          />
          <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>
            {sortedInc.length} categor{sortedInc.length === 1 ? 'y' : 'ies'}
          </p>
        </div>
        <div className="card">
          <div className="stat-label">Expenses</div>
          <AnimatedNumber
            value={calc.expTotal}
            symbol={symbol}
            className="stat-value md"
            style={{ color: 'var(--negative)' }}
          />
          <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>
            {sortedExp.length} categor{sortedExp.length === 1 ? 'y' : 'ies'}
          </p>
        </div>
      </div>

      {/* Monthly savings target */}
      {data.monthlySavingsTarget > 0 && (
        <div className="card positive-left" style={{ marginBottom: 16 }}>
          <div className="row space">
            <div>
              <div className="eyebrow positive">Monthly Savings Target</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>
                <span className="tnum" style={{ fontWeight: 600 }}>
                  {formatMoney(symbol, Math.max(0, calc.balance))}
                </span>{' '}
                <span className="muted"> saved of </span>
                <span className="tnum" style={{ fontWeight: 600 }}>
                  {formatMoney(symbol, data.monthlySavingsTarget)}
                </span>
              </div>
            </div>
            <div
              className="tnum"
              style={{
                fontFamily: 'Fraunces, serif',
                fontSize: 22,
                fontWeight: 600,
                color:
                  calc.balance >= data.monthlySavingsTarget
                    ? 'var(--positive)'
                    : 'var(--accent-2)',
              }}
            >
              {Math.min(100, Math.round((Math.max(0, calc.balance) / data.monthlySavingsTarget) * 100))}%
            </div>
          </div>
          <div className="bar-track" style={{ marginTop: 10, height: 6 }}>
            <div
              className="bar-fill positive"
              style={{
                width: `${Math.min(100, (Math.max(0, calc.balance) / data.monthlySavingsTarget) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Trend area chart */}
      {calc.trend.some((t) => t.income > 0 || t.expense > 0) && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="eyebrow accent" style={{ marginBottom: 8 }}>6-Month Trend</div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer>
              <AreaChart data={calc.trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--positive)" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="var(--positive)" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--negative)" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="var(--negative)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(v) => `${symbol}${Math.round(v / 1000)}k`} />
                <Tooltip content={<ChartTooltip symbol={symbol} />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area
                  type="monotone"
                  dataKey="income"
                  name="Income"
                  stroke="var(--positive)"
                  strokeWidth={2}
                  fill="url(#incomeGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="expense"
                  name="Expenses"
                  stroke="var(--negative)"
                  strokeWidth={2}
                  fill="url(#expenseGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Donut charts */}
      <div className="grid grid-2" style={{ marginBottom: 16 }}>
        {[
          { title: 'Income breakdown', data: sortedInc, colors: INCOME_PALETTE, total: calc.incTotal, eyebrow: 'positive' },
          { title: 'Expense breakdown', data: sortedExp, colors: EXPENSE_PALETTE, total: calc.expTotal, eyebrow: 'negative' },
        ].map((panel, panelIdx) => (
          <div key={panel.title} className="card">
            <div className={`eyebrow ${panel.eyebrow}`} style={{ marginBottom: 8 }}>
              {panel.title}
            </div>
            {panel.data.length === 0 ? (
              <p className="muted" style={{ fontSize: 12, padding: '24px 0', textAlign: 'center' }}>
                No data this month.
              </p>
            ) : (
              <>
                <div style={{ height: 200, position: 'relative' }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={panel.data}
                        dataKey="amount"
                        nameKey="cat"
                        cx="50%"
                        cy="50%"
                        innerRadius={56}
                        outerRadius={88}
                        paddingAngle={2}
                      >
                        {panel.data.map((entry, i) => (
                          <Cell key={i} fill={panel.colors[i % panel.colors.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip symbol={symbol} />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'grid',
                      placeItems: 'center',
                      pointerEvents: 'none',
                      textAlign: 'center',
                    }}
                  >
                    <div>
                      <div className="eyebrow">Total</div>
                      <div
                        className="tnum"
                        style={{
                          fontFamily: 'Fraunces, serif',
                          fontSize: 20,
                          fontWeight: 600,
                          marginTop: 2,
                        }}
                      >
                        {formatMoney(symbol, panel.total)}
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {panel.data.slice(0, 5).map((c, i) => (
                    <div key={c.cat} className="row" style={{ fontSize: 12 }}>
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 3,
                          background: panel.colors[i % panel.colors.length],
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ flex: 1 }}>{c.cat}</span>
                      <span className="tnum" style={{ fontWeight: 600 }}>
                        {formatMoney(symbol, c.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Budget vs actual */}
      {Object.keys(data.budgetTargets).length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="eyebrow accent" style={{ marginBottom: 10 }}>Budget vs Actual</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(data.budgetTargets)
              .filter(([, cfg]) => cfg.monthly > 0)
              .map(([cat, cfg]) => {
                const roll = calcRollover(data, cat, year, month);
                if (!roll) return null;
                const pct = (roll.spent / roll.budget) * 100;
                const status = pct >= 100 ? 'negative' : pct >= 80 ? 'warning' : 'positive';
                return (
                  <div key={cat}>
                    <div className="row space" style={{ marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{cat}</span>
                      <span style={{ fontSize: 12 }} className="tnum">
                        <span style={{ color: 'var(--ink)', fontWeight: 600 }}>
                          {formatMoney(symbol, roll.spent)}
                        </span>
                        <span className="muted"> / {formatMoney(symbol, roll.budget)}</span>
                      </span>
                    </div>
                    <div className="bar-track">
                      <div
                        className={`bar-fill ${status}`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Heatmap */}
      {calc.dow.some((v) => v > 0) && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Spending by Day of Week</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
            {DAYS_OF_WEEK.map((d, i) => {
              const max = Math.max(...calc.dow);
              const intensity = max > 0 ? calc.dow[i] / max : 0;
              return (
                <div key={d} style={{ textAlign: 'center' }}>
                  <div className="eyebrow" style={{ marginBottom: 4 }}>{d}</div>
                  <div
                    className="heatmap-cell"
                    style={{
                      background: `color-mix(in srgb, var(--accent) ${Math.round(intensity * 90 + 10)}%, transparent)`,
                      color: intensity > 0.4 ? '#fff' : 'var(--ink)',
                    }}
                  >
                    {formatMoney(symbol, calc.dow[i])}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recurring detection */}
      {recurring.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="eyebrow info" style={{ marginBottom: 10 }}>Detected Recurring (auto-found)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {recurring.slice(0, 5).map((r) => (
              <div key={r.category} className="row" style={{ fontSize: 12, gap: 8 }}>
                <span style={{ flex: 1, fontWeight: 500 }}>{r.category}</span>
                <span className="muted">
                  every ~{Math.round(r.avgInterval)} days · {r.occurrences} times
                </span>
                <span className="tnum" style={{ fontWeight: 600, minWidth: 80, textAlign: 'right' }}>
                  {formatMoney(symbol, r.avgAmount)}
                </span>
                <span className="badge info">{r.confidence.toFixed(0)}% conf</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
