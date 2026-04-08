const { app } = require('./server');
const jwt = require('jsonwebtoken');
const linkSecret = "ijr2iq34rfeiadsfkjq3ew";
const db = require('./db');
const multer = require('multer');
const path = require('path');
const nodemailer = require('nodemailer');
const axios = require('axios');

// --- API PROXY FETCH ---
app.get('/proxy-fetch', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).send("URL is required");
    try {
        const response = await axios.get(url, { timeout: 15000 });
        res.send(response.data);
    } catch (error) {
        res.status(500).json({ success: false, message: "Không thể tải link này" });
    }
});

// --- IPTV LINK LIBRARY API ---
app.get('/iptv-links', (req, res) => {
    db.all(`SELECT * FROM iptv_links ORDER BY created_at DESC`, [], (err, rows) => {
        res.json(rows || []);
    });
});

app.post('/iptv-links', (req, res) => {
    const { url, name } = req.body;
    db.run(`INSERT OR IGNORE INTO iptv_links (url, name) VALUES (?, ?)`, [url, name], function(err) {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true, id: this.lastID });
    });
});

app.delete('/iptv-links/:id', (req, res) => {
    db.run(`DELETE FROM iptv_links WHERE id = ?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true });
    });
});

// Cấu hình gửi Mail (Dùng Host/Port chính xác cho Gmail)
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: 'trungnt.pro.99@gmail.com',
        pass: 'zihm xksq jmsy xsvz'
    }
});

transporter.verify((error, success) => {
    if (error) console.error("Lỗi cấu hình Email:", error);
    else console.log("Hệ thống Email đã sẵn sàng.");
});

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, 'public', 'avatars')),
    filename: (req, file, cb) => cb(null, req.body.email.replace(/[@.]/g, '_') + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

app.post('/upload-avatar', upload.single('avatar'), (req, res) => {
    const { email } = req.body;
    if (!req.file) return res.status(400).json({ success: false, message: "Không tìm thấy file" });
    const avatarUrl = `/avatars/${req.file.filename}`;
    db.run(`UPDATE users SET avatar = ? WHERE email = ?`, [avatarUrl, email], (err) => {
        if (err) return res.status(500).json({ success: false });
        res.json({ success: true, avatarUrl });
    });
});

app.post('/register', (req, res) => {
    const { email, fullName, password } = req.body;
    if (!email || !fullName || !password) return res.status(400).json({ success: false, message: "Vui lòng điền đủ thông tin" });
    
    db.get(`SELECT id FROM users WHERE email = ? AND is_verified = 1`, [email], (err, user) => {
        if (err) return res.status(500).json({ success: false, message: "Lỗi cơ sở dữ liệu" });
        if (user) return res.status(400).json({ success: false, message: "Email này đã được đăng ký" });

        const otp = generateOTP();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        db.run(`INSERT INTO email_verification (email, otp, expires_at) VALUES (?, ?, ?)`, [email, otp, expiresAt.toISOString()], function(err2) {
            if (err2) return res.status(500).json({ success: false, message: "Lỗi tạo mã xác thực" });

            const mailOptions = {
                from: '"TeleLegal Support" <trungnt.pro.99@gmail.com>',
                to: email,
                subject: 'Mã xác thực đăng ký TeleLegal',
                html: `<div style="padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                        <h3>Chào ${fullName},</h3>
                        <p>Mã OTP của bạn là: <b style="color: #007bff; font-size: 24px;">${otp}</b></p>
                        <p>Mã có hiệu lực trong 10 phút. Không chia sẻ mã này với bất kỳ ai.</p>
                       </div>`
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) return res.status(500).json({ success: false, message: "Không thể gửi email OTP." });
                db.run(`INSERT OR IGNORE INTO users (email, fullName, password, is_verified) VALUES (?, ?, ?, 0)`, [email, fullName, password], (err3) => {
                    res.json({ success: true, message: "Mã OTP đã được gửi thành công!" });
                });
            });
        });
    });
});

app.post('/verify-otp', (req, res) => {
    const { email, otp } = req.body;
    db.get(`SELECT * FROM email_verification WHERE email = ? AND otp = ? ORDER BY created_at DESC LIMIT 1`, [email, otp], (err, row) => {
        if (!row) return res.status(400).json({ success: false, message: "Mã OTP không chính xác" });
        if (new Date() > new Date(row.expires_at)) return res.status(400).json({ success: false, message: "Mã OTP đã hết hạn" });
        db.run(`UPDATE users SET is_verified = 1 WHERE email = ?`, [email], (err2) => {
            db.run(`DELETE FROM email_verification WHERE email = ?`, [email]);
            res.json({ success: true, message: "Xác thực thành công!" });
        });
    });
});

app.post('/login', (req, res) => {
    const { email, password, rememberMe } = req.body; 
    db.get(`SELECT * FROM users WHERE email = ? AND password = ? AND is_verified = 1`, [email, password], (err, user) => {
        if (err || !user) return res.status(401).json({ success: false, message: "Sai tài khoản hoặc mật khẩu" });
        const expiresIn = rememberMe ? '60d' : '2h';
        const maxAge = rememberMe ? 60 * 24 * 60 * 60 * 1000 : 2 * 60 * 60 * 1000;
        const token = jwt.sign({ username: user.email, fullName: user.fullName }, linkSecret, { expiresIn });
        res.cookie('token', token, { httpOnly: true, secure: true, sameSite: 'none', maxAge: maxAge, path: '/' });
        res.json({ success: true, token, user: { username: user.email, fullName: user.fullName, avatar: user.avatar } });
    });
});

app.post('/validate-link', (req, res) => {
    const token = req.cookies.token || req.body.token;
    if (!token) return res.status(401).json({ success: false });
    try {
        const decodedData = jwt.verify(token, linkSecret);
        res.json({ success: true, ...decodedData });
    } catch(err) { res.status(401).json({ success: false }); }
});

app.get('/search-user/:email', (req, res) => {
    db.get(`SELECT email as username, fullName, avatar FROM users WHERE email = ? AND is_verified = 1`, [req.params.email], (err, user) => {
        if (user) res.json({ success: true, user });
        else res.json({ success: false });
    });
});

app.post('/friend-request', (req, res) => {
    db.run(`INSERT INTO friend_requests (sender_email, receiver_email) VALUES (?, ?)`, [req.body.senderPhone, req.body.receiverPhone], () => res.json({ success: true }));
});

app.get('/friend-requests/:email', (req, res) => {
    db.all(`SELECT fr.id, fr.sender_email as sender_phone, u.fullName as senderName, u.avatar as senderAvatar FROM friend_requests fr JOIN users u ON fr.sender_email = u.email WHERE fr.receiver_email = ? AND fr.status = 'pending'`, [req.params.email], (err, rows) => res.json(rows || []));
});

app.post('/friend-request/respond', (req, res) => {
    const { requestId, senderPhone, receiverPhone, action } = req.body;
    if (action === 'accept') {
        db.serialize(() => {
            db.run(`UPDATE friend_requests SET status = 'accepted' WHERE id = ?`, [requestId]);
            db.run(`INSERT OR IGNORE INTO friends (user_email, friend_email) VALUES (?, ?)`, [senderPhone, receiverPhone]);
            db.run(`INSERT OR IGNORE INTO friends (user_email, friend_email) VALUES (?, ?)`, [receiverPhone, senderPhone]);
            res.json({ success: true });
        });
    } else {
        db.run(`UPDATE friend_requests SET status = 'rejected' WHERE id = ?`, [requestId]);
        res.json({ success: true });
    }
});

app.get('/friends/:email', (req, res) => {
    db.all(`SELECT u.email as username, u.fullName, u.avatar FROM friends f JOIN users u ON f.friend_email = u.email WHERE f.user_email = ?`, [req.params.email], (err, rows) => res.json(rows || []));
});

app.post('/remove-friend', (req, res) => {
    db.serialize(() => {
        db.run(`DELETE FROM friends WHERE user_email = ? AND friend_email = ?`, [req.body.userPhone, req.body.friendPhone]);
        db.run(`DELETE FROM friends WHERE user_email = ? AND friend_email = ?`, [req.body.friendPhone, req.body.userPhone]);
        res.json({ success: true });
    });
});

// GROUPS
app.post('/groups', (req, res) => {
    db.run(`INSERT INTO groups (name, owner_email) VALUES (?, ?)`, [req.body.name, req.body.ownerPhone], function() {
        const groupId = this.lastID;
        db.run(`INSERT INTO group_members (group_id, user_email) VALUES (?, ?)`, [groupId, req.body.ownerPhone], () => res.json({ success: true, groupId }));
    });
});

app.get('/groups/user/:email', (req, res) => {
    db.all(`SELECT g.* FROM groups g JOIN group_members gm ON g.id = gm.group_id WHERE gm.user_email = ?`, [req.params.email], (err, rows) => res.json(rows || []));
});

app.get('/groups/:groupId/details', (req, res) => {
    const groupId = req.params.groupId;
    db.get(`SELECT * FROM groups WHERE id = ?`, [groupId], (err, group) => {
        db.all(`SELECT u.email as username, u.fullName, u.avatar FROM group_members gm JOIN users u ON gm.user_email = u.email WHERE gm.group_id = ?`, [groupId], (err2, members) => res.json({ group, members }));
    });
});

app.post('/groups/:groupId/add', (req, res) => {
    db.run(`INSERT OR IGNORE INTO group_members (group_id, user_email) VALUES (?, ?)`, [req.params.groupId, req.body.userPhone], () => res.json({ success: true }));
});

app.post('/groups/:groupId/remove', (req, res) => {
    db.run(`DELETE FROM group_members WHERE group_id = ? AND user_email = ?`, [req.params.groupId, req.body.userPhone], () => res.json({ success: true }));
});

app.post('/groups/:groupId/invite-link', (req, res) => {
    db.get(`SELECT owner_email FROM groups WHERE id = ?`, [req.params.groupId], (err, group) => {
        if (group?.owner_email === req.body.ownerPhone) {
            const inviteCode = Buffer.from(req.params.groupId.toString()).toString('base64');
            res.json({ success: true, inviteCode });
        } else res.status(403).json({ success: false });
    });
});

app.post('/groups/join-request', (req, res) => {
    const groupId = Buffer.from(req.body.inviteCode, 'base64').toString('ascii');
    db.run(`INSERT INTO group_join_requests (group_id, user_email) VALUES (?, ?)`, [groupId, req.body.userPhone], (err) => {
        if (err) return res.status(400).json({ success: false, message: "Đã gửi yêu cầu trước đó" });
        res.json({ success: true, message: "Đã gửi yêu cầu, chờ Admin duyệt" });
    });
});

app.get('/groups/:groupId/join-requests', (req, res) => {
    db.all(`SELECT jr.id, jr.user_email as user_phone, u.fullName, u.avatar FROM group_join_requests jr JOIN users u ON jr.user_email = u.email WHERE jr.group_id = ? AND jr.status = 'pending'`, [req.params.groupId], (err, rows) => res.json(rows || []));
});

app.post('/groups/respond-join-request', (req, res) => {
    const { requestId, action, ownerPhone } = req.body;
    db.get(`SELECT jr.*, g.owner_email FROM group_join_requests jr JOIN groups g ON jr.group_id = g.id WHERE jr.id = ?`, [requestId], (err, row) => {
        if (row?.owner_email === ownerPhone) {
            if (action === 'approve') {
                db.serialize(() => {
                    db.run(`UPDATE group_join_requests SET status = 'approved' WHERE id = ?`, [requestId]);
                    db.run(`INSERT OR IGNORE INTO group_members (group_id, user_email) VALUES (?, ?)`, [row.group_id, row.user_email]);
                    res.json({ success: true });
                });
            } else {
                db.run(`UPDATE group_join_requests SET status = 'rejected' WHERE id = ?`, [requestId]);
                res.json({ success: true });
            }
        } else res.status(403).json({ success: false });
    });
});

// MESSAGES
app.get('/groups/:groupId/messages', (req, res) => {
    const query = `
        SELECT gm.*, 
               CASE WHEN m.user_email IS NOT NULL THEN u.fullName ELSE 'Người lạ' END as senderName, 
               CASE WHEN m.user_email IS NOT NULL THEN u.avatar ELSE NULL END as senderAvatar
        FROM group_messages gm
        LEFT JOIN users u ON gm.sender_email = u.email
        LEFT JOIN group_members m ON gm.group_id = m.group_id AND gm.sender_email = m.user_email
        WHERE gm.group_id = ?
        ORDER BY gm.created_at ASC
    `;
    db.all(query, [req.params.groupId], (err, rows) => res.json(rows || []));
});

app.post('/groups/messages/edit', (req, res) => {
    db.run(`UPDATE group_messages SET content = ? WHERE id = ? AND sender_email = ?`, [req.body.newContent, req.body.messageId, req.body.senderPhone], () => res.json({ success: true }));
});

app.post('/groups/messages/delete', (req, res) => {
    const { messageId, senderPhone, groupId } = req.body;
    db.get(`SELECT owner_email FROM groups WHERE id = ?`, [groupId], (err, group) => {
        if (group?.owner_email === senderPhone) db.run(`DELETE FROM group_messages WHERE id = ?`, [messageId], () => res.json({ success: true }));
        else {
            db.run(`DELETE FROM group_messages WHERE id = ? AND sender_email = ?`, [messageId, senderPhone], function() {
                if (this.changes > 0) res.json({ success: true });
                else res.status(403).json({ success: false });
            });
        }
    });
});

app.post('/guest-token', (req, res) => {
    const { guestName } = req.body;
    const token = jwt.sign({ username: `guest_${Date.now()}`, fullName: `${guestName} (Khách)` }, linkSecret);
    res.json({ success: true, token, username: `guest_${Date.now()}`, fullName: `${guestName} (Khách)` });
});

const groupFileStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, 'public', 'uploads')),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const uploadGroupFile = multer({ storage: groupFileStorage, limits: { fileSize: 100 * 1024 * 1024 } });

app.post('/upload-group-file', uploadGroupFile.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ success: false });
    res.json({ success: true, fileUrl: `/uploads/${req.file.filename}`, fileName: req.file.originalname });
});
