import React from 'react';
import { AlertTriangle, CheckCircle2, MapPin } from 'lucide-react';

function formatDateTime(value) {
  if (!value) return '--';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '--';
  return parsed.toLocaleString();
}

function getMapsLink(event) {
  if (!event?.location) return '';
  return `https://www.google.com/maps?q=${event.location.latitude},${event.location.longitude}`;
}

function FallEventList({ events }) {
  if (!events?.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-800">Recent Events</h3>
        <p className="mt-3 text-sm text-slate-500">No fall events received yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-800">Recent Events</h3>
      <ul className="mt-4 space-y-3">
        {events.map((event) => (
          <li
            key={event.id ?? `${event.timestamp}-${event.deviceId}`}
            className="rounded-xl border border-slate-200 bg-slate-50 p-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  {event.fallDetected ? (
                    <AlertTriangle className="text-red-600" size={16} />
                  ) : (
                    <CheckCircle2 className="text-green-600" size={16} />
                  )}
                  {event.fallDetected ? 'Fall Detected' : 'Normal Reading'}
                </div>
                <p className="text-sm text-slate-600">Device: {event.deviceId}</p>
                <p className="text-sm text-slate-600">
                  Time: {formatDateTime(event.timestamp ?? event.createdAt)}
                </p>
                <p className="text-sm text-slate-600">
                  Heart Rate: {event.heartRate ?? '--'} bpm
                </p>
                <p className="text-sm text-slate-600">
                  SpO2: {event.spo2 ?? '--'}%
                </p>
              </div>
              <div className="space-y-2 text-sm">
                {event.location ? (
                  <>
                    <div className="flex items-center gap-2 text-slate-700">
                      <MapPin size={14} />
                      <span>
                        {event.location.latitude.toFixed(6)}, {event.location.longitude.toFixed(6)}
                      </span>
                    </div>
                    <a
                      href={getMapsLink(event)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex rounded-lg bg-slate-900 px-3 py-2 text-white transition-colors hover:bg-slate-700"
                    >
                      Open in Google Maps
                    </a>
                  </>
                ) : (
                  <p className="text-slate-500">Location unavailable</p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default FallEventList;
