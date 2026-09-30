import { motion } from 'framer-motion';
import { 
  Smartphone, Battery, BatteryLow, Wifi, WifiOff, 
  Lock, Unlock, Cpu, Shield, AlertTriangle, CheckCircle2
} from 'lucide-react';
import type { Device } from '../lib/supabase';

interface DeviceCardProps {
  device: Device;
  onLockSIM: (deviceId: string, locked: boolean) => void;
  onRemoteWipe: (deviceId: string) => void;
  isSelected: boolean;
  onClick: () => void;
}

export default function DeviceCard({ device, onLockSIM, onRemoteWipe, isSelected, onClick }: DeviceCardProps) {
  const batteryColor =
    device.battery_level > 50 ? 'var(--clr-success)' :
    device.battery_level > 20 ? 'var(--clr-warn)' :
    'var(--clr-danger)';

  const lastSeenMs = Date.now() - new Date(device.last_seen).getTime();
  const isOnline = lastSeenMs < 5 * 60 * 1000; // within 5 minutes
  const lastSeenStr = lastSeenMs < 60000
    ? 'Just now'
    : lastSeenMs < 3600000
    ? `${Math.floor(lastSeenMs / 60000)}m ago`
    : `${Math.floor(lastSeenMs / 3600000)}h ago`;

  return (
    <motion.div
      className={`device-card glass-card ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      layout
    >
      {/* Status stripe */}
      <div className={`device-stripe ${isOnline ? 'online' : 'offline'}`} />

      {/* Header */}
      <div className="device-header">
        <div className="device-icon">
          <Smartphone size={22} />
          {!isOnline && (
            <div className="device-offline-dot" title="Offline" />
          )}
        </div>
        <div className="device-info">
          <h4 className="device-name">{device.device_name}</h4>
          <span className="device-model mono">{device.model || 'Unknown Model'}</span>
        </div>
        <span className={`badge ${isOnline ? 'badge-active' : 'badge-danger'}`}>
          <span className="pulse-dot" style={{ background: isOnline ? 'var(--clr-success)' : 'var(--clr-danger)' }} />
          {isOnline ? 'Online' : 'Offline'}
        </span>
      </div>

      {/* IMEI */}
      <div className="device-imei">
        <Cpu size={13} />
        <span className="mono">IMEI: {device.imei}</span>
      </div>

      {/* Stats row */}
      <div className="device-stats">
        {/* Battery */}
        <div className="device-stat">
          {device.battery_level <= 20 ? <BatteryLow size={15} style={{ color: batteryColor }} /> : <Battery size={15} style={{ color: batteryColor }} />}
          <div className="device-stat-bar">
            <div
              className="device-stat-fill"
              style={{ width: `${device.battery_level}%`, background: batteryColor }}
            />
          </div>
          <span style={{ color: batteryColor, fontSize: 12, fontWeight: 600 }}>{device.battery_level}%</span>
        </div>

        {/* Network */}
        <div className="device-stat">
          {isOnline ? <Wifi size={15} style={{ color: 'var(--clr-success)' }} /> : <WifiOff size={15} style={{ color: 'var(--clr-danger)' }} />}
          <span style={{ fontSize: 12, color: 'var(--clr-text-secondary)' }}>{lastSeenStr}</span>
        </div>

        {/* SIM Lock */}
        <div className="device-stat">
          {device.sim_locked
            ? <Lock size={15} style={{ color: 'var(--clr-warn)' }} />
            : <Unlock size={15} style={{ color: 'var(--clr-text-muted)' }} />
          }
          <span style={{ fontSize: 12, color: device.sim_locked ? 'var(--clr-warn)' : 'var(--clr-text-muted)' }}>
            SIM {device.sim_locked ? 'Locked' : 'Unlocked'}
          </span>
        </div>
      </div>

      {/* Device status pills */}
      <div className="device-pills">
        <span className={`badge ${device.is_active ? 'badge-active' : 'badge-danger'}`}>
          {device.is_active ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
          {device.is_active ? 'Protected' : 'Unprotected'}
        </span>
        {device.sim_locked && <span className="badge badge-warn"><Lock size={11} /> SIM Tray Locked</span>}
      </div>

      {/* Action buttons */}
      <div className="device-actions" onClick={e => e.stopPropagation()}>
        <button
          className={`btn ${device.sim_locked ? 'btn-ghost' : 'btn-primary'}`}
          style={{ flex: 1, fontSize: 12, padding: '8px 10px' }}
          onClick={() => onLockSIM(device.id, !device.sim_locked)}
        >
          {device.sim_locked ? <Unlock size={13} /> : <Lock size={13} />}
          {device.sim_locked ? 'Unlock SIM' : 'Lock SIM'}
        </button>
        <button
          className="btn btn-danger"
          style={{ flex: 1, fontSize: 12, padding: '8px 10px' }}
          onClick={() => onRemoteWipe(device.id)}
        >
          <Shield size={13} />
          Remote Wipe
        </button>
      </div>

      <style>{`
        .device-card {
          padding: 18px;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          gap: 12px;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .device-card.selected {
          border-color: rgba(0,212,255,0.4);
          box-shadow: 0 0 0 2px rgba(0,212,255,0.12), var(--glow-accent);
        }
        .device-stripe {
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 3px;
          border-radius: 3px 0 0 3px;
        }
        .device-stripe.online  { background: var(--clr-success); }
        .device-stripe.offline { background: var(--clr-danger); }
        .device-header { display: flex; align-items: center; gap: 12px; }
        .device-icon {
          width: 44px; height: 44px;
          border-radius: 12px;
          background: var(--clr-surface-3);
          display: flex; align-items: center; justify-content: center;
          color: var(--clr-accent);
          position: relative;
          flex-shrink: 0;
        }
        .device-offline-dot {
          position: absolute;
          top: -4px; right: -4px;
          width: 10px; height: 10px;
          border-radius: 50%;
          background: var(--clr-danger);
          border: 2px solid var(--clr-surface);
        }
        .device-info { flex: 1; min-width: 0; }
        .device-name { font-size: 15px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .device-model { font-size: 11px; color: var(--clr-text-muted); }
        .device-imei {
          display: flex; align-items: center; gap: 6px;
          font-size: 11px; color: var(--clr-text-muted);
          font-family: 'JetBrains Mono', monospace;
          padding: 6px 10px;
          background: var(--clr-surface-2);
          border-radius: 8px;
          border: 1px solid var(--clr-border);
        }
        .device-stats { display: flex; flex-direction: column; gap: 8px; }
        .device-stat { display: flex; align-items: center; gap: 8px; }
        .device-stat-bar {
          flex: 1;
          height: 4px;
          border-radius: 2px;
          background: var(--clr-surface-3);
          overflow: hidden;
        }
        .device-stat-fill { height: 100%; border-radius: 2px; transition: width 0.5s ease; }
        .device-pills { display: flex; gap: 6px; flex-wrap: wrap; }
        .device-actions { display: flex; gap: 8px; margin-top: 4px; }
      `}</style>
    </motion.div>
  );
}
