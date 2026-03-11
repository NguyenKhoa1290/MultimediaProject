import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

const Login = () => {
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const resp = await axios.post(`https://${process.env.REACT_APP_SERVER_IP}:9000/login`, { phone, password });
            if (resp.data.success) {
                // Lưu token và thông tin user vào localStorage
                localStorage.setItem('token', resp.data.token);
                localStorage.setItem('username', resp.data.user.username); // username lúc này là phone
                localStorage.setItem('fullName', resp.data.user.fullName);
                if (resp.data.user.avatar) {
                    localStorage.setItem('avatar', resp.data.user.avatar);
                } else {
                    localStorage.removeItem('avatar'); // Xóa avatar cũ nếu tài khoản này chưa có
                }
                navigate('/dashboard');
            }
        } catch (err) {
            setError('Sai số điện thoại hoặc mật khẩu');
        }
    };

    return (
        <div className="container mt-5">
            <div className="row justify-content-center">
                <div className="col-md-4">
                    <div className="card p-4">
                        <h2 className="text-center">Đăng nhập</h2>
                        {error && <div className="alert alert-danger">{error}</div>}
                        <form onSubmit={handleLogin}>
                            <div className="mb-3">
                                <label className="form-label">Số điện thoại:</label>
                                <input type="text" className="form-control" value={phone} onChange={e => setPhone(e.target.value)} required />
                            </div>
                            <div className="mb-3">
                                <label className="form-label">Mật khẩu:</label>
                                <input type="password" title="password" className="form-control" value={password} onChange={e => setPassword(e.target.value)} required />
                            </div>
                            <button className="btn btn-primary w-100 mb-2">Vào hệ thống</button>
                            <div className="text-center">
                                <span>Chưa có tài khoản? </span>
                                <Link to="/register">Đăng ký ngay</Link>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
