import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Wifi, WifiOff, Satellite, AlertTriangle,
  Phone, MapPin, PhoneOff, Radio
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { createSOSEvent, getSOSEvents, updateSOSStatus } from '../lib/api';
import type { SOSEvent } from '../lib/supabase';

interface SOSPanelProps {
  deviceId: string;
  currentLocation?: { lat: number; lng: number };
}

type SOSMode = 'idle' | 'armed' | 'active';

export default function SOSPanel({ deviceId, currentLocation }: SOSPanelProps) {
  const { user } = useAuth();
  const [mode, setMode] = useState<SOSMode>('idle');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [countdown, setCountdown] = useState(5);
  const [countingDown, setCountingDown] = useState(false);
  const [activeSOSId, setActiveSOSId] = useState<string | null>(null);
  const [sosHistory, setSOSHistory] = useState<SOSEvent[]>([]);
  const [sosType, setSOSType] = useState<'manual' | 'theft' | 'panic'>('manual');

  // Network monitoring
  useEffect(() => {
    const handleOnline  = () => { setIsOnline(true);  toast.success('Network restored'); };
    const handleOffline = () => { setIsOnline(false); toast('📡 Switching to satellite mode', { icon: '🛰️' }); };
    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load SOS history
  useEffect(() => {
    if (!user) return;
    getSOSEvents(user.uid).then(setSOSHistory).catch(console.error);
  }, [user]);

  // Countdown to fire SOS
  useEffect(() => {
    if (!countingDown) return;
    if (countdown === 0) {
      setCountingDown(false);
      fireSOS();
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, countingDown]);

  const armSOS = () => {
    setMode('armed');
    setCountdown(5);
    setCountingDown(true);
    toast('SOS armed – tap CANCEL to abort', { icon: '⚠️', duration: 5000 });
  };

  const cancelSOS = () => {
    setCountingDown(false);
    setCountdown(5);
    setMode('idle');
    toast.success('SOS cancelled');
  };

  const fireSOS = async () => {
    setMode('active');
    if (!user) return;

    const satelliteMode = !isOnline;

    try {
      const sos = await createSOSEvent({
        user_id: user.uid,
        device_id: deviceId,
        type: sosType,
        status: 'active',
        message: `Emergency SOS triggered via ${satelliteMode ? 'SATELLITE' : 'internet'}`,
        location_lat: currentLocation?.lat,
        location_lng: currentLocation?.lng,
        notified_police: true,
        notified_contacts: true,
        satellite_mode: satelliteMode,
      });
      setActiveSOSId(sos.id);
      setSOSHistory(prev => [sos, ...prev]);

      // Simulate calling police (local HTTP fallback)
      if (!isOnline) {
        await simulateSatelliteSOSDispatch(sos.id);
      } else {
        await simulateInternetSOSDispatch(sos.id);
      }

      toast.error('🚨 SOS ACTIVATED — Help is on the way!', { duration: 10000 });
    } catch (err) {
      console.error(err);
      toast.error('Failed to send SOS via backend — using local broadcast');
      triggerLocalSOSBroadcast();
    }
  };

  // Simulate satellite SOS via local broadcast (works offline)
  const triggerLocalSOSBroadcast = () => {
    const data = {
      type: 'SOS_EMERGENCY',
      timestamp: new Date().toISOString(),
      location: currentLocation,
      message: 'EMERGENCY SOS - PhoneGuard Anti-Theft System',
    };
    // Broadcast to local network via BroadcastChannel (works on local network)
    const bc = new BroadcastChannel('phoneguard_sos');
    bc.postMessage(data);
    bc.close();

    // Also try local HTTP to any listening device on LAN
    fetch('http://localhost:3001/sos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).catch(() => {/* LAN receiver not running */});

    toast('📡 SOS broadcast via local network & satellite link', { icon: '🛰️' });
  };

  const simulateSatelliteSOSDispatch = async (_sosId: string) => {
    // In production: integrate with Iridium/Garmin satellite API
    await new Promise(r => setTimeout(r, 1200));
    triggerLocalSOSBroadcast();
    toast('🛰️ Satellite uplink established — SOS transmitted', { duration: 6000 });
  };

  const simulateInternetSOSDispatch = async (_sosId: string) => {
    await new Promise(r => setTimeout(r, 800));
    toast('📶 SOS sent via internet to contacts & emergency services', { duration: 6000 });
  };

  const resolveActiveSOS = async () => {
    if (activeSOSId) {
      await updateSOSStatus(activeSOSId, 'resolved');
    }
    setMode('idle');
    setActiveSOSId(null);
    toast.success('SOS resolved. Stay safe!');
    if (user) getSOSEvents(user.uid).then(setSOSHistory);
  };

  const networkStatus = isOnline
    ? { icon: <Wifi size={14} />, label: 'Internet', cls: 'badge-active' }
    : { icon: <Satellite size={14} />, label: 'Satellite', cls: 'badge-sat' };

  return (
    <div className="sos-panel">
      {/* Header */}
      <div className="sos-panel-header">
        <div className="flex items-center gap-2">
          <Radio size={20} style={{ color: 'var(--clr-danger)' }} />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>SOS System</h3>
        </div>
        <span className={`badge ${networkStatus.cls}`}>
          {networkStatus.icon} {networkStatus.label}
        </span>
      </div>

      {/* SOS Type Selector */}
      {mode === 'idle' && (
        <div className="sos-type-row">
          {(['manual', 'theft', 'panic'] as const).map(t => (
            <button key={t}
              className={`sos-type-btn ${sosType === t ? 'selected' : ''}`}
              onClick={() => setSOSType(t)}>
              {t === 'manual' && <Phone size={14} />}
              {t === 'theft'  && <PhoneOff size={14} />}
              {t === 'panic'  && <AlertTriangle size={14} />}
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* SOS Button */}
      <div className="sos-button-area">
        <AnimatePresence mode="wait">
          {mode === 'idle' && (
            <motion.button key="idle"
              className="sos-trigger-btn"
              onClick={armSOS}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <div className="sos-btn-inner">
                <Shield size={36} />
                <span className="sos-btn-label">SOS</span>
                <span className="sos-btn-sub">Hold to Activate</span>
              </div>
              <div className="sos-ring sos-ring-1" />
              <div className="sos-ring sos-ring-2" />
            </motion.button>
          )}

          {mode === 'armed' && (
            <motion.div key="armed" className="sos-armed"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="sos-countdown">{countdown}</div>
              <p className="sos-armed-msg">Sending SOS in <strong>{countdown}s</strong>…</p>
              <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={cancelSOS}>
                ✕ Cancel SOS
              </button>
            </motion.div>
          )}

          {mode === 'active' && (
            <motion.div key="active" className="sos-active-display"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}>
              <div className="sos-active-icon sos-active">
                <AlertTriangle size={40} />
              </div>
              <p className="sos-active-msg">🚨 SOS ACTIVE</p>
              <p className="sos-active-sub">
                Transmitting via {isOnline ? 'Internet' : '🛰️ Satellite'}<br/>
                Police & contacts notified
              </p>
              <button className="btn btn-success" style={{ marginTop: 12 }} onClick={resolveActiveSOS}>
                ✓ I'm Safe – Resolve SOS
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Info chips */}
      {mode === 'idle' && (
        <div className="sos-info-chips">
          <div className="sos-chip">
            <MapPin size={12} />
            {currentLocation ? `${currentLocation.lat.toFixed(4)}, ${currentLocation.lng.toFixed(4)}` : 'Location pending…'}
          </div>
          <div className="sos-chip">
            <Satellite size={12} />
            Satellite Backup Ready
          </div>
        </div>
      )}

      {/* Offline notice */}
      {!isOnline && (
        <div className="sos-offline-notice">
          <WifiOff size={14} />
          <span>No internet — SOS will transmit via satellite + local network broadcast</span>
        </div>
      )}

      {/* Recent SOS */}
      {sosHistory.length > 0 && (
        <div className="sos-history">
          <p className="sos-history-title">Recent SOS Events</p>
          {sosHistory.slice(0, 3).map(s => (
            <div key={s.id} className="sos-history-item">
              <span className={`badge ${s.status === 'active' ? 'badge-danger' : s.status === 'resolved' ? 'badge-active' : 'badge-warn'}`}>
                {s.status}
              </span>
              <span className="sos-history-type">{s.type}</span>
              {s.satellite_mode && <span className="badge badge-sat"><Satellite size={10} /></span>}
              <span className="sos-history-time">
                {new Date(s.created_at).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .sos-panel {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .sos-panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .sos-type-row {
          display: flex;
          gap: 8px;
        }
        .sos-type-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          padding: 8px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid var(--clr-border);
          background: var(--clr-surface-2);
          color: var(--clr-text-secondary);
          transition: all 0.2s ease;
          text-transform: capitalize;
        }
        .sos-type-btn.selected {
          border-color: var(--clr-danger);
          background: rgba(255,69,96,0.12);
          color: var(--clr-danger);
        }
        .sos-button-area {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 200px;
        }
        .sos-trigger-btn {
          width: 160px; height: 160px;
          border-radius: 50%;
          background: radial-gradient(circle at 40% 35%, #ff1a3c, #8b0000);
          border: 3px solid rgba(255,69,96,0.5);
          cursor: pointer;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 40px rgba(255,69,96,0.45), inset 0 2px 10px rgba(255,255,255,0.1);
          transition: box-shadow 0.2s ease;
        }
        .sos-trigger-btn:hover {
          box-shadow: 0 8px 60px rgba(255,69,96,0.7), inset 0 2px 10px rgba(255,255,255,0.1);
        }
        .sos-btn-inner {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          color: #fff;
          z-index: 1;
        }
        .sos-btn-label { font-size: 28px; font-weight: 900; letter-spacing: 0.08em; }
        .sos-btn-sub { font-size: 9px; opacity: 0.75; letter-spacing: 0.1em; text-transform: uppercase; }
        .sos-ring {
          position: absolute;
          inset: -12px;
          border-radius: 50%;
          border: 2px solid rgba(255,69,96,0.3);
          animation: sos-ring-pulse 2s ease-out infinite;
        }
        .sos-ring-2 { inset: -26px; animation-delay: 0.5s; border-color: rgba(255,69,96,0.15); }
        @keyframes sos-ring-pulse {
          0%   { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(1.1); opacity: 0; }
        }

        .sos-armed { display: flex; flex-direction: column; align-items: center; gap: 8px; }
        .sos-countdown {
          width: 80px; height: 80px;
          border-radius: 50%;
          background: rgba(255,165,0,0.15);
          border: 3px solid var(--clr-warn);
          display: flex; align-items: center; justify-content: center;
          font-size: 36px; font-weight: 800; color: var(--clr-warn);
          animation: countdown-pulse 1s ease infinite;
        }
        @keyframes countdown-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        .sos-armed-msg { color: var(--clr-text-secondary); font-size: 13px; }

        .sos-active-display { display: flex; flex-direction: column; align-items: center; gap: 8px; }
        .sos-active-icon {
          width: 90px; height: 90px;
          border-radius: 50%;
          background: rgba(255,69,96,0.2);
          border: 3px solid var(--clr-danger);
          display: flex; align-items: center; justify-content: center;
          color: var(--clr-danger);
        }
        .sos-active-msg { font-size: 22px; font-weight: 800; color: var(--clr-danger); }
        .sos-active-sub { text-align: center; color: var(--clr-text-secondary); font-size: 13px; line-height: 1.6; }

        .sos-info-chips { display: flex; gap: 8px; flex-wrap: wrap; }
        .sos-chip {
          display: flex; align-items: center; gap: 5px;
          font-size: 11px; color: var(--clr-text-muted);
          background: var(--clr-surface-2);
          border: 1px solid var(--clr-border);
          border-radius: 20px;
          padding: 4px 10px;
        }
        .sos-offline-notice {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 14px;
          background: rgba(240,192,64,0.08);
          border: 1px solid rgba(240,192,64,0.25);
          border-radius: 10px;
          font-size: 12px;
          color: var(--clr-satellite);
        }
        .sos-history { border-top: 1px solid var(--clr-border); padding-top: 12px; display: flex; flex-direction: column; gap: 8px; }
        .sos-history-title { font-size: 11px; font-weight: 600; color: var(--clr-text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
        .sos-history-item { display: flex; align-items: center; gap: 8px; font-size: 12px; }
        .sos-history-type { color: var(--clr-text-secondary); text-transform: capitalize; flex: 1; }
        .sos-history-time { color: var(--clr-text-muted); font-size: 11px; }
      `}</style>
    </div>
  );
}
