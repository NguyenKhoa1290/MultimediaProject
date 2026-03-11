const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Lỗi khi kết nối đến cơ sở dữ liệu SQLite:', err.message);
    } else {
        console.log('Đã kết nối thành công đến cơ sở dữ liệu SQLite.');
        
        // Khởi tạo bảng users nếu chưa có
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone TEXT UNIQUE NOT NULL,
            fullName TEXT NOT NULL,
            password TEXT NOT NULL,
            avatar TEXT DEFAULT NULL
        )`, (err) => {
            if (err) console.error('Lỗi khi tạo bảng users:', err.message);
        });

        // Bảng lưu lời mời kết bạn
        db.run(`CREATE TABLE IF NOT EXISTS friend_requests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_phone TEXT NOT NULL,
            receiver_phone TEXT NOT NULL,
            status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
            UNIQUE(sender_phone, receiver_phone)
        )`, (err) => {
            if (err) console.error('Lỗi khi tạo bảng friend_requests:', err.message);
        });

        // Bảng lưu danh sách bạn bè (Quan hệ 2 chiều)
        db.run(`CREATE TABLE IF NOT EXISTS friends (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_phone TEXT NOT NULL,
            friend_phone TEXT NOT NULL,
            UNIQUE(user_phone, friend_phone)
        )`, (err) => {
            if (err) console.error('Lỗi khi tạo bảng friends:', err.message);
        });

        // Bảng lưu lịch sử cuộc gọi
        db.run(`CREATE TABLE IF NOT EXISTS call_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            caller_phone TEXT NOT NULL,
            receiver_phone TEXT NOT NULL,
            call_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'completed' -- 'connected', 'missed', etc.
        )`, (err) => {
            if (err) console.error('Lỗi khi tạo bảng call_history:', err.message);
        });
    }
});

module.exports = db;