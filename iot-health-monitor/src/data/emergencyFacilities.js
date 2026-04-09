/**
 * Sample emergency facilities data.
 * Replace with real API (e.g., Google Places, OpenStreetMap) when integrating.
 * Structure supports: ambulances, hospitals, doctors
 */
export const EMERGENCY_AMBULANCES = [
  { id: 1, name: 'City Emergency Ambulance', phone: '+1-555-102', distance: '0.8 km', available: true },
  { id: 2, name: 'Red Cross Ambulance', phone: '+1-555-108', distance: '1.2 km', available: true },
  { id: 3, name: 'MediRescue 24/7', phone: '+1-555-911', distance: '2.1 km', available: true },
];

export const NEARBY_HOSPITALS = [
  { id: 1, name: 'Central General Hospital', phone: '+1-555-200-1000', address: '123 Medical Ave', distance: '1.5 km', emergency: true },
  { id: 2, name: 'City Care Hospital', phone: '+1-555-200-2000', address: '456 Health St', distance: '2.8 km', emergency: true },
  { id: 3, name: 'Metro Medical Center', phone: '+1-555-200-3000', address: '789 Wellness Rd', distance: '3.2 km', emergency: true },
];

export const EMERGENCY_DOCTORS = [
  { id: 1, name: 'Dr. Sarah Johnson', role: 'Emergency Physician', phone: '+1-555-301-1001', available: '24/7' },
  { id: 2, name: 'Dr. Michael Chen', role: 'Cardiologist', phone: '+1-555-301-1002', available: '24/7' },
  { id: 3, name: 'Dr. Emma Wilson', role: 'General Practitioner', phone: '+1-555-301-1003', available: '8AM–10PM' },
];
