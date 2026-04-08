const Turn = require('node-turn');

// Bản đồ lưu trữ thông tin lưu lượng
const sessionStats = new Map();

const server = new Turn({
  authMech: 'long-term',
  credentials: {
    "cachephoarong": "matkhau123" 
  },
  listeningIps: ['0.0.0.0'],
  listeningPort: 3478,
  relayIps: ['103.166.182.59'],
  realm: 'cachephoarong.click',
  debugLevel: 'INFO' 
});

// --- LOGIC THEO DÕI LƯU LƯỢNG ---

server.on('allocation', (allocation) => {
  // node-turn allocation object has id, address, username
  const id = allocation.id;
  const ip = allocation.address || 'Unknown-IP';
  
  sessionStats.set(id, { 
    ip: ip,
    username: allocation.username,
    bytes: 0, 
    active: true, 
    lastSeen: Date.now() 
  });
  
  console.log(`[NEW-SESSION] ID: ${id} | IP: ${ip} | User: ${allocation.username}`);
});

server.on('data', (bytes, allocation) => {
  const id = allocation.id;
  if (sessionStats.has(id)) {
    const stats = sessionStats.get(id);
    stats.bytes += bytes;
    stats.lastSeen = Date.now();
  }
});

server.on('deallocation', (allocation) => {
  const id = allocation.id;
  if (sessionStats.has(id)) {
    sessionStats.get(id).active = false;
    console.log(`[END-SESSION] ID: ${id} has closed.`);
  }
});

server.start();

// --- DASHBOARD LOGGING (Mỗi 10 giây hiện một lần) ---
setInterval(() => {
  if (sessionStats.size === 0) return;

  console.clear();
  console.log('========================================================================');
  console.log('🚀 TELELEGAL TURN MONITORING DASHBOARD - ' + new Date().toLocaleTimeString());
  console.log('========================================================================');
  console.log(`${'SESSION ID'.padEnd(12)} | ${'CLIENT IP'.padEnd(18)} | ${'TRAFFIC'.padEnd(12)} | ${'STATUS'}`);
  console.log('------------------------------------------------------------------------');

  sessionStats.forEach((stats, id) => {
    const mb = (stats.bytes / (1024 * 1024)).toFixed(2) + ' MB';
    const status = stats.active ? '🟢 LIVE' : '⚪ CLOSED';
    
    console.log(`${id.padEnd(12)} | ${stats.ip.padEnd(18)} | ${mb.padEnd(12)} | ${status}`);
    
    // Tự động xóa các session đã đóng quá 30 phút để sạch RAM
    if (!stats.active && (Date.now() - stats.lastSeen > 1800000)) {
      sessionStats.delete(id);
    }
  });
  console.log('========================================================================');
}, 10000);

console.log('🚀 TURN Server started. Dashboard active on port 3478');
