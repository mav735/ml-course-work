import React, { useEffect, useState } from 'react';

function getInitialTheme() {
  const saved = localStorage.getItem('theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return 'dark';
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  return (
    <button
      type="button"
      onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      aria-label="Переключить тему"
      title="Переключить тему"
      className="fixed top-3 right-3 z-50 bg-slate-800 hover:bg-slate-700 border border-slate-700
                 text-slate-200 rounded-sm w-9 h-9 flex items-center justify-center transition-colors"
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}
