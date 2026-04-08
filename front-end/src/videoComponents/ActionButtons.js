import { useState, useEffect } from 'react';
import HangupButton from './HangupButton';
import AudioButton from './AudioButton/AudioButton';
import VideoButton from './VideoButton/VideoButton';
import ScreenShareButton from './ScreenShareButton';
import getDevices from './VideoButton/getDevices';
import updateCallStatus from '../redux-elements/actions/updateCallStatus';
import addStream from '../redux-elements/actions/addStream';
import { useDispatch, useSelector } from 'react-redux';
import DeviceSelectorPopup from './DeviceSelectorPopup';

const ActionButtons = ({ smallFeedEl, socket, roomName, endCallProp, toggleParticipants, openCloseChat, hideRemoteVideo, setHideRemoteVideo, noiseSuppression, setNoiseSuppression }) => {
    const dispatch = useDispatch();
    const callStatus = useSelector(state => state.callStatus);
    const streams = useSelector(state => state.streams);

    const [showSettings, setShowSettings] = useState(false);
    const [showAudioPopup, setShowAudioPopup] = useState(false);
    const [showVideoPopup, setShowVideoPopup] = useState(false);
    const [isBarHidden, setIsBarHidden] = useState(false);
    const [audioDeviceList, setAudioDeviceList] = useState([]);
    const [videoDeviceList, setVideoDeviceList] = useState([]);

    // Tải danh sách thiết bị
    const refreshDevices = async () => {
        const devices = await getDevices();
        setAudioDeviceList(devices.audioOutputDevices.concat(devices.audioInputDevices));
        setVideoDeviceList(devices.videoDevices);
    };

    useEffect(() => {
        if (showAudioPopup || showVideoPopup) refreshDevices();
    }, [showAudioPopup, showVideoPopup]);

    // Xử lý đổi Mic/Loa
    const changeAudioDevice = async (e) => {
        const deviceId = e.target.value.slice(5);
        const audioType = e.target.value.slice(0, 5);
        try {
            if (audioType === "output") {
                if (smallFeedEl && smallFeedEl.current) smallFeedEl.current.setSinkId(deviceId);
            } else {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: { deviceId: { exact: deviceId } },
                    video: callStatus.videoDevice === "default" ? true : { deviceId: { exact: callStatus.videoDevice } }
                });
                dispatch(updateCallStatus('audioDevice', deviceId));
                dispatch(updateCallStatus('audio', 'enabled'));
                dispatch(addStream('localStream', stream));
                const [audioTrack] = stream.getAudioTracks();
                for (const s in streams) {
                    if (s !== "localStream" && streams[s].peerConnection) {
                        const sender = streams[s].peerConnection.getSenders().find(s => s.track && s.track.kind === 'audio');
                        if (sender) sender.replaceTrack(audioTrack);
                    }
                }
            }
        } catch (e) { console.error(e); }
        setShowAudioPopup(false);
    };

    // Xử lý đổi Camera/Độ phân giải
    const changeVideoDevice = async (e) => {
        const value = e.target.value;
        if (value.startsWith('res')) {
            const res = value.slice(3);
            const width = res === '1080' ? 1920 : res === '720' ? 1280 : 640;
            const height = res === '1080' ? 1080 : res === '720' ? 720 : 480;
            if (streams.localStream?.stream) {
                const videoTrack = streams.localStream.stream.getVideoTracks()[0];
                await videoTrack.applyConstraints({ width, height });
            }
        } else {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: callStatus.audioDevice === "default" ? true : { deviceId: { exact: callStatus.audioDevice } },
                    video: { deviceId: { exact: value } }
                });
                dispatch(updateCallStatus('videoDevice', value));
                dispatch(updateCallStatus('video', 'enabled'));
                if (smallFeedEl && smallFeedEl.current) smallFeedEl.current.srcObject = stream;
                dispatch(addStream('localStream', stream));
                const [videoTrack] = stream.getVideoTracks();
                for (const s in streams) {
                    if (s !== "localStream" && streams[s].peerConnection) {
                        const sender = streams[s].peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
                        if (sender) sender.replaceTrack(videoTrack);
                    }
                }
            } catch (e) { console.error(e); }
        }
        setShowVideoPopup(false);
    };

    return (
        <>
            <div id="menu-buttons" className={isBarHidden ? 'hidden' : ''}>
                <div className="action-bar-toggle" onClick={() => setIsBarHidden(!isBarHidden)}>
                    <i className={`fa ${isBarHidden ? 'fa-caret-up' : 'fa-caret-down'}`}></i>
                </div>

                <div className="button-wrapper">
                    <i className="fa fa-caret-up" onClick={(e) => { e.stopPropagation(); setShowVideoPopup(false); setShowSettings(false); setShowAudioPopup(!showAudioPopup); }}></i>
                    <AudioButton smallFeedEl={smallFeedEl} />
                </div>

                <div className="button-wrapper">
                    <i className="fa fa-caret-up" onClick={(e) => { e.stopPropagation(); setShowAudioPopup(false); setShowSettings(false); setShowVideoPopup(!showVideoPopup); }}></i>
                    <VideoButton smallFeedEl={smallFeedEl} />
                </div>
                
                <div className="button-no-caret" onClick={toggleParticipants}>
                    <i className="fa fa-users"></i>
                    <div className="btn-text">Thành viên</div>
                </div>
                
                <div className="button-no-caret" onClick={openCloseChat}>
                    <i className="fa fa-comment"></i>
                    <div className="btn-text">Chat</div>
                </div>

                <ScreenShareButton smallFeedEl={smallFeedEl} socket={socket} roomName={roomName} />

                <div className="button-no-caret" onClick={() => { setShowAudioPopup(false); setShowVideoPopup(false); setShowSettings(!showSettings); }}>
                    <i className="fa fa-cog"></i>
                    <div className="btn-text">Cài đặt</div>
                </div>

                <HangupButton smallFeedEl={smallFeedEl} endCallProp={endCallProp} />
            </div>

            {/* CỬA SỔ CÀI ĐẶT CHUNG */}
            <div className={`side-panel ${showSettings ? 'show' : ''}`}>
                <div className="panel-header">
                    <h5 className="m-0 text-info"><i className="fa fa-cog me-2"></i> Cài đặt cuộc họp</h5>
                    <i className="fa fa-times cursor-pointer text-white" onClick={() => setShowSettings(false)}></i>
                </div>
                <div className="p-2">
                    <div className="d-flex justify-content-between align-items-center mb-4">
                        <span>Ẩn camera mọi người</span>
                        <div className="form-check form-switch">
                            <input className="form-check-input" type="checkbox" checked={hideRemoteVideo} onChange={e => setHideRemoteVideo(e.target.checked)} />
                        </div>
                    </div>
                    <div className="d-flex justify-content-between align-items-center mb-4">
                        <span>Lọc tiếng ồn Micro</span>
                        <div className="form-check form-switch">
                            <input className="form-check-input" type="checkbox" checked={noiseSuppression} onChange={e => setNoiseSuppression(e.target.checked)} />
                        </div>
                    </div>
                </div>
                <button className="btn btn-primary w-100 mt-auto rounded-pill" onClick={() => setShowSettings(false)}>Đóng</button>
            </div>

            <DeviceSelectorPopup 
                show={showAudioPopup}
                title="Cài đặt Âm thanh"
                type="audio"
                deviceList={audioDeviceList}
                defaultValue={`input${callStatus.audioDevice}`}
                onChange={changeAudioDevice}
                onClose={() => setShowAudioPopup(false)}
            />

            <DeviceSelectorPopup 
                show={showVideoPopup}
                title="Cài đặt Camera"
                type="video"
                deviceList={videoDeviceList}
                defaultValue={callStatus.videoDevice}
                onChange={changeVideoDevice}
                onClose={() => setShowVideoPopup(false)}
            />
        </>
    );
};

export default ActionButtons;
