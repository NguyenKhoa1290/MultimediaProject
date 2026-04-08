const io = require('./server').io;
const jwt = require('jsonwebtoken');
const linkSecret = "ijr2iq34rfeiadsfkjq3ew";
const db = require('./db');

const onlineUsers = {};
const rooms = {};
const roomIPTV = {}; 
const hostLeaveTimeouts = {};
const closedRooms = new Set(); 

io.on('connection', socket => {
    console.log(socket.id, "has connected");

    const handshakeData = socket.handshake.auth.jwt;
    let decodedData;
    try {
        decodedData = jwt.verify(handshakeData, linkSecret);
        const { username } = decodedData;
        onlineUsers[username] = socket.id;
        io.emit('onlineUsersUpdate', Object.keys(onlineUsers));
    } catch (err) {
        socket.disconnect();
        return;
    }

    socket.on('inviteUser', ({ toUsername, fromUsername, roomName }) => {
        const toSocketId = onlineUsers[toUsername];
        if (toSocketId) {
            io.to(toSocketId).emit('receivedInvitation', { fromUsername, roomName });
        }
    });

    socket.on('getOnlineUsers', () => {
        socket.emit('onlineUsersUpdate', Object.keys(onlineUsers));
    });

    // MESH WEBRTC SIGNALING
    socket.on('joinRoom', ({ roomName, isInitiator }) => {
        if (closedRooms.has(roomName)) {
            socket.emit('roomExpired');
            return;
        }

        db.get(`SELECT type FROM group_messages WHERE content = ?`, [roomName], (err, row) => {
            if (row && row.type === 'meeting_ended') {
                closedRooms.add(roomName);
                socket.emit('roomExpired');
                return;
            }

            if (!rooms[roomName]) rooms[roomName] = [];

            let finalIsHost = false;
            const parts = roomName.split('-');
            
            if (isInitiator) {
                if (parts[0] === 'group') {
                    const groupId = parts[1];
                    db.get(`SELECT owner_email FROM groups WHERE id = ?`, [groupId], (errG, group) => {
                        finalIsHost = (group && String(group.owner_email) === String(decodedData.username));
                        proceedJoin(finalIsHost);
                    });
                    return; 
                } else if (parts[0] === 'room') {
                    finalIsHost = (parts[1] === String(decodedData.username));
                    proceedJoin(finalIsHost);
                    return;
                }
            }
            proceedJoin(false); 

            function proceedJoin(isActuallyHost) {
                const existingUserIndex = rooms[roomName].findIndex(u => u.username === decodedData.username);
                if (existingUserIndex !== -1) {
                    const oldUser = rooms[roomName][existingUserIndex];
                    socket.to(roomName).emit('peerLeft', { socketId: oldUser.socketId });
                    rooms[roomName].splice(existingUserIndex, 1);
                }

                if (hostLeaveTimeouts[roomName]) {
                    clearTimeout(hostLeaveTimeouts[roomName]);
                    delete hostLeaveTimeouts[roomName];
                }

                const newUser = {
                    socketId: socket.id,
                    username: decodedData.username,
                    fullName: decodedData.fullName,
                    isHost: isActuallyHost, 
                    audio: false,
                    video: false
                };
                
                socket.join(roomName);
                rooms[roomName].push(newUser);

                socket.emit('roomJoinedSuccess', { socketId: socket.id, isHost: isActuallyHost });
                socket.to(roomName).emit('peerJoined', newUser);
                
                const existingPeers = rooms[roomName].filter(u => u.socketId !== socket.id);
                socket.emit('existingPeers', existingPeers);

                if (roomIPTV[roomName]) {
                    socket.emit('iptvStarted', roomIPTV[roomName]);
                }
            }
        });
    });

    socket.on('newOffer', ({ offer, roomName, targetSocketId }) => {
        io.to(targetSocketId).emit('newOfferWaiting', { offer, fromSocketId: socket.id });
    });

    socket.on('newAnswer', ({ answer, roomName, targetSocketId }) => {
        io.to(targetSocketId).emit('answerToClient', { answer, fromSocketId: socket.id });
    });

    socket.on('iceToServer', ({ iceC, roomName, targetSocketId }) => {
        io.to(targetSocketId).emit('iceToClient', { iceC, fromSocketId: socket.id });
    });

    socket.on('mediaStatusChanged', ({ roomName, audio, video }) => {
        if (rooms[roomName]) {
            const user = rooms[roomName].find(u => u.socketId === socket.id);
            if (user) {
                user.audio = audio;
                user.video = video;
            }
        }
        socket.to(roomName).emit('peerMediaStatus', { socketId: socket.id, audio, video });
    });

    socket.on('mirrorStatusChanged', ({ roomName, isMirrored }) => {
        socket.to(roomName).emit('peerMirrorStatus', { socketId: socket.id, isMirrored });
    });

    socket.on('muteParticipant', ({ roomName, targetSocketId }) => {
        const user = rooms[roomName]?.find(u => u.socketId === socket.id);
        if (user && user.isHost) {
            io.to(targetSocketId).emit('forceMute');
        }
    });

    socket.on('endCall', ({ roomName }) => {
        const user = rooms[roomName]?.find(u => u.socketId === socket.id);
        if (user && user.isHost) {
            io.to(roomName).emit('callEnded');
            closedRooms.add(roomName);
            db.run(`UPDATE group_messages SET type = 'meeting_ended' WHERE content = ?`, [roomName], (err) => {
                const parts = roomName.split('-');
                if (parts.length >= 2) {
                    io.to(`group_${parts[1]}`).emit('groupListUpdated');
                    io.to(`group_${parts[1]}`).emit('meetingEnded', { roomName });
                }
            });
            delete rooms[roomName];
            delete roomIPTV[roomName];
        }
    });

    // --- IPTV SOCKET EVENTS ---
    socket.on('startIPTV', ({ roomName, channelName, channelUrl }) => {
        // Chỉ host mới được bật IPTV
        const user = rooms[roomName]?.find(u => u.socketId === socket.id);
        if (!user || !user.isHost) return;

        const iptvSocketId = `${socket.id}_iptv`;
        const iptvData = { 
            iptvSocketId, 
            ownerSocketId: socket.id, 
            channelName,
            channelUrl
        };
        roomIPTV[roomName] = iptvData;
        io.to(roomName).emit('iptvStarted', iptvData); // Gửi cho cả phòng để đồng bộ
    });

    socket.on('stopIPTV', ({ roomName }) => {
        // Chỉ host mới được tắt IPTV
        const user = rooms[roomName]?.find(u => u.socketId === socket.id);
        if (!user || !user.isHost) return;

        const iptvSocketId = `${socket.id}_iptv`;
        delete roomIPTV[roomName];
        io.to(roomName).emit('iptvStopped', { iptvSocketId }); // Gửi lệnh dọn dẹp cho cả phòng
    });

    socket.on('chatToServer', ({ message, fromFullName, roomName, type, fileUrl }) => {
        socket.to(roomName).emit('chatToClient', { message, fromFullName, type, fileUrl });
    });

    socket.on('joinGroupRooms', (groupIds) => {
        if (Array.isArray(groupIds)) {
            groupIds.forEach(id => socket.join(`group_${id}`));
        }
    });

    socket.on('sendGroupMessage', (msgData) => {
        const { groupId, senderEmail, content, type, fileUrl } = msgData;
        db.run(`INSERT INTO group_messages (group_id, sender_email, content, type, file_url) VALUES (?, ?, ?, ?, ?)`, 
        [groupId, senderEmail, content, type, fileUrl], function(err) {
            if (err) return;
            const query = `
                SELECT u.fullName, u.avatar, m.user_email 
                FROM users u 
                LEFT JOIN group_members m ON u.email = m.user_email AND m.group_id = ?
                WHERE u.email = ?
            `;
            db.get(query, [groupId, senderEmail], (err2, user) => {
                const isMember = user && user.user_email !== null;
                const fullMsg = {
                    id: this.lastID,
                    group_id: groupId,
                    sender_email: senderEmail,
                    content,
                    type,
                    file_url: fileUrl,
                    created_at: new Date().toISOString(),
                    senderName: isMember ? user.fullName : 'Người lạ',
                    senderAvatar: isMember ? user.avatar : null
                };
                io.to(`group_${groupId}`).emit('newGroupMessage', fullMsg);
            });
        });
    });

    socket.on('disconnecting', () => {
        for (const room of socket.rooms) {
            if (room !== socket.id && rooms[room]) {
                const leavingUser = rooms[room].find(u => u.socketId === socket.id);
                if (leavingUser) {
                    rooms[room] = rooms[room].filter(u => u.socketId !== socket.id);
                    socket.to(room).emit('peerLeft', { socketId: socket.id });

                    if (rooms[room].length === 0) {
                        hostLeaveTimeouts[room] = setTimeout(() => {
                            closedRooms.add(room);
                            db.run(`UPDATE group_messages SET type = 'meeting_ended' WHERE content = ? AND type = 'meeting'`, [room], (err) => {
                                const parts = room.split('-');
                                if (parts.length >= 2) {
                                    io.to(`group_${parts[1]}`).emit('meetingEnded', { roomName: room });
                                }
                            });
                            delete rooms[room];
                            delete roomIPTV[room];
                            delete hostLeaveTimeouts[room];
                        }, 5000);
                    }
                }
            }
        }
    });

    socket.on('disconnect', () => {
        for (const username in onlineUsers) {
            if (onlineUsers[username] === socket.id) {
                delete onlineUsers[username];
                io.emit('onlineUsersUpdate', Object.keys(onlineUsers));
                break;
            }
        }
    });
});
