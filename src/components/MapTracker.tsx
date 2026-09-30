import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation, Clock, Satellite } from 'lucide-react';
import type { Location } from '../lib/supabase';

// Fix default leaflet icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const deviceIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:20px;height:20px;border-radius:50%;
    background:var(--clr-accent,#00d4ff);
    border:3px solid white;
    box-shadow:0 0 12px rgba(0,212,255,0.8);
    position:relative;
  ">
    <div style="
      position:absolute;inset:-6px;border-radius:50%;
      border:2px solid rgba(0,212,255,0.5);
      animation:pulse-ring 1.5s ease-out infinite;
    "></div>
  </div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const theftIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:24px;height:24px;border-radius:50%;
    background:#ff4560;border:3px solid white;
    box-shadow:0 0 16px rgba(255,69,96,0.9);
  "></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

function AutoCenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => { map.setView([lat, lng], map.getZoom()); }, [lat, lng, map]);
  return null;
}

interface MapTrackerProps {
  locations: Location[];
  latestLocation: Location | null;
  isTheftMode?: boolean;
  deviceName?: string;
}

export default function MapTracker({ locations, latestLocation, isTheftMode = false, deviceName = 'Device' }: MapTrackerProps) {
  const [showTrail, setShowTrail] = useState(true);
  const defaultCenter: [number, number] = latestLocation
    ? [latestLocation.latitude, latestLocation.longitude]
    : [28.6139, 77.209]; // Default: New Delhi

  const pathCoords: [number, number][] = locations.map(l => [l.latitude, l.longitude]);

  const formatTime = (ts: string) => new Date(ts).toLocaleTimeString();
  const formatDateTime = (ts: string) => new Date(ts).toLocaleString();

  return (
    <div className="map-tracker">
      {/* Map controls */}
      <div className="map-controls">
        <div className="flex items-center gap-2">
          <MapPin size={16} style={{ color: 'var(--clr-accent)' }} />
          <span style={{ fontSize: 14, fontWeight: 600 }}>{deviceName} — Live Tracking</span>
          {isTheftMode && (
            <span className="badge badge-danger" style={{ animation: 'pulse-ring 1s ease infinite' }}>
              ⚠ THEFT ALERT
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            className={`map-toggle ${showTrail ? 'active' : ''}`}
            onClick={() => setShowTrail(v => !v)}
          >
            <Navigation size={13} /> Trail {showTrail ? 'On' : 'Off'}
          </button>
          {latestLocation?.is_offline && (
            <span className="badge badge-sat"><Satellite size={11} /> Offline</span>
          )}
        </div>
      </div>

      {/* Map */}
      <div className="map-container-wrap">
        <MapContainer
          center={defaultCenter}
          zoom={14}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap'
          />

          {latestLocation && (
            <>
              <AutoCenter lat={latestLocation.latitude} lng={latestLocation.longitude} />
              <Marker
                position={[latestLocation.latitude, latestLocation.longitude]}
                icon={isTheftMode ? theftIcon : deviceIcon}
              >
                <Popup>
                  <div style={{ fontFamily: 'Inter, sans-serif', minWidth: 160 }}>
                    <strong>{deviceName}</strong><br />
                    <small>📍 {latestLocation.latitude.toFixed(6)}, {latestLocation.longitude.toFixed(6)}</small><br />
                    <small>🕒 {formatDateTime(latestLocation.timestamp)}</small><br />
                    {latestLocation.accuracy && <small>±{latestLocation.accuracy}m accuracy</small>}
                  </div>
                </Popup>
              </Marker>
              <Circle
                center={[latestLocation.latitude, latestLocation.longitude]}
                radius={latestLocation.accuracy || 50}
                pathOptions={{ color: isTheftMode ? '#ff4560' : '#00d4ff', fillOpacity: 0.08, weight: 1 }}
              />
            </>
          )}

          {showTrail && pathCoords.length > 1 && (
            <Polyline
              positions={pathCoords}
              pathOptions={{ color: isTheftMode ? '#ff4560' : '#00d4ff', weight: 2.5, opacity: 0.7, dashArray: '6 4' }}
            />
          )}
        </MapContainer>
      </div>

      {/* Stats row */}
      {latestLocation && (
        <div className="map-stats">
          <div className="map-stat">
            <Clock size={13} />
            <span>Last seen: {formatTime(latestLocation.timestamp)}</span>
          </div>
          <div className="map-stat">
            <MapPin size={13} />
            <span>{latestLocation.latitude.toFixed(5)}, {latestLocation.longitude.toFixed(5)}</span>
          </div>
          {latestLocation.accuracy && (
            <div className="map-stat">
              <Navigation size={13} />
              <span>±{latestLocation.accuracy}m</span>
            </div>
          )}
          <div className="map-stat">
            <span style={{ color: locations.length > 0 ? 'var(--clr-success)' : 'var(--clr-text-muted)' }}>
              {locations.length} points tracked
            </span>
          </div>
        </div>
      )}

      {!latestLocation && (
        <div className="map-no-data">
          <MapPin size={32} style={{ opacity: 0.3 }} />
          <p>No location data yet</p>
          <span>Waiting for device to report…</span>
        </div>
      )}

      <style>{`
        .map-tracker { display: flex; flex-direction: column; gap: 12px; height: 100%; }
        .map-controls {
          display: flex; align-items: center; justify-content: space-between;
          flex-wrap: wrap; gap: 8px;
        }
        .map-toggle {
          display: flex; align-items: center; gap: 5px;
          padding: 5px 12px;
          border-radius: 20px;
          font-size: 12px; font-weight: 500;
          cursor: pointer;
          border: 1px solid var(--clr-border);
          background: var(--clr-surface-2);
          color: var(--clr-text-secondary);
          transition: all 0.2s ease;
        }
        .map-toggle.active {
          border-color: var(--clr-accent);
          color: var(--clr-accent);
          background: rgba(0,212,255,0.08);
        }
        .map-container-wrap {
          border-radius: var(--radius-md);
          overflow: hidden;
          flex: 1;
          min-height: 320px;
          border: 1px solid var(--clr-border);
        }
        .map-stats {
          display: flex; gap: 16px; flex-wrap: wrap;
          padding: 10px 14px;
          background: var(--clr-surface-2);
          border-radius: var(--radius-md);
          border: 1px solid var(--clr-border);
        }
        .map-stat {
          display: flex; align-items: center; gap: 5px;
          font-size: 12px; color: var(--clr-text-secondary);
          font-family: 'JetBrains Mono', monospace;
        }
        .map-no-data {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 8px;
          padding: 40px;
          color: var(--clr-text-muted);
          text-align: center;
        }
        .map-no-data p { font-weight: 600; }
        .map-no-data span { font-size: 13px; }
      `}</style>
    </div>
  );
}
