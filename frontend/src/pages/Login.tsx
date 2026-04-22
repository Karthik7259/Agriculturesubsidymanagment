import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const u = await login(phone, password);
      nav(u.role === 'admin' ? '/admin' : '/dashboard');
    } catch (ex: any) {
      setErr(ex?.response?.data?.detail ?? 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 420 }}>
      <div className="card">
        <h2>Login</h2>
        <form onSubmit={onSubmit}>
          <label>Phone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit phone" />
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {err && <div className="error">{err}</div>}
          <button type="submit" className="btn btn-primary" disabled={busy} style={{ marginTop: 16, width: '100%' }}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="muted" style={{ marginTop: 16 }}>
          No account? <Link to="/register">Register here</Link>
        </p>
        <p className="muted" style={{ fontSize: 12 }}>
          Admin seed: phone <b>9999999999</b> / password <b>admin123</b>
        </p>
      </div>
    </div>
  );
}
