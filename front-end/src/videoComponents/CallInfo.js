import moment from 'moment'
import 'moment/locale/vi' // Import ngôn ngữ tiếng Việt cho moment
import { useEffect, useState } from 'react'

const CallInfo = ({apptInfo})=>{

    // Thiết lập ngôn ngữ tiếng Việt cho moment
    moment.locale('vi');
    const [ momentText, setMomentText ] = useState(moment(apptInfo.apptDate).fromNow())
    
    useEffect(() => {
        const timeInterval = setInterval(()=>{
            setMomentText(moment(apptInfo.apptDate).fromNow())
            // console.log("Updating time")
        },5000)
        //clean up function
        return () => {
            // console.log("Clearing")
          clearInterval(timeInterval);
        };
      }, [apptInfo.apptDate]);

    return(
        <div className="call-info">
            <h1>
                {apptInfo.professionalsFullName} đã nhận được thông báo.<br />
                Yêu cầu này được khởi tạo {momentText}.
            </h1>
        </div>
    )
}

export default CallInfo