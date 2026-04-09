import React from 'react';
import { Activity } from 'lucide-react';
import NotificationPanel from './NotificationPanel';

function Header({ patientId, connectedUserId, notificationProps }) {
  return (
    <header className="bg-white shadow-sm border-b border-slate-200 safe-area-top">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700 flex-shrink-0">
              <Activity size={28} strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-3xl font-bold text-slate-800 truncate">
                IoT Human Health Monitor
              </h1>
              <p className="text-slate-500 text-xs sm:text-base mt-0.5 truncate">
                Real-Time Health Monitoring Dashboard
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {notificationProps && (
              <NotificationPanel {...notificationProps} />
            )}
            <div className="flex flex-col sm:items-end gap-1">
              <p className="text-sm text-slate-600">
                <span className="font-medium text-slate-500">Patient ID:</span>{' '}
                <span className="font-mono font-semibold">{patientId}</span>
              </p>
              <p className="text-sm">
                <span className="font-medium text-slate-500">Connected:</span>{' '}
                <span className="font-semibold text-green-600">{connectedUserId}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
