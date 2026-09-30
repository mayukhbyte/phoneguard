# 🛡️ PhoneGuard — Anti-Theft Security & Emergency SOS System

**PhoneGuard** is an advanced anti-theft phone security and emergency telemetry dashboard designed to protect mobile devices from snatching, unauthorized power-offs, and SIM tampering.

---

## ⚡ Core Features

- **🚨 Automatic Snatch & Theft Detection**: If the device is abruptly powered off or disconnected, an emergency broadcast packet with the phone's **15-digit IMEI**, **live GPS coordinates**, and **battery status** is immediately dispatched.
- **🔒 Remote SIM Tray Lock**: Automatic or one-click remote electronic locking of the SIM card tray to prevent physical SIM removal and identity theft.
- **🛰️ Satellite & Offline Local SOS (Port 3001)**: When cellular and Wi-Fi networks are severed, PhoneGuard falls back to an ad-hoc local network broadcast and satellite mesh relay (`http://localhost:3001/sos`).
- **📍 Real-Time GPS Tracking & Breadcrumbs**: Live interactive dark map (Leaflet) with breadcrumb trails, GPS accuracy radius, and high-visibility Theft Mode tracking.
- **👥 Trusted Emergency Contacts**: Manage primary and secondary contacts who receive emergency SMS alerts with IMEI and live location tracking links.
- **🔐 Biometric & PIN Security**: Dual-layer security featuring biometric authentication (WebAuthn) and a 4-to-6 digit PIN keypad.
- **☁️ Supabase & Firebase Integration**: Full CRUD and WebSocket realtime subscriptions powered by Supabase PostgreSQL and Firebase Authentication.

---

## 🏗️ Architecture

```
[ Mobile Device / Client ]
       │
       ├─ (Online Mode)   ──> [ Firebase Auth ] (User Privacy)
       │                  ──> [ Supabase PostgreSQL ] (Devices, Alerts, GPS Breadcrumbs)
       │
       └─ (Offline Mode)  ──> [ Localhost Relay (Port 3001) ] (Satellite / Mesh Fallback)
```

---

## 🚀 Quick Start

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/mayukhbyte/phoneguard.git
cd phoneguard
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Fill in your Firebase and Supabase credentials in `.env.local`:
```ini
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

VITE_SUPABASE_URL=https://your_project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### 3. Start the Application
In terminal 1 (Localhost Satellite SOS Relay):
```bash
npm run server
```

In terminal 2 (Vite Frontend):
```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🗄️ Supabase SQL Database Schema

Run this in your **Supabase SQL Editor**:

```sql
-- Devices
CREATE TABLE IF NOT EXISTS devices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  imei TEXT NOT NULL UNIQUE,
  device_name TEXT NOT NULL,
  model TEXT,
  is_active BOOLEAN DEFAULT true,
  sim_locked BOOLEAN DEFAULT false,
  battery_level INTEGER DEFAULT 100,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Locations
CREATE TABLE IF NOT EXISTS locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy DECIMAL(6, 2),
  altitude DECIMAL(8, 2),
  speed DECIMAL(6, 2),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  is_offline BOOLEAN DEFAULT false
);

-- Trusted Contacts
CREATE TABLE IF NOT EXISTS trusted_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  relation TEXT,
  is_primary BOOLEAN DEFAULT false,
  receive_sos BOOLEAN DEFAULT true,
  receive_location BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alerts
CREATE TABLE IF NOT EXISTS alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SOS Events
CREATE TABLE IF NOT EXISTS sos_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  device_id UUID,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  message TEXT,
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  notified_police BOOLEAN DEFAULT false,
  notified_contacts BOOLEAN DEFAULT false,
  satellite_mode BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security & Policies
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE trusted_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sos_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access devices" ON devices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access locations" ON locations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access contacts" ON trusted_contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access alerts" ON alerts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public access sos_events" ON sos_events FOR ALL USING (true) WITH CHECK (true);
```

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Vanilla CSS (Curated Deep Navy / Indigo / Violet Design System)
- **Map & Geolocation**: Leaflet, React-Leaflet
- **Animations**: Framer Motion
- **Database & Realtime**: Supabase (PostgreSQL, Realtime WebSockets)
- **Authentication**: Firebase Authentication + PIN & Biometrics (WebAuthn)
- **Local Satellite Relay**: Node.js HTTP Server (`server.js`)
