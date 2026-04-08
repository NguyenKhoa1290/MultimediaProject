//this is where we create the express and socket.io server

const fs = require('fs'); //the file system
const https = require('https');
const http = require('http');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const socketio = require('socket.io');
const app = express();

const serverIP = "localhost"; 

// Cấu hình danh sách các domain được phép truy cập (CORS)
const allowedOrigins = [
    `https://${serverIP}:5069`,
    `https://${serverIP}:3000`,
    `https://${serverIP}:3001`,
    `https://${serverIP}:3002`,
    `https://cachephoarong.click`,
    `https://www.cachephoarong.click`,
    `https://backend.cachephoarong.click`,
    'https://www.deploying-javascript.com',
];

app.use(cors({
    origin: function (origin, callback) {
        // Cho phép các yêu cầu không có origin (như mobile apps hoặc curl)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            return callback(new Error('CORS Policy: Origin not allowed'), false);
        }
        return callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
})) 

app.use(express.json());
app.use(cookieParser());
app.use(express.static(__dirname+'/public'));

const key = fs.readFileSync('./certs/127.0.0.1.key');
const cert = fs.readFileSync('./certs/127.0.0.1.crt'); 

const expressServer = https.createServer({key, cert}, app); 
const io = socketio(expressServer,{
    cors: {
        origin: allowedOrigins,
        credentials: true
    }
})

expressServer.listen(9000);
console.log("Backend Server is running on port 9000 with CORS enabled for:", allowedOrigins);

module.exports = { io, expressServer, app, serverIP };
