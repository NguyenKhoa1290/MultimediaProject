const getPeerConfiguration = (roomName = "default") => {
    return {
        iceServers: [
            {
                // Khôi phục lại STUN Google để đảm bảo kết nối P2P tốt nhất cho 4G
                urls: [
                    'stun:stun.l.google.com:19302',
                    'stun:stun1.l.google.com:19302',
                    'stun:stun2.l.google.com:19302',
                    'stun:stun3.l.google.com:19302',
                    'stun:stun4.l.google.com:19302',
                    'stun:stun.relay.metered.ca:80'
                ]
            },
            {
                urls: [
                    "turn:103.166.182.59:3478",
                    "turn:103.166.182.59:3478?transport=tcp"
                ],
                username: "cachephoarong",
                credential: "matkhau123"
            }
        ]
    };
};

export default getPeerConfiguration;
