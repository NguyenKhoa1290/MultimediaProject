import { useState, useRef } from 'react';
import { useSelector } from 'react-redux';

const ScreenShareButton = ({ smallFeedEl, socket, roomName }) => {
    const [isSharing, setIsSharing] = useState(false);
    const streams = useSelector(state => state.streams);
    
    const originalVideoTrack = useRef(null);
    const originalAudioTrack = useRef(null);
    const mixedAudioStream = useRef(null);

    const startScreenShare = async () => {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
                alert("Trình duyệt không hỗ trợ chia sẻ màn hình.");
                return;
            }

            // 1. Yêu cầu lấy màn hình kèm âm thanh hệ thống
            const screenStream = await navigator.mediaDevices.getDisplayMedia({ 
                video: true, 
                audio: true // Kích hoạt lấy tiếng của hệ thống
            });
            
            const screenVideoTrack = screenStream.getVideoTracks()[0];
            const screenAudioTrack = screenStream.getAudioTracks()[0];

            if (streams.localStream && streams.localStream.stream) {
                const localStream = streams.localStream.stream;
                
                // Lưu lại track cũ
                originalVideoTrack.current = localStream.getVideoTracks()[0];
                originalAudioTrack.current = localStream.getAudioTracks()[0];

                // 2. LOGIC TRỘN ÂM THANH (Nếu có tiếng từ màn hình)
                let finalAudioTrack = originalAudioTrack.current;

                if (screenAudioTrack) {
                    console.log("WebRTC: Mixing system audio and microphone...");
                    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    const dest = audioContext.createMediaStreamDestination();

                    // Nguồn 1: Từ Micro
                    const micSource = audioContext.createMediaStreamSource(new MediaStream([originalAudioTrack.current]));
                    micSource.connect(dest);

                    // Nguồn 2: Từ Màn hình
                    const screenSource = audioContext.createMediaStreamSource(new MediaStream([screenAudioTrack]));
                    screenSource.connect(dest);

                    mixedAudioStream.current = dest.stream;
                    finalAudioTrack = dest.stream.getAudioTracks()[0];
                }

                // 3. Cập nhật hiển thị và WebRTC
                if (originalVideoTrack.current) localStream.removeTrack(originalVideoTrack.current);
                localStream.addTrack(screenVideoTrack);

                // Cập nhật track gửi đi cho các Peer
                for (const s in streams) {
                    if (s !== "localStream" && streams[s].peerConnection) {
                        const senders = streams[s].peerConnection.getSenders();
                        
                        // Thay Video
                        const vSender = senders.find(s => s.track && s.track.kind === 'video');
                        if (vSender) vSender.replaceTrack(screenVideoTrack);

                        // Thay Audio (đã trộn)
                        const aSender = senders.find(s => s.track && s.track.kind === 'audio');
                        if (aSender && finalAudioTrack) aSender.replaceTrack(finalAudioTrack);
                    }
                }

                if (smallFeedEl && smallFeedEl.current) {
                    smallFeedEl.current.srcObject = new MediaStream([screenVideoTrack, finalAudioTrack]);
                    smallFeedEl.current.classList.add('no-mirror');
                }
            }

            setIsSharing(true);
            if (socket) socket.emit('screenShareStatus', { roomName, isSharing: true });

            screenVideoTrack.onended = () => stopScreenShare();

        } catch (err) {
            console.error("Lỗi khi chia sẻ màn hình:", err);
        }
    };

    const stopScreenShare = () => {
        if (originalVideoTrack.current && streams.localStream && streams.localStream.stream) {
            const localStream = streams.localStream.stream;
            
            // 1. Dừng hẳn luồng share màn hình
            const currentVideoTrack = localStream.getVideoTracks()[0];
            if (currentVideoTrack && currentVideoTrack !== originalVideoTrack.current) {
                currentVideoTrack.stop();
                localStream.removeTrack(currentVideoTrack);
            }
            
            // 2. Trả lại Cam gốc
            localStream.addTrack(originalVideoTrack.current);

            // 3. Cập nhật cho các Peer
            for (const s in streams) {
                if (s !== "localStream" && streams[s].peerConnection) {
                    const senders = streams[s].peerConnection.getSenders();
                    const vSender = senders.find(s => s.track && s.track.kind === 'video');
                    if (vSender) vSender.replaceTrack(originalVideoTrack.current);

                    const aSender = senders.find(s => s.track && s.track.kind === 'audio');
                    if (aSender && originalAudioTrack.current) aSender.replaceTrack(originalAudioTrack.current);
                }
            }

            // 4. Reset hiển thị
            if (smallFeedEl && smallFeedEl.current) {
                smallFeedEl.current.srcObject = null; // Kick-start the video element
                smallFeedEl.current.srcObject = localStream;
                smallFeedEl.current.classList.remove('no-mirror');
            }
            
            originalVideoTrack.current = null;
            originalAudioTrack.current = null;
            if (mixedAudioStream.current) {
                mixedAudioStream.current.getTracks().forEach(t => t.stop());
                mixedAudioStream.current = null;
            }
        }
        setIsSharing(false);
        if (socket) socket.emit('screenShareStatus', { roomName, isSharing: false });
    };

    const toggleScreenShare = () => isSharing ? stopScreenShare() : startScreenShare();

    return (
        <div className="button-no-caret participants d-inline-block">
            <div className={`button participants ${isSharing ? 'sharing' : ''}`} onClick={toggleScreenShare}>
                <i className="fa fa-desktop" style={{ color: isSharing ? '#00ff00' : '#ccc' }}></i>
                <div className="btn-text">{isSharing ? 'Dừng Share' : 'Share Screen'}</div>
            </div>
        </div>
    );
};

export default ScreenShareButton;
