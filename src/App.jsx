import React from 'react';
import {
  Activity,
  AlertTriangle,
  Clock3,
  HeartPulse,
  MapPin,
  Navigation,
  Radio,
  ShieldAlert,
  ShieldCheck,
  Siren,
} from 'lucide-react';
import Header from './components/Header';
import HealthCard from './components/HealthCard';
import AlertsSection from './components/AlertsSection';
import { useHealthData } from './hooks/useHealthData';
import { useNotifications } from './hooks/useNotifications';
import { useFallAlarm } from './hooks/useFallAlarm';
import { useGeolocation } from './hooks/useGeolocation';
import { getSupabase } from './lib/supabaseClient';
import { getAlerts } from './utils/getAlerts';

const PATIENT_ID = 'patient_001';
const HEALTH_TABLE = import.meta.env.VITE_SUPABASE_HEALTH_TABLE || 'health_readings';
const USES_HEALTH_DATA_TABLE = HEALTH_TABLE === 'health_data';

const PHONE_SYNC_META = {
  idle: {
    label: 'Location not armed',
    tone: 'bg-slate-100 text-slate-700',
  },
  armed: {
    label: 'Phone GPS armed',
    tone: 'bg-emerald-100 text-emerald-700',
  },
  'needs-location': {
    label: 'Enable location on this phone',
    tone: 'bg-amber-100 text-amber-700',
  },
  capturing: {
    label: 'Capturing phone GPS',
    tone: 'bg-sky-100 text-sky-700',
  },
  saving: {
    label: 'Saving location to Supabase',
    tone: 'bg-blue-100 text-blue-700',
  },
  synced: {
    label: 'Phone location synced',
    tone: 'bg-emerald-100 text-emerald-700',
  },
  error: {
    label: 'Sync failed',
    tone: 'bg-red-100 text-red-700',
  },
};

function getInitialMode() {
  if (typeof window === 'undefined') return 'dashboard';
  const params = new URLSearchParams(window.location.search);
  return params.get('mode') === 'phone' ? 'phone' : 'dashboard';
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function displayMetric(value) {
  return isFiniteNumber(value) ? value : '--';
}

function formatDateTime(value) {
  if (!value) return 'Waiting for the first event';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatClockParts(value) {
  if (!value) {
    return { primary: '--:--:--', secondary: 'PENDING' };
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { primary: String(value), secondary: 'LIVE' };
  }

  const formatted = parsed.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
  const [primary, secondary = ''] = formatted.split(' ');
  return { primary, secondary };
}

function formatCoordinates(location) {
  if (!location) return 'Location not synced yet';
  return `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
}

function getGoogleMapsLink(location) {
  if (!location) return '';
  return `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
}

function getMapEmbedLink(location) {
  if (!location) return '';

  const delta = 0.01;
  const minLon = location.longitude - delta;
  const minLat = location.latitude - delta;
  const maxLon = location.longitude + delta;
  const maxLat = location.latitude + delta;

  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(
    `${minLon},${minLat},${maxLon},${maxLat}`
  )}&layer=mapnik&marker=${encodeURIComponent(
    `${location.latitude},${location.longitude}`
  )}`;
}

function normalizeDeviceId(value) {
  return String(value || '').trim().toLowerCase();
}

function buildAlertMessages({
  fallDetected,
  deviceId,
  eventMessage,
  lastEventTime,
  location,
  vitalAlerts,
}) {
  const messages = [];

  if (fallDetected) {
    const locationText = location ? ` at ${formatCoordinates(location)}` : '';
    const defaultMessage = `Fall detected from ${deviceId}${locationText} on ${formatDateTime(
      lastEventTime
    )}`;
    messages.push(eventMessage || defaultMessage);
  }

  return [...messages, ...vitalAlerts];
}

function buildRecentEvents({
  alertMessages,
  bloodOxygen,
  deviceId,
  eventMessage,
  fallDetected,
  heartRate,
  lastEventTime,
  location,
}) {
  if (alertMessages.length > 0) {
    return alertMessages.map((message, index) => ({
      id: `${lastEventTime || 'latest'}-${index}`,
      title: fallDetected && index === 0 ? 'Fall Detected' : 'Health Alert',
      message,
      time: formatDateTime(lastEventTime),
      deviceId,
      heartRate,
      bloodOxygen,
      location,
      ctaLabel: location ? 'Open in Google Maps' : null,
    }));
  }

  return [
    {
      id: 'monitoring-ok',
      title: 'Monitoring Active',
      message:
        eventMessage ||
        'No critical events are active right now. The dashboard is waiting for the next live update.',
      time: formatDateTime(lastEventTime),
      deviceId,
      heartRate,
      bloodOxygen,
      location,
      ctaLabel: location ? 'Open in Google Maps' : null,
    },
  ];
}

function ModeSwitcher({ mode, onChange }) {
  return (
    <div className="mode-switch-shell mb-6 flex flex-wrap gap-3">
      <button
        type="button"
        onClick={() => onChange('dashboard')}
        className={`mode-chip rounded-2xl px-4 py-2 text-sm font-semibold transition-colors ${
          mode === 'dashboard'
            ? 'mode-chip-active mode-chip-dashboard text-white'
            : 'bg-white/90 text-slate-700 shadow-sm hover:bg-slate-50'
        }`}
      >
        Monitoring Dashboard
      </button>
      <button
        type="button"
        onClick={() => onChange('phone')}
        className={`mode-chip rounded-2xl px-4 py-2 text-sm font-semibold transition-colors ${
          mode === 'phone'
            ? 'mode-chip-active mode-chip-phone text-white'
            : 'bg-white/90 text-slate-700 shadow-sm hover:bg-slate-50'
        }`}
      >
        Phone Companion
      </button>
    </div>
  );
}

function AlarmControl({ fallAlarm }) {
  const buttonTone = fallAlarm.isPlaying
    ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
    : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50';

  return (
    <button
      type="button"
      onClick={
        fallAlarm.needsInteraction
          ? fallAlarm.enableAlarmAudio
          : fallAlarm.isPlaying
            ? fallAlarm.silenceAlarm
            : fallAlarm.enableAlarmAudio
      }
      className={`inline-flex min-h-[48px] items-center justify-center rounded-2xl border px-5 py-3 text-sm font-semibold transition-colors ${buttonTone}`}
    >
      {fallAlarm.needsInteraction
        ? 'Enable Alarm Audio'
        : fallAlarm.isPlaying
          ? 'Stop Alarm'
          : fallAlarm.isSilenced
            ? 'Alarm Stopped'
            : 'Alarm Armed'}
    </button>
  );
}

function AlarmTestButton({ fallAlarm }) {
  return (
    <button
      type="button"
      onClick={fallAlarm.playTestAlarm}
      className="inline-flex min-h-[48px] items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50"
    >
      {fallAlarm.isTesting ? 'Testing Alarm...' : 'Test Alarm'}
    </button>
  );
}

function DashboardView({
  alertMessages,
  clockParts,
  error,
  fallAlarm,
  fallDetected,
  heartRate,
  leadMessage,
  loading,
  location,
  locationStateLabel,
  mapsLink,
  openMaps,
  recentEvents,
  statusText,
  StatusIcon,
  topBannerTone,
  bloodOxygen,
  deviceId,
}) {
  return (
    <>
      {(loading || error) && (
        <div className="mb-6">
          <div
            className={`rounded-[24px] border px-5 py-4 shadow-sm ${
              error
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-slate-200 bg-white text-slate-600'
            } front-box`}
          >
            <p className="font-semibold">
              {error ? 'Database connection issue' : 'Syncing the latest device snapshot...'}
            </p>
            {error && <p className="mt-1 text-sm">{String(error)}</p>}
          </div>
        </div>
      )}

      <section
        className={`front-box rounded-[30px] border px-5 py-5 shadow-[0_18px_45px_rgba(15,23,42,0.07)] sm:px-6 ${topBannerTone.panel}`}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className={`rounded-[22px] p-3 ${topBannerTone.icon}`}>
              <Siren size={24} strokeWidth={2} />
            </div>
            <div>
              <h2 className={`text-2xl font-bold ${topBannerTone.title}`}>
                {fallDetected
                  ? 'Fall Alert Active'
                  : alertMessages.length > 0
                    ? 'Health Attention Needed'
                    : 'Monitoring Stable'}
              </h2>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={openMaps}
              disabled={!mapsLink}
              className={`inline-flex min-h-[48px] items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${topBannerTone.button}`}
            >
              {mapsLink ? 'Open Google Maps' : 'Waiting for Phone Location'}
            </button>
            <AlarmTestButton fallAlarm={fallAlarm} />
            {fallDetected && <AlarmControl fallAlarm={fallAlarm} />}
          </div>
        </div>
      </section>

      {fallDetected && fallAlarm.needsInteraction && (
        <div className="front-box mt-4 rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 shadow-sm">
          Browser audio needs one tap to activate. Press{' '}
          <span className="font-semibold">Enable Alarm Audio</span> once, and future fall alerts
          will ring automatically while this dashboard stays open.
        </div>
      )}

      <div className="mt-6">
        <AlertsSection alerts={alertMessages} />
      </div>

      <section className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-5">
        <HealthCard
          icon={StatusIcon}
          label="Current Status"
          value={statusText}
          accentColor="border-red-500"
          iconBgColor="bg-red-50"
          iconColor="text-red-500"
        />
        <HealthCard
          icon={Radio}
          label="Device ID"
          value="LifeCare+"
          accentColor="border-blue-500"
          iconBgColor="bg-blue-50"
          iconColor="text-blue-500"
          wrapValue
          valueClassName="text-[1.95rem] leading-[1.04] tracking-tight sm:text-[2.2rem]"
        />
        <HealthCard
          icon={HeartPulse}
          label="Heart Rate"
          value={displayMetric(heartRate)}
          unit="bpm"
          accentColor="border-amber-400"
          iconBgColor="bg-amber-50"
          iconColor="text-amber-500"
        />
        <HealthCard
          icon={Activity}
          label="SpO2"
          value={displayMetric(bloodOxygen)}
          unit="%"
          accentColor="border-cyan-400"
          iconBgColor="bg-cyan-50"
          iconColor="text-cyan-500"
        />
        <HealthCard
          icon={Clock3}
          label="Last Event Time"
          value={
            <span className="block leading-none">
              <span className="block">{clockParts.primary}</span>
              <span className="mt-2 block text-[0.32em] uppercase tracking-[0.32em] text-slate-500">
                {clockParts.secondary}
              </span>
            </span>
          }
          accentColor="border-slate-300"
          iconBgColor="bg-slate-100"
          iconColor="text-slate-500"
          valueClassName="text-[2.65rem] leading-[0.95]"
        />
      </section>

      <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.18fr_1fr]">
        <div className="front-box rounded-[32px] border border-slate-200/80 bg-white p-6 shadow-[0_22px_55px_rgba(15,23,42,0.08)]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="rounded-[22px] bg-blue-50 p-3 text-blue-500">
                <MapPin size={24} strokeWidth={2} />
              </div>
              <div>
                <h3 className="text-[1.65rem] font-bold text-slate-900">Latest Device Location</h3>
              </div>
            </div>

            <button
              type="button"
              onClick={openMaps}
              disabled={!mapsLink}
              className="hidden min-h-[44px] items-center gap-2 rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60 sm:inline-flex"
            >
              <Navigation size={16} />
              {mapsLink ? 'Open Maps' : 'Waiting'}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
              <MapPin size={14} />
              {formatCoordinates(location)}
            </span>
            <span className="inline-flex rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
              {locationStateLabel}
            </span>
          </div>

          <div className="mt-5 overflow-hidden rounded-[28px] border border-slate-200 bg-slate-100">
            {location ? (
              <iframe
                title="Latest fall location map"
                src={getMapEmbedLink(location)}
                className="h-[320px] w-full border-0"
                loading="lazy"
              />
            ) : (
              <div className="map-placeholder flex h-[320px] items-center justify-center px-6 text-center">
                <div className="max-w-sm">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/80 text-blue-500 shadow-lg">
                    <MapPin size={30} strokeWidth={2} />
                  </div>
                  <h4 className="mt-4 text-xl font-bold text-slate-900">
                    Waiting for phone companion
                  </h4>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="front-box rounded-[32px] border border-slate-200/80 bg-white p-6 shadow-[0_22px_55px_rgba(15,23,42,0.08)]">
          <div className="flex items-start gap-4">
            <div className="rounded-[22px] bg-slate-100 p-3 text-slate-700">
              <AlertTriangle size={24} strokeWidth={2} />
            </div>
            <div>
              <h3 className="text-[1.65rem] font-bold text-slate-900">Recent Events</h3>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {recentEvents.map((event) => (
              <article
                key={event.id}
                className="front-box rounded-[26px] border border-slate-200 bg-slate-50/80 p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-red-50 p-2.5 text-red-500">
                      <AlertTriangle size={18} strokeWidth={2} />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-slate-900">{event.title}</h4>
                      <p className="mt-1 text-sm text-slate-600">{event.message}</p>
                    </div>
                  </div>
                  {event.location && (
                    <span className="hidden items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-medium text-slate-500 sm:inline-flex">
                      <MapPin size={14} />
                      {formatCoordinates(event.location)}
                    </span>
                  )}
                </div>

                <div className="mt-4 space-y-2 text-sm text-slate-600">
                  <p>
                    <span className="font-semibold text-slate-800">Device:</span> {event.deviceId}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-800">Time:</span> {event.time}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-800">Heart Rate:</span>{' '}
                    {displayMetric(event.heartRate)} bpm
                  </p>
                  <p>
                    <span className="font-semibold text-slate-800">SpO2:</span>{' '}
                    {displayMetric(event.bloodOxygen)}%
                  </p>
                </div>

                {event.ctaLabel && event.location && (
                  <button
                    type="button"
                    onClick={() =>
                      window.open(
                        getGoogleMapsLink(event.location),
                        '_blank',
                        'noopener,noreferrer'
                      )
                    }
                    className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
                  >
                    {event.ctaLabel}
                  </button>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function PhoneCompanionView({
  activeDeviceId,
  fallAlarm,
  fallDetected,
  geolocation,
  handleDeviceIdChange,
  handleDisableTracking,
  handleUseLatestDeviceId,
  handleEnableTracking,
  handleManualSync,
  lastEventTime,
  linkedDeviceId,
  isSecureOrigin,
  phoneSyncError,
  phoneSyncStatus,
  rowMatchesLinkedDevice,
  rowLocation,
}) {
  const liveLocation = geolocation.location;
  const previewLocation = rowLocation ?? liveLocation ?? null;
  const syncMeta = PHONE_SYNC_META[phoneSyncStatus] ?? PHONE_SYNC_META.idle;
  const mapsLink = getGoogleMapsLink(previewLocation);
  const gpsReady = Boolean(liveLocation);
  const rowReady = Boolean(rowLocation);

  return (
    <>
      <section className="front-box rounded-[30px] border border-slate-200 bg-white px-5 py-6 shadow-[0_18px_45px_rgba(15,23,42,0.07)] sm:px-6">
        <h2 className="text-2xl font-bold text-slate-900">Phone Companion Mode</h2>
        {!isSecureOrigin && (
          <div className="front-box mt-4 rounded-[24px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            This URL is running on insecure `http://`. Open the page on `https://` to enable phone
            location.
          </div>
        )}
      </section>

      <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <div className="front-box rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_22px_55px_rgba(15,23,42,0.08)]">
            <div className="flex items-start gap-4">
              <div className="rounded-[22px] bg-blue-50 p-3 text-blue-500">
                <Radio size={24} strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-[1.4rem] font-bold text-slate-900">Link This Phone</h3>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <label className="block text-sm font-semibold text-slate-700">
                Hardware Device ID
              </label>
              <input
                type="text"
                value={linkedDeviceId}
                onChange={(event) => handleDeviceIdChange(event.target.value)}
                placeholder={activeDeviceId}
                className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:bg-white"
              />
              <p className="text-sm text-slate-500">
                Latest live device in dashboard feed: <span className="font-semibold">{activeDeviceId}</span>
              </p>
              <button
                type="button"
                onClick={handleUseLatestDeviceId}
                className="inline-flex min-h-[42px] items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50"
              >
                Use Latest Device ID
              </button>
            </div>
          </div>

          <div className="front-box rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_22px_55px_rgba(15,23,42,0.08)]">
            <div className="flex items-start gap-4">
              <div className="rounded-[22px] bg-emerald-50 p-3 text-emerald-500">
                <Navigation size={24} strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-[1.4rem] font-bold text-slate-900">Arm Phone Location</h3>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <span className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] ${syncMeta.tone}`}>
                {syncMeta.label}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">
                {geolocation.watching ? 'Tracking On' : 'Tracking Off'}
              </span>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleEnableTracking}
                disabled={!isSecureOrigin || geolocation.loading || geolocation.watching}
                className="inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {!isSecureOrigin
                  ? 'Use HTTPS URL First'
                  : geolocation.loading
                    ? 'Requesting Permission...'
                    : 'Enable Live Location'}
              </button>
              <button
                type="button"
                onClick={handleDisableTracking}
                disabled={!geolocation.watching}
                className="inline-flex min-h-[48px] items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Stop Tracking
              </button>
              <AlarmTestButton fallAlarm={fallAlarm} />
              <AlarmControl fallAlarm={fallAlarm} />
            </div>

            {phoneSyncError && <p className="mt-4 text-sm text-red-600">{phoneSyncError}</p>}
          </div>
        </div>

        <div className="space-y-6">
          <div className="front-box rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_22px_55px_rgba(15,23,42,0.08)]">
            <div className="flex items-start gap-4">
              <div className="rounded-[22px] bg-red-50 p-3 text-red-500">
                <Siren size={24} strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-[1.4rem] font-bold text-slate-900">Fall Event Watcher</h3>
              </div>
            </div>

            <div className="mt-5 space-y-2 text-sm text-slate-600">
              <p>
                <span className="font-semibold text-slate-900">Linked device:</span> {linkedDeviceId || activeDeviceId}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Latest incoming device:</span> {activeDeviceId}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Last event time:</span> {formatDateTime(lastEventTime)}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Current fall state:</span>{' '}
                {fallDetected ? 'Fall detected' : 'No active fall'}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Device match:</span>{' '}
                {rowMatchesLinkedDevice ? 'Yes, this phone should respond' : 'No, waiting for linked device'}
              </p>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Map readiness</p>
              <p className="mt-1">HTTPS URL: {isSecureOrigin ? 'OK' : 'Required'}</p>
              <p>Device match: {rowMatchesLinkedDevice ? 'OK' : 'Mismatch'}</p>
              <p>GPS tracking: {geolocation.watching ? 'ON' : 'OFF'}</p>
              <p>Phone GPS fix: {gpsReady ? 'Captured' : 'Missing'}</p>
              <p>Saved in Supabase row: {rowReady ? 'Yes' : 'Not yet'}</p>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => handleManualSync({ force: true })}
                disabled={!rowMatchesLinkedDevice || !lastEventTime}
                className="inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-red-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Push Current Location to Dashboard
              </button>
              <button
                type="button"
                onClick={() => mapsLink && window.open(mapsLink, '_blank', 'noopener,noreferrer')}
                disabled={!mapsLink}
                className="inline-flex min-h-[48px] items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Open Current GPS
              </button>
            </div>
          </div>

          <div className="front-box rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_22px_55px_rgba(15,23,42,0.08)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-[1.4rem] font-bold text-slate-900">Live Phone GPS</h3>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">
                {rowLocation ? 'Saved in Supabase' : liveLocation ? 'Phone GPS Ready' : 'No GPS Fix'}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
                <MapPin size={14} />
                {formatCoordinates(previewLocation)}
              </span>
              {liveLocation?.capturedAt && (
                <span className="inline-flex rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                  GPS fix at {new Date(liveLocation.capturedAt).toLocaleTimeString()}
                </span>
              )}
            </div>

            <div className="mt-5 overflow-hidden rounded-[28px] border border-slate-200 bg-slate-100">
              {previewLocation ? (
                <iframe
                  title="Phone GPS preview"
                  src={getMapEmbedLink(previewLocation)}
                  className="h-[320px] w-full border-0"
                  loading="lazy"
                />
              ) : (
                <div className="map-placeholder flex h-[320px] items-center justify-center px-6 text-center">
                  <div className="max-w-sm">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/80 text-blue-500 shadow-lg">
                      <MapPin size={30} strokeWidth={2} />
                    </div>
                  <h4 className="mt-4 text-xl font-bold text-slate-900">Enable location on phone</h4>
                </div>
              </div>
            )}
            </div>

            {geolocation.error && <p className="mt-4 text-sm text-red-600">{geolocation.error}</p>}
          </div>
        </div>
      </section>
    </>
  );
}

function App() {
  const [mode, setMode] = React.useState(getInitialMode);
  const [theme, setTheme] = React.useState('dark');
  const { data, loading, error } = useHealthData(PATIENT_ID);
  const geolocation = useGeolocation();
  const isSecureOrigin = typeof window === 'undefined' ? true : window.isSecureContext;
  const [notificationPanelOpen, setNotificationPanelOpen] = React.useState(false);
  const [linkedDeviceId, setLinkedDeviceId] = React.useState(() => {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem('lifecare-phone-device-id') || '';
  });
  const [phoneSyncStatus, setPhoneSyncStatus] = React.useState('idle');
  const [phoneSyncError, setPhoneSyncError] = React.useState('');
  const requestedPhoneSyncRef = React.useRef('');

  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    let frame = null;
    const onPointerMove = (event) => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        document.documentElement.style.setProperty('--mx', `${event.clientX}px`);
        document.documentElement.style.setProperty('--my', `${event.clientY}px`);
        frame = null;
      });
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const syncModeFromUrl = () => setMode(getInitialMode());
    window.addEventListener('popstate', syncModeFromUrl);
    return () => window.removeEventListener('popstate', syncModeFromUrl);
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('lifecare-phone-device-id', linkedDeviceId);
  }, [linkedDeviceId]);

  React.useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    document.documentElement.setAttribute('data-theme', theme);
    window.localStorage.setItem('lifecare-theme', theme);
  }, [theme]);

  React.useEffect(() => {
    if (!linkedDeviceId && data?.deviceId) {
      setLinkedDeviceId(data.deviceId);
    }
  }, [data?.deviceId, linkedDeviceId]);

  const changeMode = React.useCallback((nextMode) => {
    setMode(nextMode);

    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    if (nextMode === 'phone') {
      url.searchParams.set('mode', 'phone');
    } else {
      url.searchParams.delete('mode');
    }

    window.history.replaceState({}, '', url);
  }, []);

  const temperature = data?.temperature ?? null;
  const heartRate = data?.heartRate ?? null;
  const bloodOxygen = data?.bloodOxygen ?? null;
  const deviceId = data?.deviceId ?? PATIENT_ID;
  const lastEventTime = data?.lastEventTime ?? data?.lastUpdated ?? null;
  const fallDetected =
    Boolean(data?.fallDetected) ||
    String(data?.eventType || '')
      .toLowerCase()
      .includes('fall');
  const normalizedLinkedDeviceId = normalizeDeviceId(linkedDeviceId);
  const normalizedDeviceId = normalizeDeviceId(deviceId);
  const rowMatchesLinkedDeviceNormalized =
    !normalizedLinkedDeviceId || normalizedLinkedDeviceId === normalizedDeviceId;
  const storedLocation = data?.coordinates ?? null;
  const vitalAlerts = getAlerts(temperature, heartRate, bloodOxygen);
  const alertMessages = buildAlertMessages({
    fallDetected,
    deviceId,
    eventMessage: data?.eventMessage,
    lastEventTime,
    location: storedLocation,
    vitalAlerts,
  });
  const notificationProps = useNotifications(alertMessages);
  const recentEvents = buildRecentEvents({
    alertMessages,
    bloodOxygen,
    deviceId,
    eventMessage: data?.eventMessage,
    fallDetected,
    heartRate,
    lastEventTime,
    location: storedLocation,
  });
  const activeFallEventKey = fallDetected
    ? `${data?.id ?? deviceId}:${lastEventTime ?? 'latest'}`
    : `idle:${lastEventTime ?? 'none'}`;
  const fallAlarm = useFallAlarm({
    active: fallDetected,
    alarmKey: activeFallEventKey,
  });

  const topBannerTone = fallDetected
    ? {
        panel: 'border-red-200 bg-red-50/90',
        icon: 'bg-red-100 text-red-600',
        title: 'text-red-900',
        body: 'text-red-700',
        button:
          'bg-slate-900 text-white hover:bg-slate-800 focus-visible:outline-slate-900',
      }
    : alertMessages.length > 0
      ? {
          panel: 'border-amber-200 bg-amber-50/90',
          icon: 'bg-amber-100 text-amber-600',
          title: 'text-amber-900',
          body: 'text-amber-700',
          button:
            'bg-amber-500 text-white hover:bg-amber-600 focus-visible:outline-amber-500',
        }
      : {
          panel: 'border-emerald-200 bg-emerald-50/90',
          icon: 'bg-emerald-100 text-emerald-600',
          title: 'text-emerald-900',
          body: 'text-emerald-700',
          button:
            'bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:outline-emerald-600',
        };
  const statusText = fallDetected
    ? 'Fall'
    : alertMessages.length > 0
      ? 'Alert'
      : loading
        ? 'Syncing'
        : 'Normal';
  const StatusIcon = fallDetected
    ? ShieldAlert
    : alertMessages.length > 0
      ? AlertTriangle
      : ShieldCheck;
  const clockParts = formatClockParts(lastEventTime);
  const leadMessage = fallDetected
    ? data?.eventMessage || 'New fall detected from ESP32 fall detector. Website alarm is active.'
    : alertMessages.length > 0
      ? alertMessages[0]
      : 'Live monitoring is active. The dashboard will surface the next event automatically.';
  const dashboardLocationStateLabel = storedLocation
    ? `Synced from ${data?.locationSource || 'phone'}`
    : fallDetected
      ? 'Waiting for phone companion to push location'
      : 'Waiting for phone companion to sync location';

  const syncPhoneLocationToEvent = React.useCallback(
    async ({ force = false } = {}) => {
      if (mode !== 'phone' || !rowMatchesLinkedDeviceNormalized || !data?.id) return false;

      const eventKey = `${data.id}:${fallDetected ? 'fall' : 'live'}`;
      if (!force && requestedPhoneSyncRef.current === eventKey) return false;

      requestedPhoneSyncRef.current = eventKey;
      setPhoneSyncError('');
      setPhoneSyncStatus('capturing');

      try {
        const coords = geolocation.location ?? (await geolocation.getLocation());
        setPhoneSyncStatus('saving');

        const supabase = getSupabase();
        if (!supabase) {
          throw new Error('Supabase client is not ready for saving phone location.');
        }

        const phoneLocationUpdate = {
          latitude: coords.latitude,
          longitude: coords.longitude,
        };

        if (USES_HEALTH_DATA_TABLE) {
          phoneLocationUpdate.gps_accuracy =
            typeof coords.accuracy === 'number' ? Math.round(coords.accuracy) : 0;
          phoneLocationUpdate.location_timestamp = coords.capturedAtMs ?? Date.now();
        } else {
          phoneLocationUpdate.location_source = 'phone';
          phoneLocationUpdate.location_synced_at = new Date().toISOString();
        }

        const { error: updateError } = await supabase
          .from(HEALTH_TABLE)
          .update(phoneLocationUpdate)
          .eq('id', data.id);

        if (updateError) {
          throw updateError;
        }

        setPhoneSyncStatus('synced');
        return true;
      } catch (syncError) {
        requestedPhoneSyncRef.current = '';
        setPhoneSyncStatus('error');
        setPhoneSyncError(
          syncError?.message || 'Could not capture and store the phone location.'
        );
        return false;
      }
    },
    [data?.id, fallDetected, geolocation, lastEventTime, mode, rowMatchesLinkedDeviceNormalized]
  );

  React.useEffect(() => {
    if (mode !== 'phone') return;

    if (!geolocation.watching) {
      setPhoneSyncStatus(fallDetected ? 'needs-location' : 'idle');
      return;
    }

    if (!rowMatchesLinkedDeviceNormalized) {
      setPhoneSyncStatus('armed');
      return;
    }

    if (storedLocation) {
      setPhoneSyncStatus('synced');
      setPhoneSyncError('');
      return;
    }

    setPhoneSyncStatus('armed');
    setPhoneSyncError('');
    syncPhoneLocationToEvent();
  }, [
    fallDetected,
    geolocation.watching,
    mode,
    rowMatchesLinkedDeviceNormalized,
    storedLocation,
    syncPhoneLocationToEvent,
  ]);

  const handleEnableTracking = React.useCallback(async () => {
    try {
      setPhoneSyncError('');
      await geolocation.startWatching();
      setPhoneSyncStatus('armed');
      await fallAlarm.enableAlarmAudio();
    } catch (trackingError) {
      setPhoneSyncStatus('error');
      setPhoneSyncError(
        trackingError?.message || 'Location permission was not granted on this phone.'
      );
    }
  }, [fallAlarm, geolocation]);

  const handleDisableTracking = React.useCallback(() => {
    geolocation.stopWatching();
    setPhoneSyncStatus('idle');
    setPhoneSyncError('');
  }, [geolocation]);

  const openDashboardMaps = React.useCallback(() => {
    const mapsLink = getGoogleMapsLink(storedLocation);
    if (mapsLink) {
      window.open(mapsLink, '_blank', 'noopener,noreferrer');
    }
  }, [storedLocation]);

  return (
    <div className="app-shell min-h-screen bg-[var(--page-bg)]">
      <Header
        title={mode === 'phone' ? 'LifeCare+ Phone Companion' : 'LifeCare+'}
        subtitle={
          mode === 'phone'
            ? 'Arm phone GPS for fall-event location sync'
            : 'Real-Time Health Monitoring Dashboard'
        }
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
        notificationProps={{
          ...notificationProps,
          isOpen: notificationPanelOpen,
          onOpenChange: setNotificationPanelOpen,
        }}
      />

      <main className="mx-auto max-w-[1400px] px-4 pb-10 pt-6 sm:px-6 lg:px-8">
        <div className="mode-switch-enter">
          <ModeSwitcher mode={mode} onChange={changeMode} />
        </div>

        <div className="view-enter" key={mode}>
          {mode === 'phone' ? (
            <PhoneCompanionView
              activeDeviceId={deviceId}
              fallAlarm={fallAlarm}
              fallDetected={fallDetected}
              geolocation={geolocation}
              handleDeviceIdChange={setLinkedDeviceId}
              handleUseLatestDeviceId={() => setLinkedDeviceId(deviceId)}
              handleDisableTracking={handleDisableTracking}
              handleEnableTracking={handleEnableTracking}
              handleManualSync={syncPhoneLocationToEvent}
              isSecureOrigin={isSecureOrigin}
              lastEventTime={lastEventTime}
              linkedDeviceId={linkedDeviceId}
              phoneSyncError={phoneSyncError}
              phoneSyncStatus={phoneSyncStatus}
              rowMatchesLinkedDevice={rowMatchesLinkedDeviceNormalized}
              rowLocation={storedLocation}
            />
          ) : (
            <DashboardView
              alertMessages={alertMessages}
              bloodOxygen={bloodOxygen}
              clockParts={clockParts}
              deviceId={deviceId}
              error={error}
              fallAlarm={fallAlarm}
              fallDetected={fallDetected}
              heartRate={heartRate}
              leadMessage={leadMessage}
              loading={loading}
              location={storedLocation}
              locationStateLabel={dashboardLocationStateLabel}
              mapsLink={getGoogleMapsLink(storedLocation)}
              openMaps={openDashboardMaps}
              recentEvents={recentEvents}
              statusText={statusText}
              StatusIcon={StatusIcon}
              topBannerTone={topBannerTone}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
