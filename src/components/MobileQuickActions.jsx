import React, { useState } from 'react';
import { MapPin, Bell, Plus } from 'lucide-react';

/**
 * Floating action buttons for mobile - quick access to Location and Notifications.
 */
function MobileQuickActions({
  onLocationClick,
  onNotificationsClick,
  notificationCount = 0,
  showNotificationPrompt = false,
  onEnableNotifications,
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="md:hidden fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
      {expanded && (
        <div className="flex flex-col gap-2">
          {showNotificationPrompt && onEnableNotifications && (
            <button
              onClick={() => {
                onEnableNotifications();
                setExpanded(false);
              }}
              className="tap-target px-4 py-3 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white rounded-full shadow-lg flex items-center gap-2 text-sm font-semibold"
            >
              <Bell size={20} />
              Enable Notifications
            </button>
          )}
          <button
            onClick={() => {
              onLocationClick?.();
              setExpanded(false);
            }}
            className="tap-target px-4 py-3 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white rounded-full shadow-lg flex items-center gap-2 text-sm font-semibold"
          >
            <MapPin size={20} />
            Share Location
          </button>
          <button
            onClick={() => {
              onNotificationsClick?.();
              setExpanded(false);
            }}
            className="tap-target relative px-4 py-3 bg-slate-700 hover:bg-slate-800 active:bg-slate-900 text-white rounded-full shadow-lg flex items-center gap-2 text-sm font-semibold"
          >
            <Bell size={20} />
            Notifications
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[20px] h-5 flex items-center justify-center text-xs font-bold bg-red-500 rounded-full">
                {notificationCount > 99 ? '99+' : notificationCount}
              </span>
            )}
          </button>
        </div>
      )}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="tap-target w-14 h-14 bg-slate-800 hover:bg-slate-900 active:bg-slate-950 text-white rounded-full shadow-lg flex items-center justify-center"
        aria-label={expanded ? 'Close menu' : 'Quick actions'}
      >
        <Plus size={24} strokeWidth={2.5} className={expanded ? 'rotate-45' : ''} />
      </button>
    </div>
  );
}

export default MobileQuickActions;
