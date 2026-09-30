import { supabase, type Device, type Location, type TrustedContact, type Alert, type SOSEvent, isSupabaseConfigured } from './supabase';

// ---- Devices ----
export async function getUserDevices(userId: string): Promise<Device[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabase
    .from('devices')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function updateDevice(deviceId: string, updates: Partial<Device>) {
  if (!isSupabaseConfigured()) return updates;
  const { data, error } = await supabase
    .from('devices')
    .update(updates)
    .eq('id', deviceId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createDevice(device: Omit<Device, 'id' | 'created_at'> & { id?: string }) {
  if (!isSupabaseConfigured()) return { id: `dev-${Date.now()}`, created_at: new Date().toISOString(), ...device };
  const { data, error } = await supabase.from('devices').insert(device).select().single();
  if (error) throw error;
  return data;
}

// ---- Locations ----
export async function getLatestLocation(deviceId: string): Promise<Location | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('device_id', deviceId)
    .order('timestamp', { ascending: false })
    .limit(1)
    .single();
  if (error) return null;
  return data;
}

export async function getLocationHistory(deviceId: string, hours = 24): Promise<Location[]> {
  if (!isSupabaseConfigured()) return [];
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('device_id', deviceId)
    .gte('timestamp', since)
    .order('timestamp', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function addLocation(location: Omit<Location, 'id'> & { id?: string }) {
  if (!isSupabaseConfigured()) return { id: `loc-${Date.now()}`, ...location };
  const { data, error } = await supabase.from('locations').insert(location).select().single();
  if (error) throw error;
  return data;
}

// ---- Trusted Contacts ----
export async function getTrustedContacts(userId: string): Promise<TrustedContact[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabase
    .from('trusted_contacts')
    .select('*')
    .eq('user_id', userId)
    .order('is_primary', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createContact(contact: Omit<TrustedContact, 'id' | 'created_at'> & { id?: string }) {
  if (!isSupabaseConfigured()) return { id: `c-${Date.now()}`, created_at: new Date().toISOString(), ...contact };
  const { data, error } = await supabase
    .from('trusted_contacts')
    .insert(contact)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteContact(contactId: string) {
  if (!isSupabaseConfigured()) return;
  const { error } = await supabase.from('trusted_contacts').delete().eq('id', contactId);
  if (error) throw error;
}

export async function updateContact(contactId: string, updates: Partial<TrustedContact>) {
  if (!isSupabaseConfigured()) return updates;
  const { data, error } = await supabase
    .from('trusted_contacts')
    .update(updates)
    .eq('id', contactId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---- Alerts ----
export async function getAlerts(userId: string): Promise<Alert[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
}

export async function resolveAlert(alertId: string) {
  if (!isSupabaseConfigured()) return { id: alertId, is_resolved: true };
  const { data, error } = await supabase
    .from('alerts')
    .update({ is_resolved: true, resolved_at: new Date().toISOString() })
    .eq('id', alertId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createAlert(alert: Omit<Alert, 'id' | 'created_at'> & { id?: string }) {
  if (!isSupabaseConfigured()) return { id: `a-${Date.now()}`, created_at: new Date().toISOString(), ...alert };
  const { data, error } = await supabase.from('alerts').insert(alert).select().single();
  if (error) throw error;
  return data;
}

// ---- SOS Events ----
export async function createSOSEvent(sos: Omit<SOSEvent, 'id' | 'created_at'> & { id?: string }) {
  if (!isSupabaseConfigured()) return { id: `sos-${Date.now()}`, created_at: new Date().toISOString(), ...sos };
  const { data, error } = await supabase.from('sos_events').insert(sos).select().single();
  if (error) throw error;
  return data;
}

export async function getSOSEvents(userId: string): Promise<SOSEvent[]> {
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabase
    .from('sos_events')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data || [];
}

export async function updateSOSStatus(
  sosId: string,
  status: 'active' | 'acknowledged' | 'resolved',
) {
  if (!isSupabaseConfigured()) return { id: sosId, status };
  const { data, error } = await supabase
    .from('sos_events')
    .update({ status })
    .eq('id', sosId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---- Real-time Subscriptions ----
export function subscribeToAlerts(userId: string, callback: (alert: Alert) => void) {
  if (!isSupabaseConfigured()) return { unsubscribe: () => {} };
  return supabase
    .channel('alerts-channel')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'alerts', filter: `user_id=eq.${userId}` },
      (payload) => callback(payload.new as Alert),
    )
    .subscribe();
}

export function subscribeToDeviceLocations(
  deviceId: string,
  callback: (location: Location) => void,
) {
  if (!isSupabaseConfigured()) return { unsubscribe: () => {} };
  return supabase
    .channel('locations-channel')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'locations',
        filter: `device_id=eq.${deviceId}`,
      },
      (payload) => callback(payload.new as Location),
    )
    .subscribe();
}
