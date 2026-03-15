import { useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import updateCallStatus from '../redux-elements/actions/updateCallStatus';

const ScreenShareButton = ({ smallFeedEl }) => {
    const [isSharing, setIsSharing] = useState(false);
    const streams = useSelector(state => state.streams);
    const dispatch = useDispatch();
    
    // Dùng useRef để lưu lại track camera cũ trước khi bị ghi đè
    const originalVideoTrack = useRef(null);

    const startScreenShare = async () => {
        try {
            // Yêu cầu lấy luồng màn hình
            const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            const screenTrack = screenStream.getVideoTracks()[0];

            // Lưu lại luồng camera hiện tại (nếu đang bật)
            if (streams.localStream && streams.localStream.stream) {
                originalVideoTrack.current = streams.localStream.stream.getVideoTracks()[0];
                
                // Thay thế track hiển thị trên màn hình nhỏ
                smallFeedEl.current.srcObject = new MediaStream([screenTrack, ...streams.localStream.stream.getAudioTracks()]);
                smallFeedEl.current.classList.add('no-mirror'); // Bỏ lật hình khi share screen

                // Thay thế track trên đường truyền WebRTC sang máy đối phương
                for (const s in streams) {
                    if (s !== "localStream" && streams[s].peerConnection) {
                        const senders = streams[s].peerConnection.getSenders();
                        const sender = senders.find(s => s.track && s.track.kind === 'video');
                        if (sender) {
                            sender.replaceTrack(screenTrack);
                        }
                    }
                }
            }

            setIsSharing(true);

            // Lắng nghe sự kiện người dùng bấm "Stop sharing" mặc định của trình duyệt
            screenTrack.onended = () => {
                stopScreenShare();
            };

        } catch (err) {
            console.error("Lỗi khi chia sẻ màn hình:", err);
        }
    };

    const stopScreenShare = () => {
        // Phục hồi lại luồng camera cũ
        if (originalVideoTrack.current && streams.localStream && streams.localStream.stream) {
            
            // Khôi phục màn hình nhỏ
            smallFeedEl.current.srcObject = streams.localStream.stream;
            smallFeedEl.current.classList.remove('no-mirror'); // Khôi phục lật hình cho camera

            // Đổi lại track trên đường truyền WebRTC
            for (const s in streams) {
                if (s !== "localStream" && streams[s].peerConnection) {
                    const senders = streams[s].peerConnection.getSenders();
                    const sender = senders.find(s => s.track && s.track.kind === 'video');
                    if (sender) {
                        sender.replaceTrack(originalVideoTrack.current);
                    }
                }
            }
            
            originalVideoTrack.current = null;
        }
        setIsSharing(false);
    };

    const toggleScreenShare = () => {
        if (isSharing) {
            stopScreenShare();
        } else {
            startScreenShare();
        }
    };

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
