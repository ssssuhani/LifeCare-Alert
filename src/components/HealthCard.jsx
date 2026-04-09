import React from 'react';

function HealthCard({
  icon: Icon,
  label,
  value,
  unit,
  accentColor,
  iconBgColor,
  iconColor,
  valueClassName = '',
  wrapValue = false,
}) {
  const valueIsPlain = typeof value === 'string' || typeof value === 'number';

  return (
    <div
      className={`rounded-[30px] border border-slate-200/80 border-t-[5px] ${accentColor} bg-white p-6 shadow-[0_22px_55px_rgba(15,23,42,0.08)] transition-transform duration-300 hover:-translate-y-0.5`}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            {label}
          </p>
          <div
            className={`min-h-[5.5rem] text-[2.8rem] font-bold text-slate-900 tabular-nums ${wrapValue ? 'break-all leading-[1.02]' : 'leading-[0.95]'} ${valueClassName}`}
          >
            {value}
            {unit && valueIsPlain && (
              <span className="ml-1 text-[0.45em] font-semibold text-slate-500">
                {unit}
              </span>
            )}
          </div>
        </div>
        <div
          className={`ml-4 rounded-[20px] p-3 ${iconBgColor} ${iconColor}`}
        >
          {Icon && <Icon size={28} strokeWidth={2} />}
        </div>
      </div>
    </div>
  );
}

export default HealthCard;
