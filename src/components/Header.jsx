import React from 'react';
import { Activity, Moon, Sun } from 'lucide-react';
import NotificationPanel from './NotificationPanel';

function Header({
  title = 'LifeCare+',
  subtitle = 'Real-Time Health Monitoring Dashboard',
  notificationProps,
  theme = 'light',
  onToggleTheme,
}) {
  return (
    <header className="hero-glass safe-area-top border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex-shrink-0 rounded-2xl bg-slate-100 p-3 text-slate-700 shadow-sm">
              <Activity size={28} strokeWidth={2} />
            </div>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold text-slate-900 sm:text-4xl">
              {title}
            </h1>
            <p className="mt-0.5 truncate text-sm text-slate-500 sm:text-lg">
              {subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onToggleTheme}
            className="theme-toggle tap-target rounded-xl border border-slate-300 bg-white/90 px-3 py-2 text-slate-700 transition-colors hover:bg-slate-50"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {notificationProps && <NotificationPanel {...notificationProps} />}
        </div>
      </div>
    </header>
  );
}

export default Header;
