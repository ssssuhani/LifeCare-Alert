import React from 'react';
import {
  AlertTriangle,
  BellRing,
  Clock3,
  LocateFixed,
  MapPinned,
  Radio,
  ShieldAlert,
} from 'lucide-react';
import Header from './components/Header';
import HealthCard from './components/HealthCard';
import AlertsSection from './components/AlertsSection';
import FallEventList from './components/FallEventList';
import { useFallData } from './hooks/useFallData';
import { useFallAlarm } from './hooks/useFallAlarm';
import { useNotifications } from './hooks/useNotifications';

function formatDateTime(value) {
  if (!value) return '--';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '--';
  return parsed.toLocaleString();
}

function App() {
  const { latestEvent, events, loading, error } = useFallData(12);
  const alertMessages = React.useMemo(() => {
    if (!latestEvent?.fallDetected) return [];

    const locationText = latestEvent.location
      ? ` at ${latestEvent.location.latitude.toFixed(6)}, ${latestEvent.location.longitude.toFixed(6)}`
      : '';

    return [
      `Fall detected from ${latestEvent.deviceId}${locationText} on ${formatDateTime(
        latestEvent.timestamp ?? latestEvent.createdAt
      )}`,
    ];
  }, [latestEvent]);

  const notificationProps = useNotifications(alertMessages);
  const { alarmActive, audioReady, stopAlarm } = useFallAlarm(
    latestEvent?.id,
    Boolean(latestEvent?.fallDetected)
  );
  const mapsLink = latestEvent?.location
    ? `https://www.google.com/maps?q=${latestEvent.location.latitude},${latestEvent.location.longitude}`
    : '';

  return (
    <div className="min-h-screen bg-slate-100">
      <Header
        notificationProps={{
          notifications: notificationProps.notifications,
          onClear: notificationProps.clearNotification,
          onClearAll: notificationProps.clearAllNotifications,
          onEnableBrowserNotifications:
            notificationProps.requestBrowserNotificationPermission,
          browserNotificationEnabled: notificationProps.browserNotificationEnabled,
        }}
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {(loading || error) && (
          <div className="mb-6 rounded-2xl border p-4 shadow-sm">
            <div
              className={
                error
                  ? 'rounded-xl border border-red-200 bg-red-50 p-4 text-red-800'
                  : 'rounded-xl border border-slate-200 bg-white p-4 text-slate-700'
              }
            >
              <div className="font-semibold">
                {error ? 'Database connection issue' : 'Loading fall detection data...'}
              </div>
              {error && <div className="mt-1 text-sm">{String(error)}</div>}
            </div>
          </div>
        )}

        {latestEvent?.fallDetected && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-red-100 p-3 text-red-600">
                  <ShieldAlert size={26} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-red-800">Fall Alert Active</h2>
                  <p className="mt-1 text-sm text-red-700">
                    New fall detected from {latestEvent.deviceId}. Website alarm is{' '}
                    {audioReady ? 'active' : 'waiting for user interaction to enable audio'}.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                {mapsLink && (
                  <a
                    href={mapsLink}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
                  >
                    Open Google Maps
                  </a>
                )}
                {alarmActive && (
                  <button
                    onClick={stopAlarm}
                    className="rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-700"
                  >
                    Stop Alarm
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {alertMessages.length > 0 && (
          <div className="mb-6">
            <AlertsSection alerts={alertMessages} />
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-5">
          <HealthCard
            icon={AlertTriangle}
            label="Current Status"
            value={latestEvent?.fallDetected ? 'Fall' : 'Safe'}
            unit=""
            accentColor={latestEvent?.fallDetected ? 'border-red-500' : 'border-green-500'}
            iconBgColor={latestEvent?.fallDetected ? 'bg-red-50' : 'bg-green-50'}
            iconColor={latestEvent?.fallDetected ? 'text-red-600' : 'text-green-600'}
          />
          <HealthCard
            icon={Radio}
            label="Device ID"
            value={latestEvent?.deviceId ?? '--'}
            unit=""
            accentColor="border-blue-500"
            iconBgColor="bg-blue-50"
            iconColor="text-blue-600"
          />
          <HealthCard
            icon={BellRing}
            label="Heart Rate"
            value={latestEvent?.heartRate ?? '--'}
            unit="bpm"
            accentColor="border-amber-500"
            iconBgColor="bg-amber-50"
            iconColor="text-amber-600"
          />
          <HealthCard
            icon={Clock3}
            label="SpO2"
            value={latestEvent?.spo2 ?? '--'}
            unit="%"
            accentColor="border-cyan-500"
            iconBgColor="bg-cyan-50"
            iconColor="text-cyan-600"
          />
          <HealthCard
            icon={Clock3}
            label="Last Event Time"
            value={latestEvent?.timestamp ? new Date(latestEvent.timestamp).toLocaleTimeString() : '--'}
            unit=""
            accentColor="border-slate-500"
            iconBgColor="bg-slate-100"
            iconColor="text-slate-700"
          />
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
                <MapPinned size={24} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Latest Fall Location</h3>
                <p className="text-sm text-slate-500">
                  View the latest coordinates synced from the phone browser into Supabase.
                </p>
              </div>
            </div>

            <div className="mt-5">
              {latestEvent?.location ? (
                <>
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                    <LocateFixed size={14} />
                    {latestEvent.location.latitude.toFixed(6)},{' '}
                    {latestEvent.location.longitude.toFixed(6)}
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-slate-200">
                    <iframe
                      title="Latest fall location"
                      src={`https://www.google.com/maps?q=${latestEvent.location.latitude},${latestEvent.location.longitude}&z=15&output=embed`}
                      className="h-[320px] w-full"
                      loading="lazy"
                    />
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
                  No coordinates available yet. Once the phone receives a realtime fall event and
                  uploads latitude and longitude, the map will appear here.
                </div>
              )}
            </div>
          </div>

          <FallEventList events={events} />
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800">System Flow</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-4">
            {[
              '1. ESP32 connects to WiFi and reads MPU6050 acceleration.',
              '2. When threshold is crossed, ESP32 inserts a row into public.fall_events.',
              '3. Supabase broadcasts the new row over realtime to the phone browser.',
              '4. The phone uploads location into public.locations and the dashboard updates automatically.',
            ].map((item) => (
              <div key={item} className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                {item}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
