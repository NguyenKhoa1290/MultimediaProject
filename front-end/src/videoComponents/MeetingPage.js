import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from 'axios';
import './VideoComponents.css';
import ActionButtons from "./ActionButtons";
import addStream from '../redux-elements/actions/addStream';
import { useDispatch, useSelector } from "react-redux";
import createPeerConnection from "../webRTCutilities/createPeerConnection";
import socketConnection from '../webRTCutilities/socketConnection';
import updateCallStatus from "../redux-elements/actions/updateCallStatus";
import HeadsetPopup from "./HeadsetPopup";
import ChatWindow from "./ChatWindow";

const MeetingPage = () => {
    const dispatch = useDispatch();
    const callStatus = useSelector(state => state.callStatus);
    const streams = useSelector(state => state.streams);
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    
    const [users, setUsers] = useState([]);
    const [onlineUsernames, setOnlineUsernames] = useState([]);
    const [showParticipants, setShowParticipants] = useState(false);
    const [showChat, setShowChat] = useState(false);
    const [peerJoined, setPeerJoined] = useState(false);
    
    const smallFeedEl = useRef(null);
    const largeFeedEl = useRef(null);
    const streamsRef = useRef(null);
    const socketRef = useRef(null);
    const iceQueueRef = useRef([]);
    const peerLeftTimeout = useRef(null);

    const roomName = searchParams.get('room');
    const isInitiator = searchParams.get('isInitiator') === 'true';
    const myUsername = localStorage.getItem('username');
    const myFullName = localStorage.getItem('fullName');

    // Hàm tiện ích để đóng cuộc gọi và đóng tab
    const handleCloseTab = () => {
        alert("Cuộc gọi kết thúc");
        if (streamsRef.current) {
            for (const s in streamsRef.current) {
                if (streamsRef.current[s].peerConnection) {
                    streamsRef.current[s].peerConnection.close();
                }
                if (streamsRef.current[s].stream) {
                    streamsRef.current[s].stream.getTracks().forEach(track => track.stop());
                }
            }
        }
        try {
            window.close();
        } catch(e) {
            console.log(e);
        }
        setTimeout(() => {
            window.location.href = '/dashboard';
        }, 500);
    };

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) { navigate('/login'); return; }

        const socket = socketConnection(token);
        socketRef.current = socket;
        socket.emit('joinRoom', roomName);

        // Tự động gọi người dùng nếu có tham số invite trong URL
        const invitePhone = searchParams.get('invite');
        if (invitePhone && isInitiator) {
            socket.emit('inviteUser', { toUsername: invitePhone, fromUsername: myUsername, roomName });
        }

        const fetchUsers = async () => {
            const resp = await axios.get(`https://${process.env.REACT_APP_SERVER_IP}:9000/friends/${myUsername}`);
            setUsers(resp.data);
        };
        fetchUsers();

        socket.on('peerJoined', () => {
            console.log("Peer has joined/reconnected");
            setPeerJoined(true);
            
            // Xóa timeout nếu người dùng kịp reload lại
            if (peerLeftTimeout.current) {
                clearTimeout(peerLeftTimeout.current);
                peerLeftTimeout.current = null;
            }

            // Nếu là người khởi tạo, reset trạng thái để gửi Offer mới cho người vừa quay lại
            if (isInitiator) {
                dispatch(updateCallStatus('haveCreatedOffer', false));
            }
        });

        socket.on('onlineUsersUpdate', (onlineList) => {
            setOnlineUsernames(onlineList);
        });

        socket.on('newOfferWaiting', (offer) => {
            if (!isInitiator) {
                // Reset trạng thái Answer cũ để nhận Offer mới khi re-connect
                dispatch(updateCallStatus('haveCreatedAnswer', false));
                dispatch(updateCallStatus('offer', offer));
            }
        });

        socket.on('answerToClient', (answer) => {
            if (isInitiator) {
                dispatch(updateCallStatus('answer', answer));
            }
        });

        socket.on('iceToClient', ({ iceC }) => {
            if (streamsRef.current && streamsRef.current.remote1) {
                const pc = streamsRef.current.remote1.peerConnection;
                if (pc.remoteDescription) {
                    pc.addIceCandidate(iceC).catch(err => console.log("ICE Error", err));
                } else {
                    iceQueueRef.current.push(iceC);
                }
            } else {
                iceQueueRef.current.push(iceC);
            }
        });

        // Xử lý khi người kia chủ động bấm nút Hang Up
        socket.on('callEnded', () => {
            handleCloseTab();
        });

        // Xử lý khi người kia reload hoặc mất mạng tạm thời hoặc đóng tab (X)
        socket.on('peerLeft', () => {
            console.log("Peer disconnected, waiting for reconnection...");
            setPeerJoined(false);
            // Reset các queue và trạng thái để sẵn sàng kết nối lại
            iceQueueRef.current = [];
            if (!isInitiator) {
                dispatch(updateCallStatus('haveCreatedAnswer', false));
            } else {
                dispatch(updateCallStatus('haveCreatedOffer', false));
            }

            // Đặt thời gian chờ 5 giây. Nếu quá 5 giây mà peerJoined không được kích hoạt (không phải là reload) -> Đóng tab
            peerLeftTimeout.current = setTimeout(() => {
                handleCloseTab();
            }, 5000);
        });

        return () => {
            if (peerLeftTimeout.current) clearTimeout(peerLeftTimeout.current);
            socket.off('peerJoined');
            socket.off('onlineUsersUpdate');
            socket.off('newOfferWaiting');
            socket.off('answerToClient');
            socket.off('iceToClient');
            socket.off('callEnded');
            socket.off('peerLeft');
        };
    }, [roomName, isInitiator]);

    useEffect(() => {
        streamsRef.current = streams;
    }, [streams]);

    useEffect(() => {
        if (streams.remote1 && largeFeedEl.current) {
            largeFeedEl.current.srcObject = streams.remote1.stream;
        }
    }, [streams.remote1]);

    useEffect(() => {
        const fetchMedia = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { width: 1280, height: 720 }, 
                    audio: true 
                });
                
                // Mặc định tắt để chờ người dùng bấm nút, nhưng luồng vẫn được kết nối
                stream.getVideoTracks().forEach(t => t.enabled = false);
                stream.getAudioTracks().forEach(t => t.enabled = false);

                if (smallFeedEl.current) {
                    smallFeedEl.current.srcObject = stream;
                }

                dispatch(updateCallStatus('haveMedia', true));
                dispatch(addStream('localStream', stream));
                
                const { peerConnection, remoteStream } = await createPeerConnection(addIce);
                
                // Gắn các track vào PC ngay từ đầu
                stream.getTracks().forEach(track => {
                    peerConnection.addTrack(track, stream);
                });

                dispatch(addStream('remote1', remoteStream, peerConnection));
            } catch (err) {
                console.log("Media Error:", err);
            }
        };
        fetchMedia();
    }, []);

    const addIce = (iceC) => {
        socketRef.current.emit('iceToServer', { iceC, roomName, who: isInitiator ? 'initiator' : 'invitee' });
    };

    // Tạo Offer cho người gọi
    useEffect(() => {
        const createOffer = async () => {
            // Chỉ cần có Media và peerJoined là tạo Offer ngay lập tức, không chờ bấm nút Bật Cam/Mic
            if (isInitiator && callStatus.haveMedia && !callStatus.haveCreatedOffer && streams.remote1 && peerJoined) {
                const pc = streams.remote1.peerConnection;
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                socketRef.current.emit('newOffer', { offer, roomName });
                dispatch(updateCallStatus('haveCreatedOffer', true));
            }
        };
        createOffer();
    }, [callStatus.haveMedia, callStatus.haveCreatedOffer, isInitiator, streams.remote1, peerJoined]);

    // Set Remote Description cho người nhận (khi nhận Offer)
    useEffect(() => {
        const setAsyncOffer = async () => {
            if (streams.remote1 && streams.remote1.peerConnection) {
                const pc = streams.remote1.peerConnection;
                await pc.setRemoteDescription(callStatus.offer);
                // Sau khi setRemoteDescription, đẩy các ICE candidate đang xếp hàng vào
                iceQueueRef.current.forEach(iceC => {
                    pc.addIceCandidate(iceC).catch(err => console.log("Queue ICE Error", err));
                });
                iceQueueRef.current = [];
            }
        };
        if (callStatus.offer && !isInitiator) {
            setAsyncOffer();
        }
    }, [callStatus.offer, streams.remote1, isInitiator]);

    // Tạo Answer cho người nhận
    useEffect(() => {
        const createAnswer = async () => {
            if (!isInitiator && callStatus.haveMedia && callStatus.offer && !callStatus.haveCreatedAnswer && streams.remote1) {
                const pc = streams.remote1.peerConnection;
                try {
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    socketRef.current.emit('newAnswer', { answer, roomName });
                    dispatch(updateCallStatus('haveCreatedAnswer', true));
                } catch (error) {
                    console.log(error);
                }
            }
        };
        createAnswer();
    }, [callStatus.haveMedia, callStatus.offer, callStatus.haveCreatedAnswer, isInitiator, streams.remote1]);

    // Xử lý khi nhận Answer (Dành cho người gọi)
    useEffect(() => {
        const setAsyncAnswer = async () => {
            if (streams.remote1 && streams.remote1.peerConnection) {
                const pc = streams.remote1.peerConnection;
                await pc.setRemoteDescription(callStatus.answer);
                // Sau khi setRemoteDescription, đẩy các ICE candidate đang xếp hàng vào
                iceQueueRef.current.forEach(iceC => {
                    pc.addIceCandidate(iceC).catch(err => console.log("Queue ICE Error", err));
                });
                iceQueueRef.current = [];
            }
        };
        if (callStatus.answer && isInitiator) {
            setAsyncAnswer();
        }
    }, [callStatus.answer, streams.remote1, isInitiator]);

    const toggleParticipants = () => {
        setShowChat(false); 
        setShowParticipants(!showParticipants);
    };

    const toggleChat = () => {
        setShowParticipants(false);
        setShowChat(!showChat);
    };

    const inviteUser = (toUsername) => {
        socketRef.current.emit('inviteUser', { toUsername, fromUsername: myUsername, roomName });
        alert(`Đã gửi lời mời tới ${toUsername}`);
    };

    const serverUrl = `https://${process.env.REACT_APP_SERVER_IP}:9000`;

    return (
        <div className="main-video-page">
            <div className="video-chat-wrapper">
                <video id="large-feed" ref={largeFeedEl} autoPlay playsInline></video>
                <video id="own-feed" ref={smallFeedEl} autoPlay playsInline></video>
                
                <div className={`participants-window ${showParticipants ? 'show' : ''}`}>
                    <h4>Người tham gia</h4>
                    <ul className="list-group">
                        {users.filter(u => u.username !== myUsername).map(u => (
                            <li key={u.username} className="list-group-item d-flex justify-content-between align-items-center">
                                <div className="d-flex align-items-center">
                                    {u.avatar ? (
                                        <img src={`${serverUrl}${u.avatar}`} alt={u.fullName} style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', marginRight: '10px' }} />
                                    ) : (
                                        <i className="fa fa-user-circle text-secondary" style={{ fontSize: 30, marginRight: '10px' }}></i>
                                    )}
                                    <span>{u.fullName}</span>
                                </div>
                                {onlineUsernames.includes(u.username) ? (
                                    !peerJoined ? (
                                        <button className="btn btn-primary btn-sm" onClick={() => inviteUser(u.username)}>Mời</button>
                                    ) : (
                                        <span className="badge bg-success">Online</span>
                                    )
                                ) : (
                                    <span className="badge bg-secondary">Offline</span>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>

                <ChatWindow 
                    show={showChat} 
                    socket={socketRef.current} 
                    roomName={roomName} 
                    myFullName={myFullName}
                />
            </div>
            
            <HeadsetPopup smallFeedEl={smallFeedEl} />
            
            <ActionButtons 
                smallFeedEl={smallFeedEl} 
                largeFeedEl={largeFeedEl} 
                toggleParticipants={toggleParticipants}
                openCloseChat={toggleChat}
                endCallProp={() => {
                    if (socketRef.current) {
                        socketRef.current.emit('endCall', { roomName });
                    }
                }}
            />
        </div>
    );
};

export default MeetingPage;
