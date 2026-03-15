import { useEffect, useState, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import updateCallStatus from "../redux-elements/actions/updateCallStatus";
import addStream from "../redux-elements/actions/addStream";

const HeadsetPopup = ({ smallFeedEl }) => {
    const dispatch = useDispatch();
    const streams = useSelector(state => state.streams);
    const callStatus = useSelector(state => state.callStatus);
    
    const [showPopup, setShowPopup] = useState(false);
    const [newDevices, setNewDevices] = useState({ handsFreeIn: null, handsFreeOut: null, stereoOut: null, defaultIn: null });

    useEffect(() => {
        const handleDeviceChange = async () => {
            const devices = await navigator.mediaDevices.enumerateDevices();
            
            console.log("Sự kiện devicechange được kích hoạt! Danh sách thiết bị:", devices);

            // Cố gắng phân loại dựa trên từ khóa (dành cho Bluetooth Windows)
            let handsFreeIn = devices.find(d => d.kind === 'audioinput' && (d.label.toLowerCase().includes('hands-free') || d.label.toLowerCase().includes('rảnh tay')));
            let handsFreeOut = devices.find(d => d.kind === 'audiooutput' && (d.label.toLowerCase().includes('hands-free') || d.label.toLowerCase().includes('rảnh tay')));
            let stereoOut = devices.find(d => d.kind === 'audiooutput' && (d.label.toLowerCase().includes('stereo') || d.label.toLowerCase().includes('âm thanh nổi') || d.label.toLowerCase().includes('headphone')));
            
            // Fallback: Lấy thiết bị không phải mặc định để người dùng có cái mà chọn
            if (!handsFreeIn) handsFreeIn = devices.find(d => d.kind === 'audioinput' && d.deviceId !== 'default');
            if (!handsFreeOut) handsFreeOut = devices.find(d => d.kind === 'audiooutput' && d.deviceId !== 'default');
            if (!stereoOut) stereoOut = devices.find(d => d.kind === 'audiooutput' && d.deviceId !== 'default');

            // Tìm Mic mặc định của hệ thống
            const defaultIn = devices.find(d => d.kind === 'audioinput' && (d.deviceId === 'default' || d.label.toLowerCase().includes('array') || d.label.toLowerCase().includes('realtek'))) 
                                || devices.find(d => d.kind === 'audioinput'); 

            setNewDevices({
                handsFreeIn,
                handsFreeOut: handsFreeOut || stereoOut,
                stereoOut: stereoOut || handsFreeOut,
                defaultIn
            });
            
            // ÉP HIỂN THỊ POP-UP ĐỂ KIỂM TRA GIAO DIỆN
            setShowPopup(true);
        };

        navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
        return () => navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    }, []);

    const applyDevice = async (inputId, outputId) => {
        setShowPopup(false);
        try {
            // Thay đổi Loa (Output)
            if (outputId && smallFeedEl.current && typeof smallFeedEl.current.setSinkId === 'function') {
                await smallFeedEl.current.setSinkId(outputId);
            }

            // Thay đổi Mic (Input)
            if (inputId) {
                const newConstraints = {
                    audio: { deviceId: { exact: inputId } },
                    video: callStatus.videoDevice === "default" ? true : { deviceId: { exact: callStatus.videoDevice } }
                };
                const stream = await navigator.mediaDevices.getUserMedia(newConstraints);
                
                dispatch(updateCallStatus('audioDevice', inputId));
                dispatch(updateCallStatus('audio', 'enabled'));
                dispatch(addStream('localStream', stream));

                const [audioTrack] = stream.getAudioTracks();
                
                // Thay thế track trên đường truyền WebRTC
                for (const s in streams) {
                    if (s !== "localStream" && streams[s].peerConnection) {
                        const senders = streams[s].peerConnection.getSenders();
                        const sender = senders.find(s => s.track && s.track.kind === 'audio');
                        if (sender) {
                            sender.replaceTrack(audioTrack);
                        } else {
                            streams[s].peerConnection.addTrack(audioTrack, stream);
                        }
                    }
                }
            }
        } catch (err) {
            console.error("Lỗi khi chuyển đổi thiết bị âm thanh:", err);
            alert("Không thể áp dụng thiết bị âm thanh này!");
        }
    };

    if (!showPopup) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', 
            backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 10000, 
            display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
            <div className="bg-white p-4 rounded text-center shadow-lg" style={{ maxWidth: '500px', width: '90%' }}>
                <div className="mb-3">
                    <i className="fa fa-headphones text-primary" style={{ fontSize: '60px' }}></i>
                </div>
                <h3 className="mb-3 text-dark">Phát hiện tai nghe!</h3>
                <p className="text-muted mb-4">Bạn muốn sử dụng thiết bị này như thế nào?</p>
                
                <div className="d-flex flex-column gap-2">
                    <button className="btn btn-primary py-3 fw-bold" onClick={() => applyDevice(newDevices.handsFreeIn?.deviceId, newDevices.handsFreeOut?.deviceId)}>
                        CHẾ ĐỘ GỌI THOẠI<br/>
                        <span className="small fw-normal">Dùng cả Mic và Loa của tai nghe</span>
                    </button>
                    
                    <button className="btn btn-success py-3 fw-bold" onClick={() => applyDevice(newDevices.defaultIn?.deviceId, newDevices.stereoOut?.deviceId)}>
                        CHẾ ĐỘ NGHE NHẠC<br/>
                        <span className="small fw-normal">Loa tai nghe xịn + Mic Laptop</span>
                    </button>

                    <button className="btn btn-light py-2 mt-2" onClick={() => setShowPopup(false)}>
                        Giữ nguyên như cũ
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HeadsetPopup;