// Supabase Configuration & Data Layer
import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL || '';
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    rawUrl &&
    rawKey &&
    !rawUrl.includes('YOUR_PROJECT') &&
    !rawUrl.includes('your_project') &&
    !rawKey.includes('your_anon_key')
  );
};

// Safe fallback URL to prevent createClient crashes before credentials are supplied
const supabaseUrl = isSupabaseConfigured() ? rawUrl : 'https://placeholder-project.supabase.co';
const supabaseAnonKey = isSupabaseConfigured() ? rawKey : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database Types
export interface Device {
  id: string;
  user_id: string;
  imei: string;
  device_name: string;
  model: string;
  is_active: boolean;
  sim_locked: boolean;
  battery_level: number;
  last_seen: string;
  created_at: string;
}

export interface Location {
  id: string;
  device_id: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number;
  speed?: number;
  timestamp: string;
  is_offline: boolean;
}

export interface TrustedContact {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  email: string;
  relation: string;
  is_primary: boolean;
  receive_sos: boolean;
  receive_location: boolean;
  created_at: string;
}

export interface Alert {
  id: string;
  device_id: string;
  user_id: string;
  type: 'theft' | 'sos' | 'offline' | 'sim_removed' | 'low_battery';
  message: string;
  location_lat?: number;
  location_lng?: number;
  is_resolved: boolean;
  resolved_at?: string;
  created_at: string;
}

export interface SOSEvent {
  id: string;
  user_id: string;
  device_id: string;
  type: 'manual' | 'theft' | 'panic';
  status: 'active' | 'acknowledged' | 'resolved';
  message: string;
  location_lat?: number;
  location_lng?: number;
  notified_police: boolean;
  notified_contacts: boolean;
  satellite_mode: boolean;
  created_at: string;
}

// Test live database connectivity
export async function testSupabaseConnection(): Promise<{ ok: boolean; message: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: 'Supabase credentials are not configured in .env.local' };
  }
  try {
    const { error } = await supabase.from('devices').select('id').limit(1);
    if (error) {
      if (error.code === '42P01') {
        return { ok: false, message: 'Connected to Supabase, but tables are missing. Please run the SQL schema.' };
      }
      return { ok: false, message: `Database error: ${error.message}` };
    }
    return { ok: true, message: 'Successfully connected to Supabase database!' };
  } catch (err: any) {
    return { ok: false, message: err?.message || 'Failed to reach Supabase' };
  }
}

// Seed initial database demo records
export async function seedDemoData(userId: string) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured.');
  }

  // 1. Device
  const { data: dev, error: devErr } = await supabase
    .from('devices')
    .upsert({
      user_id: userId,
      imei: '352001234567890',
      device_name: 'Samsung Galaxy S24 Ultra',
      model: 'SM-S928B',
      is_active: true,
      sim_locked: false,
      battery_level: 84,
      last_seen: new Date().toISOString(),
    }, { onConflict: 'imei' })
    .select()
    .single();

  if (devErr) throw devErr;

  // 2. Locations
  if (dev?.id) {
    await supabase.from('locations').insert([
      { device_id: dev.id, latitude: 35.6762, longitude: 139.6503, accuracy: 20, is_offline: false },
      { device_id: dev.id, latitude: 35.6770, longitude: 139.6515, accuracy: 18, is_offline: false },
      { device_id: dev.id, latitude: 35.6780, longitude: 139.6525, accuracy: 12, is_offline: false },
    ]);
  }

  // 3. Contacts
  await supabase.from('trusted_contacts').insert([
    {
      user_id: userId,
      name: 'Mom (Emergency Contact)',
      phone: '+91 98765 43210',
      email: 'emergency.contact@family.net',
      relation: 'Family',
      is_primary: true,
      receive_sos: true,
      receive_location: true,
    },
    {
      user_id: userId,
      name: 'Guardian / Trusted Friend',
      phone: '+91 87654 32109',
      email: 'trusted@friend.org',
      relation: 'Friend',
      is_primary: false,
      receive_sos: true,
      receive_location: true,
    }
  ]);

  // 4. Alert
  if (dev?.id) {
    await supabase.from('alerts').insert([
      {
        device_id: dev.id,
        user_id: userId,
        type: 'theft',
        message: 'Security Alert: Sudden phone shutdown detected. Emergency location & IMEI dispatched.',
        location_lat: 28.6139,
        location_lng: 77.2090,
        is_resolved: false,
      }
    ]);
  }

  return true;
}

// Ready-to-run Supabase SQL script
export const SUPABASE_SCHEMA_SQL = `-- Run this in Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

-- 1. Create Devices Table
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

-- 2. Create Locations Table
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

-- 3. Create Trusted Contacts Table
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

-- 4. Create Alerts Table
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

-- 5. Create SOS Events Table
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

-- 6. Enable Row Level Security (RLS)
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE trusted_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sos_events ENABLE ROW LEVEL SECURITY;

-- 7. Public Read & Write Policies for PhoneGuard client access
DROP POLICY IF EXISTS "Public access devices" ON devices;
CREATE POLICY "Public access devices" ON devices FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access locations" ON locations;
CREATE POLICY "Public access locations" ON locations FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access contacts" ON trusted_contacts;
CREATE POLICY "Public access contacts" ON trusted_contacts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access alerts" ON alerts;
CREATE POLICY "Public access alerts" ON alerts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access sos_events" ON sos_events;
CREATE POLICY "Public access sos_events" ON sos_events FOR ALL USING (true) WITH CHECK (true);
`;
