import { useDispatch, useSelector } from "react-redux";
import updateCallStatus from "../../redux-elements/actions/updateCallStatus";

const AudioButton = ()=>{
    const dispatch = useDispatch();
    const callStatus = useSelector(state=>state.callStatus);
    const streams = useSelector(state=>state.streams);

    const startStopAudio = ()=>{
        const nextStatus = callStatus.audio === "enabled" ? "disabled" : "enabled";
        dispatch(updateCallStatus('audio', nextStatus));
        
        if (streams.localStream?.stream) {
            const tracks = streams.localStream.stream.getAudioTracks();
            tracks.forEach(t => t.enabled = (nextStatus === "enabled"));
        }
    }

    return(
        <div className="button mic" onClick={startStopAudio}>
            <i className={`fa ${callStatus.audio === "enabled" ? "fa-microphone" : "fa-microphone-slash"}`}></i>
            <div className="btn-text">{callStatus.audio === "enabled" ? "Tắt Mic" : "Bật Mic"}</div>
        </div>
    )
}

export default AudioButton;
