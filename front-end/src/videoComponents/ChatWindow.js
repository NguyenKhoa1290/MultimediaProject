import { useState, useEffect, useRef } from "react";

const ChatWindow = ({ show, socket, roomName, myFullName }) => {
    const [chatMessages, setChatMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const messagesEndRef = useRef(null);

    useEffect(() => {
        if (socket) {
            const handleNewMessage = (data) => {
                setChatMessages(prev => [...prev, { ...data, isMe: false }]);
            };
            socket.on('chatToClient', handleNewMessage);
            return () => socket.off('chatToClient', handleNewMessage);
        }
    }, [socket]);

    // Tự động cuộn xuống dưới cùng khi có tin nhắn mới
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [chatMessages]);

    const sendChat = (e) => {
        e.preventDefault();
        if (newMessage.trim() === "") return;

        const messageData = {
            message: newMessage,
            fromFullName: myFullName,
            roomName: roomName
        };

        socket.emit('chatToServer', messageData);
        setChatMessages(prev => [...prev, { ...messageData, isMe: true }]);
        setNewMessage("");
    };

    return (
        <div className={`participants-window ${show ? 'show' : ''}`} style={{ display: 'flex', flexDirection: 'column' }}>
            <h4 className="border-bottom pb-2">Chat trong phòng</h4>
            
            <div className="chat-content flex-grow-1 overflow-auto my-3" style={{ fontSize: '14px' }}>
                {chatMessages.length === 0 ? (
                    <p className="text-muted text-center mt-5">Chưa có tin nhắn nào</p>
                ) : (
                    chatMessages.map((msg, i) => (
                        <div key={i} className={`mb-2 d-flex flex-column ${msg.isMe ? 'align-items-end' : 'align-items-start'}`}>
                            <span className="small text-muted">{msg.fromFullName}</span>
                            <div className={`p-2 rounded ${msg.isMe ? 'bg-primary text-white' : 'bg-light text-dark'}`} 
                                 style={{ maxWidth: '85%', wordBreak: 'break-word' }}>
                                {msg.message}
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={sendChat} className="mt-auto pt-3 border-top">
                <div className="input-group">
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
