import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { ThemeProvider } from './lib/theme.jsx';
import { loadData, saveData, loadAuth, saveAuth, STORAGE_KEYS } from './lib/storage.js';
import { migrate, DEFAULT_STATE } from './lib/migrate.js';
import { generateNotifications } from './lib/notifications.js';
import { flattenCategories } from './lib/categories.js';
import Auth from './components/Auth.jsx';
import Shell from './components/Shell.jsx';
import SetupTab from './tabs/SetupTab.jsx';
import TransactionsTab from './tabs/TransactionsTab.jsx';
import OverviewTab from './tabs/OverviewTab.jsx';
import GoalsTab from './tabs/GoalsTab.jsx';
import { pad, monthRange, dateString } from './lib/dates.js';

export default function App() {
  const [auth, setAuth] = useState(undefined);
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([loadAuth(), loadData()]).then(([a, d]) => {
      setAuth(a || null);
      if (a) setData(d ? migrate(d) : { ...DEFAULT_STATE });
      setLoading(false);
    });
  }, []);

  const update = useCallback((fn) => {
    setData((prev) => {
      const next = typeof fn === 'function' ? fn(prev) : { ...prev, ...fn };
      saveData(next);
      return next;
    });
  }, []);

  // Auto-fill recurring transactions on month change
  useEffect(() => {
    if (!data || !data.recurringTemplates || data.recurringTemplates.length === 0) return;
    const now = new Date();
    const cmKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
    if (data.lastAutoFillMonth === cmKey) return;
    const range = monthRange(now.getFullYear(), now.getMonth());
    const existing = data.transactions.filter((t) => t.date >= range.start && t.date <= range.end);
    const toAdd = [];
    let nid = data.nextId;
    data.recurringTemplates
      .filter((t) => t.active !== false)
      .forEach((tpl) => {
        const already = existing.some(
          (t) =>
            t.category === tpl.category &&
            t.type === tpl.type &&
            Math.abs(t.amount - tpl.amount) < 0.01 &&
            t.recurring === tpl.id
        );
        if (!already) {
          toAdd.push({
            id: nid++,
            date: dateString(now.getFullYear(), now.getMonth(), 1),
            type: tpl.type,
            category: tpl.category,
            currencyCode: tpl.currencyCode,
            amount: tpl.amount,
            description: tpl.description || '',
            recurring: tpl.id,
          });
        }
      });
    if (toAdd.length > 0) {
      update((p) => ({
        ...p,
        transactions: [...p.transactions, ...toAdd],
        nextId: nid,
        lastAutoFillMonth: cmKey,
      }));
    } else {
      update((p) => ({ ...p, lastAutoFillMonth: cmKey }));
    }
  }, [data?.recurringTemplates, data?.lastAutoFillMonth, data?.nextId, update]);

  const login = (u) => {
    setAuth(u);
    saveAuth(u);
    loadData().then((d) => setData(d ? migrate(d) : { ...DEFAULT_STATE }));
  };
  const logout = () => {
    setAuth(null);
    saveAuth(null);
    setTab('overview');
  };

  const incomeCategories = useMemo(
    () => (data ? flattenCategories(data.incomeGroups) : []),
    [data?.incomeGroups]
  );
  const expenseCategories = useMemo(
    () => (data ? flattenCategories(data.expenseGroups) : []),
    [data?.expenseGroups]
  );
  const notifications = useMemo(() => (data ? generateNotifications(data) : []), [data]);

  if (loading || auth === undefined) {
    return (
      <ThemeProvider>
        <div className="boot-loading">Loading…</div>
      </ThemeProvider>
    );
  }
  if (!auth) {
    return (
      <ThemeProvider>
        <Auth onLogin={login} />
      </ThemeProvider>
    );
  }
  if (!data) {
    return (
      <ThemeProvider>
        <div className="boot-loading">Loading…</div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <Shell auth={auth} data={data} tab={tab} setTab={setTab} notifications={notifications} onLogout={logout}>
        {tab === 'setup' && <SetupTab data={data} update={update} />}
        {tab === 'transactions' && (
          <TransactionsTab data={data} update={update} incomeCategories={incomeCategories} expenseCategories={expenseCategories} />
        )}
        {tab === 'overview' && (
          <OverviewTab data={data} incomeCategories={incomeCategories} expenseCategories={expenseCategories} />
        )}
        {tab === 'goals' && <GoalsTab data={data} update={update} />}
      </Shell>
    </ThemeProvider>
  );
}
