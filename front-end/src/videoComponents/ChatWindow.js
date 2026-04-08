import { useState, useEffect, useRef } from "react";
import axios from 'axios';

const ChatWindow = ({ show, socket, roomName, myFullName }) => {
    const [chatMessages, setChatMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const messagesEndRef = useRef(null);

    const isGroupRoom = roomName && roomName.startsWith('group-');
    const groupId = isGroupRoom ? roomName.split('-')[1] : null;
    const myPhone = localStorage.getItem('username');
    const serverUrl = `${process.env.REACT_APP_BACKEND_URL}`;

    useEffect(() => {
        if (isGroupRoom) {
            const fetchHistory = async () => {
                try {
                    const resp = await axios.get(`${serverUrl}/groups/${groupId}/messages`);
                    setChatMessages(resp.data);
                } catch(e) {}
            };
            fetchHistory();
        }
    }, [isGroupRoom, groupId, serverUrl]);

    useEffect(() => {
        if (socket) {
            if (isGroupRoom) {
                const handleNewGroupMessage = (msg) => {
                    if (String(msg.group_id) === String(groupId)) {
                        setChatMessages(prev => [...prev, msg]);
                    }
                };
                socket.on('newGroupMessage', handleNewGroupMessage);
                const handleEdit = ({ messageId, newContent }) => {
                    setChatMessages(prev => prev.map(m => m.id === messageId ? { ...m, content: newContent } : m));
                };
                const handleDelete = ({ messageId }) => {
                    setChatMessages(prev => prev.filter(m => m.id !== messageId));
                };
                socket.on('groupMessageEdited', handleEdit);
                socket.on('groupMessageDeleted', handleDelete);

                return () => {
                    socket.off('newGroupMessage', handleNewGroupMessage);
                    socket.off('groupMessageEdited', handleEdit);
                    socket.off('groupMessageDeleted', handleDelete);
                };
            } else {
                const handleNewMessage = (data) => {
                    setChatMessages(prev => [...prev, { ...data, isMe: false, type: data.type || 'text' }]);
                };
                socket.on('chatToClient', handleNewMessage);
                return () => socket.off('chatToClient', handleNewMessage);
            }
        }
    }, [socket, isGroupRoom, groupId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatMessages]);

    const sendChat = (e) => {
        e.preventDefault();
        if (newMessage.trim() === "") return;

        if (isGroupRoom) {
            socket.emit('sendGroupMessage', {
                groupId: groupId,
                senderPhone: myPhone,
                content: newMessage,
                type: 'text',
                senderName: myFullName
            });
        } else {
            const messageData = {
                message: newMessage,
                fromFullName: myFullName,
                roomName: roomName,
                type: 'text'
            };
            socket.emit('chatToServer', messageData);
            setChatMessages(prev => [...prev, { ...messageData, isMe: true }]);
        }
        setNewMessage("");
    };

    const uploadFile = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 100 * 1024 * 1024) { alert("File quá lớn (Tối đa 100MB)"); return; }

        const formData = new FormData();
        formData.append('file', file);
        try {
            const resp = await axios.post(`${serverUrl}/upload-group-file`, formData);
            if (resp.data.success) {
                if (isGroupRoom) {
                    socket.emit('sendGroupMessage', {
                        groupId: groupId,
                        senderPhone: myPhone,
                        content: resp.data.fileName,
                        type: 'file',
                        fileUrl: resp.data.fileUrl,
                        senderName: myFullName
                    });
                } else {
                    const messageData = {
                        message: resp.data.fileName,
                        fromFullName: myFullName,
                        roomName: roomName,
                        type: 'file',
                        fileUrl: resp.data.fileUrl
                    };
                    socket.emit('chatToServer', messageData);
                    setChatMessages(prev => [...prev, { ...messageData, isMe: true }]);
                }
            }
        } catch (err) { alert("Lỗi khi tải file"); }
    };

    return (
        <div className={`participants-window ${show ? 'show' : ''}`} style={{ display: 'flex', flexDirection: 'column' }}>
            <h4 className="border-bottom pb-2">Chat {isGroupRoom ? 'Nhóm' : 'Phòng'}</h4>
            
            <div className="chat-content flex-grow-1 overflow-auto my-3" style={{ fontSize: '14px' }}>
                {chatMessages.length === 0 ? (
                    <p className="text-muted text-center mt-5">Chưa có tin nhắn nào</p>
                ) : (
                    chatMessages.map((msg, i) => {
                        let isMine = false;
                        let senderName = '';
                        let content = '';
                        let type = 'text';
                        let fileUrl = '';

                        if (isGroupRoom) {
                            isMine = String(msg.sender_phone) === String(myPhone);
                            senderName = msg.senderName;
                            content = msg.content;
                            type = msg.type;
                            fileUrl = msg.file_url;
                        } else {
                            isMine = msg.isMe;
                            senderName = isMine ? myFullName : msg.fromFullName;
                            content = msg.message;
                            type = msg.type || 'text';
                            fileUrl = msg.fileUrl;
                        }

                        return (
                            <div key={i} className={`mb-2 d-flex flex-column ${isMine ? 'align-items-end' : 'align-items-start'}`}>
                                <span className="small text-muted">{senderName}</span>
                                <div className={`p-2 rounded ${isMine ? 'bg-primary text-white' : 'bg-light text-dark'}`} 
                                     style={{ maxWidth: '85%', wordBreak: 'break-word' }}>
                                    {type === 'text' && content}
                                    {type === 'file' && (
                                        <div className="file-attachment">
                                            {/\.(jpg|jpeg|png|gif|webp)$/i.test(content) ? (
                                                <img 
                                                    src={`${serverUrl}${fileUrl}`} 
                                                    alt={content} 
                                                    style={{ maxWidth: '100%', borderRadius: '5px', cursor: 'pointer' }} 
                                                    onClick={() => window.open(`${serverUrl}${fileUrl}`, '_blank')}
                                                />
                                            ) : (
                                                <a href={`${serverUrl}${fileUrl}`} target="_blank" rel="noreferrer" className={isMine ? 'text-white' : 'text-primary'}>
                                                    <i className="fa fa-file-arrow-down me-1"></i> {content}
                                                </a>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={sendChat} className="mt-auto pt-3 border-top">
                <div className="input-group">
                    <button type="button" className="btn btn-outline-light border btn-sm" onClick={() => document.getElementById('meeting-file').click()}>
                        <i className="fa fa-paperclip"></i>
                    </button>
                    <input id="meeting-file" type="file" style={{ display: 'none' }} onChange={uploadFile} />
                    <input 
                        type="text" 
                        className="form-control form-control-sm" 
                        placeholder="Nhập tin nhắn..." 
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                    />
                    <button className="btn btn-primary btn-sm">Gửi</button>
                </div>
            </form>
        </div>
    );
};

export default ChatWindow;
