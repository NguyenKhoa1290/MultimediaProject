let peerConfiguration = {
    iceServers: [
        {
            // Danh sách các STUN Server miễn phí để tìm IP Public
            urls: [
                'stun:stun.l.google.com:19302',
                'stun:stun1.l.google.com:19302',
                'stun:stun.relay.metered.ca:80'
            ]
        },
        {

            urls: [
                "turn:{ip}:3478",
                "turn:{ip}:3478?transport=tcp"
            ],
            username: "",
            credential: ""
        }
    ]
}

export default peerConfiguration;
