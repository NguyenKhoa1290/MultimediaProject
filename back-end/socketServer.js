
const io = require('./server').io;
const jwt = require('jsonwebtoken');
const linkSecret = "ijr2iq34rfeiadsfkjq3ew";
const db = require('./db');

// Quản lý người dùng online: { username: socketId }
const onlineUsers = {};

io.on('connection', socket => {
    console.log(socket.id, "has connected");

    // Khi một người dùng kết nối, họ gửi token để xác nhận danh tính
    const handshakeData = socket.handshake.auth.jwt;
    let decodedData;
    try {
        decodedData = jwt.verify(handshakeData, linkSecret);
        const { username } = decodedData;
        onlineUsers[username] = socket.id;
        console.log(`User ${username} is online`);
        
        // Gửi thông báo cho mọi người biết có người mới online
        io.emit('onlineUsersUpdate', Object.keys(onlineUsers));
    } catch (err) {
        console.log("Invalid token, disconnecting...");
        socket.disconnect();
        return;
    }

    // Logic: User A mời User B
    socket.on('inviteUser', ({ toUsername, fromUsername, roomName }) => {
        const toSocketId = onlineUsers[toUsername];
        if (toSocketId) {
            io.to(toSocketId).emit('receivedInvitation', { 
                fromUsername, 
                roomName,
                inviteToken: jwt.sign({ roomName, invitedBy: fromUsername }, linkSecret) 
            });
            console.log(`${fromUsername} invited ${toUsername} to ${roomName}`);

            db.run(`INSERT INTO call_history (caller_phone, receiver_phone, status) VALUES (?, ?, ?)`, [fromUsername, toUsername, 'connected'], (err) => {
                if (err) console.log("Lỗi khi lưu lịch sử cuộc gọi:", err.message);
            });
        }
    });

    // Bắn thông báo realtime khi có lời mời kết bạn mới
    socket.on('sendFriendRequest', ({ toUsername }) => {
        const toSocketId = onlineUsers[toUsername];
        if (toSocketId) {
            io.to(toSocketId).emit('newFriendRequest');
        }
    });

    // Bắn thông báo realtime khi bị hủy kết bạn
    socket.on('unfriend', ({ toUsername }) => {
        const toSocketId = onlineUsers[toUsername];
        if (toSocketId) {
            io.to(toSocketId).emit('friendRemoved');
        }
    });

    // Lấy danh sách online hiện tại
    socket.on('getOnlineUsers', () => {
        socket.emit('onlineUsersUpdate', Object.keys(onlineUsers));
    });

    // WebRTC Signaling (Như cũ, nhưng theo room)
    socket.on('joinRoom', (roomName) => {
        socket.join(roomName);
        console.log(socket.id, "joined room", roomName);
        socket.to(roomName).emit('peerJoined'); // Báo cho người kia biết mình đã vào phòng
    });

    socket.on('newOffer', ({ offer, roomName }) => {
        socket.to(roomName).emit('newOfferWaiting', offer);
    });

    socket.on('newAnswer', ({ answer, roomName }) => {
        socket.to(roomName).emit('answerToClient', answer);
    });

    socket.on('iceToServer', ({ iceC, roomName, who }) => {
        socket.to(roomName).emit('iceToClient', { iceC, who });
    });

    // Khi người dùng bấm nút Hang Up
    socket.on('endCall', ({ roomName }) => {
        socket.to(roomName).emit('callEnded');
    });

    // Khi người dùng ngắt kết nối (tắt tab, mất mạng...)
    socket.on('disconnecting', () => {
        // socket.rooms là một Set chứa các room mà socket đang tham gia
        // Bao gồm cả room mặc định là chính socket.id của nó
        for (const room of socket.rooms) {
            if (room !== socket.id) {
                // Nếu đây là phòng họp (room), báo cho người còn lại biết
                socket.to(room).emit('peerLeft');
                console.log(`Socket ${socket.id} left room ${room}`);
            }
        }
    });

    socket.on('disconnect', () => {
        for (const username in onlineUsers) {
            if (onlineUsers[username] === socket.id) {
                delete onlineUsers[username];
                console.log(`User ${username} is offline`);
                io.emit('onlineUsersUpdate', Object.keys(onlineUsers));
                break;
            }
        }
    });
});
