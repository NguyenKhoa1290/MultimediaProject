
const ActionButtonCaretDropDown = ({defaultValue,changeHandler,deviceList,type})=>{
        
    let dropDownEl;
    if(type==="video"){
        const videoDeviceEl = deviceList.map(vd=><option key={vd.deviceId} value={vd.deviceId}>{vd.label}</option>)
        videoDeviceEl.unshift(<optgroup key="opt-camera" label="Thiết bị Camera" />)
        
        const qualityEl = [
            <optgroup key="opt-res" label="Độ phân giải" />,
            <option key="res480" value="res480">480p (SD)</option>,
            <option key="res720" value="res720">720p (HD)</option>,
            <option key="res1080" value="res1080">1080p (Full HD)</option>,
            <optgroup key="opt-fps" label="Khung hình (FPS)" />,
            <option key="fps15" value="fps15">15 FPS</option>,
            <option key="fps30" value="fps30">30 FPS</option>,
            <option key="fps60" value="fps60">60 FPS</option>
        ]
        dropDownEl = videoDeviceEl.concat(qualityEl)
    }else if(type === "audio"){
        const audioInputEl = [];
        const audioOutputEl = [];
        deviceList.forEach((d,i)=>{
            if(d.kind === "audioinput"){
                audioInputEl.push(<option key={`input${d.deviceId}`} value={`input${d.deviceId}`}>{d.label}</option>)
            }else if(d.kind === "audiooutput"){
                audioOutputEl.push(<option key={`ouput${d.deviceId}`} value={`ouput${d.deviceId}`}>{d.label}</option>)
            }
        })
        audioInputEl.unshift(<optgroup key="opt-mic" label="Thiết bị ghi âm" />)
        audioOutputEl.unshift(<optgroup key="opt-speaker" label="Loa" />)
        dropDownEl = audioInputEl.concat(audioOutputEl)
    }
    
    return(
        <div className="caret-dropdown" style={{top:"-25px"}}>
            <select defaultValue={defaultValue} onChange={changeHandler}>
                {dropDownEl}
            </select>
        </div>
    )
}

export default ActionButtonCaretDropDown