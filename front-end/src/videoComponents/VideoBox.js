import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

const VideoBox = ({ stream, isLocal, fullName, audioEnabled, videoEnabled, isHost, socketId, muteParticipant, myIsHost, avatar, isScreenSharing, emitPointerMove, pointers, isIPTV, iptvUrl, stopIPTV, isMirrored, isHiddenBySetting, isPinned, togglePin }) => {
    const videoRef = useRef(null);
    const containerRef = useRef(null);
    const hlsRef = useRef(null);
    const [pointerMode, setPointerMode] = useState(false);
    
    const [showOptions, setShowOptions] = useState(false);
    const [localVolume, setLocalVolume] = useState(100); 
    const [isLocalMuted, setIsLocalMuted] = useState(false);
    const [resolution, setResolution] = useState('auto');
    
    const audioContextRef = useRef(null);
    const gainNodeRef = useRef(null);
    const sourceRef = useRef(null);
    const serverUrl = process.env.REACT_APP_BACKEND_URL;

    const attachMedia = () => {
        if (!videoRef.current) return;
        if (isIPTV && iptvUrl) {
            if (hlsRef.current) hlsRef.current.destroy();
            if (Hls.isSupported()) {
                const hls = new Hls({ autoStartLoad: true, startLevel: -1 });
                hls.loadSource(iptvUrl);
                hls.attachMedia(videoRef.current);
                hlsRef.current = hls;
            } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
                videoRef.current.src = iptvUrl;
            }
            videoRef.current.muted = false;
        } else if (stream) {
            if (videoRef.current.srcObject !== stream) {
                videoRef.current.srcObject = stream;
            }
            if (!isLocal && stream.getAudioTracks().length > 0) {
                if (!audioContextRef.current) {
                    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
                    gainNodeRef.current = audioContextRef.current.createGain();
                    sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
                    sourceRef.current.connect(gainNodeRef.current);
                    gainNodeRef.current.connect(audioContextRef.current.destination);
                }
                videoRef.current.muted = true;
            }
        }
    };

    useEffect(() => {
        attachMedia();
        return () => { if (hlsRef.current) hlsRef.current.destroy(); };
    }, [stream, isIPTV, iptvUrl, isPinned]);

    useEffect(() => {
        if (isIPTV && hlsRef.current) {
            const hls = hlsRef.current;
            if (resolution === 'auto') hls.currentLevel = -1;
            else {
                const targetHeight = parseInt(resolution);
                let foundIndex = -1;
                hls.levels.forEach((level, index) => { if (level.height === targetHeight) foundIndex = index; });
                if (foundIndex !== -1) hls.currentLevel = foundIndex;
            }
        }
    }, [resolution, isIPTV]);

    useEffect(() => {
        const multiplier = isLocalMuted ? 0 : (localVolume / 100);
        if (gainNodeRef.current) {
            gainNodeRef.current.gain.setTargetAtTime(multiplier, audioContextRef.current.currentTime, 0.01);
        } else if (videoRef.current && isIPTV) {
            videoRef.current.volume = Math.min(1, multiplier);
        }
    }, [localVolume, isLocalMuted, isIPTV]);

    const handleMouseMove = (e) => {
        if (!pointerMode || !isScreenSharing || !emitPointerMove || isLocal) return;
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        emitPointerMove(socketId, x, y);
    };

    const handleClick = (e) => {
        if (showOptions) return;
        togglePin(socketId || 'localStream');
    };

    return (
        <div 
            ref={containerRef}
            className={`video-box-container ${isPinned ? 'pinned' : ''} ${isLocal ? 'local' : ''} ${isIPTV ? 'iptv-box' : ''} ${showOptions ? 'has-open-menu' : ''}`} 
            onClick={handleClick}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setShowOptions(false)}
            style={{ 
                cursor: pointerMode ? 'crosshair' : 'pointer',
                display: (isHiddenBySetting && !isLocal && !isIPTV) ? 'none' : 'flex'
            }}
        >
            <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted={isLocal && !isIPTV} 
                style={{ 
                    width: '100%', height: '100%', objectFit: 'contain', 
                    display: (videoEnabled || isIPTV) ? 'block' : 'none', 
                    transform: isLocal && !isScreenSharing && !isIPTV ? (isMirrored ? 'scaleX(1)' : 'scaleX(-1)') : (isMirrored ? 'scaleX(-1)' : 'none')
                }}
            />

            {isIPTV && (
                <div style={{ position: 'absolute', top: '10px', left: '10px', backgroundColor: 'rgba(255, 0, 0, 0.8)', color: 'white', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', zIndex: 10 }}>
                    <i className="fa fa-television me-2 animate-pulse"></i> IPTV LIVE
                </div>
            )}

            {!videoEnabled && !isIPTV && (
                <div className="avatar-fallback">
                    {avatar ? (
                        <img src={`${serverUrl}${avatar}`} alt={fullName} style={{ width: isPinned ? '150px' : '80px', height: isPinned ? '150px' : '80px', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                        <i className="fa fa-user-circle text-secondary" style={{ fontSize: isPinned ? '150px' : '80px' }}></i>
                    )}
                </div>
            )}

            {!isLocal && !isPinned && (
                <div className="options-trigger" style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 6100 }}>
                    <button 
                        className="btn btn-sm btn-dark opacity-75 rounded-circle" 
                        onClick={(e) => { e.stopPropagation(); setShowOptions(!showOptions); }} 
                        style={{ width: '30px', height: '30px', padding: 0 }}
                    >
                        <i className="fa fa-ellipsis-v"></i>
                    </button>
                    {showOptions && (
                        <div className="options-menu shadow-lg p-3" onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: '35px', right: 0, backgroundColor: 'rgba(20, 20, 20, 0.98)', color: 'white', borderRadius: '12px', width: '220px', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(15px)' }}>
                            <div className="mb-3 border-bottom border-secondary pb-2 small fw-bold text-info">{isIPTV ? 'CÀI ĐẶT IPTV' : 'TÙY CHỌN CÁ NHÂN'}</div>
                            <div className="d-flex justify-content-between align-items-center mb-3">
                                <span className="small">Âm thanh</span>
                                <div className="form-check form-switch"><input className="form-check-input" type="checkbox" checked={!isLocalMuted} onChange={() => setIsLocalMuted(!isLocalMuted)} /></div>
                            </div>
                            <div className="mb-3">
                                <div className="d-flex justify-content-between mb-1"><span className="small">Âm lượng</span><span className="small text-warning">{localVolume}%</span></div>
                                <input type="range" className="form-range custom-range" min="0" max="200" step="5" value={localVolume} onChange={(e) => setLocalVolume(parseInt(e.target.value))} />
                            </div>
                            {isIPTV && (
                                <div className="mb-3">
                                    <span className="small d-block mb-2">Độ phân giải</span>
                                    <select className="form-select form-select-sm bg-dark text-white border-secondary" value={resolution} onChange={(e) => setResolution(e.target.value)}>
                                        <option value="auto">Tự động (Auto)</option>
                                        <option value="1080">1080p (Full HD)</option>
                                        <option value="720">720p (HD)</option>
                                        <option value="480">480p (SD)</option>
                                        <option value="360">360p (Mượt)</option>
                                    </select>
                                </div>
                            )}
                            {isIPTV && myIsHost && (<button className="btn btn-danger btn-sm w-100 mt-2" onClick={() => { stopIPTV(); setShowOptions(false); }}><i className="fa fa-stop-circle me-2"></i> Tắt IPTV</button>)}
                            {!isIPTV && myIsHost && audioEnabled && (<button className="btn btn-danger btn-sm w-100 mt-2" onClick={() => { muteParticipant(socketId); setShowOptions(false); }}><i className="fa fa-microphone-slash me-2"></i> Tắt mic cả phòng</button>)}
                        </div>
                    )}
                </div>
            )}

            <div style={{ position: 'absolute', bottom: '10px', left: '10px', backgroundColor: 'rgba(0,0,0,0.6)', padding: '5px 10px', borderRadius: '5px', color: 'white', display: 'flex', alignItems: 'center', gap: '8px', zIndex: 10 }}>
                <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{fullName} {isLocal ? "(Bạn)" : ""} {isHost && "👑"}</span>
                <i className={`fa ${audioEnabled || isIPTV ? (isLocalMuted ? 'fa-volume-off text-warning' : 'fa-microphone text-success') : 'fa-microphone-slash text-danger'}`}></i>
            </div>
        </div>
    );
};

export default VideoBox;
