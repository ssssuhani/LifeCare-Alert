# LifeCare+

A real-time health monitoring dashboard that displays human health data from IoT wearable sensors.

## Tech Stack

- **React 18** (Vite)
- **Tailwind CSS**
- **Lucide React** (icons)
- **Recharts** (heart rate trend)

## Features

- Real-time health metrics: Body Temperature, Heart Rate, Blood Oxygen (SpO2), Activity Level
- Health alerts for critical thresholds (heart rate > 120, SpO2 < 90%, temperature > 38°C)
- Status badge: Normal / Warning / Critical
- Heart rate trend chart
- Last updated timestamp
- Mock data simulation (ready for Firebase integration)
- Responsive layout (2 columns on desktop, 1 on mobile)
- **Mobile-friendly PWA** – Add to Home Screen for app-like experience
- **GPS location sharing** – Share your location for help via Maps, copy, or WhatsApp
- **Mobile notifications** – Enable browser notifications for health alerts on your phone
- **Quick actions FAB** – On mobile: Share Location, Notifications, Enable Alerts

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Project Structure

```
src/
├── components/
│   ├── Header.jsx         # Title, patient ID, connected user
│   ├── HealthCard.jsx     # Reusable sensor card
│   ├── AlertsSection.jsx  # Alert messages
│   └── HeartRateChart.jsx # Recharts heart rate graph
├── hooks/
│   └── useHealthData.js   # Mock simulation, Firebase-ready
├── utils/
│   ├── getAlerts.js       # Alert logic
│   └── getStatus.js       # Status badge logic
├── App.jsx
├── main.jsx
└── index.css
```

## Firebase Integration

To connect Firebase Realtime Database:

1. Create `src/config/firebase.js` with your Firebase config
2. In `useHealthData.js`, replace the `setInterval` logic with:

```js
import { ref, onValue } from 'firebase/database';
import { database } from '../config/firebase';

const healthRef = ref(database, `patients/${patientId}/sensors`);
onValue(healthRef, (snapshot) => {
  const val = snapshot.val();
  setData({
    temperature: val?.temperature ?? 0,
    heartRate: val?.heartRate ?? 0,
    bloodOxygen: val?.bloodOxygen ?? 0,
    humidity: val?.humidity ?? 0,
    activityLevel: val?.activityLevel ?? 0,
    lastUpdated: val?.timestamp ?? new Date().toISOString(),
  });
});
```
