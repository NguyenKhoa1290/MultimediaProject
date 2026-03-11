const { app, serverIP } = require('./server');
const jwt = require('jsonwebtoken');
const linkSecret = "ijr2iq34rfeiadsfkjq3ew";
const db = require('./db');
const multer = require('multer');
const path = require('path');

// Cấu hình Multer để lưu ảnh vào thư mục public/avatars
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, 'public', 'avatars'))
    },
    filename: function (req, file, cb) {
        // Đặt tên file là số điện thoại + đuôi mở rộng
        cb(null, req.body.phone + path.extname(file.originalname))
    }
});
const upload = multer({ storage: storage });

// API Cập nhật Avatar
app.post('/upload-avatar', upload.single('avatar'), (req, res) => {
    const { phone } = req.body;
    if (!req.file) {
        return res.status(400).json({ success: false, message: "Không tìm thấy file" });
    }
    
    // Đường dẫn có thể truy cập qua HTTP
    const avatarUrl = `/avatars/${req.file.filename}`;
    
    db.run(`UPDATE users SET avatar = ? WHERE phone = ?`, [avatarUrl, phone], function(err) {
        if (err) return res.status(500).json({ success: false, message: "Lỗi lưu database" });
        res.json({ success: true, avatarUrl });
    });
});

// API Đăng ký
app.post('/register', (req, res) => {
    const { phone, fullName, password } = req.body;
    
    if (!phone || !fullName || !password) {
        return res.status(400).json({ success: false, message: "Vui lòng điền đầy đủ thông tin" });
    }

    db.run(`INSERT INTO users (phone, fullName, password) VALUES (?, ?, ?)`, [phone, fullName, password], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ success: false, message: "Số điện thoại này đã được đăng ký" });
            }
            return res.status(500).json({ success: false, message: "Lỗi hệ thống" });
        }
        res.json({ success: true, message: "Đăng ký thành công" });
    });
});

// API Đăng nhập
app.post('/login', (req, res) => {
    const { phone, password } = req.body; // Dùng phone thay vì username

    db.get(`SELECT * FROM users WHERE phone = ? AND password = ?`, [phone, password], (err, user) => {
        if (err) {
            return res.status(500).json({ success: false, message: "Lỗi hệ thống" });
        }
        
        if (user) {
            const token = jwt.sign({ username: user.phone, fullName: user.fullName }, linkSecret);
            res.json({ success: true, token, user: { username: user.phone, fullName: user.fullName, avatar: user.avatar } });
        } else {
            res.status(401).json({ success: false, message: "Sai số điện thoại hoặc mật khẩu" });
        }
    });
});

// API Tìm kiếm người dùng bằng số điện thoại
app.get('/search-user/:phone', (req, res) => {
    const searchPhone = req.params.phone;
    db.get(`SELECT phone as username, fullName, avatar FROM users WHERE phone = ?`, [searchPhone], (err, user) => {
        if (err) return res.status(500).json({ success: false, message: "Lỗi hệ thống" });
        if (user) {
            res.json({ success: true, user });
        } else {
            res.json({ success: false, message: "Không tìm thấy người dùng" });
        }
    });
});

// API Gửi lời mời kết bạn
app.post('/friend-request', (req, res) => {
    const { senderPhone, receiverPhone } = req.body;
    if (senderPhone === receiverPhone) return res.status(400).json({ success: false, message: "Không thể tự kết bạn" });

    db.run(`INSERT INTO friend_requests (sender_phone, receiver_phone) VALUES (?, ?)`, [senderPhone, receiverPhone], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ success: false, message: "Đã gửi lời mời trước đó" });
            }
            return res.status(500).json({ success: false, message: "Lỗi hệ thống" });
        }
        res.json({ success: true, message: "Đã gửi lời mời" });
    });
});

// API Lấy danh sách lời mời (Hòm thư)
app.get('/friend-requests/:phone', (req, res) => {
    const phone = req.params.phone;
    const query = `
        SELECT fr.id, fr.sender_phone, u.fullName as senderName, u.avatar as senderAvatar
        FROM friend_requests fr 
        JOIN users u ON fr.sender_phone = u.phone 
        WHERE fr.receiver_phone = ? AND fr.status = 'pending'
    `;
    db.all(query, [phone], (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: "Lỗi hệ thống" });
        res.json(rows);
    });
});

// API Phản hồi lời mời (Đồng ý / Từ chối)
app.post('/friend-request/respond', (req, res) => {
    const { requestId, senderPhone, receiverPhone, action } = req.body; // action = 'accept' or 'reject'
    
    if (action === 'accept') {
        db.serialize(() => {
            db.run(`UPDATE friend_requests SET status = 'accepted' WHERE id = ?`, [requestId]);
            // Thêm vào bảng friends (2 chiều)
            db.run(`INSERT OR IGNORE INTO friends (user_phone, friend_phone) VALUES (?, ?)`, [senderPhone, receiverPhone]);
            db.run(`INSERT OR IGNORE INTO friends (user_phone, friend_phone) VALUES (?, ?)`, [receiverPhone, senderPhone]);
            res.json({ success: true, message: "Đã đồng ý kết bạn" });
        });
    } else {
        db.run(`UPDATE friend_requests SET status = 'rejected' WHERE id = ?`, [requestId]);
        res.json({ success: true, message: "Đã từ chối kết bạn" });
    }
});

// API lấy danh sách bạn bè thay vì lấy toàn bộ users
app.get('/friends/:phone', (req, res) => {
    const phone = req.params.phone;
    const query = `
        SELECT u.phone as username, u.fullName, u.avatar 
        FROM friends f
        JOIN users u ON f.friend_phone = u.phone
        WHERE f.user_phone = ?
    `;
    db.all(query, [phone], (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: "Lỗi hệ thống" });
        res.json(rows);
    });
});

// API Lịch sử cuộc gọi
app.get('/call-history/:phone', (req, res) => {
    const phone = req.params.phone;
    const query = `
        SELECT ch.id, ch.caller_phone, ch.receiver_phone, ch.call_time, ch.status,
               CASE WHEN ch.caller_phone = ? THEN u_receiver.fullName ELSE u_caller.fullName END as other_person_name,
               CASE WHEN ch.caller_phone = ? THEN 'outgoing' ELSE 'incoming' END as type
        FROM call_history ch
        LEFT JOIN users u_caller ON ch.caller_phone = u_caller.phone
        LEFT JOIN users u_receiver ON ch.receiver_phone = u_receiver.phone
        WHERE ch.caller_phone = ? OR ch.receiver_phone = ?
        ORDER BY ch.call_time DESC
    `;
    db.all(query, [phone, phone, phone, phone], (err, rows) => {
        if (err) return res.status(500).json({ success: false, message: "Lỗi hệ thống" });
        res.json(rows);
    });
});

// API Xóa kết bạn (Unfriend)
app.post('/remove-friend', (req, res) => {
    const { userPhone, friendPhone } = req.body;
    
    db.serialize(() => {
        // Xóa chiều từ user -> friend
        db.run(`DELETE FROM friends WHERE user_phone = ? AND friend_phone = ?`, [userPhone, friendPhone]);
        // Xóa chiều từ friend -> user
        db.run(`DELETE FROM friends WHERE user_phone = ? AND friend_phone = ?`, [friendPhone, userPhone]);
        
        res.json({ success: true, message: "Đã hủy kết bạn" });
    });
});

app.post('/validate-link', (req, res) => {
    const token = req.body.token;
    try {
        const decodedData = jwt.verify(token, linkSecret);
        res.json(decodedData);
    } catch(err) {
        res.status(401).json({ message: "Invalid token" });
    }
});