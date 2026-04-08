import React, { useState } from 'react';
import {
  MapPin,
  Copy,
  MessageCircle,
  ExternalLink,
  Truck,
  Building2,
  Stethoscope,
  Phone,
  Check,
} from 'lucide-react';
import {
  EMERGENCY_AMBULANCES,
  NEARBY_HOSPITALS,
  EMERGENCY_DOCTORS,
} from '../data/emergencyFacilities';

function EmergencyHelp({
  location,
  error,
  loading,
  getLocation,
  getMapsLink,
  copyToClipboard,
  shareViaWhatsApp,
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyToClipboard();
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* GPS Location Share */}
      <div className="bg-white rounded-xl shadow-md border-t-4 border-amber-500 p-6 transition-all duration-400 hover:shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
            <MapPin size={24} strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">Share GPS Location for Help</h3>
            <p className="text-sm text-slate-500">Share your location with family, friends, or emergency services</p>
          </div>
        </div>

        {!location ? (
          <div className="space-y-3">
            <button
              onClick={getLocation}
              disabled={loading}
              className="tap-target flex items-center gap-2 px-5 py-3 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-60"
            >
              <MapPin size={18} />
              {loading ? 'Getting location...' : 'Get My Location'}
            </button>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              {location.source === 'hardware' ? 'Live wearable GPS location' : 'Phone GPS location'}
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="text-slate-600">Lat:</span>
              <span className="font-mono font-medium">{location.latitude.toFixed(6)}</span>
              <span className="text-slate-600 ml-3">Lng:</span>
              <span className="font-mono font-medium">{location.longitude.toFixed(6)}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={getMapsLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="tap-target inline-flex items-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-lg text-slate-700 font-medium transition-colors"
              >
                <ExternalLink size={16} />
                Open in Maps
              </a>
              <button
                onClick={handleCopy}
                className="tap-target inline-flex items-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-lg text-slate-700 font-medium transition-colors"
              >
                {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                {copied ? 'Copied!' : 'Copy Location'}
              </button>
              <button
                onClick={shareViaWhatsApp}
                className="tap-target inline-flex items-center gap-2 px-4 py-3 bg-green-100 hover:bg-green-200 active:bg-green-300 text-green-800 rounded-lg font-medium transition-colors"
              >
                <MessageCircle size={16} />
                Share via WhatsApp
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Ambulance Facilities */}
      <div className="bg-white rounded-xl shadow-md border-t-4 border-red-500 p-6 transition-all duration-400 hover:shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-red-50 text-red-600">
            <Truck size={24} strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">Nearby Ambulance Services</h3>
            <p className="text-sm text-slate-500">Emergency ambulances near your location</p>
          </div>
        </div>
        <ul className="space-y-3">
          {EMERGENCY_AMBULANCES.map((amb) => (
            <li
              key={amb.id}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 bg-slate-50 rounded-lg"
            >
              <div>
                <p className="font-medium text-slate-800">{amb.name}</p>
                <p className="text-xs text-slate-500">{amb.distance} away</p>
              </div>
              <a
                href={`tel:${amb.phone.replace(/-/g, '')}`}
                className="tap-target inline-flex items-center gap-2 py-2 text-red-600 hover:text-red-700 active:text-red-800 font-semibold"
              >
                <Phone size={16} />
                {amb.phone}
              </a>
            </li>
          ))}
        </ul>
      </div>

      {/* Hospitals */}
      <div className="bg-white rounded-xl shadow-md border-t-4 border-blue-500 p-6 transition-all duration-400 hover:shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
            <Building2 size={24} strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">Nearby Hospitals</h3>
            <p className="text-sm text-slate-500">Hospitals with emergency facilities</p>
          </div>
        </div>
        <ul className="space-y-3">
          {NEARBY_HOSPITALS.map((hosp) => (
            <li
              key={hosp.id}
              className="p-3 bg-slate-50 rounded-lg"
            >
              <p className="font-medium text-slate-800">{hosp.name}</p>
              <p className="text-xs text-slate-500">{hosp.address} • {hosp.distance}</p>
              <a
                href={`tel:${hosp.phone.replace(/[-()]/g, '').replace(/\s/g, '')}`}
                className="tap-target inline-flex items-center gap-2 py-2 text-blue-600 hover:text-blue-700 active:text-blue-800 font-semibold mt-2"
              >
                <Phone size={14} />
                {hosp.phone}
              </a>
            </li>
          ))}
        </ul>
      </div>

      {/* Doctor Numbers */}
      <div className="bg-white rounded-xl shadow-md border-t-4 border-emerald-500 p-6 transition-all duration-400 hover:shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
            <Stethoscope size={24} strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">Emergency Doctor Numbers</h3>
            <p className="text-sm text-slate-500">Contact doctors for urgent medical advice</p>
          </div>
        </div>
        <ul className="space-y-3">
          {EMERGENCY_DOCTORS.map((doc) => (
            <li
              key={doc.id}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 bg-slate-50 rounded-lg"
            >
              <div>
                <p className="font-medium text-slate-800">{doc.name}</p>
                <p className="text-xs text-slate-500">{doc.role} • {doc.available}</p>
              </div>
              <a
                href={`tel:${doc.phone.replace(/-/g, '')}`}
                className="tap-target inline-flex items-center gap-2 py-2 text-emerald-600 hover:text-emerald-700 active:text-emerald-800 font-semibold"
              >
                <Phone size={16} />
                {doc.phone}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default EmergencyHelp;
