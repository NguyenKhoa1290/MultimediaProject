import { useEffect, useState } from 'react';
import './ProDashboard.css'
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import socketConnection from '../webRTCutilities/socketConnection';
import proSocketListeners from '../webRTCutilities/proSocketListeners';
import moment from 'moment';
import { useDispatch } from 'react-redux';

const ProDashboard = ()=>{

    const [ searchParams, setSearchParams ] = useSearchParams();
    const navigate = useNavigate();
    const [ apptInfo, setApptInfo ] = useState([]);
    const dispatch = useDispatch();

    useEffect(()=>{
        //grab the token var out of the query string
        const token = searchParams.get('token');
        const socket = socketConnection(token);
        proSocketListeners.proDashabordSocketListeners(socket,setApptInfo,dispatch);
    },[])

    const joinCall = (appt)=>{
        console.log(appt);
        const token = searchParams.get('token');
        //navigate to /join-video-pro
        navigate(`/join-video-pro?token=${token}&uuid=${appt.uuid}&client=${appt.clientName}`)
    }

    return(
        <div className="container">
            <div className="row">
                <div className="col-12 main-border purple-bg"></div>
            </div>
            <div className="row">
                <div className="col-3 purple-bg left-rail text-center">
                    <i className="fa fa-user mb-3"></i>
                    <div className="menu-item active">
                        <li><i className="fa fa-table-columns"></i>Bảng theo dõi</li>
                    </div>
                    <div className="menu-item">
                        <li><i className="fa fa-calendar"></i>Lịch</li>
                    </div>
                    <div className="menu-item">
                        <li><i className="fa fa-gear"></i>Cài đặt</li>
                    </div>
                    <div className="menu-item">
                        <li><i className="fa fa-file-lines"></i>Tệp tin</li>
                    </div>
                    <div className="menu-item">
                        <li><i className="fa fa-chart-pie"></i>Tố cáo</li>
                        </div>
                </div>
                <div className="col-8">
                    <div className="row">
                        <h1>Bảng điều khiển</h1>
                        <div className="row num-1">
                            <div className="col-6">
                                <div className="dash-box clients-board orange-bg">
                                    <h4>Tên chuyên gia</h4>
                                    <li className="client">Top IT</li>
                                </div>
                            </div>
                            <div className="col-6">
                                <div className="dash-box clients-board blue-bg">
                                    <h4>Người đợi giúp</h4>
                                    {apptInfo.map(a=><div key={a.uuid}>
                                            <li className="client">{a.clientName} - {moment(a.apptDate).calendar()} 
                                            {a.waiting ? <>
                                                    <div className="waiting-text d-inline-block">Đang chờ</div>
                                                    <button className="btn btn-danger join-btn" onClick={()=>joinCall(a)}>Vào việc</button>
                                                </> : <></>}
                                            </li>
                                        </div>
                                    )}
                                    
                                </div>
                                
                            </div>
                        </div>
                        <div className="row num-2">
                            <div className="col-6">
                                <div className="dash-box clients-board green-bg">
                                    <h4>Files</h4>
                                    <div className="pointer"><i className="fa fa-plus"></i> <i className="fa fa-folder"></i></div>
                                    <div className="pointer"><i className="fa fa-plus"></i> Tệp</div>
                                </div>
                            </div>
                            <div className="col-6">
                                <div className="dash-box clients-board redish-bg">
                                    <h4>💩 tích</h4>
                                    <div className="text-center">
                                        
                                    </div>
                                </div>
                            </div>

                            

                        </div>
                    </div>
                    <div className="row num-2">
                        <div className="col-4 calendar">
                      
                        </div>    
                    </div>
                </div>



            </div>            
        </div>
    )
}

export default ProDashboard