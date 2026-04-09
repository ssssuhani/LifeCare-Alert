import React from 'react';

/**
 * Reusable HealthCard component for displaying sensor data.
 * Designed for easy Firebase Realtime Database integration.
 * @param {Object} props
 * @param {React.ReactNode} props.icon - Lucide icon component
 * @param {string} props.label - Card label (e.g., "BODY TEMPERATURE")
 * @param {number|string} props.value - Current sensor value
 * @param {string} props.unit - Unit of measurement (e.g., "°C", "BPM")
 * @param {string} props.accentColor - Tailwind border color class (e.g., "border-red-500")
 * @param {string} props.iconBgColor - Tailwind background for icon (e.g., "bg-red-50")
 * @param {string} props.iconColor - Tailwind text color for icon (e.g., "text-red-600")
 */
function HealthCard({ icon: Icon, label, value, unit, accentColor, iconBgColor, iconColor }) {
  return (
    <div
      className={`
        bg-white rounded-xl shadow-md
        border-t-4 ${accentColor}
        p-6
        transition-all duration-400 ease-in-out
        hover:shadow-xl hover:-translate-y-0.5
      `}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
            {label}
          </p>
          <p className="text-3xl font-bold text-slate-800 tabular-nums">
            {value}
            <span className="text-lg font-medium text-slate-500 ml-1">{unit}</span>
          </p>
        </div>
        <div
          className={`p-3 rounded-xl ${iconBgColor} ${iconColor} transition-transform duration-400 hover:scale-110`}
        >
          {Icon && <Icon size={28} strokeWidth={2} />}
        </div>
      </div>
    </div>
  );
}

export default HealthCard;
