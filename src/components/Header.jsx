import React from 'react';
import { Activity } from 'lucide-react';
import NotificationPanel from './NotificationPanel';

function Header({
  title = 'LifeCare+',
  subtitle = 'Real-Time Health Monitoring Dashboard',
  notificationProps,
}) {
  return (
    <header className="safe-area-top border-b border-slate-200/80 bg-white/90 backdrop-blur">
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

        {notificationProps && <NotificationPanel {...notificationProps} />}
      </div>
    </header>
  );
}

export default Header;
