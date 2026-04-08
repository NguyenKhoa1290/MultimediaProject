import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

const Register = () => {
    const [email, setEmail] = useState('');
    const [fullName, setFullName] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');
    
    const [otpSent, setOtpSent] = useState(false); // Trạng thái đã gửi OTP hay chưa
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const navigate = useNavigate();

    // Bước 1: Đăng ký thông tin và nhận OTP
    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        try {
            const resp = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/register`, { 
                email, 
                fullName, 
                password 
            });
            if (resp.data.success) {
                setOtpSent(true);
                setMessage(resp.data.message);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Lỗi khi đăng ký');
        }
    };

    // Bước 2: Xác thực OTP để hoàn tất
    const handleVerifyOTP = async (e) => {
        e.preventDefault();
        setError('');
        try {
            const resp = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/verify-otp`, { 
                email, 
                otp 
            });
            if (resp.data.success) {
                alert('Đăng ký và xác thực thành công! Vui lòng đăng nhập.');
                navigate('/login');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Mã OTP không hợp lệ');
        }
    };

    return (
        <div className="container mt-5">
            <div className="row justify-content-center">
                <div className="col-md-4">
                    <div className="card shadow-lg p-4 border-0 rounded-4">
                        <h2 className="text-center mb-4 fw-bold text-primary">TeleLegal</h2>
                        <h5 className="text-center mb-4 text-muted">
                            {otpSent ? 'Xác thực Email' : 'Đăng ký tài khoản'}
                        </h5>
                        
                        {error && <div className="alert alert-danger py-2">{error}</div>}
                        {message && <div className="alert alert-success py-2">{message}</div>}

                        {!otpSent ? (
                            // FORM ĐĂNG KÝ
                            <form onSubmit={handleRegister}>
                                <div className="mb-3">
                                    <label className="form-label fw-semibold">Địa chỉ Gmail</label>
                                    <input type="email" className="form-control form-control-lg" placeholder="example@gmail.com" value={email} onChange={e => setEmail(e.target.value)} required />
                                </div>
                                <div className="mb-3">
                                    <label className="form-label fw-semibold">Họ và tên</label>
                                    <input type="text" className="form-control form-control-lg" placeholder="Nguyễn Văn A" value={fullName} onChange={e => setFullName(e.target.value)} required />
                                </div>
                                <div className="mb-3">
                                    <label className="form-label fw-semibold">Mật khẩu</label>
                                    <input type="password" title="password" className="form-control form-control-lg" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
                                </div>
                                <button className="btn btn-primary btn-lg w-100 mb-3 fw-bold shadow-sm">Nhận mã xác thực</button>
                                <div className="text-center">
                                    <span className="text-muted">Đã có tài khoản? </span>
                                    <Link to="/login" className="text-decoration-none fw-bold">Đăng nhập</Link>
                                </div>
                            </form>
                        ) : (
                            // FORM NHẬP OTP
                            <form onSubmit={handleVerifyOTP}>
                                <div className="text-center mb-4">
                                    <p className="text-muted small">Vui lòng kiểm tra hòm thư <b>{email}</b> để lấy mã OTP 6 số.</p>
                                </div>
                                <div className="mb-4">
                                    <input 
                                        type="text" 
                                        className="form-control form-control-lg text-center fw-bold" 
                                        style={{ letterSpacing: '10px', fontSize: '24px' }}
                                        placeholder="000000" 
                                        maxLength="6"
                                        value={otp} 
                                        onChange={e => setOtp(e.target.value)} 
                                        required 
                                    />
                                </div>
                                <button className="btn btn-success btn-lg w-100 mb-3 fw-bold shadow-sm">Xác nhận</button>
                                <button type="button" className="btn btn-link w-100 text-decoration-none text-muted" onClick={() => setOtpSent(false)}>
                                    Quay lại sửa Email
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Register;
