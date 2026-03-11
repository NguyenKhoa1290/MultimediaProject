import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

const Register = () => {
    const [phone, setPhone] = useState('');
    const [fullName, setFullName] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleRegister = async (e) => {
        e.preventDefault();
        try {
            const resp = await axios.post(`https://${process.env.REACT_APP_SERVER_IP}:9000/register`, { 
                phone, 
                fullName, 
                password 
            });
            
            if (resp.data.success) {
                alert('Đăng ký thành công! Vui lòng đăng nhập.');
                navigate('/login');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Đã có lỗi xảy ra');
        }
    };

    return (
        <div className="container mt-5">
            <div className="row justify-content-center">
                <div className="col-md-4">
                    <div className="card p-4">
                        <h2 className="text-center">Đăng ký tài khoản</h2>
                        {error && <div className="alert alert-danger">{error}</div>}
                        <form onSubmit={handleRegister}>
                            <div className="mb-3">
                                <label className="form-label">Số điện thoại:</label>
                                <input type="text" className="form-control" value={phone} onChange={e => setPhone(e.target.value)} required />
                            </div>
                            <div className="mb-3">
                                <label className="form-label">Họ và Tên:</label>
                                <input type="text" className="form-control" value={fullName} onChange={e => setFullName(e.target.value)} required />
                            </div>
                            <div className="mb-3">
                                <label className="form-label">Mật khẩu:</label>
                                <input type="password" title="password" className="form-control" value={password} onChange={e => setPassword(e.target.value)} required />
                            </div>
                            <button className="btn btn-success w-100 mb-2">Đăng ký</button>
                            <div className="text-center">
                                <span>Đã có tài khoản? </span>
                                <Link to="/login">Đăng nhập ngay</Link>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Register;
