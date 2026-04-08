import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import socketConnection from '../webRTCutilities/socketConnection';
import BottomTaskbar from './BottomTaskbar';

const UserDashboard = () => {
    const [activeTab, setActiveTab] = useState('main');
    const [friends, setFriends] = useState([]);
    const [onlineUsernames, setOnlineUsernames] = useState([]);
    const [invitation, setInvitation] = useState(null);
    
    const [searchPhone, setSearchPhone] = useState('');
    const [searchResult, setSearchResult] = useState(null);
    const [friendRequests, setFriendRequests] = useState([]);

    const [groups, setGroups] = useState([]);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [newGroupName, setNewGroupName] = useState('');
    const [groupMessage, setGroupMessage] = useState('');
    const [editingMessage, setEditingMessage] = useState(null);
    const [activeMenuId, setActiveMenuId] = useState(null);
    const [hoveredMessageId, setHoveredMessageId] = useState(null);
    
    const [joinRequests, setJoinRequests] = useState([]);
    const [inviteLink, setInviteLink] = useState('');

    const chatEndRef = useRef(null);
    const socketRef = useRef(null);

    const navigate = useNavigate();
    const myPhone = localStorage.getItem('username');
    const myFullName = localStorage.getItem('fullName');
    const [myAvatar, setMyAvatar] = useState(localStorage.getItem('avatar'));
    const serverUrl = `${process.env.REACT_APP_BACKEND_URL}`;

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) { navigate('/login'); return; }

        const validateToken = async () => {
            try {
                await axios.post(`${process.env.REACT_APP_BACKEND_URL}/validate-link`, { token }, { withCredentials: true });
            } catch (err) {
                localStorage.clear();
                navigate('/login');
            }
        };
        validateToken();

        const params = new URLSearchParams(window.location.search);
        const inviteCode = params.get('invite');
        if (inviteCode) {
            handleJoinByLink(inviteCode);
        }

        fetchFriends();
        fetchFriendRequests();
        fetchGroups();

        const socket = socketConnection(token);
        socketRef.current = socket;

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

        socket.on('newGroupMessage', (msg) => {
            setSelectedGroup(prev => {
                if (prev && String(prev.group.id) === String(msg.group_id)) {
                    return { ...prev, messages: [...prev.messages, msg] };
                }
                return prev;
            });
        });

        socket.on('groupListUpdated', () => {
            fetchGroups();
        });

        socket.on('groupMessageEdited', ({ messageId, newContent }) => {
            setSelectedGroup(prev => {
                if (!prev) return prev;
                const newMessages = prev.messages.map(m => m.id === messageId ? { ...m, content: newContent } : m);
                return { ...prev, messages: newMessages };
            });
        });

        socket.on('groupMessageDeleted', ({ messageId }) => {
            setSelectedGroup(prev => {
                if (!prev) return prev;
                const newMessages = prev.messages.filter(m => m.id !== messageId);
                return { ...prev, messages: newMessages };
            });
        });

        socket.on('meetingEnded', ({ roomName }) => {
            setSelectedGroup(prev => {
                if (!prev) return prev;
                const newMessages = prev.messages.map(m => m.content === roomName && m.type === 'meeting' ? { ...m, type: 'meeting_ended' } : m);
                return { ...prev, messages: newMessages };
            });
        });

        return () => {
            socket.off('onlineUsersUpdate');
            socket.off('receivedInvitation');
            socket.off('newFriendRequest');
            socket.off('friendRemoved');
            socket.off('newGroupMessage');
            socket.off('groupListUpdated');
            socket.off('groupMessageEdited');
            socket.off('groupMessageDeleted');
            socket.off('meetingEnded');
        };
    }, []);

    useEffect(() => {
        let timeout;
        if (invitation) {
            timeout = setTimeout(() => {
                setInvitation(null);
            }, 20000);
        }
        return () => {
            if (timeout) clearTimeout(timeout);
        };
    }, [invitation]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [selectedGroup?.messages]);

    const fetchFriends = async () => {
        const resp = await axios.get(`${serverUrl}/friends/${myPhone}`);
        setFriends(resp.data);
    };

    const fetchFriendRequests = async () => {
        const resp = await axios.get(`${serverUrl}/friend-requests/${myPhone}`);
        setFriendRequests(resp.data);
    };

    const fetchGroups = async () => {
        const resp = await axios.get(`${serverUrl}/groups/user/${myPhone}`);
        setGroups(resp.data);
        if (socketRef.current) {
            socketRef.current.emit('joinGroupRooms', resp.data.map(g => g.id));
        }
    };

    const handleSearch = async () => {
        if(!searchPhone) return;
        try {
            const resp = await axios.get(`${serverUrl}/search-user/${searchPhone}`);
            if (resp.data.success) {
                const isAlreadyFriend = friends.some(f => String(f.username) === String(resp.data.user.username));
                if (isAlreadyFriend) {
                    alert('Người này đã có trong danh sách bạn bè của bạn');
                    setSearchResult(null);
                } else if (String(resp.data.user.username) === String(myPhone)) {
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

    const handleCreateGroup = async (e) => {
        e.preventDefault();
        if (!newGroupName.trim()) return;
        try {
            const resp = await axios.post(`${serverUrl}/groups`, { name: newGroupName, ownerPhone: myPhone });
            if (resp.data.success) {
                setNewGroupName('');
                fetchGroups();
                alert("Tạo nhóm thành công!");
            }
        } catch (err) { alert("Lỗi khi tạo nhóm"); }
    };

    const selectGroup = async (groupId) => {
        try {
            const detailResp = await axios.get(`${serverUrl}/groups/${groupId}/details`);
            const msgResp = await axios.get(`${serverUrl}/groups/${groupId}/messages`);
            setSelectedGroup({
                group: detailResp.data.group,
                members: detailResp.data.members,
                messages: msgResp.data
            });
            setEditingMessage(null);
            setGroupMessage('');
            setActiveMenuId(null);
            setHoveredMessageId(null);
            setInviteLink('');
            if (String(detailResp.data.group.owner_phone) === String(myPhone)) {
                const jrResp = await axios.get(`${serverUrl}/groups/${groupId}/join-requests`);
                setJoinRequests(jrResp.data);
            }
        } catch (err) { alert("Lỗi khi tải thông tin nhóm"); }
    };

    const inviteToGroup = async (friendPhone) => {
        try {
            await axios.post(`${serverUrl}/groups/${selectedGroup.group.id}/add`, { userPhone: friendPhone });
            selectGroup(selectedGroup.group.id);
            socketRef.current.emit('groupUpdated', { targetPhone: friendPhone, groupId: selectedGroup.group.id, action: 'added' });
        } catch (err) { alert("Người này đã ở trong nhóm hoặc có lỗi"); }
    };

    const removeFromGroup = async (memberPhone) => {
        if (!window.confirm("Xóa thành viên này khỏi nhóm?")) return;
        try {
            await axios.post(`${serverUrl}/groups/${selectedGroup.group.id}/remove`, { ownerPhone: myPhone, userPhone: memberPhone });
            selectGroup(selectedGroup.group.id);
            socketRef.current.emit('groupUpdated', { targetPhone: memberPhone, groupId: selectedGroup.group.id, action: 'removed' });
        } catch (err) { alert("Lỗi khi xóa thành viên"); }
    };

    const sendGroupChat = (e) => {
        e.preventDefault();
        if (!groupMessage.trim() || !selectedGroup) return;

        if (editingMessage) {
            handleEditMessageSubmit();
        } else {
            socketRef.current.emit('sendGroupMessage', {
                groupId: selectedGroup.group.id,
                senderPhone: myPhone,
                content: groupMessage,
                type: 'text'
            });
            setGroupMessage('');
        }
    };

    const handleEditMessageSubmit = async () => {
        try {
            const resp = await axios.post(`${serverUrl}/groups/messages/edit`, {
                messageId: editingMessage.id,
                senderPhone: myPhone,
                newContent: groupMessage
            });
            if (resp.data.success) {
                socketRef.current.emit('editGroupMessage', { 
                    groupId: selectedGroup.group.id, 
                    messageId: editingMessage.id, 
                    newContent: groupMessage 
                });
                setEditingMessage(null);
                setGroupMessage('');
            }
        } catch (err) { alert("Lỗi khi sửa tin nhắn"); }
    };

    const deleteMessage = async (msgId) => {
        if (!window.confirm("Bạn có chắc chắn muốn gỡ tin nhắn này không?")) return;
        try {
            const resp = await axios.post(`${serverUrl}/groups/messages/delete`, {
                messageId: msgId,
                senderPhone: myPhone,
                groupId: selectedGroup.group.id
            });
            if (resp.data.success) {
                socketRef.current.emit('deleteGroupMessage', { 
                    groupId: selectedGroup.group.id, 
                    messageId: msgId 
                });
                setActiveMenuId(null);
            } else {
                alert(resp.data.message || "Không thể gỡ tin nhắn");
            }
        } catch (err) { alert("Lỗi khi gỡ tin nhắn"); }
    };

    const uploadFile = async (e) => {
        const file = e.target.files[0];
        if (!file || !selectedGroup) return;
        if (file.size > 100 * 1024 * 1024) { alert("File quá lớn (Tối đa 100MB)"); return; }

        const formData = new FormData();
        formData.append('file', file);
        try {
            const resp = await axios.post(`${serverUrl}/upload-group-file`, formData);
            if (resp.data.success) {
                socketRef.current.emit('sendGroupMessage', {
                    groupId: selectedGroup.group.id,
                    senderPhone: myPhone,
                    content: resp.data.fileName,
                    type: 'file',
                    fileUrl: resp.data.fileUrl
                });
            }
        } catch (err) { alert("Lỗi khi tải file"); }
    };

    const createGroupMeeting = () => {
        const roomName = `group-${selectedGroup.group.id}-${Date.now()}`;
        window.open(`/meeting?room=${roomName}&isInitiator=true`, '_blank');
        socketRef.current.emit('sendGroupMessage', {
            groupId: selectedGroup.group.id,
            senderPhone: myPhone,
            content: roomName,
            type: 'meeting'
        });
    };

    const handleJoinByLink = async (code) => {
        if (!window.confirm("Bạn có muốn gửi yêu cầu tham gia nhóm này không?")) {
            navigate('/dashboard');
            return;
        }
        try {
            const resp = await axios.post(`${serverUrl}/groups/join-request`, {
                inviteCode: code,
                userPhone: myPhone
            });
            alert(resp.data.message);
            navigate('/dashboard');
        } catch (err) {
            alert(err.response?.data?.message || "Lỗi khi gia nhập");
            navigate('/dashboard');
        }
    };

    const generateInviteLink = async () => {
        try {
            const resp = await axios.post(`${serverUrl}/groups/${selectedGroup.group.id}/invite-link`, {
                ownerPhone: myPhone
            });
            if (resp.data.success) {
                const link = `${window.location.origin}/dashboard?invite=${resp.data.inviteCode}`;
                setInviteLink(link);
                navigator.clipboard.writeText(link);
                alert("Đã tạo và copy link mời vào nhóm!");
            }
        } catch (err) { alert("Lỗi khi tạo link"); }
    };

    const respondToJoinRequest = async (requestId, action) => {
        try {
            const resp = await axios.post(`${serverUrl}/groups/respond-join-request`, {
                requestId,
                action,
                ownerPhone: myPhone
            });
            if (resp.data.success) {
                alert(resp.data.message);
                const jrResp = await axios.get(`${serverUrl}/groups/${selectedGroup.group.id}/join-requests`);
                setJoinRequests(jrResp.data);
                if (action === 'approve') selectGroup(selectedGroup.group.id);
            }
        } catch (err) { alert("Lỗi khi phản hồi"); }
    };

    const startEditing = (msg) => {
        setEditingMessage(msg);
        setGroupMessage(msg.content);
        setActiveMenuId(null);
    };

    const cancelEditing = () => {
        setEditingMessage(null);
        setGroupMessage('');
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
            const resp = await axios.post(`${serverUrl}/upload-avatar`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            if (resp.data.success) {
                localStorage.setItem('avatar', resp.data.avatarUrl);
                setMyAvatar(resp.data.avatarUrl);
                alert("Cập nhật ảnh đại diện thành công!");
            }
        } catch (err) { alert("Lỗi khi tải ảnh lên"); }
    };

    const AvatarDisplay = ({ src, alt, size = 40 }) => {
        if (src) return <img src={`${serverUrl}${src}`} alt={alt} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', marginRight: '10px' }} />;
        return <i className="fa fa-user-circle text-secondary" style={{ fontSize: size, marginRight: '10px' }}></i>;
    };

    const renderMainTab = () => (
        <div className="row">
            <div className="col-md-7">
                <button className="btn btn-success mb-4" onClick={() => window.open(`/meeting?room=room-${myPhone}-${Date.now()}&isInitiator=true`, '_blank')}>Tạo phòng họp (Tự mời)</button>
                <div className="card mb-4"><div className="card-body">
                    <h5 className="card-title">Tìm kiếm bạn bè</h5>
                    <div className="input-group mb-3">
                        <input type="text" className="form-control" placeholder="Nhập địa chỉ Gmail..." value={searchPhone} onChange={e => setSearchPhone(e.target.value)} />
                        <button className="btn btn-outline-secondary" onClick={handleSearch}>Tìm kiếm</button>
                    </div>
                    {searchResult && (
                        <div className="d-flex justify-content-between align-items-center bg-light p-2 rounded">
                            <div className="d-flex align-items-center"><AvatarDisplay src={searchResult.avatar} alt={searchResult.fullName} /><span>{searchResult.fullName} ({searchResult.username})</span></div>
                            <button className="btn btn-sm btn-info" onClick={sendFriendRequest}>Kết bạn</button>
                        </div>
                    )}
                </div></div>
                <h4>Danh sách bạn bè:</h4>
                <ul className="list-group">
                    {friends.length === 0 ? <li className="list-group-item">Chưa có bạn bè nào</li> : 
                        friends.map(f => (
                            <li key={f.username} className="list-group-item d-flex justify-content-between align-items-center">
                                <div className="d-flex align-items-center"><AvatarDisplay src={f.avatar} alt={f.fullName} />
                                    <span><strong>{f.fullName}</strong> ({f.username}) {onlineUsernames.includes(f.username) ? <span className="badge bg-success ms-2">Online</span> : <span className="badge bg-secondary ms-2">Offline</span>}</span>
                                </div>
                                <div>
                                    {onlineUsernames.includes(f.username) && <button className="btn btn-success btn-sm me-2" onClick={() => window.open(`/meeting?room=room-${myPhone}-${Date.now()}&isInitiator=true&invite=${f.username}`, '_blank')}><i className="fa fa-phone"></i> Gọi</button>}
                                    <button className="btn btn-danger btn-sm" onClick={() => removeFriend(f.username)}>Hủy kết bạn</button>
                                </div>
                            </li>
                        ))
                    }
                </ul>
            </div>
            <div className="col-md-5"><div className="card border-primary">
                <div className="card-header bg-primary text-white"><i className="fa fa-envelope"></i> Hòm thư ({friendRequests.length})</div>
                <ul className="list-group">
                    {friendRequests.length === 0 ? <li className="list-group-item">Không có lời mời nào</li> : 
                        friendRequests.map(req => (
                            <li key={req.id} className="list-group-item">
                                <div className="d-flex align-items-center mb-2"><AvatarDisplay src={req.senderAvatar} alt={req.senderName} /><p className="mb-0"><strong>{req.senderName}</strong> muốn kết bạn.</p></div>
                                <div className="d-flex gap-2">
                                    <button className="btn btn-sm btn-success w-50" onClick={() => respondToRequest(req.id, req.sender_phone, 'accept')}>Đồng ý</button>
                                    <button className="btn btn-sm btn-danger w-50" onClick={() => respondToRequest(req.id, req.sender_phone, 'reject')}>Từ chối</button>
                                </div>
                            </li>
                        ))
                    }
                </ul>
            </div></div>
        </div>
    );

    const renderGroupsTab = () => {
        const sidebarClass = selectedGroup ? 'd-none d-md-flex' : 'd-flex';
        const chatClass = !selectedGroup ? 'd-none d-md-flex' : 'd-flex';

        return (
            <div className="row g-0 border rounded shadow-sm" style={{ height: selectedGroup ? 'calc(100vh - 100px)' : 'calc(100vh - 180px)', overflow: 'hidden', backgroundColor: 'white', transition: 'height 0.3s ease' }}>
                <div className={`col-md-3 border-end bg-light flex-column h-100 ${sidebarClass}`}>
                    <div className="p-3 border-bottom">
                        <form onSubmit={handleCreateGroup} className="mb-0">
                            <div className="input-group">
                                <input type="text" className="form-control form-control-sm" placeholder="Tên nhóm mới..." value={newGroupName} onChange={e => setNewGroupName(e.target.value)} />
                                <button className="btn btn-success btn-sm"><i className="fa fa-plus"></i></button>
                            </div>
                        </form>
                    </div>
                    <div className="p-2 fw-bold text-secondary small">NHÓM CỦA BẠN</div>
                    <div className="list-group list-group-flush flex-grow-1 overflow-auto">
                        {groups.map(g => (
                            <button key={g.id} className={`list-group-item list-group-item-action border-0 ${selectedGroup?.group.id === g.id ? 'active bg-primary text-white' : ''}`} onClick={() => selectGroup(g.id)}>
                                <i className="fa fa-users me-2"></i> {g.name}
                            </button>
                        ))}
                    </div>
                </div>

                <div className={`col-md-9 flex-column h-100 position-relative bg-white ${chatClass}`} onClick={() => setActiveMenuId(null)}>
                    {selectedGroup ? (
                        <>
                            <div className="group-header border-bottom p-3 d-flex justify-content-between align-items-center bg-white shadow-sm" style={{ zIndex: 10 }}>
                                <div className="d-flex align-items-center">
                                    <button className="btn btn-light btn-sm me-3 border shadow-sm rounded-circle d-flex align-items-center justify-content-center" style={{ width: '35px', height: '35px' }} onClick={(e) => { e.stopPropagation(); setSelectedGroup(null); }} title="Quay lại">
                                        <i className="fa fa-arrow-left text-secondary"></i>
                                    </button>
                                    <div>
                                        <h5 className="mb-0 fw-bold">{selectedGroup.group.name}</h5>
                                        <small className="text-muted"><i className="fa fa-user"></i> {selectedGroup.members.length} thành viên</small>
                                    </div>
                                </div>
                                <div className="d-flex gap-2">
                                    <button className="btn btn-sm btn-light border" data-bs-toggle="modal" data-bs-target="#membersModal"><i className="fa fa-users text-primary"></i> Xem</button>
                                    {String(selectedGroup.group.owner_phone) === String(myPhone) && (
                                        <>
                                            <button className="btn btn-sm btn-outline-info" title="Duyệt thành viên" data-bs-toggle="modal" data-bs-target="#requestsModal">
                                                <i className="fa fa-user-clock"></i> {joinRequests.length > 0 && <span className="badge bg-danger ms-1">{joinRequests.length}</span>}
                                            </button>
                                            <button className="btn btn-sm btn-outline-primary" title="Tạo link mời" onClick={generateInviteLink}>
                                                <i className="fa fa-link"></i>
                                            </button>
                                            <div className="dropdown">
                                                <button className="btn btn-sm btn-primary dropdown-toggle" data-bs-toggle="dropdown"><i className="fa fa-user-plus"></i></button>
                                                <ul className="dropdown-menu dropdown-menu-end shadow p-2">
                                                    <li className="dropdown-header">Mời bạn bè</li>
                                                    {friends.filter(f => !selectedGroup.members.find(m => String(m.username) === String(f.username))).length === 0 ? (
                                                        <li className="dropdown-item small text-muted">Không có ai</li>
                                                    ) : (
                                                        friends.filter(f => !selectedGroup.members.find(m => String(m.username) === String(f.username))).map(f => (
                                                            <li key={f.username}><button className="dropdown-item small d-flex align-items-center" onClick={() => inviteToGroup(f.username)}><AvatarDisplay src={f.avatar} size={20} /> {f.fullName}</button></li>
                                                        ))
                                                    )}
                                                </ul>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="modal fade" id="membersModal" tabIndex="-1" onClick={(e) => e.stopPropagation()}>
                                <div className="modal-dialog modal-dialog-centered"><div className="modal-content">
                                    <div className="modal-header"><h5 className="modal-title">Thành viên nhóm</h5><button type="button" className="btn-close" data-bs-dismiss="modal"></button></div>
                                    <div className="modal-body p-0"><ul className="list-group list-group-flush">
                                        {selectedGroup.members.map(m => (
                                            <li key={m.username} className="list-group-item d-flex justify-content-between align-items-center py-3">
                                                <div className="d-flex align-items-center"><AvatarDisplay src={m.avatar} alt={m.fullName} /><div><div className="fw-bold">{m.fullName} {String(m.username) === String(selectedGroup.group.owner_phone) && <span className="badge bg-warning text-dark ms-1">Admin 👑</span>}</div><small className="text-muted">{m.username}</small></div></div>
                                                {String(selectedGroup.group.owner_phone) === String(myPhone) && String(m.username) !== String(myPhone) && <button className="btn btn-outline-danger btn-sm" onClick={() => removeFromGroup(m.username)}><i className="fa fa-user-times"></i> Đuổi</button>}
                                            </li>
                                        ))}
                                    </ul></div>
                                </div></div>
                            </div>

                            <div className="modal fade" id="requestsModal" tabIndex="-1" onClick={(e) => e.stopPropagation()}>
                                <div className="modal-dialog modal-dialog-centered"><div className="modal-content">
                                    <div className="modal-header"><h5 className="modal-title">Yêu cầu gia nhập</h5><button type="button" className="btn-close" data-bs-dismiss="modal"></button></div>
                                    <div className="modal-body p-0">
                                        <ul className="list-group list-group-flush">
                                            {joinRequests.length === 0 ? <li className="list-group-item text-center py-4">Không có yêu cầu nào</li> : 
                                                joinRequests.map(req => (
                                                    <li key={req.id} className="list-group-item d-flex justify-content-between align-items-center py-3">
                                                        <div className="d-flex align-items-center"><AvatarDisplay src={req.avatar} alt={req.fullName} /><div><div className="fw-bold">{req.fullName}</div><small className="text-muted">{req.user_phone}</small></div></div>
                                                        <div className="d-flex gap-2">
                                                            <button className="btn btn-success btn-sm" onClick={() => respondToJoinRequest(req.id, 'approve')}>Duyệt</button>
                                                            <button className="btn btn-danger btn-sm" onClick={() => respondToJoinRequest(req.id, 'reject')}>Từ chối</button>
                                                        </div>
                                                    </li>
                                                ))
                                            }
                                        </ul>
                                    </div>
                                </div></div>
                            </div>

                            <div className="group-chat flex-grow-1 overflow-auto p-4 pb-5" style={{backgroundImage: 'url("https://www.transparenttextures.com/patterns/cubes.png")', backgroundColor: '#f8f9fa'}}>
                                {selectedGroup.messages.map((msg, i) => {
                                    const isMine = String(msg.sender_phone) === String(myPhone);
                                    const isAdmin = String(selectedGroup.group.owner_phone) === String(myPhone);
                                    const canInteract = isMine || isAdmin;

                                    return (
                                        <div key={i} className={`mb-3 d-flex flex-column ${isMine ? 'align-items-end' : 'align-items-start'}`} onMouseEnter={() => canInteract && setHoveredMessageId(msg.id)} onMouseLeave={() => setHoveredMessageId(null)}>
                                            <div className="d-flex align-items-center mb-1">
                                                {!isMine && <AvatarDisplay src={msg.senderAvatar} alt={msg.senderName} size={25} />}
                                                <small className="text-muted" style={{fontSize: '11px'}}>{msg.senderName}</small>
                                            </div>
                                            <div className="d-flex align-items-center" style={{ maxWidth: '85%' }}>
                                                {canInteract && !isMine && hoveredMessageId === msg.id && (
                                                    <div className="me-2 position-relative">
                                                        <button className="btn btn-sm btn-light rounded-circle shadow-sm border" style={{ width: '30px', height: '30px', padding: 0 }} onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === msg.id ? null : msg.id); }}>
                                                            <i className="fa fa-ellipsis-v text-secondary"></i>
                                                        </button>
                                                        {activeMenuId === msg.id && (
                                                            <div className="bg-white shadow-lg border rounded p-2" style={{ position: 'absolute', top: '100%', left: 0, zIndex: 1000, minWidth: '100px', marginTop: '5px' }}>
                                                                <button className="btn btn-light btn-sm text-danger text-decoration-none d-block w-100 text-start py-2" onClick={(e) => { e.stopPropagation(); deleteMessage(msg.id); }}><i className="fa fa-trash me-2"></i> Xóa</button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                <div style={{ position: 'relative' }}>
                                                    <div className={`p-2 rounded-3 shadow-sm ${isMine ? 'bg-primary text-white' : 'bg-white border text-dark'}`}>
                                                        {msg.type === 'text' && msg.content}
                                                        {msg.type === 'file' && (
                                                            <div className="file-attachment">
                                                                {/\.(jpg|jpeg|png|gif|webp)$/i.test(msg.content) ? (
                                                                    <img 
                                                                        src={`${serverUrl}${msg.file_url}`} 
                                                                        alt={msg.content} 
                                                                        style={{ maxWidth: '100%', borderRadius: '8px', cursor: 'pointer', marginBottom: '5px' }} 
                                                                        onClick={() => window.open(`${serverUrl}${msg.file_url}`, '_blank')}
                                                                    />
                                                                ) : (
                                                                    <a href={`${serverUrl}${msg.file_url}`} target="_blank" rel="noreferrer" className={isMine ? 'text-white text-decoration-none' : 'text-primary text-decoration-none'}>
                                                                        <i className="fa fa-file-arrow-down me-2"></i> {msg.content}
                                                                    </a>
                                                                )}
                                                            </div>
                                                        )}
                                                        {msg.type === 'meeting' && <div className="text-center p-2"><p className="mb-2 small">Đang có cuộc họp nhóm!</p><button className="btn btn-sm btn-success shadow-sm rounded-pill px-3" onClick={() => window.open(`/meeting?room=${msg.content}&isInitiator=false`, '_blank')}><i className="fa fa-play me-1"></i> Tham gia</button></div>}
                                                        {msg.type === 'meeting_ended' && <div className="text-center p-2 opacity-75"><p className="mb-2 small text-muted">Cuộc họp này đã kết thúc</p><button className="btn btn-sm btn-secondary rounded-pill px-3" disabled><i className="fa fa-stop me-1"></i> Đã đóng</button></div>}
                                                    </div>
                                                </div>
                                                {canInteract && isMine && hoveredMessageId === msg.id && (
                                                    <div className="ms-2 position-relative">
                                                        <button className="btn btn-sm btn-light rounded-circle shadow-sm border" style={{ width: '30px', height: '30px', padding: 0 }} onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === msg.id ? null : msg.id); }}>
                                                            <i className="fa fa-ellipsis-v text-secondary"></i>
                                                        </button>
                                                        {activeMenuId === msg.id && (
                                                            <div className="bg-white shadow-lg border rounded p-2" style={{ position: 'absolute', top: '100%', right: 0, zIndex: 1000, minWidth: '130px', marginTop: '5px' }}>
                                                                {msg.type === 'text' && <button className="btn btn-light btn-sm text-dark text-decoration-none d-block w-100 text-start py-2 mb-1" onClick={(e) => { e.stopPropagation(); startEditing(msg); }}><i className="fa fa-edit me-2 text-primary"></i> Sửa tin nhắn</button>}
                                                                <button className="btn btn-light btn-sm text-danger text-decoration-none d-block w-100 text-start py-2" onClick={(e) => { e.stopPropagation(); deleteMessage(msg.id); }}><i className="fa fa-trash me-2"></i> Gỡ tin nhắn</button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            <small style={{ fontSize: '10px', marginTop: '3px' }} className="text-muted">{new Date(msg.created_at).toLocaleTimeString()}</small>
                                        </div>
                                    );
                                })}
                                <div ref={chatEndRef} />
                            </div>

                            {editingMessage && (
                                <div className="alert alert-warning py-2 px-3 m-0 rounded-0 d-flex justify-content-between align-items-center small shadow-sm border-0 border-top" style={{ zIndex: 10 }}>
                                    <span><i className="fa fa-edit me-2"></i> Đang sửa tin nhắn...</span>
                                    <button type="button" className="btn-close" style={{width: '0.5em', height: '0.5em'}} onClick={(e) => { e.stopPropagation(); cancelEditing(); }}></button>
                                </div>
                            )}

                            <div className="bg-white p-3 border-top shadow-sm" style={{ zIndex: 10, position: 'relative' }}>
                                <form onSubmit={sendGroupChat} className="input-group">
                                    <button type="button" className="btn btn-light border" onClick={() => document.getElementById('group-file').click()}><i className="fa fa-paperclip text-secondary"></i></button>
                                    <input id="group-file" type="file" style={{ display: 'none' }} onChange={uploadFile} />
                                    <input type="text" className="form-control bg-light" placeholder={editingMessage ? "Sửa tin nhắn..." : "Nhập tin nhắn..."} value={groupMessage} onChange={e => setGroupMessage(e.target.value)} />
                                    {!editingMessage && <button type="button" className="btn btn-light border" title="Họp nhóm" onClick={createGroupMeeting}><i className="fa fa-video-camera text-info"></i></button>}
                                    <button className="btn btn-primary px-4">{editingMessage ? "Lưu" : "Gửi"}</button>
                                </form>
                            </div>
                        </>
                    ) : (
                        <div className="h-100 d-flex flex-column align-items-center justify-content-center text-muted bg-light">
                            <i className="fa fa-comments-o mb-3" style={{fontSize: '4rem', opacity: 0.2}}></i>
                            <h5>Chưa chọn nhóm</h5>
                            <p>Hãy chọn một nhóm ở cột bên trái để bắt đầu trò chuyện</p>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderProfileTab = () => (
        <div className="card w-50 mx-auto mt-5">
            <div className="card-body text-center">
                <div className="mb-4 d-flex flex-column align-items-center">
                    <AvatarDisplay src={myAvatar} alt={myFullName} size={120} />
                    <div className="mt-3">
                        <label htmlFor="avatar-upload" className="btn btn-outline-primary btn-sm"><i className="fa fa-camera"></i> Đổi ảnh đại diện</label>
                        <input id="avatar-upload" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
                    </div>
                </div>
                <h3 className="card-title">{myFullName}</h3>
                <p className="card-text text-muted fs-5"><i className="fa fa-envelope"></i> {myPhone}</p>
                <button className="btn btn-danger mt-3 px-5" onClick={handleLogout}>Đăng xuất</button>
            </div>
        </div>
    );

    const showTaskbar = activeTab !== 'groups' || !selectedGroup;

    return (
        <div style={{ paddingBottom: showTaskbar ? '100px' : '20px', height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <div className="d-flex justify-content-between align-items-center bg-dark text-white p-3 shadow-sm" style={{ flexShrink: 0 }}>
                <h3 className="m-0 text-primary">TeleLegal</h3>
                <div className="d-flex align-items-center">
                    <AvatarDisplay src={myAvatar} alt={myFullName} size={35} />
                    <span className="fw-bold">{myFullName}</span>
                </div>
            </div>

            <div className="container mt-4" style={{ flexGrow: 1 }}>
                {invitation && (
                    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <div className="bg-white p-5 rounded text-center">
                            <h3 className="mb-4">Cuộc gọi đến</h3>
                            <p className="fs-5 mb-4"><strong>{invitation.fromUsername}</strong> đang gọi cho bạn...</p>
                            <div className="d-flex justify-content-center gap-3">
                                <button className="btn btn-success btn-lg px-4" onClick={() => window.open(`/meeting?room=${invitation.roomName}&isInitiator=false`, '_blank')}><i className="fa fa-phone"></i> Vào</button>
                                <button className="btn btn-danger btn-lg px-4" onClick={() => setInvitation(null)}><i className="fa fa-times"></i> Không</button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'main' && renderMainTab()}
                {activeTab === 'groups' && renderGroupsTab()}
                {activeTab === 'profile' && renderProfileTab()}
            </div>

            {showTaskbar && <BottomTaskbar activeTab={activeTab} setActiveTab={setActiveTab} />}
        </div>
    );
};

export default UserDashboard;
