import { useDispatch, useSelector } from "react-redux";
import updateCallStatus from "../../redux-elements/actions/updateCallStatus";

const VideoButton = ()=>{
    const dispatch = useDispatch();
    const callStatus = useSelector(state=>state.callStatus);
    const streams = useSelector(state=>state.streams);

    const startStopVideo = ()=>{
        const nextStatus = callStatus.video === "enabled" ? "disabled" : "enabled";
        dispatch(updateCallStatus('video', nextStatus));
        
        if (streams.localStream?.stream) {
            const tracks = streams.localStream.stream.getVideoTracks();
            tracks.forEach(t => t.enabled = (nextStatus === "enabled"));
        }
    }

    return(
        <div className="button camera" onClick={startStopVideo}>
            <i className={`fa ${callStatus.video === "enabled" ? "fa-video-camera" : "fa-video-slash"}`}></i>
            <div className="btn-text">{callStatus.video === "enabled" ? "Dừng Cam" : "Bật Cam"}</div>
        </div>
    )
}

export default VideoButton;
