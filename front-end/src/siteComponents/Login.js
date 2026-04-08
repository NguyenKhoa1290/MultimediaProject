import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState('');
    const [isChecking, setIsChecking] = useState(true); 
    const navigate = useNavigate();

    useEffect(() => {
        const checkSession = async () => {
            const token = localStorage.getItem('token');
            if (token) {
                try {
                    const resp = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/validate-link`, 
                        { token }, 
                        { withCredentials: true }
                    );
                    if (resp.data.success) {
                        navigate('/dashboard');
                        return;
                    }
                } catch (err) {
                    localStorage.removeItem('token');
                    localStorage.removeItem('username');
                    localStorage.removeItem('fullName');
                }
            }
            setIsChecking(false);
        };
        checkSession();
    }, [navigate]);

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const resp = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/login`, { 
                email, 
                password,
                rememberMe
            }, { withCredentials: true });
            
            if (resp.data.success) {
                localStorage.setItem('token', resp.data.token);
                localStorage.setItem('username', resp.data.user.username); // Đây là email
                localStorage.setItem('fullName', resp.data.user.fullName);
                if (resp.data.user.avatar) {
                    localStorage.setItem('avatar', resp.data.user.avatar);
                } else {
                    localStorage.removeItem('avatar');
                }
                navigate('/dashboard');
            }
        } catch (err) {
            setError('Sai địa chỉ Gmail hoặc mật khẩu');
        }
    };

    if (isChecking) {
        return (
            <div className="vh-100 d-flex justify-content-center align-items-center bg-light">
                <div className="text-center">
                    <div className="spinner-border text-primary mb-3" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                    <div className="text-muted">Đang kiểm tra phiên đăng nhập...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="container mt-5">
            <div className="row justify-content-center">
                <div className="col-md-4">
                    <div className="card shadow-lg p-4 border-0 rounded-4">
                        <h2 className="text-center mb-4 fw-bold text-primary">TeleLegal</h2>
                        <h5 className="text-center mb-4 text-muted">Đăng nhập hệ thống</h5>
                        {error && <div className="alert alert-danger py-2">{error}</div>}
                        <form onSubmit={handleLogin}>
                            <div className="mb-3">
                                <label className="form-label fw-semibold">Địa chỉ Gmail</label>
                                <input type="email" className="form-control form-control-lg" placeholder="example@gmail.com" value={email} onChange={e => setEmail(e.target.value)} required />
                            </div>
                            <div className="mb-3">
                                <label className="form-label fw-semibold">Mật khẩu</label>
                                <input type="password" title="password" className="form-control form-control-lg" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
                            </div>
                            <div className="mb-4 d-flex justify-content-between align-items-center">
                                <div className="form-check">
                                    <input type="checkbox" className="form-check-input" id="rememberMe" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} />
                                    <label className="form-check-label small" htmlFor="rememberMe">Ghi nhớ tôi (2 tháng)</label>
                                </div>
                            </div>
                            <button className="btn btn-primary btn-lg w-100 mb-3 fw-bold shadow-sm">Vào hệ thống</button>
                            <div className="text-center border-top pt-3">
                                <span className="text-muted">Chưa có tài khoản? </span>
                                <Link to="/register" className="text-decoration-none fw-bold">Đăng ký ngay</Link>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
