import React, { useState, useRef, useEffect } from 'react';
import { Bell, X, Trash2, AlertTriangle, Info } from 'lucide-react';

function NotificationPanel({
  notifications,
  onClear,
  onClearAll,
  onEnableBrowserNotifications,
  browserNotificationEnabled,
  isOpen: controlledOpen,
  onOpenChange,
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setIsOpen = isControlled ? onOpenChange : setInternalOpen;
  const panelRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setIsOpen?.(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setIsOpen?.(!isOpen)}
        className="relative p-3 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 transition-colors tap-target"
        aria-label="Notifications"
      >
        <Bell size={22} strokeWidth={2} />
        {notifications.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-xs font-bold text-white bg-red-500 rounded-full px-1">
            {notifications.length > 99 ? '99+' : notifications.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-96 max-h-[70vh] sm:max-h-[420px] bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
            <h3 className="font-semibold text-slate-800">Notifications</h3>
            {notifications.length > 0 && (
              <button
                onClick={onClearAll}
                className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-red-600 transition-colors"
              >
                <Trash2 size={14} />
                Clear all
              </button>
            )}
          </div>

          {!browserNotificationEnabled && onEnableBrowserNotifications && (
            <div className="px-3 py-2 space-y-1">
              <button
                onClick={onEnableBrowserNotifications}
                className="tap-target w-full py-3 px-4 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 rounded-lg transition-colors"
              >
                Enable mobile notifications
              </button>
              <p className="text-xs text-slate-500">Get alerts on your phone when vitals need attention</p>
            </div>
          )}

          <div className="overflow-y-auto flex-1 max-h-80">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">
                No notifications yet
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {notifications.map((n) => (
                  <li
                    key={n.id}
                    className={`flex gap-3 px-4 py-3 hover:bg-slate-50 transition-colors ${
                      n.type === 'alert' ? 'bg-red-50/50' : ''
                    }`}
                  >
                    <div
                      className={`flex-shrink-0 mt-0.5 p-1.5 rounded-lg ${
                        n.type === 'alert' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {n.type === 'alert' ? (
                        <AlertTriangle size={16} strokeWidth={2} />
                      ) : (
                        <Info size={16} strokeWidth={2} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-800">{n.message}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {new Date(n.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                    <button
                      onClick={() => onClear(n.id)}
                      className="flex-shrink-0 p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600"
                      aria-label="Dismiss"
                    >
                      <X size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationPanel;
