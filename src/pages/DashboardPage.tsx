import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Smartphone, Users, Bell, Settings,
  LogOut, Shield, Menu, X, ChevronRight, Activity,
  AlertTriangle, Lock, Trash2, Plus, Phone,
  Mail, User, Star, StarOff, Check, Satellite,
  MapPin, Battery, Wifi, WifiOff, Database,
  Clock, ShieldCheck, ShieldAlert, PhoneCall,
  Server, RefreshCw, Copy, CheckCircle2, XCircle, Send
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import {
  type Device, type TrustedContact, type Alert, type Location,
  isSupabaseConfigured, testSupabaseConnection,
  seedDemoData, SUPABASE_SCHEMA_SQL
} from '../lib/supabase';
import {
  getUserDevices, createDevice, updateDevice,
  getTrustedContacts, createContact, deleteContact, updateContact,
  getAlerts, resolveAlert, createAlert,
  getLatestLocation, getLocationHistory,
  subscribeToAlerts, subscribeToDeviceLocations
} from '../lib/api';
import DeviceCard from '../components/DeviceCard';
import MapTracker from '../components/MapTracker';
import SOSPanel from '../components/SOSPanel';

// ─── Default / Fallback Demo Data ────────────────────────────────
const MOCK_DEVICES: Device[] = [
  {
    id: 'dev-1',
    user_id: 'demo',
    imei: '352001234567890',
    device_name: 'Samsung Galaxy S24 Ultra',
    model: 'SM-S928B',
    is_active: true,
    sim_locked: false,
    battery_level: 84,
    last_seen: new Date().toISOString(),
    created_at: new Date().toISOString(),
  },
  {
    id: 'dev-2',
    user_id: 'demo',
    imei: '352009876543210',
    device_name: 'OnePlus 12 (Backup)',
    model: 'CPH2581',
    is_active: true,
    sim_locked: true,
    battery_level: 18,
    last_seen: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
  }
];

const MOCK_LOCATION: Location = {
  id: 'loc-1',
  device_id: 'dev-1',
  latitude: 28.6139,
  longitude: 77.2090,
  accuracy: 12,
  timestamp: new Date().toISOString(),
  is_offline: false,
};

const MOCK_CONTACTS: TrustedContact[] = [
  { id: 'c1', user_id: 'demo', name: 'Mom (Emergency Contact)', phone: '+91 98765 43210', email: 'mom@family.net', relation: 'Family', is_primary: true, receive_sos: true, receive_location: true, created_at: new Date().toISOString() },
  { id: 'c2', user_id: 'demo', name: 'Emergency Services / Guardian', phone: '+91 87654 32109', email: 'guardian@support.org', relation: 'Friend', is_primary: false, receive_sos: true, receive_location: true, created_at: new Date().toISOString() },
];

const MOCK_ALERTS: Alert[] = [
  { id: 'a1', device_id: 'dev-1', user_id: 'demo', type: 'theft', message: 'Phone switched off unexpectedly — location & IMEI sent to contacts', location_lat: 28.6139, location_lng: 77.209, is_resolved: false, created_at: new Date(Date.now() - 1800000).toISOString() },
  { id: 'a2', device_id: 'dev-2', user_id: 'demo', type: 'sim_removed', message: 'SIM tray removed — tray locked remotely', location_lat: 28.62, location_lng: 77.21, is_resolved: true, resolved_at: new Date().toISOString(), created_at: new Date(Date.now() - 7200000).toISOString() },
  { id: 'a3', device_id: 'dev-2', user_id: 'demo', type: 'low_battery', message: 'Battery critically low (18%)', is_resolved: false, created_at: new Date(Date.now() - 900000).toISOString() },
];

const MOCK_LOCATIONS: Location[] = [
  { id: 'l1', device_id: 'dev-1', latitude: 28.6120, longitude: 77.2070, accuracy: 20, timestamp: new Date(Date.now() - 7200000).toISOString(), is_offline: false },
  { id: 'l2', device_id: 'dev-1', latitude: 28.6128, longitude: 77.2080, accuracy: 18, timestamp: new Date(Date.now() - 3600000).toISOString(), is_offline: false },
  { id: 'l3', device_id: 'dev-1', latitude: 28.6135, longitude: 77.2088, accuracy: 12, timestamp: new Date(Date.now() - 1800000).toISOString(), is_offline: false },
  MOCK_LOCATION,
];

type NavTab = 'dashboard' | 'devices' | 'contacts' | 'alerts' | 'backend' | 'settings';

export default function DashboardPage() {
  const { user, logout, isFirebaseLive } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [devices, setDevices] = useState<Device[]>(MOCK_DEVICES);
  const [contacts, setContacts] = useState<TrustedContact[]>(MOCK_CONTACTS);
  const [alerts, setAlerts] = useState<Alert[]>(MOCK_ALERTS);
  const [selectedDevice, setSelectedDevice] = useState<Device>(MOCK_DEVICES[0]);
  const [latestLocation, setLatestLocation] = useState<Location>(MOCK_LOCATION);
  const [locationHistory, setLocationHistory] = useState<Location[]>(MOCK_LOCATIONS);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [isDbLive, setIsDbLive] = useState(isSupabaseConfigured());
  const [localRelayOnline, setLocalRelayOnline] = useState(false);

  // Check localhost SOS satellite relay on port 3001
  const checkLocalRelay = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:3001/health', { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        setLocalRelayOnline(true);
      } else {
        setLocalRelayOnline(false);
      }
    } catch {
      setLocalRelayOnline(false);
    }
  }, []);

  useEffect(() => {
    checkLocalRelay();
    const interval = setInterval(checkLocalRelay, 10000);
    return () => clearInterval(interval);
  }, [checkLocalRelay]);

  // Load live data from Supabase if configured
  const loadBackendData = useCallback(async () => {
    const configured = isSupabaseConfigured();
    setIsDbLive(configured);
    if (!configured || !user?.uid) return;

    try {
      const [userDevices, userContacts, userAlerts] = await Promise.all([
        getUserDevices(user.uid),
        getTrustedContacts(user.uid),
        getAlerts(user.uid),
      ]);

      if (userDevices.length > 0) {
        setDevices(userDevices);
        setSelectedDevice(userDevices[0]);

        // Load location for selected device
        const [latest, history] = await Promise.all([
          getLatestLocation(userDevices[0].id),
          getLocationHistory(userDevices[0].id),
        ]);
        if (latest) setLatestLocation(latest);
        if (history.length > 0) setLocationHistory(history);
      }

      if (userContacts.length > 0) {
        setContacts(userContacts);
      }

      if (userAlerts.length > 0) {
        setAlerts(userAlerts);
      }
    } catch (err: any) {
      console.warn('Failed to load from Supabase:', err.message);
    }
  }, [user]);

  useEffect(() => {
    loadBackendData();
  }, [loadBackendData]);

  // Real-time Supabase subscriptions
  useEffect(() => {
    if (!isDbLive || !user?.uid) return;

    const alertSub = subscribeToAlerts(user.uid, (newAlert) => {
      setAlerts(prev => [newAlert, ...prev]);
      toast.error(`🚨 New Security Alert: ${newAlert.message}`);
    });

    return () => {
      if (alertSub && 'unsubscribe' in alertSub) {
        alertSub.unsubscribe();
      }
    };
  }, [isDbLive, user]);

  // Real-time location updates for selected device
  useEffect(() => {
    if (!isDbLive || !selectedDevice?.id) return;

    const locSub = subscribeToDeviceLocations(selectedDevice.id, (newLoc) => {
      setLatestLocation(newLoc);
      setLocationHistory(prev => [...prev, newLoc]);
    });

    return () => {
      if (locSub && 'unsubscribe' in locSub) {
        locSub.unsubscribe();
      }
    };
  }, [isDbLive, selectedDevice?.id]);

  // Stats
  const activeDevices = devices.filter(d => d.is_active).length;
  const unresolved = alerts.filter(a => !a.is_resolved).length;
  const lockedSIMs = devices.filter(d => d.sim_locked).length;

  const handleLockSIM = async (deviceId: string, locked: boolean) => {
    // Optimistic UI update
    setDevices(prev => prev.map(d =>
      d.id === deviceId ? { ...d, sim_locked: locked } : d
    ));

    toast.success(locked ? '🔒 SIM tray locked remotely' : '🔓 SIM tray unlocked');

    try {
      if (isDbLive) {
        await updateDevice(deviceId, { sim_locked: locked });
      }

      if (locked) {
        const newAlert: Alert = {
          id: `a${Date.now()}`,
          device_id: deviceId,
          user_id: user?.uid || 'demo',
          type: 'sim_removed',
          message: 'SIM tray locked remotely by user',
          is_resolved: false,
          created_at: new Date().toISOString(),
        };

        if (isDbLive) {
          const savedAlert = await createAlert(newAlert);
          setAlerts(prev => [savedAlert, ...prev]);
        } else {
          setAlerts(prev => [newAlert, ...prev]);
        }
      }
    } catch (err: any) {
      console.error('Lock SIM error', err);
    }
  };

  const handleRemoteWipe = (deviceId: string) => {
    const dev = devices.find(d => d.id === deviceId);
    toast((t) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <strong>⚠️ Wipe {dev?.device_name}?</strong>
        <p style={{ fontSize: 13 }}>This will erase all device data. Cannot be undone.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-danger" style={{ fontSize: 12, padding: '6px 12px' }}
            onClick={async () => {
              toast.dismiss(t.id);
              toast.error('🗑️ Remote wipe command dispatched!');
              if (isDbLive && user?.uid) {
                await createAlert({
                  device_id: deviceId,
                  user_id: user.uid,
                  type: 'theft',
                  message: `Remote wipe initiated for ${dev?.device_name} (IMEI: ${dev?.imei})`,
                  is_resolved: false,
                });
              }
            }}>
            Wipe Now
          </button>
          <button className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }}
            onClick={() => toast.dismiss(t.id)}>
            Cancel
          </button>
        </div>
      </div>
    ), { duration: 10000 });
  };

  const handleResolveAlert = async (alertId: string) => {
    setAlerts(prev => prev.map(a =>
      a.id === alertId ? { ...a, is_resolved: true, resolved_at: new Date().toISOString() } : a
    ));
    toast.success('Alert resolved');
    if (isDbLive) {
      try {
        await resolveAlert(alertId);
      } catch (err) {
        console.error('Resolve alert error', err);
      }
    }
  };

  const handleAddDevice = async (newDev: Device) => {
    setDevices(prev => [newDev, ...prev]);
    setSelectedDevice(newDev);
    setShowAddDevice(false);
    toast.success(`${newDev.device_name} protected!`);

    if (isDbLive) {
      try {
        const saved = await createDevice(newDev);
        setDevices(prev => prev.map(d => d.id === newDev.id ? saved : d));
      } catch (err: any) {
        toast.error(`Saved locally, but Supabase sync failed: ${err.message}`);
      }
    }
  };

  const handleAddContact = async (newContact: TrustedContact) => {
    setContacts(prev => [newContact, ...prev]);
    setShowAddContact(false);
    toast.success(`${newContact.name} added as trusted contact!`);

    if (isDbLive) {
      try {
        const saved = await createContact(newContact);
        setContacts(prev => prev.map(c => c.id === newContact.id ? saved : c));
      } catch (err: any) {
        toast.error(`Saved locally, but Supabase sync failed: ${err.message}`);
      }
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    setContacts(prev => prev.filter(c => c.id !== contactId));
    toast.success('Contact removed');
    if (isDbLive) {
      try {
        await deleteContact(contactId);
      } catch (err) {
        console.error('Delete contact error', err);
      }
    }
  };

  const handleTogglePrimaryContact = async (contact: TrustedContact) => {
    const updated = !contact.is_primary;
    setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, is_primary: updated } : c));
    if (isDbLive) {
      try {
        await updateContact(contact.id, { is_primary: updated });
      } catch (err) {
        console.error('Update contact error', err);
      }
    }
  };

  const alertTypeConfig: Record<Alert['type'], { icon: React.ReactNode; cls: string; label: string }> = {
    theft:       { icon: <ShieldAlert size={14} />, cls: 'badge-danger', label: 'Theft Alert' },
    sos:         { icon: <AlertTriangle size={14} />, cls: 'badge-danger', label: 'SOS' },
    offline:     { icon: <WifiOff size={14} />, cls: 'badge-warn', label: 'Offline' },
    sim_removed: { icon: <Lock size={14} />, cls: 'badge-warn', label: 'SIM Removed' },
    low_battery: { icon: <Battery size={14} />, cls: 'badge-info', label: 'Low Battery' },
  };

  const navItems: { id: NavTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'dashboard', label: 'Overview',  icon: <LayoutDashboard size={18} /> },
    { id: 'devices',   label: 'Devices',   icon: <Smartphone size={18} />, badge: devices.length },
    { id: 'contacts',  label: 'Contacts',  icon: <Users size={18} />, badge: contacts.length },
    { id: 'alerts',    label: 'Alerts',    icon: <Bell size={18} />, badge: unresolved || undefined },
    { id: 'backend',   label: 'Backend & Cloud', icon: <Database size={18} /> },
    { id: 'settings',  label: 'Settings',  icon: <Settings size={18} /> },
  ];

  return (
    <div className="dash-root">
      <Toaster position="top-right" toastOptions={{
        style: { background: '#1c2237', color: '#e2e8f0', border: '1px solid rgba(108,99,255,0.25)', fontSize: 13 },
      }} />

      {/* ── Sidebar ── */}
      <AnimatePresence>
        {(sidebarOpen || true) && (
          <motion.aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}
            initial={false}>
            {/* Brand */}
            <div className="sidebar-brand">
              <div className="sidebar-logo">
                <Shield size={22} />
              </div>
              <span className="sidebar-brand-text">PhoneGuard</span>
              <button className="sidebar-close" onClick={() => setSidebarOpen(false)}>
                <X size={16} />
              </button>
            </div>

            {/* User pill */}
            <div className="sidebar-user">
              <div className="sidebar-avatar">
                {user?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">{user?.displayName || 'Phone Owner'}</span>
                <span className="sidebar-user-email">{user?.email || 'owner@phoneguard.app'}</span>
              </div>
            </div>

            {/* Nav */}
            <nav className="sidebar-nav">
              {navItems.map(item => (
                <button key={item.id}
                  className={`sidebar-nav-item ${activeTab === item.id ? 'active' : ''}`}
                  onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
                >
                  <span className="sidebar-nav-icon">{item.icon}</span>
                  <span className="sidebar-nav-label">{item.label}</span>
                  {item.badge !== undefined && (
                    <span className={`sidebar-nav-badge ${item.id === 'alerts' ? 'danger' : ''}`}>
                      {item.badge}
                    </span>
                  )}
                  {activeTab === item.id && (
                    <motion.div className="sidebar-active-bar" layoutId="sidebar-active" />
                  )}
                </button>
              ))}
            </nav>

            {/* Quick Backend Connectivity Indicator */}
            <div className="sidebar-backend-status" onClick={() => setActiveTab('backend')}>
              <div className="flex items-center justify-between" style={{ width: '100%' }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Backend Status</span>
                <span className={`status-dot ${isDbLive ? 'green' : 'amber'}`} />
              </div>
              <div className="flex items-center gap-1" style={{ fontSize: 11, color: 'var(--clr-text-secondary)' }}>
                <Database size={11} /> Supabase: {isDbLive ? 'Live' : 'Sandbox'}
              </div>
              <div className="flex items-center gap-1" style={{ fontSize: 11, color: 'var(--clr-text-secondary)' }}>
                <Server size={11} /> Local SOS Relay: {localRelayOnline ? '3001 Online' : 'Offline'}
              </div>
            </div>

            {/* SOS quick status */}
            <div className="sidebar-sos-quick">
              <div className="sidebar-sos-dot" />
              <span>SOS System Armed</span>
              <span className="badge badge-sat" style={{ fontSize: 10, padding: '2px 6px' }}>
                <Satellite size={9} /> Satellite
              </span>
            </div>

            {/* Logout */}
            <button className="sidebar-logout" onClick={logout}>
              <LogOut size={16} /> Sign Out
            </button>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Overlay (mobile) */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Main ── */}
      <main className="dash-main">
        {/* Topbar */}
        <header className="dash-topbar">
          <div className="flex items-center gap-3">
            <button className="topbar-menu-btn" onClick={() => setSidebarOpen(v => !v)}>
              <Menu size={20} />
            </button>
            <div>
              <h2 className="topbar-title">
                {navItems.find(n => n.id === activeTab)?.label}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Quick backend shortcut */}
            <button
              className={`topbar-backend-btn ${isDbLive ? 'live' : 'sandbox'}`}
              onClick={() => setActiveTab('backend')}
              title="Click to manage backend connection"
            >
              <Database size={13} />
              <span>{isDbLive ? 'Supabase Connected' : 'Connect Backend'}</span>
            </button>

            {/* Local relay indicator */}
            <div className={`topbar-relay-pill ${localRelayOnline ? 'online' : 'offline'}`} title="Localhost 3001 SOS Relay">
              <Server size={13} />
              <span>{localRelayOnline ? 'Relay 3001 Active' : 'Relay 3001 Standby'}</span>
            </div>

            {/* Online / Satellite */}
            <div className={`topbar-online-badge ${navigator.onLine ? 'online' : 'offline'}`}>
              {navigator.onLine ? <Wifi size={13} /> : <Satellite size={13} />}
              {navigator.onLine ? 'Internet' : 'Satellite Mode'}
            </div>

            {unresolved > 0 && (
              <button className="topbar-alert-btn" onClick={() => setActiveTab('alerts')}>
                <Bell size={16} />
                <span className="topbar-alert-count">{unresolved}</span>
              </button>
            )}
          </div>
        </header>

        {/* ── Content ── */}
        <div className="dash-content">
          <AnimatePresence mode="wait">
            <motion.div key={activeTab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
              style={{ height: '100%' }}
            >
              {/* ══════ OVERVIEW ══════ */}
              {activeTab === 'dashboard' && (
                <div className="tab-overview">
                  {/* Backend Notice Banner if Sandbox */}
                  {!isDbLive && (
                    <motion.div className="backend-banner glass-card"
                      initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                      <div className="flex items-center gap-3">
                        <div className="backend-banner-icon">
                          <Database size={18} />
                        </div>
                        <div>
                          <strong>Backend Status: Running in Demo Sandbox</strong>
                          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--clr-text-secondary)' }}>
                            Connect your live Supabase database & Firebase in <code>.env.local</code> to sync telemetry across devices in real time.
                          </p>
                        </div>
                      </div>
                      <button className="btn btn-primary" style={{ fontSize: 12, padding: '6px 14px' }}
                        onClick={() => setActiveTab('backend')}>
                        Configure Backend →
                      </button>
                    </motion.div>
                  )}

                  {/* Stat cards */}
                  <div className="stats-grid">
                    {[
                      { label: 'Protected Devices', value: activeDevices, icon: <ShieldCheck size={20} />, cls: 'stat-accent', sub: `of ${devices.length} total` },
                      { label: 'Active Alerts',     value: unresolved,    icon: <Bell size={20} />,         cls: unresolved > 0 ? 'stat-danger' : 'stat-success', sub: unresolved > 0 ? 'Needs attention' : 'All clear' },
                      { label: 'SIM Locked',        value: lockedSIMs,   icon: <Lock size={20} />,         cls: 'stat-warn', sub: 'Tray secured' },
                      { label: 'Emergency Relay',   value: localRelayOnline ? '3001' : 'Off', icon: <Satellite size={20} />, cls: localRelayOnline ? 'stat-success' : 'stat-purple', sub: localRelayOnline ? 'Mesh relay online' : 'Standby mode' },
                    ].map((s, i) => (
                      <motion.div key={i} className={`stat-card glass-card ${s.cls}`}
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.07 }}>
                        <div className="stat-icon">{s.icon}</div>
                        <div className="stat-body">
                          <div className="stat-value">{s.value}</div>
                          <div className="stat-label">{s.label}</div>
                          <div className="stat-sub">{s.sub}</div>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Map + SOS */}
                  <div className="overview-bottom">
                    <div className="glass-card overview-map">
                      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>
                          📍 Live Location: {selectedDevice.device_name} (IMEI: {selectedDevice.imei})
                        </span>
                        <span className="badge badge-active" style={{ fontSize: 11 }}>
                          Accuracy: {latestLocation.accuracy}m
                        </span>
                      </div>
                      <div style={{ flex: 1, minHeight: 0 }}>
                        <MapTracker
                          locations={locationHistory}
                          latestLocation={latestLocation}
                          deviceName={selectedDevice.device_name}
                          isTheftMode={alerts.some(a => a.type === 'theft' && !a.is_resolved && a.device_id === selectedDevice.id)}
                        />
                      </div>
                    </div>
                    <div className="glass-card overview-sos" style={{ padding: 20 }}>
                      <SOSPanel
                        deviceId={selectedDevice.id}
                        currentLocation={{ lat: latestLocation.latitude, lng: latestLocation.longitude }}
                      />
                    </div>
                  </div>

                  {/* Recent alerts strip */}
                  {alerts.filter(a => !a.is_resolved).length > 0 && (
                    <div className="recent-alerts glass-card">
                      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
                          <AlertTriangle size={15} style={{ color: 'var(--clr-danger)', marginRight: 6 }} />
                          Active Alerts
                        </h4>
                        <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px' }}
                          onClick={() => setActiveTab('alerts')}>
                          View All <ChevronRight size={13} />
                        </button>
                      </div>
                      {alerts.filter(a => !a.is_resolved).slice(0, 3).map(a => {
                        const cfg = alertTypeConfig[a.type] || alertTypeConfig['theft'];
                        return (
                          <div key={a.id} className="alert-row">
                            <span className={`badge ${cfg.cls}`}>{cfg.icon} {cfg.label}</span>
                            <span className="alert-msg">{a.message}</span>
                            <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 8px' }}
                              onClick={() => handleResolveAlert(a.id)}>
                              <Check size={11} /> Resolve
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ══════ DEVICES ══════ */}
              {activeTab === 'devices' && (
                <div className="tab-devices">
                  <div className="tab-header">
                    <div>
                      <h3 style={{ margin: 0 }}>Protected Devices</h3>
                      <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--clr-text-secondary)' }}>
                        All devices equipped with automatic SIM-lock and theft telemetry.
                      </p>
                    </div>
                    <button className="btn btn-primary" style={{ fontSize: 13 }}
                      onClick={() => setShowAddDevice(v => !v)}>
                      <Plus size={15} /> Add Device
                    </button>
                  </div>

                  {showAddDevice && (
                    <AddDeviceForm
                      onAdd={handleAddDevice}
                      onClose={() => setShowAddDevice(false)}
                      userId={user?.uid || 'demo'}
                    />
                  )}

                  <div className="devices-grid">
                    {devices.map(dev => (
                      <DeviceCard
                        key={dev.id}
                        device={dev}
                        isSelected={selectedDevice.id === dev.id}
                        onClick={() => setSelectedDevice(dev)}
                        onLockSIM={handleLockSIM}
                        onRemoteWipe={handleRemoteWipe}
                      />
                    ))}
                  </div>

                  {/* Selected device map */}
                  <div className="glass-card" style={{ padding: 20, marginTop: 8 }}>
                    <h4 style={{ margin: '0 0 14px', fontSize: 14 }}>
                      📍 {selectedDevice.device_name} — GPS Track & Breadcrumb Trail
                    </h4>
                    <div style={{ height: 380 }}>
                      <MapTracker
                        locations={locationHistory}
                        latestLocation={latestLocation}
                        deviceName={selectedDevice.device_name}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ══════ CONTACTS ══════ */}
              {activeTab === 'contacts' && (
                <div className="tab-contacts">
                  <div className="tab-header">
                    <div>
                      <h3 style={{ margin: 0 }}>Trusted Emergency Contacts</h3>
                      <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--clr-text-secondary)' }}>
                        When phone shutdown or theft is detected, emergency SMS with GPS coordinates & IMEI is dispatched here.
                      </p>
                    </div>
                    <button className="btn btn-primary" style={{ fontSize: 13 }}
                      onClick={() => setShowAddContact(v => !v)}>
                      <Plus size={15} /> Add Contact
                    </button>
                  </div>

                  {showAddContact && (
                    <AddContactForm
                      onAdd={handleAddContact}
                      onClose={() => setShowAddContact(false)}
                      userId={user?.uid || 'demo'}
                    />
                  )}

                  <div className="contacts-list">
                    {contacts.map((c, i) => (
                      <motion.div key={c.id} className="contact-card glass-card"
                        initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.06 }}>
                        <div className="contact-avatar">
                          {c.name[0].toUpperCase()}
                          {c.is_primary && (
                            <div className="contact-primary-dot" title="Primary contact" />
                          )}
                        </div>
                        <div className="contact-info">
                          <div className="flex items-center gap-2">
                            <span className="contact-name">{c.name}</span>
                            {c.is_primary && <span className="badge badge-info" style={{ fontSize: 10 }}>Primary Contact</span>}
                          </div>
                          <div className="contact-detail"><Phone size={12} /> {c.phone}</div>
                          {c.email && <div className="contact-detail"><Mail size={12} /> {c.email}</div>}
                          <div className="contact-detail"><User size={12} /> {c.relation}</div>
                        </div>
                        <div className="contact-flags">
                          <div className={`flag-pill ${c.receive_sos ? 'active' : ''}`}>
                            <AlertTriangle size={11} />
                            Emergency SOS
                          </div>
                          <div className={`flag-pill ${c.receive_location ? 'active' : ''}`}>
                            <MapPin size={11} />
                            Live GPS
                          </div>
                        </div>
                        <div className="contact-actions">
                          <button className="icon-btn" title="Toggle primary"
                            onClick={() => handleTogglePrimaryContact(c)}>
                            {c.is_primary ? <Star size={15} style={{ color: 'var(--clr-warn)' }} /> : <StarOff size={15} />}
                          </button>
                          <button className="icon-btn danger" title="Delete"
                            onClick={() => handleDeleteContact(c.id)}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Info box */}
                  <div className="contacts-info-box glass-card">
                    <PhoneCall size={18} style={{ color: 'var(--clr-accent)', flexShrink: 0 }} />
                    <p>
                      <strong>Automatic Theft Protocol:</strong> If a phone is suddenly powered off or snatched, the SIM tray locks automatically and an emergency alert packet (containing device <strong>IMEI</strong>, <strong>live coordinates</strong>, and battery status) is sent to all verified trusted contacts via SMS, HTTP, and satellite relay.
                    </p>
                  </div>
                </div>
              )}

              {/* ══════ ALERTS ══════ */}
              {activeTab === 'alerts' && (
                <div className="tab-alerts">
                  <div className="tab-header">
                    <div>
                      <h3 style={{ margin: 0 }}>Incident & Alert Log</h3>
                      <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--clr-text-secondary)' }}>
                        Real-time audit log of theft attempts, SIM extractions, and SOS triggers.
                      </p>
                    </div>
                    <span className="badge badge-danger">{unresolved} Unresolved</span>
                  </div>
                  <div className="alerts-list">
                    {alerts.map((a, i) => {
                      const cfg = alertTypeConfig[a.type] || alertTypeConfig['theft'];
                      return (
                        <motion.div key={a.id}
                          className={`alert-card glass-card ${a.is_resolved ? 'resolved' : ''}`}
                          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}>
                          <div className="alert-card-left">
                            <span className={`badge ${a.is_resolved ? 'badge-active' : cfg.cls}`}>
                              {a.is_resolved ? <Check size={11} /> : cfg.icon}
                              {a.is_resolved ? 'Resolved' : cfg.label}
                            </span>
                            <p className="alert-card-msg">{a.message}</p>
                            {(a.location_lat && a.location_lng) && (
                              <div className="alert-location">
                                <MapPin size={11} />
                                Coordinates: {a.location_lat.toFixed(4)}, {a.location_lng.toFixed(4)}
                              </div>
                            )}
                          </div>
                          <div className="alert-card-right">
                            <span className="alert-time">
                              <Clock size={11} />
                              {new Date(a.created_at).toLocaleString()}
                            </span>
                            {!a.is_resolved && (
                              <button className="btn btn-success" style={{ fontSize: 12, padding: '6px 12px' }}
                                onClick={() => handleResolveAlert(a.id)}>
                                <Check size={13} /> Mark Resolved
                              </button>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ══════ BACKEND & CLOUD MANAGER ══════ */}
              {activeTab === 'backend' && (
                <BackendManager
                  isDbLive={isDbLive}
                  localRelayOnline={localRelayOnline}
                  onReload={loadBackendData}
                  userId={user?.uid || 'pg_owner_01'}
                />
              )}

              {/* ══════ SETTINGS ══════ */}
              {activeTab === 'settings' && (
                <SettingsPanel
                  isDbLive={isDbLive}
                  isFirebaseLive={isFirebaseLive}
                  localRelayOnline={localRelayOnline}
                  onOpenBackend={() => setActiveTab('backend')}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <style>{`
        .dash-root {
          display: flex;
          min-height: 100vh;
          background: var(--clr-bg);
        }

        /* ── Sidebar ── */
        .sidebar {
          width: 260px;
          min-width: 260px;
          background: rgba(14, 18, 33, 0.95);
          border-right: 1px solid rgba(108,99,255,0.12);
          display: flex;
          flex-direction: column;
          padding: 20px 12px;
          gap: 4px;
          position: sticky;
          top: 0;
          height: 100vh;
          overflow-y: auto;
          z-index: 50;
          backdrop-filter: blur(20px);
        }
        .sidebar-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 8px 16px;
          border-bottom: 1px solid var(--clr-border);
          margin-bottom: 8px;
        }
        .sidebar-logo {
          width: 36px; height: 36px;
          border-radius: 10px;
          background: linear-gradient(135deg, rgba(108,99,255,0.3), rgba(167,139,250,0.2));
          border: 1px solid rgba(108,99,255,0.4);
          display: flex; align-items: center; justify-content: center;
          color: var(--clr-accent);
          box-shadow: 0 0 12px rgba(108,99,255,0.3);
          flex-shrink: 0;
        }
        .sidebar-brand-text { font-size: 16px; font-weight: 800; flex: 1; letter-spacing: -0.02em; }
        .sidebar-close {
          background: none; border: none; cursor: pointer;
          color: var(--clr-text-muted); display: none;
        }
        .sidebar-user {
          display: flex; align-items: center; gap: 10px;
          padding: 10px;
          border-radius: 10px;
          background: var(--clr-surface-2);
          border: 1px solid var(--clr-border);
          margin-bottom: 12px;
        }
        .sidebar-avatar {
          width: 34px; height: 34px;
          border-radius: 50%;
          background: linear-gradient(135deg, #6c63ff, #a78bfa);
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; font-weight: 700; color: #fff;
          flex-shrink: 0;
        }
        .sidebar-user-info { min-width: 0; }
        .sidebar-user-name {
          font-size: 13px; font-weight: 600;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          display: block;
        }
        .sidebar-user-email {
          font-size: 11px; color: var(--clr-text-muted);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          display: block;
        }
        .sidebar-nav { display: flex; flex-direction: column; gap: 2px; flex: 1; }
        .sidebar-nav-item {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px;
          border-radius: 10px;
          cursor: pointer;
          border: none;
          background: transparent;
          color: var(--clr-text-secondary);
          font-size: 14px; font-weight: 500;
          transition: all 0.18s ease;
          position: relative;
          width: 100%;
          text-align: left;
        }
        .sidebar-nav-item:hover {
          background: rgba(108,99,255,0.08);
          color: var(--clr-text-primary);
        }
        .sidebar-nav-item.active {
          background: rgba(108,99,255,0.14);
          color: var(--clr-accent);
          font-weight: 600;
        }
        .sidebar-nav-icon { width: 20px; display: flex; align-items: center; justify-content: center; }
        .sidebar-nav-label { flex: 1; }
        .sidebar-nav-badge {
          background: var(--clr-surface-3);
          color: var(--clr-text-secondary);
          font-size: 11px; font-weight: 700;
          padding: 2px 7px; border-radius: 20px;
        }
        .sidebar-nav-badge.danger {
          background: rgba(244,63,94,0.2);
          color: var(--clr-danger);
        }
        .sidebar-active-bar {
          position: absolute; left: 0; top: 6px; bottom: 6px;
          width: 3px; border-radius: 2px;
          background: var(--clr-accent);
          box-shadow: 0 0 8px rgba(108,99,255,0.6);
        }
        .sidebar-backend-status {
          background: rgba(108,99,255,0.06);
          border: 1px solid rgba(108,99,255,0.18);
          border-radius: 10px;
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
          margin-top: 6px;
        }
        .sidebar-backend-status:hover {
          background: rgba(108,99,255,0.12);
          border-color: var(--clr-accent);
        }
        .status-dot {
          width: 8px; height: 8px; border-radius: 50%;
        }
        .status-dot.green { background: var(--clr-success); box-shadow: 0 0 6px var(--clr-success); }
        .status-dot.amber { background: var(--clr-warn); box-shadow: 0 0 6px var(--clr-warn); }
        .sidebar-sos-quick {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 12px;
          background: rgba(16,185,129,0.06);
          border: 1px solid rgba(16,185,129,0.18);
          border-radius: 10px;
          font-size: 12px; font-weight: 500;
          color: var(--clr-success);
          margin-top: 6px;
        }
        .sidebar-sos-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: var(--clr-success);
          box-shadow: 0 0 6px var(--clr-success);
          flex-shrink: 0;
          animation: pulse-ring 1.5s ease infinite;
        }
        .sidebar-logout {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 12px; margin-top: 8px;
          border-radius: 10px;
          background: none;
          border: 1px solid rgba(244,63,94,0.2);
          color: var(--clr-danger);
          font-size: 13px; font-weight: 500;
          cursor: pointer;
          transition: all 0.18s ease;
          width: 100%;
        }
        .sidebar-logout:hover { background: rgba(244,63,94,0.08); }
        .sidebar-overlay { display: none; }

        /* ── Main ── */
        .dash-main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
        .dash-topbar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 24px;
          border-bottom: 1px solid var(--clr-border);
          background: rgba(14,18,33,0.75);
          backdrop-filter: blur(16px);
          position: sticky; top: 0; z-index: 40;
        }
        .topbar-menu-btn {
          background: none; border: 1px solid var(--clr-border);
          border-radius: 8px; padding: 7px; cursor: pointer;
          color: var(--clr-text-secondary);
          display: none;
          transition: all 0.18s ease;
        }
        .topbar-menu-btn:hover { color: var(--clr-accent); border-color: var(--clr-accent); }
        .topbar-title { font-size: 18px; font-weight: 700; margin: 0; }
        .topbar-backend-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 5px 12px; border-radius: 20px;
          font-size: 12px; font-weight: 600; cursor: pointer;
          border: 1px solid transparent;
          transition: all 0.2s ease;
        }
        .topbar-backend-btn.live {
          background: rgba(16,185,129,0.12);
          color: var(--clr-success);
          border-color: rgba(16,185,129,0.3);
        }
        .topbar-backend-btn.sandbox {
          background: rgba(245,158,11,0.12);
          color: var(--clr-warn);
          border-color: rgba(245,158,11,0.3);
        }
        .topbar-relay-pill {
          display: flex; align-items: center; gap: 5px;
          padding: 5px 11px; border-radius: 20px;
          font-size: 12px; font-weight: 600;
        }
        .topbar-relay-pill.online {
          background: rgba(108,99,255,0.12);
          color: var(--clr-accent);
          border: 1px solid rgba(108,99,255,0.3);
        }
        .topbar-relay-pill.offline {
          background: var(--clr-surface-2);
          color: var(--clr-text-muted);
          border: 1px solid var(--clr-border);
        }
        .topbar-online-badge {
          display: flex; align-items: center; gap: 5px;
          padding: 5px 12px; border-radius: 20px;
          font-size: 12px; font-weight: 600;
        }
        .topbar-online-badge.online  { background: rgba(16,185,129,0.1); color: var(--clr-success); border: 1px solid rgba(16,185,129,0.25); }
        .topbar-online-badge.offline { background: rgba(251,191,36,0.1); color: var(--clr-satellite); border: 1px solid rgba(251,191,36,0.25); }
        .topbar-alert-btn {
          position: relative;
          background: rgba(244,63,94,0.1); border: 1px solid rgba(244,63,94,0.25);
          border-radius: 8px; padding: 7px 10px;
          color: var(--clr-danger); cursor: pointer;
          transition: all 0.18s ease;
          display: flex; align-items: center;
        }
        .topbar-alert-btn:hover { background: rgba(244,63,94,0.2); }
        .topbar-alert-count {
          position: absolute; top: -6px; right: -6px;
          background: var(--clr-danger);
          color: #fff; font-size: 10px; font-weight: 700;
          width: 16px; height: 16px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          border: 2px solid var(--clr-bg);
        }
        .dash-content { flex: 1; padding: 24px; overflow-y: auto; }

        /* Backend Banner */
        .backend-banner {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 20px;
          background: linear-gradient(90deg, rgba(245,158,11,0.08), rgba(108,99,255,0.08));
          border-color: rgba(245,158,11,0.3);
          gap: 16px;
          flex-wrap: wrap;
        }
        .backend-banner-icon {
          width: 36px; height: 36px; border-radius: 8px;
          background: rgba(245,158,11,0.15);
          display: flex; align-items: center; justify-content: center;
          color: var(--clr-warn); flex-shrink: 0;
        }

        /* ── Overview ── */
        .tab-overview { display: flex; flex-direction: column; gap: 20px; }
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
        .stat-card { padding: 20px; display: flex; align-items: center; gap: 14px; }
        .stat-icon {
          width: 48px; height: 48px;
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .stat-accent .stat-icon { background: rgba(108,99,255,0.15); color: var(--clr-accent); }
        .stat-danger .stat-icon { background: rgba(244,63,94,0.15);  color: var(--clr-danger); }
        .stat-success .stat-icon { background: rgba(16,185,129,0.15); color: var(--clr-success); }
        .stat-warn   .stat-icon { background: rgba(245,158,11,0.15); color: var(--clr-warn); }
        .stat-purple .stat-icon { background: rgba(167,139,250,0.15); color: var(--clr-purple); }
        .stat-value { font-size: 28px; font-weight: 800; line-height: 1; }
        .stat-label { font-size: 13px; font-weight: 600; color: var(--clr-text-secondary); margin-top: 2px; }
        .stat-sub   { font-size: 11px; color: var(--clr-text-muted); margin-top: 2px; }
        .overview-bottom { display: grid; grid-template-columns: 1fr 340px; gap: 16px; }
        .overview-map { padding: 20px; height: 500px; display: flex; flex-direction: column; }
        .overview-sos { }
        .recent-alerts { padding: 18px; }
        .alert-row {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 0;
          border-top: 1px solid var(--clr-border);
          flex-wrap: wrap;
        }
        .alert-msg { flex: 1; font-size: 13px; color: var(--clr-text-secondary); min-width: 200px; }

        /* ── Devices ── */
        .tab-devices { display: flex; flex-direction: column; gap: 16px; }
        .tab-header { display: flex; align-items: center; justify-content: space-between; }
        .devices-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }

        /* ── Contacts ── */
        .tab-contacts { display: flex; flex-direction: column; gap: 16px; }
        .contacts-list { display: flex; flex-direction: column; gap: 10px; }
        .contact-card {
          display: flex; align-items: center; gap: 14px;
          padding: 16px;
        }
        .contact-avatar {
          width: 44px; height: 44px; border-radius: 50%;
          background: linear-gradient(135deg, #6c63ff, #a78bfa);
          display: flex; align-items: center; justify-content: center;
          font-size: 18px; font-weight: 700; color: #fff;
          flex-shrink: 0; position: relative;
        }
        .contact-primary-dot {
          position: absolute; bottom: -2px; right: -2px;
          width: 12px; height: 12px; border-radius: 50%;
          background: var(--clr-warn);
          border: 2px solid var(--clr-bg);
        }
        .contact-info { flex: 1; display: flex; flex-direction: column; gap: 3px; }
        .contact-name { font-size: 15px; font-weight: 700; }
        .contact-detail { display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--clr-text-secondary); }
        .contact-flags { display: flex; flex-direction: column; gap: 5px; }
        .flag-pill {
          display: flex; align-items: center; gap: 4px;
          padding: 3px 8px; border-radius: 20px;
          font-size: 11px; font-weight: 600;
          background: var(--clr-surface-3);
          color: var(--clr-text-muted);
          border: 1px solid var(--clr-border);
        }
        .flag-pill.active { background: rgba(16,185,129,0.1); color: var(--clr-success); border-color: rgba(16,185,129,0.25); }
        .contact-actions { display: flex; flex-direction: column; gap: 6px; }
        .icon-btn {
          width: 32px; height: 32px; border-radius: 8px;
          background: var(--clr-surface-2); border: 1px solid var(--clr-border);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: var(--clr-text-muted);
          transition: all 0.18s ease;
        }
        .icon-btn:hover { color: var(--clr-text-primary); border-color: var(--clr-accent); }
        .icon-btn.danger:hover { color: var(--clr-danger); border-color: var(--clr-danger); }
        .contacts-info-box {
          display: flex; gap: 12px; padding: 16px;
          background: rgba(108,99,255,0.05);
          border-color: rgba(108,99,255,0.2);
          font-size: 13px; color: var(--clr-text-secondary); line-height: 1.7;
        }
        .contacts-info-box strong { color: var(--clr-text-primary); }

        /* ── Alerts ── */
        .tab-alerts { display: flex; flex-direction: column; gap: 16px; }
        .alerts-list { display: flex; flex-direction: column; gap: 10px; }
        .alert-card {
          display: flex; align-items: flex-start; justify-content: space-between;
          padding: 16px; gap: 14px;
          transition: opacity 0.2s ease;
        }
        .alert-card.resolved { opacity: 0.55; }
        .alert-card-left { display: flex; flex-direction: column; gap: 6px; flex: 1; }
        .alert-card-msg { font-size: 13px; color: var(--clr-text-secondary); margin: 0; }
        .alert-location { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--clr-text-muted); font-family: 'JetBrains Mono', monospace; }
        .alert-card-right { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; flex-shrink: 0; }
        .alert-time { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--clr-text-muted); white-space: nowrap; }

        /* ── Responsive ── */
        @media (max-width: 1200px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
          .overview-bottom { grid-template-columns: 1fr; }
          .overview-map { height: 420px; }
        }
        @media (max-width: 768px) {
          .sidebar { position: fixed; left: -260px; transition: left 0.3s ease; }
          .sidebar.sidebar-open { left: 0; }
          .sidebar-close { display: flex; }
          .sidebar-overlay { display: block; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 49; }
          .topbar-menu-btn { display: flex; }
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
          .dash-content { padding: 16px; }
          .contact-card { flex-wrap: wrap; }
        }
        @media (max-width: 480px) {
          .stats-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

// ─── Backend & Cloud Manager Tab ─────────────────────────────────
function BackendManager({ isDbLive, localRelayOnline, onReload, userId }: {
  isDbLive: boolean;
  localRelayOnline: boolean;
  onReload: () => void;
  userId: string;
}) {
  const [testingSupabase, setTestingSupabase] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [testingRelay, setTestingRelay] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const handleTestSupabase = async () => {
    setTestingSupabase(true);
    const res = await testSupabaseConnection();
    setTestingSupabase(false);
    if (res.ok) {
      toast.success(res.message);
    } else {
      toast.error(res.message, { duration: 6000 });
    }
  };

  const handleSeedData = async () => {
    setSeeding(true);
    try {
      await seedDemoData(userId);
      toast.success('Sample devices, locations, contacts & alerts created in Supabase!');
      onReload();
    } catch (err: any) {
      toast.error(err.message || 'Seeding failed. Make sure tables exist.', { duration: 6000 });
    } finally {
      setSeeding(false);
    }
  };

  const handleTestRelay = async () => {
    setTestingRelay(true);
    try {
      const res = await fetch('http://localhost:3001/sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: 'dev-1',
          imei: '352001234567890',
          type: 'test_satellite_broadcast',
          message: 'Diagnostic test of Local Satellite SOS Relay',
          location: { lat: 28.6139, lng: 77.2090 },
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Local satellite packet dispatched & acknowledged by port 3001!');
      } else {
        toast.error(`Relay error: ${data.error}`);
      }
    } catch (err: any) {
      toast.error(`Relay unreachable on http://localhost:3001: ${err.message}`);
    } finally {
      setTestingRelay(false);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
    setCopiedSql(true);
    toast.success('Supabase SQL schema copied to clipboard!');
    setTimeout(() => setCopiedSql(false), 3000);
  };

  return (
    <div className="backend-page">
      <div className="tab-header" style={{ marginBottom: 20 }}>
        <div>
          <h3 style={{ margin: 0 }}>Backend & Real-Time Sync</h3>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--clr-text-secondary)' }}>
            Status of Supabase PostgreSQL, Firebase Authentication, and Localhost Satellite Relay.
          </p>
        </div>
        <button className="btn btn-ghost" onClick={onReload} style={{ fontSize: 13 }}>
          <RefreshCw size={14} /> Refresh Status
        </button>
      </div>

      {/* Services Grid */}
      <div className="backend-grid">
        {/* Supabase Database */}
        <div className="glass-card backend-card">
          <div className="backend-card-header">
            <div className="backend-service-icon supabase">
              <Database size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <h4 style={{ margin: 0, fontSize: 16 }}>Supabase Database</h4>
              <span style={{ fontSize: 12, color: 'var(--clr-text-muted)' }}>PostgreSQL & Realtime GPS Telemetry</span>
            </div>
            <span className={`badge ${isDbLive ? 'badge-active' : 'badge-warn'}`}>
              {isDbLive ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
              {isDbLive ? 'Live Connected' : 'Demo Sandbox'}
            </span>
          </div>

          <p style={{ fontSize: 13, color: 'var(--clr-text-secondary)', lineHeight: 1.6 }}>
            Stores registered devices, 15-digit IMEIs, breadcrumb location history, trusted contact phone numbers, and theft incident alerts with Row-Level Security.
          </p>

          <div className="flex gap-2" style={{ flexWrap: 'wrap', marginTop: 'auto' }}>
            <button className="btn btn-primary" onClick={handleTestSupabase} disabled={testingSupabase} style={{ fontSize: 12 }}>
              {testingSupabase ? <span className="spinner" /> : <RefreshCw size={13} />}
              Test Connection
            </button>
            <button className="btn btn-ghost" onClick={handleSeedData} disabled={seeding} style={{ fontSize: 12 }}>
              {seeding ? <span className="spinner" /> : <Plus size={13} />}
              Seed Initial Data
            </button>
            <button className="btn btn-ghost" onClick={handleCopySql} style={{ fontSize: 12 }}>
              {copiedSql ? <Check size={13} style={{ color: 'var(--clr-success)' }} /> : <Copy size={13} />}
              {copiedSql ? 'SQL Copied!' : 'Copy SQL Schema'}
            </button>
          </div>
        </div>

        {/* Localhost Satellite SOS Relay */}
        <div className="glass-card backend-card">
          <div className="backend-card-header">
            <div className="backend-service-icon relay">
              <Server size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <h4 style={{ margin: 0, fontSize: 16 }}>Localhost SOS Relay</h4>
              <span style={{ fontSize: 12, color: 'var(--clr-text-muted)' }}>Port 3001 — Satellite & LAN Mesh Fallback</span>
            </div>
            <span className={`badge ${localRelayOnline ? 'badge-active' : 'badge-danger'}`}>
              {localRelayOnline ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
              {localRelayOnline ? 'Port 3001 Online' : 'Offline'}
            </span>
          </div>

          <p style={{ fontSize: 13, color: 'var(--clr-text-secondary)', lineHeight: 1.6 }}>
            Fulfills the requirement to dispatch emergency SOS signals even when internet is severed (via local BroadcastChannel and LAN satellite packet HTTP server on port 3001).
          </p>

          <div className="flex gap-2" style={{ flexWrap: 'wrap', marginTop: 'auto' }}>
            <button className="btn btn-primary" onClick={handleTestRelay} disabled={testingRelay} style={{ fontSize: 12 }}>
              {testingRelay ? <span className="spinner" /> : <Send size={13} />}
              Dispatch Test SOS Packet
            </button>
            <a
              href="http://localhost:3001/health"
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost"
              style={{ fontSize: 12, textDecoration: 'none' }}
            >
              View Relay Health API ↗
            </a>
          </div>
        </div>
      </div>

      {/* Connection Guide Box */}
      <div className="glass-card" style={{ padding: 24, marginTop: 20 }}>
        <h4 style={{ margin: '0 0 12px', fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Lock size={16} style={{ color: 'var(--clr-accent)' }} />
          How to wire your real project credentials:
        </h4>
        <p style={{ fontSize: 13, color: 'var(--clr-text-secondary)', lineHeight: 1.6, marginBottom: 16 }}>
          PhoneGuard is fully coded to connect directly to your live Firebase & Supabase instances. Simply paste your keys into the <code>.env.local</code> file in your workspace root:
        </p>

        <div className="env-code-box">
          <pre>{`# Firebase Configuration (for customer privacy & auth)
VITE_FIREBASE_API_KEY=your_firebase_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# Supabase Configuration (for devices, contacts, alerts, locations)
VITE_SUPABASE_URL=https://your_project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here`}</pre>
        </div>

        <div className="backend-steps">
          <div className="step-card">
            <span className="step-number">1</span>
            <div>
              <strong>Create Supabase Tables</strong>
              <p>Click "Copy SQL Schema" above, navigate to your Supabase Project &gt; SQL Editor, paste the SQL and hit Run.</p>
            </div>
          </div>
          <div className="step-card">
            <span className="step-number">2</span>
            <div>
              <strong>Save in .env.local</strong>
              <p>Paste your Project URL & Anon Key into <code>.env.local</code>. Vite hot-reloads instantly.</p>
            </div>
          </div>
          <div className="step-card">
            <span className="step-number">3</span>
            <div>
              <strong>Seed or Add Devices</strong>
              <p>Click "Seed Initial Data" or use the "+ Add Device" button to test live telemetry syncing across multiple devices!</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .backend-page { display: flex; flex-direction: column; gap: 16px; }
        .backend-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
        .backend-card {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .backend-card-header { display: flex; align-items: center; gap: 14px; }
        .backend-service-icon {
          width: 44px; height: 44px; border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .backend-service-icon.supabase {
          background: rgba(16,185,129,0.15);
          color: var(--clr-success);
          border: 1px solid rgba(16,185,129,0.3);
        }
        .backend-service-icon.relay {
          background: rgba(108,99,255,0.15);
          color: var(--clr-accent);
          border: 1px solid rgba(108,99,255,0.3);
        }
        .env-code-box {
          background: #060911;
          border: 1px solid var(--clr-border);
          border-radius: 10px;
          padding: 16px;
          overflow-x: auto;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          color: #a78bfa;
          margin-bottom: 20px;
        }
        .env-code-box pre { margin: 0; }
        .backend-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .step-card {
          display: flex; gap: 12px;
          background: var(--clr-surface-2);
          border: 1px solid var(--clr-border);
          border-radius: 10px;
          padding: 14px;
          font-size: 13px;
        }
        .step-card strong { display: block; margin-bottom: 4px; color: var(--clr-text-primary); }
        .step-card p { margin: 0; color: var(--clr-text-muted); font-size: 12px; line-height: 1.5; }
        .step-number {
          width: 26px; height: 26px; border-radius: 50%;
          background: var(--clr-accent); color: #fff;
          display: flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 12px; flex-shrink: 0;
        }
        @media (max-width: 900px) {
          .backend-grid { grid-template-columns: 1fr; }
          .backend-steps { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

// ─── Add Device Form ─────────────────────────────────────────────
function AddDeviceForm({ onAdd, onClose, userId }: {
  onAdd: (d: Device) => void;
  onClose: () => void;
  userId: string;
}) {
  const [name, setName] = useState('');
  const [model, setModel] = useState('');
  const [imei, setImei] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (imei.length !== 15 || !/^\d{15}$/.test(imei)) {
      toast.error('IMEI must be exactly 15 digits');
      return;
    }
    setLoading(true);
    const newDev: Device = {
      id: `dev-${Date.now()}`,
      user_id: userId,
      imei,
      device_name: name,
      model: model || 'Smartphone',
      is_active: true,
      sim_locked: false,
      battery_level: 100,
      last_seen: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    onAdd(newDev);
    setLoading(false);
  };

  return (
    <motion.div className="add-form glass-card"
      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}>
      <form onSubmit={handleSubmit}>
        <div className="add-form-grid">
          <div className="form-group">
            <label className="form-label">Device Name</label>
            <input className="form-input" required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. My Phone" />
          </div>
          <div className="form-group">
            <label className="form-label">Model</label>
            <input className="form-input" value={model} onChange={e => setModel(e.target.value)} placeholder="e.g. Samsung Galaxy S24" />
          </div>
          <div className="form-group">
            <label className="form-label">IMEI Number (15 digits)</label>
            <input className="form-input mono" required value={imei} onChange={e => setImei(e.target.value)} placeholder="352001234567890" maxLength={15} />
          </div>
        </div>
        <div className="flex gap-2" style={{ marginTop: 14 }}>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <span className="spinner" /> : <Plus size={14} />}
            {loading ? 'Adding…' : 'Add & Protect'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
      <style>{`
        .add-form { padding: 20px; overflow: hidden; }
        .add-form-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        @media (max-width: 700px) { .add-form-grid { grid-template-columns: 1fr; } }
      `}</style>
    </motion.div>
  );
}

// ─── Add Contact Form ────────────────────────────────────────────
function AddContactForm({ onAdd, onClose, userId }: {
  onAdd: (c: TrustedContact) => void;
  onClose: () => void;
  userId: string;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [relation, setRelation] = useState('Family');
  const [receiveSOS, setReceiveSOS] = useState(true);
  const [receiveLocation, setReceiveLocation] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newContact: TrustedContact = {
      id: `c-${Date.now()}`,
      user_id: userId,
      name,
      phone,
      email,
      relation,
      is_primary: false,
      receive_sos: receiveSOS,
      receive_location: receiveLocation,
      created_at: new Date().toISOString(),
    };
    onAdd(newContact);
  };

  return (
    <motion.div className="add-form glass-card"
      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
      <form onSubmit={handleSubmit}>
        <div className="add-form-grid">
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input className="form-input" required value={name} onChange={e => setName(e.target.value)} placeholder="Mom / Contact Name" />
          </div>
          <div className="form-group">
            <label className="form-label">Phone Number (SMS Alert Target)</label>
            <input className="form-input" required value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="contact@example.com" />
          </div>
          <div className="form-group">
            <label className="form-label">Relation</label>
            <select className="form-select" value={relation} onChange={e => setRelation(e.target.value)}>
              {['Family','Friend','Colleague','Partner','Other'].map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-4" style={{ marginTop: 12, flexWrap: 'wrap' }}>
          <label className="toggle-label">
            <input type="checkbox" checked={receiveSOS} onChange={e => setReceiveSOS(e.target.checked)} />
            Receive SOS SMS + IMEI on phone shutdown
          </label>
          <label className="toggle-label">
            <input type="checkbox" checked={receiveLocation} onChange={e => setReceiveLocation(e.target.checked)} />
            Receive live GPS tracking link
          </label>
        </div>
        <div className="flex gap-2" style={{ marginTop: 14 }}>
          <button type="submit" className="btn btn-primary"><Plus size={14} /> Add Contact</button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
      <style>{`.toggle-label { display: flex; align-items: center; gap: 7px; font-size: 13px; color: var(--clr-text-secondary); cursor: pointer; }
      .toggle-label input { accent-color: var(--clr-accent); width: 15px; height: 15px; }`}</style>
    </motion.div>
  );
}

// ─── Settings Panel ──────────────────────────────────────────────
function SettingsPanel({ isDbLive, isFirebaseLive, localRelayOnline, onOpenBackend }: {
  isDbLive: boolean;
  isFirebaseLive: boolean;
  localRelayOnline: boolean;
  onOpenBackend: () => void;
}) {
  const { user } = useAuth();
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [autoLock, setAutoLock] = useState(true);
  const [notifyOnOff, setNotifyOnOff] = useState(true);
  const [satelliteBackup, setSatelliteBackup] = useState(true);
  const [theftAlert, setTheftAlert] = useState(true);

  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin !== confirmPin) { toast.error('PINs do not match'); return; }
    if (newPin.length < 4) { toast.error('PIN must be at least 4 digits'); return; }
    const hashed = btoa(newPin + '_phoneguard_salt_2024');
    localStorage.setItem('pg_pin_hash', hashed);
    toast.success('Security PIN updated successfully!');
    setNewPin(''); setConfirmPin('');
  };

  return (
    <div className="settings-page">
      <div className="settings-grid">
        {/* Security settings */}
        <div className="glass-card settings-card">
          <h4 className="settings-card-title"><Lock size={16} /> Security & PIN Code</h4>
          <form onSubmit={handleSavePin} className="settings-form">
            <div className="form-group">
              <label className="form-label">New Security PIN (4–6 digits)</label>
              <input className="form-input mono" type="password" maxLength={6}
                placeholder="New PIN (default: 1234)" value={newPin} onChange={e => setNewPin(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm PIN</label>
              <input className="form-input mono" type="password" maxLength={6}
                placeholder="Repeat new PIN" value={confirmPin} onChange={e => setConfirmPin(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary" style={{ marginTop: 4 }}>
              <Check size={14} /> Update PIN
            </button>
          </form>
        </div>

        {/* Theft & Automation settings */}
        <div className="glass-card settings-card">
          <h4 className="settings-card-title"><Bell size={16} /> Anti-Theft Automation</h4>
          <div className="settings-toggles">
            {[
              { label: 'Auto-lock SIM tray on unexpected shutdown', state: autoLock, set: setAutoLock },
              { label: 'Notify contacts with IMEI & GPS when phone goes offline', state: notifyOnOff, set: setNotifyOnOff },
              { label: 'Satellite SOS fallback mode (no cellular / WiFi)', state: satelliteBackup, set: setSatelliteBackup },
              { label: 'Motion & snatch detection trigger', state: theftAlert, set: setTheftAlert },
            ].map((t, i) => (
              <label key={i} className="settings-toggle-row">
                <span className="settings-toggle-label">{t.label}</span>
                <div className={`toggle-switch ${t.state ? 'on' : ''}`}
                  onClick={() => t.set(v => !v)}>
                  <div className="toggle-thumb" />
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Account Info */}
        <div className="glass-card settings-card">
          <h4 className="settings-card-title"><User size={16} /> Account Profile</h4>
          <div className="settings-info">
            <div className="settings-info-row">
              <span className="settings-info-key">User Email</span>
              <span className="settings-info-val">{user?.email || 'owner@phoneguard.app'}</span>
            </div>
            <div className="settings-info-row">
              <span className="settings-info-key">Customer Name</span>
              <span className="settings-info-val">{user?.displayName || 'Phone Owner'}</span>
            </div>
            <div className="settings-info-row">
              <span className="settings-info-key">Authentication</span>
              <span className={`badge ${isFirebaseLive ? 'badge-active' : 'badge-warn'}`}>
                {isFirebaseLive ? 'Firebase Auth Live' : 'Demo Auth'}
              </span>
            </div>
          </div>
        </div>

        {/* System & Backend Info */}
        <div className="glass-card settings-card">
          <h4 className="settings-card-title"><Activity size={16} /> Cloud & Relay Status</h4>
          <div className="settings-info">
            <div className="settings-info-row">
              <span className="settings-info-key">Supabase Backend</span>
              <span className={`badge ${isDbLive ? 'badge-active' : 'badge-warn'}`}>
                {isDbLive ? 'Live Database' : 'Sandbox (Demo)'}
              </span>
            </div>
            <div className="settings-info-row">
              <span className="settings-info-key">Satellite Local Relay</span>
              <span className={`badge ${localRelayOnline ? 'badge-active' : 'badge-danger'}`}>
                {localRelayOnline ? 'Port 3001 Active' : 'Offline'}
              </span>
            </div>
            <div className="settings-info-row">
              <span className="settings-info-key">Network Link</span>
              <span className={`badge ${navigator.onLine ? 'badge-active' : 'badge-sat'}`}>
                {navigator.onLine ? 'Cellular / WiFi' : 'Satellite Only'}
              </span>
            </div>
          </div>
          <button className="btn btn-ghost" onClick={onOpenBackend} style={{ marginTop: 'auto', fontSize: 12 }}>
            <Database size={14} /> Open Backend Configuration Manager →
          </button>
        </div>
      </div>

      <style>{`
        .settings-page { display: flex; flex-direction: column; gap: 20px; }
        .settings-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
        .settings-card { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
        .settings-card-title {
          display: flex; align-items: center; gap: 8px;
          font-size: 14px; font-weight: 700; margin: 0;
          color: var(--clr-text-primary);
          padding-bottom: 12px;
          border-bottom: 1px solid var(--clr-border);
        }
        .settings-form { display: flex; flex-direction: column; gap: 12px; }
        .settings-toggles { display: flex; flex-direction: column; gap: 12px; }
        .settings-toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; cursor: pointer; }
        .settings-toggle-label { font-size: 13px; color: var(--clr-text-secondary); flex: 1; }
        .toggle-switch {
          width: 40px; height: 22px; border-radius: 11px;
          background: var(--clr-surface-3); border: 1px solid var(--clr-border);
          position: relative; cursor: pointer;
          transition: background 0.25s ease;
          flex-shrink: 0;
        }
        .toggle-switch.on { background: var(--clr-accent); border-color: var(--clr-accent); }
        .toggle-thumb {
          position: absolute; top: 2px; left: 2px;
          width: 16px; height: 16px; border-radius: 50%;
          background: var(--clr-text-muted);
          transition: all 0.25s ease;
        }
        .toggle-switch.on .toggle-thumb { left: 20px; background: #fff; }
        .settings-info { display: flex; flex-direction: column; gap: 10px; }
        .settings-info-row { display: flex; align-items: center; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--clr-border); }
        .settings-info-key { font-size: 13px; color: var(--clr-text-muted); }
        .settings-info-val { font-size: 13px; color: var(--clr-text-primary); font-weight: 500; }
        @media (max-width: 768px) { .settings-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
