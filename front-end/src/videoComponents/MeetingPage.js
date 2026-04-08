import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from 'axios';
import './VideoComponents.css';
import ActionButtons from "./ActionButtons";
import { useDispatch, useSelector } from "react-redux";
import createPeerConnection from "../webRTCutilities/createPeerConnection";
import socketConnection from '../webRTCutilities/socketConnection';
import updateCallStatus from "../redux-elements/actions/updateCallStatus";
import addStream from '../redux-elements/actions/addStream';
import HeadsetPopup from "./HeadsetPopup";
import ChatWindow from "./ChatWindow";
import VideoBox from "./VideoBox";

const MeetingPage = () => {
    const dispatch = useDispatch();
    const callStatus = useSelector(state => state.callStatus);
    const streams = useSelector(state => state.streams);
    
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    
    const [showParticipants, setShowParticipants] = useState(false);
    const [showChat, setShowChat] = useState(false);
    const [peersInfo, setPeersInfo] = useState({}); 
    const [pointers, setPointers] = useState({}); 
    
    const [hideRemoteVideo, setHideRemoteVideo] = useState(false);
    const [noiseSuppression, setNoiseSuppression] = useState(true);

    const [pinnedSocketId, setPinnedSocketId] = useState(null);

    const [showIPTVModal, setShowIPTVModal] = useState(false);
    const [iptvUrl, setIptvUrl] = useState('');
    const [iptvChannels, setIptvChannels] = useState([]);
    const [iptvGroups, setIptvGroups] = useState([]); 
    const [selectedGroup, setSelectedGroup] = useState('Tất cả');
    const [isIPTVActive, setIsIPTVActive] = useState(false);
    const [savedIPTVLinks, setSavedIPTVLinks] = useState([]);
    const [selectedSavedLinkId, setSelectedSavedLinkId] = useState('');

    const [guestNameInput, setGuestNameInput] = useState('');
    const [isGuestPrompt, setIsGuestPrompt] = useState(false);
    
    const socketRef = useRef(null);
    const iceQueuesRef = useRef({}); 
    const streamsRef = useRef({});
    const smallFeedEl = useRef(null); 

    const roomName = searchParams.get('room');
    const isInitiator = searchParams.get('isInitiator') === 'true'; 
    const myFullName = localStorage.getItem('fullName') || sessionStorage.getItem('fullName');
    const myAvatar = localStorage.getItem('avatar') || sessionStorage.getItem('avatar');

    useEffect(() => { streamsRef.current = streams; }, [streams]);

    useEffect(() => {
        if (socketRef.current) {
            const isAudioOn = callStatus.audio === "enabled";
            const isVideoOn = callStatus.video === "enabled";
            socketRef.current.emit('mediaStatusChanged', { roomName, audio: isAudioOn, video: isVideoOn });
        }
    }, [callStatus.audio, callStatus.video, roomName]);

    // --- TỰ ĐỘNG ĐỒNG BỘ TRACK KHI BẬT/TẮT CAM ---
    useEffect(() => {
        const localStream = streams.localStream?.stream;
        if (!localStream) return;

        Object.keys(streams).forEach(socketId => {
            if (socketId === 'localStream') return;
            const pc = streams[socketId].peerConnection;
            if (pc && pc.signalingState !== 'closed') {
                const senders = pc.getSenders();
                localStream.getTracks().forEach(track => {
                    const alreadyExists = senders.find(s => s.track?.kind === track.kind);
                    if (!alreadyExists) {
                        pc.addTrack(track, localStream);
                    } else if (alreadyExists.track !== track) {
                        alreadyExists.replaceTrack(track);
                    }
                });
            }
        });
    }, [streams.localStream?.stream, streams]);

    const togglePin = (socketId) => {
        setPinnedSocketId(prev => prev === socketId ? null : socketId);
    };

    const loadSavedIPTVLinks = async () => {
        try {
            const resp = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/iptv-links`);
            setSavedIPTVLinks(resp.data);
            if (resp.data.length > 0 && !selectedSavedLinkId) setSelectedSavedLinkId(resp.data[0].id);
        } catch(e) { console.error("Lỗi tải thư viện IPTV"); }
    };

    const saveCurrentIPTVLink = async () => {
        if (!iptvUrl) return;
        try {
            const name = prompt("Nhập tên gợi nhớ cho link này:", "Danh sách mới");
            if (name) {
                const resp = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/iptv-links`, { url: iptvUrl, name });
                await loadSavedIPTVLinks();
                setSelectedSavedLinkId(resp.data.id);
            }
        } catch(e) { alert("Link này đã tồn tại hoặc lỗi server"); }
    };

    const deleteSavedLink = async (id) => {
        if (!id) return;
        if (window.confirm("Bạn có chắc muốn xóa link này khỏi thư viện?")) {
            try {
                await axios.delete(`${process.env.REACT_APP_BACKEND_URL}/iptv-links/${id}`);
                const newList = savedIPTVLinks.filter(l => l.id != id);
                setSavedIPTVLinks(newList);
                setSelectedSavedLinkId(newList.length > 0 ? newList[0].id : '');
            } catch(e) { alert("Lỗi xóa link"); }
        }
    };

    useEffect(() => { if (showIPTVModal) loadSavedIPTVLinks(); }, [showIPTVModal]);

    const setupNewPeerConnection = async (targetSocketId, shouldSendOffer = false) => {
        const addIce = (iceC) => socketRef.current.emit('iceToServer', { iceC, roomName, targetSocketId });
        const { peerConnection, remoteStream } = await createPeerConnection(addIce, roomName);
        
        // --- LOGIC ĐÀM PHÁN LẠI TỰ ĐỘNG ---
        peerConnection.onnegotiationneeded = async () => {
            try {
                const offer = await peerConnection.createOffer();
                if (peerConnection.signalingState !== 'stable') return; // Tránh xung đột nếu đang bận
                await peerConnection.setLocalDescription(offer);
                socketRef.current.emit('newOffer', { offer, roomName, targetSocketId });
            } catch (e) { console.error("Negotiation Error:", e); }
        };

        const localStream = streamsRef.current['localStream']?.stream;
        if (localStream) {
            localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
        }

        dispatch(addStream(targetSocketId, remoteStream, peerConnection));

        return peerConnection;
    };

    useEffect(() => {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (!token) { 
            if (roomName) { setIsGuestPrompt(true); return; } 
            else { navigate('/login'); return; }
        }
        const socket = socketConnection(token);
        socketRef.current = socket;

        const initMediaAndJoin = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }, 
                    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
                });
                stream.getVideoTracks().forEach(t => t.enabled = false);
                stream.getAudioTracks().forEach(t => t.enabled = false);
                if (smallFeedEl.current) smallFeedEl.current.srcObject = stream;
                dispatch(updateCallStatus('haveMedia', true));
                dispatch(addStream('localStream', stream));
                socket.emit('joinRoom', { roomName, isInitiator });
            } catch (err) { 
                console.log("Media Error:", err);
                socket.emit('joinRoom', { roomName, isInitiator });
            }
        };
        initMediaAndJoin();

        socket.on('iptvStarted', ({ iptvSocketId, ownerSocketId, channelName, channelUrl }) => {
            setIsIPTVActive(true);
            setPeersInfo(prev => ({ 
                ...prev, 
                [iptvSocketId]: { 
                    socketId: iptvSocketId, fullName: `TV: ${channelName}`, isIPTV: true, iptvUrl: channelUrl,
                    ownerSocketId, audio: true, video: true 
                } 
            }));
        });

        socket.on('iptvStopped', ({ iptvSocketId }) => {
            setIsIPTVActive(false);
            if (pinnedSocketId === iptvSocketId) setPinnedSocketId(null);
            setPeersInfo(prev => { const copy = { ...prev }; delete copy[iptvSocketId]; return copy; });
        });

        socket.on('existingPeers', async (peersList) => {
            for (const peer of peersList) {
                setPeersInfo(prev => ({...prev, [peer.socketId]: peer}));
                iceQueuesRef.current[peer.socketId] = [];
                await setupNewPeerConnection(peer.socketId, true);
            }
        });

        socket.on('peerJoined', (newPeer) => {
            setPeersInfo(prev => ({ ...prev, [newPeer.socketId]: newPeer }));
            iceQueuesRef.current[newPeer.socketId] = [];
        });

        socket.on('newOfferWaiting', async ({ offer, fromSocketId }) => {
            const pc = await setupNewPeerConnection(fromSocketId, false);
            await pc.setRemoteDescription(offer);
            if (iceQueuesRef.current[fromSocketId]) {
                for(const iceC of iceQueuesRef.current[fromSocketId]){
                    await pc.addIceCandidate(iceC).catch(e=>console.log(e));
                }
                iceQueuesRef.current[fromSocketId] = [];
            }
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('newAnswer', { answer, roomName, targetSocketId: fromSocketId });
        });

        socket.on('answerToClient', async ({ answer, fromSocketId }) => {
            const targetStreamObj = streamsRef.current[fromSocketId];
            if (targetStreamObj && targetStreamObj.peerConnection) {
                await targetStreamObj.peerConnection.setRemoteDescription(answer);
                if (iceQueuesRef.current[fromSocketId]) {
                    for(const iceC of iceQueuesRef.current[fromSocketId]){
                        await targetStreamObj.peerConnection.addIceCandidate(iceC).catch(e=>console.log(e));
                    }
                    iceQueuesRef.current[fromSocketId] = [];
                }
            }
        });

        socket.on('iceToClient', ({ iceC, fromSocketId }) => {
            const targetStreamObj = streamsRef.current[fromSocketId];
            if (targetStreamObj && targetStreamObj.peerConnection && targetStreamObj.peerConnection.remoteDescription) {
                targetStreamObj.peerConnection.addIceCandidate(iceC).catch(e => console.log(e));
            } else {
                if (!iceQueuesRef.current[fromSocketId]) iceQueuesRef.current[fromSocketId] = [];
                iceQueuesRef.current[fromSocketId].push(iceC);
            }
        });

        socket.on('peerMediaStatus', ({ socketId, audio, video }) => {
            setPeersInfo(prev => prev[socketId] ? { ...prev, [socketId]: { ...prev[socketId], audio, video } } : prev);
        });

        socket.on('peerMirrorStatus', ({ socketId, isMirrored }) => {
            setPeersInfo(prev => prev[socketId] ? { ...prev, [socketId]: { ...prev[socketId], isMirrored } } : prev);
        });

        socket.on('peerScreenShareStatus', ({ socketId, isSharing }) => {
            setPeersInfo(prev => prev[socketId] ? { ...prev, [socketId]: { ...prev[socketId], isSharing } } : prev);
        });

        socket.on('peerLeft', ({ socketId }) => {
            if (pinnedSocketId === socketId) setPinnedSocketId(null);
            setPeersInfo(prev => { const copy = { ...prev }; delete copy[socketId]; return copy; });
            const targetStreamObj = streamsRef.current[socketId];
            if (targetStreamObj && targetStreamObj.peerConnection) targetStreamObj.peerConnection.close();
            dispatch({ type: "REMOVE_STREAM", payload: socketId });
        });

        socket.on('callEnded', () => navigate('/dashboard'));
        socket.on('roomExpired', () => { alert("Phòng kết thúc."); navigate('/dashboard'); });

        return () => {
            const currentStreams = streamsRef.current;
            for (const s in currentStreams) {
                if (currentStreams[s].stream) currentStreams[s].stream.getTracks().forEach(t => t.stop());
                if (currentStreams[s].peerConnection) currentStreams[s].peerConnection.close();
            }
            socket.off('iptvStarted'); socket.off('iptvStopped'); socket.off('existingPeers');
            socket.off('peerJoined'); socket.off('newOfferWaiting'); socket.off('answerToClient');
            socket.off('iceToClient'); socket.off('peerMediaStatus'); socket.off('peerMirrorStatus');
            socket.off('peerScreenShareStatus'); socket.off('peerLeft'); socket.off('callEnded');
            socket.off('roomExpired');
        };
    }, [roomName, isInitiator]);

    const muteParticipant = (socketId) => { if (isInitiator) socketRef.current.emit('muteParticipant', { roomName, targetSocketId: socketId }); };
    const emitPointerMove = (targetSocketId, x, y) => { if (socketRef.current) socketRef.current.emit('pointerMove', { roomName, targetSocketId, x, y, fromFullName: myFullName }); };

    const handleGuestJoin = async (e) => {
        e.preventDefault();
        try {
            localStorage.clear();
            const resp = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/guest-token`, { guestName: guestNameInput });
            if (resp.data.success) {
                sessionStorage.setItem('token', resp.data.token);
                sessionStorage.setItem('username', resp.data.username);
                sessionStorage.setItem('fullName', resp.data.fullName);
                sessionStorage.setItem('isGuest', 'true');
                window.location.reload();
            }
        } catch (err) { alert("Lỗi tham gia"); }
    };

    const copyInviteLink = () => {
        const url = new URL(window.location.href);
        url.searchParams.set('isInitiator', 'false');
        navigator.clipboard.writeText(url.toString());
        alert("Đã copy link mời!");
    };

    const fetchIPTV = async (manualUrl) => {
        const urlToFetch = manualUrl || iptvUrl;
        if (!urlToFetch) return;
        if (manualUrl) setIptvUrl(manualUrl);
        try {
            const proxyUrl = `${process.env.REACT_APP_BACKEND_URL}/proxy-fetch?url=${encodeURIComponent(urlToFetch)}`;
            const resp = await axios.get(proxyUrl);
            const content = resp.data;
            const lines = content.split('\n');
            const channels = [];
            const groupsSet = new Set();
            let currentChannel = null;
            for (let line of lines) {
                line = line.trim();
                if (line.startsWith('#EXTINF:')) {
                    const commaIndex = line.lastIndexOf(',');
                    const name = commaIndex !== -1 ? line.substring(commaIndex + 1).trim() : "Kênh không tên";
                    let group = "Kênh khác";
                    const groupMatch = line.match(/group-title="([^"]+)"/i);
                    if (groupMatch && groupMatch[1]) group = groupMatch[1];
                    currentChannel = { name, group };
                    groupsSet.add(group);
                } else if (line.startsWith('http')) {
                    if (currentChannel) {
                        currentChannel.url = line;
                        channels.push(currentChannel);
                        currentChannel = null;
                    }
                }
            }
            setIptvChannels(channels);
            setIptvGroups(["Tất cả", ...Array.from(groupsSet)]);
            setSelectedGroup("Tất cả");
        } catch (e) { alert("Lỗi tải IPTV qua Proxy."); }
    };

    const startIPTV = (channel) => {
        if (socketRef.current) socketRef.current.emit('startIPTV', { roomName, channelName: channel.name, channelUrl: channel.url });
        setShowIPTVModal(false);
    };

    const stopIPTV = () => { if (socketRef.current) socketRef.current.emit('stopIPTV', { roomName }); };

    if (isGuestPrompt) {
        return (
            <div className="d-flex justify-content-center align-items-center vh-100 bg-dark text-white">
                <div className="card bg-secondary p-4" style={{ maxWidth: '400px', width: '100%' }}>
                    <h3 className="text-center mb-4">TeleLegal</h3>
                    <form onSubmit={handleGuestJoin}>
                        <input type="text" className="form-control mb-3" placeholder="Tên của bạn..." value={guestNameInput} onChange={e => setGuestNameInput(e.target.value)} required />
                        <button type="submit" className="btn btn-primary w-100">Tham gia</button>
                    </form>
                </div>
            </div>
        );
    }

    const remotePeers = Object.values(peersInfo);
    const filteredChannels = selectedGroup === "Tất cả" ? iptvChannels : iptvChannels.filter(ch => ch.group === selectedGroup);

    const allParticipants = [
        { socketId: 'localStream', stream: streams.localStream?.stream, isLocal: true, fullName: myFullName, audio: callStatus.audio === "enabled", video: callStatus.video === "enabled", avatar: myAvatar, isHost: isInitiator },
        ...remotePeers.map(p => ({ ...p, stream: streams[p.socketId]?.stream, isLocal: false }))
    ];

    const pinnedUser = allParticipants.find(p => p.socketId === pinnedSocketId);
    const otherUsers = allParticipants.filter(p => p.socketId !== pinnedSocketId);

    return (
        <div className="main-video-page">
            {!pinnedSocketId ? (
                <div className="video-grid">
                    {allParticipants.map(p => (
                        <VideoBox 
                            key={p.socketId} stream={p.stream} isLocal={p.isLocal} fullName={p.fullName} 
                            audioEnabled={p.audio} videoEnabled={p.video} isHost={p.isHost} 
                            isIPTV={p.isIPTV} iptvUrl={p.iptvUrl} stopIPTV={stopIPTV} 
                            avatar={p.avatar} socketId={p.socketId} muteParticipant={muteParticipant} 
                            myIsHost={isInitiator} isScreenSharing={p.isSharing} emitPointerMove={emitPointerMove} 
                            pointers={pointers} isMirrored={p.isMirrored} isHiddenBySetting={hideRemoteVideo}
                            isPinned={false} togglePin={togglePin}
                        />
                    ))}
                </div>
            ) : (
                <div className="focus-mode-container">
                    <div className="main-stage">
                        {pinnedUser && (
                            <VideoBox 
                                stream={pinnedUser.stream} isLocal={pinnedUser.isLocal} fullName={pinnedUser.fullName} 
                                audioEnabled={pinnedUser.audio} videoEnabled={pinnedUser.video} isHost={pinnedUser.isHost} 
                                isIPTV={pinnedUser.isIPTV} iptvUrl={pinnedUser.iptvUrl} stopIPTV={stopIPTV} 
                                avatar={pinnedUser.avatar} socketId={pinnedUser.socketId} muteParticipant={muteParticipant} 
                                myIsHost={isInitiator} isScreenSharing={pinnedUser.isSharing} emitPointerMove={emitPointerMove} 
                                pointers={pointers} isMirrored={pinnedUser.isMirrored} isHiddenBySetting={hideRemoteVideo}
                                isPinned={true} togglePin={togglePin}
                            />
                        )}
                    </div>
                    <div className="side-strip">
                        {otherUsers.map(p => (
                            <div key={p.socketId} className="side-strip-item">
                                <VideoBox 
                                    stream={p.stream} isLocal={p.isLocal} fullName={p.fullName} 
                                    audioEnabled={p.audio} videoEnabled={p.video} isHost={p.isHost} 
                                    isIPTV={p.isIPTV} iptvUrl={p.iptvUrl} stopIPTV={stopIPTV} 
                                    avatar={p.avatar} socketId={p.socketId} muteParticipant={muteParticipant} 
                                    myIsHost={isInitiator} isScreenSharing={p.isSharing} emitPointerMove={emitPointerMove} 
                                    pointers={pointers} isMirrored={p.isMirrored} isHiddenBySetting={hideRemoteVideo}
                                    isPinned={false} togglePin={togglePin}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className={`participants-window ${showParticipants ? 'show' : ''}`}>
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <h4 className="m-0">Thành viên</h4>
                    <div className="d-flex gap-2">
                        {isInitiator && !isIPTVActive && (
                            <button className="btn btn-sm btn-success" onClick={() => setShowIPTVModal(true)}>
                                <i className="fa fa-television"></i> Thêm TV
                            </button>
                        )}
                        <button className="btn btn-sm btn-outline-primary" onClick={copyInviteLink}><i className="fa fa-link"></i> Mời</button>
                    </div>
                </div>
                <ul className="list-group">
                    {allParticipants.map(p => (
                        <li key={p.socketId} className="list-group-item d-flex justify-content-between align-items-center">
                            <span>{p.fullName} {p.isLocal && "(Bạn)"} {p.isHost && "👑"}</span>
                            {isInitiator && p.audio && !p.isLocal && !p.isIPTV && (
                                <button className="btn btn-danger btn-sm" onClick={() => muteParticipant(p.socketId)}>Tắt Mic</button>
                            )}
                        </li>
                    ))}
                </ul>
            </div>

            <ChatWindow show={showChat} socket={socketRef.current} roomName={roomName} myFullName={myFullName} />
            <video id="own-feed" ref={smallFeedEl} autoPlay playsInline muted style={{display:'none'}}></video>
            <HeadsetPopup smallFeedEl={smallFeedEl} />
            
            <ActionButtons 
                smallFeedEl={smallFeedEl} socket={socketRef.current} roomName={roomName}
                endCallProp={() => { if (socketRef.current) socketRef.current.emit('endCall', { roomName }); }}
                toggleParticipants={() => {setShowChat(false); setShowParticipants(!showParticipants)}}
                openCloseChat={() => {setShowParticipants(false); setShowChat(!showChat)}}
                hideRemoteVideo={hideRemoteVideo} setHideRemoteVideo={setHideRemoteVideo}
                noiseSuppression={noiseSuppression} setNoiseSuppression={setNoiseSuppression}
            />

            {showIPTVModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowIPTVModal(false)}>
                    <div className="settings-card shadow-lg" style={{ width: '600px', pointerEvents: 'auto' }} onClick={e => e.stopPropagation()}>
                        <div className="d-flex justify-content-between align-items-center mb-4 border-bottom border-secondary pb-2">
                            <h5 className="m-0 text-success"><i className="fa fa-television me-2"></i> Quản lý IPTV</h5>
                            <i className="fa fa-times cursor-pointer text-white" onClick={() => setShowIPTVModal(false)}></i>
                        </div>
                        {savedIPTVLinks.length > 0 && (
                            <div className="mb-4">
                                <label className="small text-muted mb-2 d-block fw-bold uppercase">Thư viện link đã lưu:</label>
                                <div className="input-group">
                                    <select className="form-select bg-dark text-white border-secondary" value={selectedSavedLinkId} onChange={e => setSelectedSavedLinkId(e.target.value)}>
                                        <option value="">-- Chọn từ thư viện --</option>
                                        {savedIPTVLinks.map(link => <option key={link.id} value={link.id}>{link.name || link.url}</option>)}
                                    </select>
                                    <button className="btn btn-primary" onClick={() => { const link = savedIPTVLinks.find(l => l.id == selectedSavedLinkId); if(link) fetchIPTV(link.url); }}>Tải</button>
                                    <button className="btn btn-outline-danger" onClick={() => deleteSavedLink(selectedSavedLinkId)}><i className="fa fa-trash"></i></button>
                                </div>
                            </div>
                        )}
                        <div className="input-group mb-2">
                            <input type="text" className="form-control bg-dark text-white border-secondary" placeholder="Dán link M3U mới..." value={iptvUrl} onChange={e => setIptvUrl(e.target.value)} />
                            <button className="btn btn-success" onClick={() => fetchIPTV()}>Tải mới</button>
                        </div>
                        {iptvChannels.length > 0 && (
                            <div className="d-flex justify-content-end mb-3">
                                <button className="btn btn-sm btn-link text-info p-0" onClick={saveCurrentIPTVLink}><i className="fa fa-save me-1"></i> Lưu vào thư viện</button>
                            </div>
                        )}
                        {iptvGroups.length > 0 && (
                            <div className="mb-3">
                                <label className="small text-muted mb-1 d-block fw-bold uppercase">Mục lục nhóm:</label>
                                <select className="form-select bg-dark text-white border-secondary" value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)}>
                                    {iptvGroups.map((g, i) => <option key={i} value={g}>{g}</option>)}
                                </select>
                            </div>
                        )}
                        <div className="mt-3 overflow-auto" style={{ maxHeight: '300px', paddingRight: '5px' }}>
                            {filteredChannels.map((ch, i) => (
                                <div key={i} className="device-item p-2 mb-1 rounded bg-dark border border-secondary cursor-pointer small d-flex justify-content-between align-items-center" onClick={() => startIPTV(ch)}>
                                    <div className="d-flex flex-column text-start">
                                        <span className="fw-bold" style={{color: '#fff'}}>{ch.name}</span>
                                        <span className="text-muted" style={{fontSize: '11px'}}>{ch.group}</span>
                                    </div>
                                    <i className="fa fa-play-circle text-success fs-4"></i>
                                </div>
                            ))}
                        </div>
                        <button className="btn btn-outline-light w-100 mt-4 rounded-pill btn-sm" onClick={() => setShowIPTVModal(false)}>Đóng</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MeetingPage;
