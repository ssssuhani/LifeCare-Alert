import React from 'react';
import { AlertTriangle } from 'lucide-react';

function AlertsSection({ alerts }) {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="rounded-[28px] border border-red-100 bg-red-50/70 p-5 shadow-[0_18px_40px_rgba(239,68,68,0.08)]">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 rounded-[18px] bg-red-100 p-2.5">
          <AlertTriangle className="text-red-600" size={22} strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold text-red-900">Health Alerts</h3>
          <ul className="mt-2 space-y-2">
            {alerts.map((alert, index) => (
              <li key={index} className="flex items-start gap-3 text-sm text-red-800 sm:text-base">
                <span className="mt-2 h-2 w-2 rounded-full bg-red-500" />
                <span>{alert}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default AlertsSection;
