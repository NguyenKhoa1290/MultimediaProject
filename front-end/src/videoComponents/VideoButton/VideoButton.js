import { useDispatch, useSelector } from "react-redux";
import { useEffect, useState } from 'react';
import startLocalVideoStream from "./startLocalVideoStream";
import updateCallStatus from "../../redux-elements/actions/updateCallStatus";
import getDevices from "./getDevices";
import addStream from "../../redux-elements/actions/addStream";
import ActionButtonCaretDropDown from "../ActionButtonCaretDropDown";

const VideoButton = ({smallFeedEl})=>{

    const dispatch = useDispatch();
    const callStatus = useSelector(state=>state.callStatus)
    const streams = useSelector(state=>state.streams);
    const [ pendingUpdate, setPendingUpdate ] = useState(false);
    const [ caretOpen, setCaretOpen ] = useState(false);
    const [ videoDeviceList, setVideoDeviceList ] = useState([])

    const DropDown = ()=>{

    }

    useEffect(()=>{
        const getDevicesAsync = async()=>{
            if(caretOpen){
                //then we need to check for video devices
                const devices = await getDevices();
                console.log(devices.videoDevices)
                setVideoDeviceList(devices.videoDevices)
            }
        }
        getDevicesAsync()
    },[caretOpen])

    const changeVideoDevice = async(e)=>{
        const value = e.target.value;
        
        // Trường hợp người dùng chọn Độ phân giải
        if(value.startsWith('res')){
            const res = value.slice(3);
            const width = res === '1080' ? 1920 : res === '720' ? 1280 : 640;
            const height = res === '1080' ? 1080 : res === '720' ? 720 : 480;
            
            if(streams.localStream && streams.localStream.stream){
                const videoTrack = streams.localStream.stream.getVideoTracks()[0];
                await videoTrack.applyConstraints({ width, height });
            }
            return;
        }

        // Trường hợp người dùng chọn FPS
        if(value.startsWith('fps')){
            const fps = parseInt(value.slice(3));
            if(streams.localStream && streams.localStream.stream){
                const videoTrack = streams.localStream.stream.getVideoTracks()[0];
                await videoTrack.applyConstraints({ frameRate: fps });
            }
            return;
        }

        // Trường hợp đổi thiết bị Camera (như cũ)
        const deviceId = value; 
        const newConstraints = {
            audio: callStatus.audioDevice === "default" ? true : {deviceId: {exact: callStatus.audioDevice}},
            video: {deviceId: {exact: deviceId}}
        }
        const stream = await navigator.mediaDevices.getUserMedia(newConstraints)
        dispatch(updateCallStatus('videoDevice',deviceId));
        dispatch(updateCallStatus('video','enabled'))
        smallFeedEl.current.srcObject = stream;
        dispatch(addStream('localStream',stream))
        const [videoTrack] = stream.getVideoTracks();

        for(const s in streams){
            if(s !== "localStream"){
                const senders = streams[s].peerConnection.getSenders();
                const sender = senders.find(s=> s.track && s.track.kind === videoTrack.kind)
                if (sender) {
                    sender.replaceTrack(videoTrack);
                } else {
                    streams[s].peerConnection.addTrack(videoTrack, stream);
                }
            }
        }
    }

    const startStopVideo = ()=>{
        //first, check if the video is enabled, if so disabled
        if(callStatus.video === "enabled"){
            //update redux callStatus
            dispatch(updateCallStatus('video',"disabled"));
            //set the stream to disabled
            const tracks = streams.localStream.stream.getVideoTracks();
            tracks.forEach(t=>t.enabled = false);
        }else if(callStatus.video === "disabled"){
        //second, check if the video is disabled, if so enable
            //update redux callStatus
            dispatch(updateCallStatus('video',"enabled"));
            const tracks = streams.localStream.stream.getVideoTracks();
            tracks.forEach(t=>t.enabled = true);
        }else if(callStatus.haveMedia){
            //thirdly, initially off, just enable it
            dispatch(updateCallStatus('video',"enabled"));
            const tracks = streams.localStream.stream.getVideoTracks();
            tracks.forEach(t=>t.enabled = true);
        }else{
            //lastly, it is possible, we dont have the media, wait for the media, then start the stream
            setPendingUpdate(true);
        }
    }

    useEffect(()=>{
        if(pendingUpdate && callStatus.haveMedia){
            console.log('Pending update succeeded!')
            //this useEffect will run if pendingUpdate changes to true!
            setPendingUpdate(false) // switch back to false
            dispatch(updateCallStatus('video',"enabled"));
            const tracks = streams.localStream.stream.getVideoTracks();
            tracks.forEach(t=>t.enabled = true);
        }
    },[pendingUpdate,callStatus.haveMedia])

    return(
        <div className="button-wrapper video-button d-inline-block">
            <i className="fa fa-caret-up choose-video" onClick={()=>setCaretOpen(!caretOpen)}></i>
            <div className="button camera" onClick={startStopVideo}>
                <i className={`fa ${callStatus.video === "enabled" ? "fa-video" : "fa-video-slash"}`}></i>
                <div className="btn-text">{callStatus.video === "enabled" ? "Dừng" : "Bật"} Video</div>
            </div>
            {caretOpen ? <ActionButtonCaretDropDown 
                            defaultValue={callStatus.videoDevice} 
                            changeHandler={changeVideoDevice}
                            deviceList={videoDeviceList}
                            type="video"
                        /> : <></>}
        </div>
    )
}
export default VideoButton;