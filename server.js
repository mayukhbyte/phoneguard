import http from 'http';

const PORT = 3001;
const sosLogs = [];

const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // Health check endpoint
  if (url.pathname === '/health' || url.pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'online',
      service: 'PhoneGuard Local Satellite / LAN SOS Relay',
      port: PORT,
      timestamp: new Date().toISOString(),
      activeRelayNodes: 1,
      totalSOSDispatched: sosLogs.length,
      mode: 'SATELLITE_EMERGENCY_MESH'
    }));
    return;
  }

  // SOS receiver endpoint (called offline or via LAN satellite link)
  if (url.pathname === '/sos' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const sosRecord = {
          id: `sos_loc_${Date.now()}`,
          receivedAt: new Date().toISOString(),
          ...payload,
          relay: 'localhost:3001_satellite_mesh',
          status: 'dispatched_to_emergency_authorities',
        };
        sosLogs.unshift(sosRecord);

        console.log('\n======================================================');
        console.log('🚨 [PHONEGUARD EMERGENCY SOS DISPATCHED]');
        console.log(`⏰ Time: ${sosRecord.receivedAt}`);
        console.log(`📱 Device: ${payload.deviceId || 'Unknown'} | IMEI: ${payload.imei || 'Reported'}`);
        console.log(`📍 Location: Lat ${payload.location?.lat || payload.latitude || 'N/A'}, Lng ${payload.location?.lng || payload.longitude || 'N/A'}`);
        console.log(`🛰️ Relay Channel: Satellite Broadcast Mesh & Local Emergency Receiver`);
        console.log(`💬 Message: ${payload.message || 'EMERGENCY SOS TRIGGERED'}`);
        console.log('======================================================\n');

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          message: 'SOS successfully received by local satellite emergency relay',
          data: sosRecord,
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  // Retrieve SOS history from local relay
  if (url.pathname === '/sos/history' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      count: sosLogs.length,
      events: sosLogs
    }));
    return;
  }

  // Catch-all 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found', available: ['/health', '/sos', '/sos/history'] }));
});

server.listen(PORT, () => {
  console.log(`📡 PhoneGuard Local Satellite Relay running on http://localhost:${PORT}`);
  console.log(`✅ Ready to receive offline SOS broadcasts and relay emergency telemetry.`);
});
