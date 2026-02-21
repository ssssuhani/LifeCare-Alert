import React from 'react';
import {
  Thermometer,
  Heart,
  Activity,
  Zap,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
} from 'lucide-react';
import Header from './components/Header';
import HealthCard from './components/HealthCard';
import AlertsSection from './components/AlertsSection';
import HeartRateChart from './components/HeartRateChart';
import EmergencyHelp from './components/EmergencyHelp';
import MobileQuickActions from './components/MobileQuickActions';
import { useHealthData } from './hooks/useHealthData';
import { useNotifications } from './hooks/useNotifications';
import { useGeolocation } from './hooks/useGeolocation';
import { getAlerts } from './utils/getAlerts';
import { getStatus } from './utils/getStatus';

// Firebase integration placeholder - uncomment when ready:
// import { ref, onValue } from 'firebase/database';
// import { database } from './config/firebase';

const PATIENT_ID = 'patient_001';
const CONNECTED_USER_ID = 'user_device_xyz';

const STATUS_CONFIG = {
  normal: {
    label: 'Normal',
    icon: CheckCircle,
    bg: 'bg-green-100',
    text: 'text-green-700',
    border: 'border-green-500',
  },
  warning: {
    label: 'Warning',
    icon: AlertCircle,
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    border: 'border-amber-500',
  },
  critical: {
    label: 'Critical',
    icon: XCircle,
    bg: 'bg-red-100',
    text: 'text-red-700',
    border: 'border-red-500',
  },
};

function App() {
  const { data, heartRateHistory } = useHealthData();
  const alerts = getAlerts(data.temperature, data.heartRate, data.bloodOxygen);
  const notificationProps = useNotifications(alerts);
  const geolocation = useGeolocation();
  const [notificationPanelOpen, setNotificationPanelOpen] = React.useState(false);
  const status = getStatus(data.temperature, data.heartRate, data.bloodOxygen);
  const statusConfig = STATUS_CONFIG[status];
  const StatusIcon = statusConfig.icon;

  const scrollToEmergency = () => {
    document.getElementById('emergency-help')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <Header
        patientId={PATIENT_ID}
        connectedUserId={CONNECTED_USER_ID}
        notificationProps={{
          ...notificationProps,
          isOpen: notificationPanelOpen,
          onOpenChange: setNotificationPanelOpen,
        }}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Status & Last Updated */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 ${statusConfig.border} ${statusConfig.bg} ${statusConfig.text}`}
          >
            <StatusIcon size={20} strokeWidth={2} />
            <span className="font-semibold">{statusConfig.label}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-600">
            <Clock size={18} strokeWidth={2} />
            <span className="text-sm">
              Last updated: {new Date(data.lastUpdated).toLocaleTimeString()}
            </span>
          </div>
        </div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="mb-6">
            <AlertsSection alerts={alerts} />
          </div>
        )}

        {/* Health Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <HealthCard
            icon={Thermometer}
            label="Body Temperature"
            value={data.temperature}
            unit="°C"
            accentColor="border-red-500"
            iconBgColor="bg-red-50"
            iconColor="text-red-600"
          />
          <HealthCard
            icon={Heart}
            label="Heart Rate"
            value={data.heartRate}
            unit="BPM"
            accentColor="border-pink-500"
            iconBgColor="bg-pink-50"
            iconColor="text-pink-600"
          />
          <HealthCard
            icon={Activity}
            label="Blood Oxygen (SpO2)"
            value={data.bloodOxygen}
            unit="%"
            accentColor="border-purple-500"
            iconBgColor="bg-purple-50"
            iconColor="text-purple-600"
          />
          <HealthCard
            icon={Zap}
            label="Activity Level"
            value={data.activityLevel}
            unit="G's"
            accentColor="border-green-500"
            iconBgColor="bg-green-50"
            iconColor="text-green-600"
          />
        </div>

        {/* Heart Rate Chart */}
        <div className="mb-8">
          <HeartRateChart data={heartRateHistory} />
        </div>

        {/* Emergency & Help Section */}
        <div id="emergency-help" className="mb-24 md:mb-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4">Emergency & Help</h2>
          <EmergencyHelp {...geolocation} />
        </div>
      </main>

      <MobileQuickActions
        onLocationClick={() => {
          scrollToEmergency();
          setTimeout(() => geolocation.getLocation(), 500);
        }}
        onNotificationsClick={() => setNotificationPanelOpen(true)}
        notificationCount={notificationProps.notifications?.length ?? 0}
        showNotificationPrompt={!notificationProps.browserNotificationEnabled}
        onEnableNotifications={notificationProps.requestBrowserNotificationPermission}
      />
    </div>
  );
}

export default App;
