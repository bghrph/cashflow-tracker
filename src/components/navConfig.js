import { IconSettings, IconList, IconChart, IconTarget } from './icons.jsx';

// Single source of truth for both Sidebar (desktop) and BottomNav (mobile).
export const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: IconChart },
  { id: 'transactions', label: 'Log', icon: IconList },
  { id: 'goals', label: 'Goals', icon: IconTarget },
  { id: 'setup', label: 'Setup', icon: IconSettings },
];
