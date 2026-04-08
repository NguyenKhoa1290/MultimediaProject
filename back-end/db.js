const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Lỗi kết nối Database:', err.message);
    } else {
        console.log('Đã kết nối thành công tới SQLite database.');
        
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fullName TEXT NOT NULL,
            password TEXT NOT NULL,
            avatar TEXT,
            is_verified INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            db.all("PRAGMA table_info(users)", (err, columns) => {
                if (err) return;
                const hasEmail = columns.some(col => col.name === 'email');
                if (!hasEmail) {
                    db.run("ALTER TABLE users ADD COLUMN email TEXT", (err2) => {
                        db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_user_email ON users(email)");
                    });
                }
            });
        });

        db.run(`CREATE TABLE IF NOT EXISTS email_verification (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            otp TEXT NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // BẢNG LƯU LINK IPTV
        db.run(`CREATE TABLE IF NOT EXISTS iptv_links (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            url TEXT UNIQUE NOT NULL,
            name TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS friends (id INTEGER PRIMARY KEY AUTOINCREMENT, user_email TEXT NOT NULL, friend_email TEXT NOT NULL, UNIQUE(user_email, friend_email))`);
        db.run(`CREATE TABLE IF NOT EXISTS friend_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, sender_email TEXT NOT NULL, receiver_email TEXT NOT NULL, status TEXT DEFAULT 'pending', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(sender_email, receiver_email))`);
        db.run(`CREATE TABLE IF NOT EXISTS groups (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, owner_email TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
        db.run(`CREATE TABLE IF NOT EXISTS group_members (id INTEGER PRIMARY KEY AUTOINCREMENT, group_id INTEGER NOT NULL, user_email TEXT NOT NULL, UNIQUE(group_id, user_email))`);
        db.run(`CREATE TABLE IF NOT EXISTS group_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, group_id INTEGER NOT NULL, sender_email TEXT NOT NULL, content TEXT, type TEXT DEFAULT 'text', file_url TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
        db.run(`CREATE TABLE IF NOT EXISTS group_join_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, group_id INTEGER NOT NULL, user_email TEXT NOT NULL, status TEXT DEFAULT 'pending', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(group_id, user_email))`);
    }
});

module.exports = db;
