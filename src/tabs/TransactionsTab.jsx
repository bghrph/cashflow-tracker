import React, { useEffect, useMemo, useState } from 'react';
import { CURRENCIES, getCurrency, convert } from '../lib/currencies.js';
import { dateString } from '../lib/dates.js';
import { formatMoney } from '../lib/format.js';
import { flattenCategories } from '../lib/categories.js';
import SmartInput from '../components/SmartInput.jsx';
import {
  IconPlus,
  IconTrash,
  IconSearch,
  IconDownload,
  IconRepeat,
  IconChevron,
  IconEdit,
  IconCheck,
  IconX,
} from '../components/icons.jsx';

export default function TransactionsTab({ data, update, incomeCategories, expenseCategories }) {
  const now = new Date();
  const [form, setForm] = useState({
    date: dateString(now.getFullYear(), now.getMonth(), now.getDate()),
    type: 'Expense',
    category: '',
    currencyCode: data.primaryCurrency,
    amount: '',
    description: '',
  });
  const [sortDir, setSortDir] = useState('desc');
  const [search, setSearch] = useState('');
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showRecurring, setShowRecurring] = useState(false);
  const [recForm, setRecForm] = useState({
    type: 'Expense',
    category: '',
    currencyCode: data.primaryCurrency,
    amount: '',
    description: '',
  });

  const cats = form.type === 'Income' ? incomeCategories : expenseCategories;
  const groups = form.type === 'Income' ? data.incomeGroups : data.expenseGroups;
  const symbol = getCurrency(data.primaryCurrency).symbol;

  useEffect(() => {
    if (form.category && !cats.includes(form.category)) setForm((f) => ({ ...f, category: '' }));
  }, [form.type, form.category, cats]);

  const addTransaction = () => {
    if (
      !form.date ||
      !form.category ||
      !form.amount ||
      Number(form.amount) <= 0 ||
      data.transactions.length >= 2000
    )
      return;
    const tx = {
      id: data.nextId,
      date: form.date,
      type: form.type,
      category: form.category,
      currencyCode: form.currencyCode,
      amount: parseFloat(parseFloat(form.amount).toFixed(2)),
      description: form.description.trim(),
    };
    update((p) => ({ ...p, transactions: [...p.transactions, tx], nextId: p.nextId + 1 }));
    setForm((f) => ({ ...f, category: '', amount: '', description: '' }));
  };

  const addRecurringFromTx = (tx) => {
    const already = (data.recurringTemplates || []).some(
      (t) =>
        t.category === tx.category &&
        t.type === tx.type &&
        Math.abs(t.amount - tx.amount) < 0.01
    );
    if (already) return;
    update((p) => ({
      ...p,
      recurringTemplates: [
        ...(p.recurringTemplates || []),
        {
          id: p.nextTplId || 1,
          type: tx.type,
          category: tx.category,
          currencyCode: tx.currencyCode,
          amount: tx.amount,
          description: tx.description || '',
          active: true,
        },
      ],
      nextTplId: (p.nextTplId || 1) + 1,
    }));
  };

  const addRecFromForm = () => {
    if (!recForm.category || !recForm.amount || Number(recForm.amount) <= 0) return;
    const already = (data.recurringTemplates || []).some(
      (t) =>
        t.category === recForm.category &&
        t.type === recForm.type &&
        Math.abs(t.amount - Number(recForm.amount)) < 0.01
    );
    if (already) return;
    update((p) => ({
      ...p,
      recurringTemplates: [
        ...(p.recurringTemplates || []),
        {
          id: p.nextTplId || 1,
          type: recForm.type,
          category: recForm.category,
          currencyCode: recForm.currencyCode,
          amount: parseFloat(parseFloat(recForm.amount).toFixed(2)),
          description: recForm.description || '',
          active: true,
        },
      ],
      nextTplId: (p.nextTplId || 1) + 1,
    }));
    setRecForm((f) => ({ ...f, category: '', amount: '', description: '' }));
  };

  const removeRecurring = (id) =>
    update((p) => ({
      ...p,
      recurringTemplates: (p.recurringTemplates || []).filter((t) => t.id !== id),
    }));
  const toggleRecurring = (id) =>
    update((p) => ({
      ...p,
      recurringTemplates: (p.recurringTemplates || []).map((t) =>
        t.id === id ? { ...t, active: !t.active } : t
      ),
    }));

  const onConfirmSmart = (smartResults) => {
    update((prev) => {
      let next = { ...prev };
      let nid = next.nextId;
      const newTxs = [];
      smartResults.forEach((r) => {
        if (r.isNew) {
          const gKey = r.type === 'Income' ? 'incomeGroups' : 'expenseGroups';
          const gs = [...next[gKey]];
          const existing = flattenCategories(gs);
          if (!existing.includes(r.category)) {
            if (gs.length > 0) {
              gs[0] = { ...gs[0], categories: [...gs[0].categories, r.category] };
            } else {
              gs.push({ name: 'General', categories: [r.category] });
            }
            next = { ...next, [gKey]: gs };
          }
        }
        newTxs.push({
          id: nid++,
          date: r.date,
          type: r.type,
          category: r.category,
          currencyCode: r.currencyCode,
          amount: r.amount,
          description: r.description,
        });
      });
      return { ...next, transactions: [...next.transactions, ...newTxs], nextId: nid };
    });
  };

  const removeTx = (id) =>
    update((p) => ({ ...p, transactions: p.transactions.filter((t) => t.id !== id) }));

  const startEdit = (tx) => {
    setEditId(tx.id);
    setEditForm({ ...tx });
  };
  const saveEdit = () => {
    if (!editForm.category || !editForm.amount || Number(editForm.amount) <= 0) return;
    update((p) => ({
      ...p,
      transactions: p.transactions.map((t) =>
        t.id === editId
          ? { ...editForm, amount: parseFloat(parseFloat(editForm.amount).toFixed(2)) }
          : t
      ),
    }));
    setEditId(null);
  };
  const cancelEdit = () => setEditId(null);

  const sorted = useMemo(() => {
    let arr = [...data.transactions];
    if (search) {
      const q = search.toLowerCase();
      arr = arr.filter(
        (t) =>
          t.category.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.type.toLowerCase().includes(q)
      );
    }
    return arr.sort((a, b) =>
      sortDir === 'desc'
        ? b.date.localeCompare(a.date) || b.id - a.id
        : a.date.localeCompare(b.date) || a.id - b.id
    );
  }, [data.transactions, sortDir, search]);

  const exportCSV = () => {
    const rows = ['Date,Type,Category,Amount,Currency,Description'];
    data.transactions.forEach((t) =>
      rows.push(
        `${t.date},${t.type},${t.category},${t.amount},${
          t.currencyCode || data.primaryCurrency
        },"${(t.description || '').replace(/"/g, '""')}"`
      )
    );
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'budget_export.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app-section">
      <div className="row space" style={{ marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
        <h2>Transactions</h2>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn ghost sm" onClick={exportCSV}>
            <IconDownload /> CSV
          </button>
          <button className="btn ghost sm" onClick={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}>
            {sortDir === 'desc' ? 'Newest first' : 'Oldest first'}
          </button>
        </div>
      </div>
      <p className="section-sub">{data.transactions.length}/2000 entries · {sorted.length} shown</p>

      <SmartInput data={data} onConfirm={onConfirmSmart} />

      {/* Quick add form */}
      <div className="card" style={{ marginBottom: 16 }}>
        <span className="eyebrow">Quick Add</span>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '120px 100px 1fr 80px 110px 1fr auto',
            gap: 6,
            alignItems: 'end',
            marginTop: 10,
          }}
          className="quick-add-grid"
        >
          <div>
            <label className="field-label">Date</label>
            <input
              className="input sm"
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
          </div>
          <div>
            <label className="field-label">Type</label>
            <select
              className="select sm"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value, category: '' }))}
            >
              <option value="Income">Income</option>
              <option value="Expense">Expense</option>
            </select>
          </div>
          <div>
            <label className="field-label">Category</label>
            <select
              className="select sm"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            >
              <option value="">Select…</option>
              {groups.map((g) => (
                <optgroup key={g.name} label={g.name}>
                  {g.categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Cur</label>
            <select
              className="select sm"
              value={form.currencyCode}
              onChange={(e) => setForm((f) => ({ ...f, currencyCode: e.target.value }))}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Amount</label>
            <input
              className="input sm"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && addTransaction()}
            />
          </div>
          <div>
            <label className="field-label">Note</label>
            <input
              className="input sm"
              placeholder="Optional…"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && addTransaction()}
            />
          </div>
          <button className="btn primary sm" onClick={addTransaction} style={{ marginBottom: 0 }}>
            <IconPlus />
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <span
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--ink-3)',
            display: 'flex',
          }}
        >
          <IconSearch />
        </span>
        <input
          className="input"
          placeholder="Search transactions…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ paddingLeft: 36 }}
        />
      </div>

      {/* Recurring panel */}
      <div className="card" style={{ marginBottom: 12, padding: 0, overflow: 'hidden' }}>
        <button
          onClick={() => setShowRecurring((s) => !s)}
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
          <span style={{ color: 'var(--info)', display: 'flex' }}>
            <IconRepeat />
          </span>
          <span style={{ flex: 1, textAlign: 'left' }}>Recurring Templates</span>
          <span className="badge info">
            {(data.recurringTemplates || []).filter((t) => t.active !== false).length} active
          </span>
          <span
            style={{
              color: 'var(--ink-3)',
              transform: showRecurring ? 'rotate(180deg)' : 'rotate(0)',
              transition: 'transform 0.2s',
              display: 'flex',
            }}
          >
            <IconChevron />
          </span>
        </button>
        {showRecurring && (
          <div style={{ padding: '0 18px 16px' }}>
            <p style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 10 }}>
              These are auto-added on the 1st of each month.
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '100px 1fr 80px 110px 1fr auto',
                gap: 6,
                alignItems: 'end',
                marginBottom: 12,
              }}
            >
              <div>
                <label className="field-label">Type</label>
                <select
                  className="select sm"
                  value={recForm.type}
                  onChange={(e) => setRecForm((f) => ({ ...f, type: e.target.value, category: '' }))}
                >
                  <option value="Income">Income</option>
                  <option value="Expense">Expense</option>
                </select>
              </div>
              <div>
                <label className="field-label">Category</label>
                <select
                  className="select sm"
                  value={recForm.category}
                  onChange={(e) => setRecForm((f) => ({ ...f, category: e.target.value }))}
                >
                  <option value="">Select…</option>
                  {(recForm.type === 'Income' ? data.incomeGroups : data.expenseGroups).map((g) => (
                    <optgroup key={g.name} label={g.name}>
                      {g.categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Cur</label>
                <select
                  className="select sm"
                  value={recForm.currencyCode}
                  onChange={(e) => setRecForm((f) => ({ ...f, currencyCode: e.target.value }))}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Amount</label>
                <input
                  className="input sm"
                  type="number"
                  step="0.01"
                  min="0"
                  value={recForm.amount}
                  onChange={(e) => setRecForm((f) => ({ ...f, amount: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && addRecFromForm()}
                />
              </div>
              <div>
                <label className="field-label">Note</label>
                <input
                  className="input sm"
                  placeholder="Optional…"
                  value={recForm.description}
                  onChange={(e) => setRecForm((f) => ({ ...f, description: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && addRecFromForm()}
                />
              </div>
              <button className="btn primary sm" onClick={addRecFromForm}>
                <IconPlus />
              </button>
            </div>
            {(data.recurringTemplates || []).length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', padding: '10px 0' }}>
                No recurring items yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(data.recurringTemplates || []).map((tpl) => {
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
                      {tpl.description && (
                        <span
                          className="muted text-ellipsis"
                          style={{ fontSize: 11, maxWidth: 100 }}
                        >
                          {tpl.description}
                        </span>
                      )}
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
                        onClick={() => toggleRecurring(tpl.id)}
                        style={{ color: tpl.active !== false ? 'var(--positive)' : 'var(--ink-3)' }}
                      >
                        {tpl.active !== false ? 'Active' : 'Paused'}
                      </button>
                      <button className="btn danger xs" onClick={() => removeRecurring(tpl.id)}>
                        <IconTrash />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Transaction list */}
      {sorted.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <p className="muted">{search ? 'No matches.' : 'No transactions yet. Add your first above.'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {sorted.slice(0, 200).map((tx) => {
            const ts = getCurrency(tx.currencyCode || data.primaryCurrency).symbol;
            const cv = convert(tx.amount, tx.currencyCode || data.primaryCurrency, data.primaryCurrency);
            const diffCur = (tx.currencyCode || data.primaryCurrency) !== data.primaryCurrency;
            if (editId === tx.id) {
              return (
                <div key={tx.id} className="card slide-in" style={{ borderColor: 'var(--accent)', padding: '10px 14px' }}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '120px 100px 1fr 80px 110px 1fr auto',
                      gap: 6,
                      alignItems: 'center',
                    }}
                  >
                    <input
                      className="input sm"
                      type="date"
                      value={editForm.date}
                      onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))}
                    />
                    <select
                      className="select sm"
                      value={editForm.type}
                      onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value, category: '' }))}
                    >
                      <option value="Income">Income</option>
                      <option value="Expense">Expense</option>
                    </select>
                    <select
                      className="select sm"
                      value={editForm.category}
                      onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                    >
                      <option value="">Select…</option>
                      {(editForm.type === 'Income' ? data.incomeGroups : data.expenseGroups).map((g) => (
                        <optgroup key={g.name} label={g.name}>
                          {g.categories.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <select
                      className="select sm"
                      value={editForm.currencyCode}
                      onChange={(e) => setEditForm((f) => ({ ...f, currencyCode: e.target.value }))}
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code}
                        </option>
                      ))}
                    </select>
                    <input
                      className="input sm"
                      type="number"
                      step="0.01"
                      min="0"
                      value={editForm.amount}
                      onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))}
                    />
                    <input
                      className="input sm"
                      value={editForm.description || ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                    />
                    <div className="row" style={{ gap: 2 }}>
                      <button className="btn primary xs" onClick={saveEdit} aria-label="Save">
                        <IconCheck />
                      </button>
                      <button className="btn ghost xs" onClick={cancelEdit} aria-label="Cancel">
                        <IconX />
                      </button>
                    </div>
                  </div>
                </div>
              );
            }
            return (
              <div
                key={tx.id}
                className="card tight"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                }}
              >
                <span style={{ fontSize: 11, color: 'var(--ink-3)', minWidth: 56 }} className="tnum">
                  {tx.date.slice(5)}
                </span>
                <span className={`badge ${tx.type === 'Income' ? 'income' : 'expense'}`}>
                  {tx.type === 'Income' ? 'In' : 'Ex'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{tx.category}</div>
                  {tx.description && (
                    <div className="muted text-ellipsis" style={{ fontSize: 11, marginTop: 1 }}>
                      {tx.description}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div
                    className="tnum"
                    style={{
                      fontWeight: 600,
                      fontSize: 14,
                      color: tx.type === 'Income' ? 'var(--positive)' : 'var(--negative)',
                    }}
                  >
                    {ts}
                    {tx.amount.toFixed(2)}
                  </div>
                  {diffCur && (
                    <div className="muted tnum" style={{ fontSize: 10 }}>
                      ≈ {symbol}
                      {cv.toFixed(2)}
                    </div>
                  )}
                </div>
                <button
                  className="btn ghost icon xs"
                  onClick={() => addRecurringFromTx(tx)}
                  title="Make this recurring"
                  aria-label="Make recurring"
                >
                  <IconRepeat />
                </button>
                <button className="btn ghost icon xs" onClick={() => startEdit(tx)} aria-label="Edit">
                  <IconEdit />
                </button>
                <button className="btn danger xs" onClick={() => removeTx(tx.id)} aria-label="Delete">
                  <IconTrash />
                </button>
              </div>
            );
          })}
          {sorted.length > 200 && (
            <p className="muted" style={{ textAlign: 'center', fontSize: 12, marginTop: 12 }}>
              Showing 200 of {sorted.length}. Use search to narrow results.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
