import React from 'react';
import { useTheme } from '../lib/theme.jsx';
import { IconSun, IconMoon } from './icons.jsx';

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      className="btn ghost icon"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      data-testid="theme-toggle"
    >
      {theme === 'dark' ? <IconSun /> : <IconMoon />}
    </button>
  );
}
