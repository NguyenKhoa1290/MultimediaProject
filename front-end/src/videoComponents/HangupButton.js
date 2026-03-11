import { useDispatch, useSelector } from "react-redux"
import updateCallStatus from "../redux-elements/actions/updateCallStatus"

const HangupButton = ({largeFeedEl, smallFeedEl})=>{

    const dispatch = useDispatch()
    const callStatus = useSelector(state=>state.callStatus)
    const streams = useSelector(state=>state.streams)

    const hangupCall = ()=>{
        dispatch(updateCallStatus('current','complete'))
        //user has clicked hang up
        for(const s in streams){
            //loop through all streams, and if there is a pc, close it
            //remove listeners
            //set it to null
            if(streams[s].peerConnection){
                streams[s].peerConnection.close();
                streams[s].peerConnection.onicecandidate = null
                streams[s].peerConnection.onaddstream = null
                streams[s].peerConnection = null;
            }
            // Dừng tất cả các luồng camera/mic để tắt đèn báo camera
            if(streams[s].stream){
                streams[s].stream.getTracks().forEach(track => track.stop());
            }
        }
        //set both video tags to empty
        if (smallFeedEl.current) smallFeedEl.current.srcObject = null;
        if (largeFeedEl.current) largeFeedEl.current.srcObject = null;

        // Chuyển hướng về trang chủ và tải lại trang để dọn dẹp bộ nhớ (Redux/WebRTC)
        window.location.href = '/dashboard';
    }

    if(callStatus.current === "complete"){
        return <></>
    }

    return(
        <button 
            onClick={hangupCall} 
            className="btn btn-danger hang-up"
        >Hang Up</button>
    )
}

export default HangupButton