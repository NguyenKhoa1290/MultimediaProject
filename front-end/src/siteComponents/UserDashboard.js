import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import socketConnection from '../webRTCutilities/socketConnection';

const UserDashboard = () => {
    const [activeTab, setActiveTab] = useState('main'); // 'main', 'history', 'profile'
    const [friends, setFriends] = useState([]);
    const [onlineUsernames, setOnlineUsernames] = useState([]);
    const [invitation, setInvitation] = useState(null);
    const [callHistory, setCallHistory] = useState([]);
    
    // States for Friend System
    const [searchPhone, setSearchPhone] = useState('');
    const [searchResult, setSearchResult] = useState(null);
    const [friendRequests, setFriendRequests] = useState([]);

    const navigate = useNavigate();
    const myPhone = localStorage.getItem('username'); // username is phone
    const myFullName = localStorage.getItem('fullName');
    const [myAvatar, setMyAvatar] = useState(localStorage.getItem('avatar')); // Thêm state cho Avatar
    const serverUrl = `https://${process.env.REACT_APP_SERVER_IP}:9000`;
    const socketRef = useRef(null);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/login');
            return;
        }

        fetchFriends();
        fetchFriendRequests();
        fetchCallHistory();

        const socket = socketConnection(token);
        socketRef.current = socket;

        // Báo server gửi lại danh sách online ngay khi vừa vào trang
        socket.emit('getOnlineUsers');

        socket.on('onlineUsersUpdate', (onlineList) => {
            setOnlineUsernames(onlineList);
        });

        socket.on('receivedInvitation', (data) => {
            setInvitation(data);
        });

        socket.on('newFriendRequest', () => {
            fetchFriendRequests();
        });

        socket.on('friendRemoved', () => {
            fetchFriends();
        });

        return () => {
            socket.off('onlineUsersUpdate');
            socket.off('receivedInvitation');
            socket.off('newFriendRequest');
            socket.off('friendRemoved');
        };
    }, []);

    useEffect(() => {
        let timeout;
        if (invitation) {
            // Tự động ẩn pop-up cuộc gọi sau 20 giây
            timeout = setTimeout(() => {
                setInvitation(null);
            }, 20000);
        }
        return () => {
            if (timeout) clearTimeout(timeout);
        };
    }, [invitation]);

    const fetchFriends = async () => {
        const resp = await axios.get(`${serverUrl}/friends/${myPhone}`);
        setFriends(resp.data);
    };

    const fetchFriendRequests = async () => {
        const resp = await axios.get(`${serverUrl}/friend-requests/${myPhone}`);
        setFriendRequests(resp.data);
    };

    const fetchCallHistory = async () => {
        const resp = await axios.get(`${serverUrl}/call-history/${myPhone}`);
        setCallHistory(resp.data);
    };

    const handleSearch = async () => {
        if(!searchPhone) return;
        try {
            const resp = await axios.get(`${serverUrl}/search-user/${searchPhone}`);
            if (resp.data.success) {
                const isAlreadyFriend = friends.some(f => f.username === resp.data.user.username);
                if (isAlreadyFriend) {
                    alert('Người này đã có trong danh sách bạn bè của bạn');
                    setSearchResult(null);
                } else if (resp.data.user.username === myPhone) {
                    alert('Bạn không thể tự kết bạn với chính mình');
                    setSearchResult(null);
                } else {
                    setSearchResult(resp.data.user);
                }
            } else {
                setSearchResult(null);
                alert('Không tìm thấy người dùng này');
            }
        } catch (err) {
            alert('Lỗi khi tìm kiếm');
        }
    };

    const sendFriendRequest = async () => {
        try {
            const resp = await axios.post(`${serverUrl}/friend-request`, {
                senderPhone: myPhone,
                receiverPhone: searchResult.username
            });
            if (resp.data.success) {
                alert('Đã gửi lời mời kết bạn');
                socketRef.current.emit('sendFriendRequest', { toUsername: searchResult.username });
                setSearchResult(null);
                setSearchPhone('');
            }
        } catch (err) {
            alert(err.response?.data?.message || 'Có lỗi xảy ra');
        }
    };

    const respondToRequest = async (requestId, senderPhone, action) => {
        try {
            await axios.post(`${serverUrl}/friend-request/respond`, {
                requestId,
                senderPhone,
                receiverPhone: myPhone,
                action
            });
            fetchFriendRequests();
            if (action === 'accept') {
                fetchFriends();
                socketRef.current.emit('unfriend', { toUsername: senderPhone });
            }
        } catch (err) {
            alert('Lỗi khi phản hồi');
        }
    };

    const removeFriend = async (friendPhone) => {
        if (window.confirm("Bạn có chắc chắn muốn hủy kết bạn với người này không?")) {
            try {
                await axios.post(`${serverUrl}/remove-friend`, {
                    userPhone: myPhone,
                    friendPhone: friendPhone
                });
                fetchFriends();
                socketRef.current.emit('unfriend', { toUsername: friendPhone });
                alert("Đã hủy kết bạn thành công!");
            } catch (err) {
                alert('Lỗi khi hủy kết bạn');
            }
        }
    };

    const createMeeting = () => {
        const roomName = `room-${myPhone}-${Date.now()}`;
        navigate(`/meeting?room=${roomName}&isInitiator=true`);
    };

    const callFriend = (friendPhone) => {
        const roomName = `room-${myPhone}-${Date.now()}`;
        navigate(`/meeting?room=${roomName}&isInitiator=true&invite=${friendPhone}`);
    };

    const joinMeeting = () => {
        navigate(`/meeting?room=${invitation.roomName}&isInitiator=false`);
    };

    const declineMeeting = () => {
        setInvitation(null);
    };

    const handleLogout = () => {
        localStorage.clear();
        window.location.href = '/login';
    };

    const handleAvatarUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('avatar', file);
        formData.append('phone', myPhone);

        try {
            const resp = await axios.post(`${serverUrl}/upload-avatar`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (resp.data.success) {
                const newAvatarUrl = resp.data.avatarUrl;
                localStorage.setItem('avatar', newAvatarUrl);
                setMyAvatar(newAvatarUrl);
                alert("Cập nhật ảnh đại diện thành công!");
            }
        } catch (err) {
            alert("Lỗi khi tải ảnh lên");
        }
    };

    // Component hiển thị Avatar dùng chung
    const AvatarDisplay = ({ src, alt, size = 40 }) => {
        if (src) {
            return <img src={`${serverUrl}${src}`} alt={alt} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', marginRight: '10px' }} />;
        }
        return <i className="fa fa-user-circle text-secondary" style={{ fontSize: size, marginRight: '10px' }}></i>;
    };

    const renderMainTab = () => (
        <div className="row">
            <div className="col-md-7">
                <button className="btn btn-success mb-4" onClick={createMeeting}>Tạo phòng họp (Tự mời)</button>

                <div className="card mb-4">
                    <div className="card-body">
                        <h5 className="card-title">Tìm kiếm bạn bè</h5>
                        <div className="input-group mb-3">
                            <input type="text" className="form-control" placeholder="Nhập số điện thoại..." value={searchPhone} onChange={e => setSearchPhone(e.target.value)} />
                            <button className="btn btn-outline-secondary" onClick={handleSearch}>Tìm kiếm</button>
                        </div>
                        
                        {searchResult && (
                            <div className="d-flex justify-content-between align-items-center bg-light p-2 rounded">
                                <div className="d-flex align-items-center">
                                    <AvatarDisplay src={searchResult.avatar} alt={searchResult.fullName} />
                                    <span>{searchResult.fullName} ({searchResult.username})</span>
                                </div>
                                <button className="btn btn-sm btn-info" onClick={sendFriendRequest}>Kết bạn</button>
                            </div>
                        )}
                    </div>
                </div>

                <h4>Danh sách bạn bè:</h4>
                <ul className="list-group">
                    {friends.length === 0 ? <li className="list-group-item">Chưa có bạn bè nào</li> : 
                        friends.map(f => (
                            <li key={f.username} className="list-group-item d-flex justify-content-between align-items-center">
                                <div className="d-flex align-items-center">
                                    <AvatarDisplay src={f.avatar} alt={f.fullName} />
                                    <span>
                                        <strong>{f.fullName}</strong> ({f.username})
                                        {onlineUsernames.includes(f.username) ? (
                                            <span className="badge bg-success rounded-pill ms-2">Online</span>
                                        ) : (
                                            <span className="badge bg-secondary rounded-pill ms-2">Offline</span>
                                        )}
                                    </span>
                                </div>
                                <div>
                                    {onlineUsernames.includes(f.username) && (
                                        <button className="btn btn-success btn-sm me-2" onClick={() => callFriend(f.username)}>
                                            <i className="fa fa-phone"></i> Gọi
                                        </button>
                                    )}
                                    <button className="btn btn-danger btn-sm" onClick={() => removeFriend(f.username)}>Hủy kết bạn</button>
                                </div>
                            </li>
                        ))
                    }
                </ul>
            </div>

            <div className="col-md-5">
                <div className="card border-primary">
                    <div className="card-header bg-primary text-white">
                        <i className="fa fa-envelope"></i> Hòm thư ({friendRequests.length})
                    </div>
                    <ul className="list-group list-group-flush">
                        {friendRequests.length === 0 ? <li className="list-group-item">Không có lời mời nào</li> : 
                            friendRequests.map(req => (
                                <li key={req.id} className="list-group-item">
                                    <div className="d-flex align-items-center mb-2">
                                        <AvatarDisplay src={req.senderAvatar} alt={req.senderName} />
                                        <p className="mb-0"><strong>{req.senderName}</strong> muốn kết bạn.</p>
                                    </div>
                                    <div className="d-flex gap-2">
                                        <button className="btn btn-sm btn-success w-50" onClick={() => respondToRequest(req.id, req.sender_phone, 'accept')}>Đồng ý</button>
                                        <button className="btn btn-sm btn-danger w-50" onClick={() => respondToRequest(req.id, req.sender_phone, 'reject')}>Từ chối</button>
                                    </div>
                                </li>
                            ))
                        }
                    </ul>
                </div>
            </div>
        </div>
    );

    const renderHistoryTab = () => (
        <div>
            <h4>Lịch sử cuộc gọi</h4>
            <ul className="list-group">
                {callHistory.length === 0 ? <li className="list-group-item">Chưa có lịch sử cuộc gọi</li> :
                    callHistory.map(call => (
                        <li key={call.id} className="list-group-item d-flex justify-content-between align-items-center">
                            <div>
                                <i className={`fa ${call.type === 'incoming' ? 'fa-arrow-down text-danger' : 'fa-arrow-up text-success'} me-2`}></i>
                                <strong>{call.other_person_name}</strong>
                                <span className="ms-2 text-muted" style={{fontSize: '0.9em'}}>({new Date(call.call_time).toLocaleString()})</span>
                            </div>
                            <span className="badge bg-info rounded-pill">{call.type === 'incoming' ? 'Gọi đến' : 'Gọi đi'}</span>
                        </li>
                    ))
                }
            </ul>
        </div>
    );

    const renderProfileTab = () => (
        <div className="card w-50 mx-auto mt-5">
            <div className="card-body text-center">
                <div className="mb-4 d-flex flex-column align-items-center">
                    <AvatarDisplay src={myAvatar} alt={myFullName} size={120} />
                    <div className="mt-3">
                        <label htmlFor="avatar-upload" className="btn btn-outline-primary btn-sm">
                            <i className="fa fa-camera"></i> Đổi ảnh đại diện
                        </label>
                        <input id="avatar-upload" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
                    </div>
                </div>
                <h3 className="card-title">{myFullName}</h3>
                <p className="card-text text-muted fs-5"><i className="fa fa-phone"></i> {myPhone}</p>
                <button className="btn btn-danger mt-3 px-5" onClick={handleLogout}>Đăng xuất</button>
            </div>
        </div>
    );

    return (
        <div>
            {/* Thanh Taskbar (Navigation) */}
            <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
                <div className="container-fluid">
                    <span className="navbar-brand">TeleLegal</span>
                    <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                        <span className="navbar-toggler-icon"></span>
                    </button>
                    <div className="collapse navbar-collapse" id="navbarNav">
                        <ul className="navbar-nav me-auto mb-2 mb-lg-0">
                            <li className="nav-item">
                                <button className={`nav-link btn btn-link ${activeTab === 'main' ? 'active' : ''}`} onClick={() => setActiveTab('main')}>Trang chính</button>
                            </li>
                            <li className="nav-item">
                                <button className={`nav-link btn btn-link ${activeTab === 'history' ? 'active' : ''}`} onClick={() => { setActiveTab('history'); fetchCallHistory(); }}>Lịch sử</button>
                            </li>
                            <li className="nav-item">
                                <button className={`nav-link btn btn-link ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>Cá nhân</button>
                            </li>
                        </ul>
                        <div className="navbar-text text-white d-flex align-items-center">
                            <AvatarDisplay src={myAvatar} alt={myFullName} size={30} />
                            <span>Chào, {myFullName}</span>
                        </div>
                    </div>
                </div>
            </nav>

            <div className="container mt-4">
                {/* Pop-up Lời mời gọi video */}
                {invitation && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', 
                        backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9999, 
                        display: 'flex', justifyContent: 'center', alignItems: 'center'
                    }}>
                        <div className="bg-white p-5 rounded text-center">
                            <h3 className="mb-4">Cuộc gọi đến</h3>
                            <p className="fs-5 mb-4"><strong>{invitation.fromUsername}</strong> đang gọi cho bạn...</p>
                            <div className="d-flex justify-content-center gap-3">
                                <button className="btn btn-success btn-lg px-4" onClick={joinMeeting}>
                                    <i className="fa fa-phone"></i> Vào
                                </button>
                                <button className="btn btn-danger btn-lg px-4" onClick={declineMeeting}>
                                    <i className="fa fa-times"></i> Không
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Render Content Based on Active Tab */}
                {activeTab === 'main' && renderMainTab()}
                {activeTab === 'history' && renderHistoryTab()}
                {activeTab === 'profile' && renderProfileTab()}
            </div>
        </div>
    );
};

export default UserDashboard;