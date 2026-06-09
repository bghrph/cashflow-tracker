import React from 'react';
import Sidebar from './Sidebar.jsx';
import BottomNav from './BottomNav.jsx';
import NotificationsPanel from './NotificationsPanel.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import SaveStatusIndicator from './SaveStatusIndicator.jsx';
import { IconHelp } from './icons.jsx';

const TAB_TITLES = {
  overview: 'Overview',
  transactions: 'Transactions',
  goals: 'Goals & Health',
  setup: 'Setup',
};

export default function Shell({ auth, data, tab, setTab, notifications, onLogout, signingOut, onOpenTutorial, children }) {
  return (
    <div className="app-shell">
      <Sidebar tab={tab} setTab={setTab} auth={auth} currency={data.primaryCurrency} onLogout={onLogout} signingOut={signingOut} />
      <div>
        <header className="app-header">
          <div className="app-header-title">{TAB_TITLES[tab]}</div>
          <div className="header-actions">
            <SaveStatusIndicator />
            <ThemeToggle />
            <button className="btn ghost icon" onClick={onOpenTutorial} aria-label="Open tutorial">
              <IconHelp />
            </button>
            <NotificationsPanel notifications={notifications} />
          </div>
        </header>
        <main className="app-main fade-up" data-testid={`tab-${tab}`}>
          {children}
        </main>
        <BottomNav tab={tab} setTab={setTab} />
      </div>
    </div>
  );
}
