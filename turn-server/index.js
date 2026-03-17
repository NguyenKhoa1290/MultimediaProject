const Turn = require('node-turn');

const server = new Turn({
  // Cơ chế xác thực
  authMech: 'long-term',
  credentials: {
    "cachephoarong": "matkhau123" 
  },
  // Lắng nghe trên tất cả các địa chỉ IP của máy chủ
  listeningIps: ['0.0.0.0'],
  listeningPort: 3478,
  
  // IP thực tế của máy chủ để trung chuyển dữ liệu
  relayIps: ['103.166.182.59'],
  
  realm: 'cachephoarong.click',
  debugLevel: 'DEBUG' // Đổi lên DEBUG để soi lỗi kỹ hơn
});

server.start();

console.log('================================================');
console.log('🚀 TURN/STUN Server RECONFIGURED at port 3478');
console.log('Listening on: 0.0.0.0');
console.log('Relaying via: 103.166.182.59');
console.log('================================================');
