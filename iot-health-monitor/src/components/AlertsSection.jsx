import React from 'react';
import { AlertTriangle } from 'lucide-react';

function AlertsSection({ alerts }) {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="bg-red-50 border-l-4 border-red-500 rounded-r-xl shadow-md p-4 flex items-start gap-3">
      <div className="flex-shrink-0 p-1.5 rounded-lg bg-red-100">
        <AlertTriangle className="text-red-600" size={22} strokeWidth={2} />
      </div>
      <div className="flex-1">
        <h3 className="font-semibold text-red-800 mb-1">Health Alerts</h3>
        <ul className="space-y-1">
          {alerts.map((alert, index) => (
            <li key={index} className="text-sm text-red-700 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              {alert}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default AlertsSection;
