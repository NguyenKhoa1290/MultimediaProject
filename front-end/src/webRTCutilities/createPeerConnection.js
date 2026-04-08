import getPeerConfiguration from './stunServers'

const createPeerConnection = (addIce, roomName)=>{
    return new Promise(async(resolve, reject)=>{
        const config = getPeerConfiguration(roomName);
        const peerConnection = await new RTCPeerConnection(config);
        const remoteStream = new MediaStream();
        
        // Tự động kết nối lại khi rớt mạng
        peerConnection.addEventListener('iceconnectionstatechange', (e) => {
            if (peerConnection.iceConnectionState === 'failed' || peerConnection.iceConnectionState === 'disconnected') {
                peerConnection.restartIce().catch(err => console.log(err));
            }
        });

        // Tìm đường đi tốt nhất
        peerConnection.addEventListener('icecandidate',e=>{
            if(e.candidate){
                addIce(e.candidate)
            }
        })
        
        // Hứng luồng Video/Audio truyền tới
        peerConnection.addEventListener('track',e=>{
            console.log("WebRTC: Received a remote track!");
            e.streams[0].getTracks().forEach(track=>{
                remoteStream.addTrack(track,remoteStream);
            })
        })

        resolve({
            peerConnection,
            remoteStream,
        })
    })
}

export default createPeerConnection
