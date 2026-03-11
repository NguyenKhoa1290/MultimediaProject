//this is where we create the express and socket.io server

const fs = require('fs'); //the file system
const https = require('https');
const http = require('http');
const express = require('express');
const cors = require('cors');

const socketio = require('socket.io');
const app = express();

const serverIP = "localhost"; // <--- Thay "localhost" bằng IP LAN của bạn tại đây (ví dụ: 192.168.1.10)

app.use(cors()) 
app.use(express.json());
app.use(express.static(__dirname+'/public'));

const key = fs.readFileSync('./certs/127.0.0.1.key');
const cert = fs.readFileSync('./certs/127.0.0.1.crt'); 

const expressServer = https.createServer({key, cert}, app); 
const io = socketio(expressServer,{
    cors: [
        `https://${serverIP}:3000`,
        `https://${serverIP}:3001`,
        `https://${serverIP}:3002`,
        'https://www.deploying-javascript.com',
    ]
})

expressServer.listen(9000);
module.exports = { io, expressServer, app, serverIP };
