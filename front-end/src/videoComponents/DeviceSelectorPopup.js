import React from 'react';

const DeviceSelectorPopup = ({ show, title, deviceList, type, defaultValue, onChange, onClose }) => {
    return (
        <div className={`side-panel ${show ? 'show' : ''}`}>
            <div className="panel-header">
                <h5 className="m-0 text-info">
                    <i className={`fa ${type === 'video' ? 'fa-video-camera' : 'fa-microphone'} me-2`}></i> {title}
                </h5>
                <i className="fa fa-times cursor-pointer text-white" onClick={onClose}></i>
            </div>

            <div className="device-list" style={{ maxHeight: 'calc(100% - 100px)', overflowY: 'auto' }}>
                {type === "video" ? (
                    <>
                        <div className="small text-muted mb-2 fw-bold uppercase">Thiết bị Camera</div>
                        {deviceList.map(d => (
                            <div 
                                key={d.deviceId} 
                                className={`device-item ${defaultValue === d.deviceId ? 'active' : ''}`}
                                onClick={() => { onChange({ target: { value: d.deviceId } }); }}
                            >
                                <i className="fa fa-camera me-2"></i> {d.label}
                            </div>
                        ))}
                        <div className="small text-muted mt-4 mb-2 fw-bold uppercase">Chất lượng</div>
                        {['480', '720', '1080'].map(res => (
                            <div 
                                key={res} 
                                className="device-item small py-2"
                                onClick={() => { onChange({ target: { value: `res${res}` } }); }}
                            >
                                {res}p ({res === '1080' ? 'Full HD' : res === '720' ? 'HD' : 'SD'})
                            </div>
                        ))}
                    </>
                ) : (
                    <>
                        <div className="small text-muted mb-2 fw-bold uppercase">Microphone</div>
                        {deviceList.filter(d => d.kind === "audioinput").map(d => (
                            <div 
                                key={d.deviceId} 
                                className={`device-item ${defaultValue === `input${d.deviceId}` ? 'active' : ''}`}
                                onClick={() => { onChange({ target: { value: `input${d.deviceId}` } }); }}
                            >
                                <i className="fa fa-microphone me-2"></i> {d.label}
                            </div>
                        ))}
                        <div className="small text-muted mt-4 mb-2 fw-bold uppercase">Loa / Tai nghe</div>
                        {deviceList.filter(d => d.kind === "audiooutput").map(d => (
                            <div 
                                key={d.deviceId} 
                                className={`device-item small py-2`}
                                onClick={() => { onChange({ target: { value: `ouput${d.deviceId}` } }); }}
                            >
                                <i className="fa fa-headphones me-2"></i> {d.label}
                            </div>
                        ))}
                    </>
                )}
            </div>

            <button className="btn btn-outline-info w-100 mt-4 rounded-pill btn-sm" onClick={onClose}>Đóng</button>
        </div>
    );
};

export default DeviceSelectorPopup;
