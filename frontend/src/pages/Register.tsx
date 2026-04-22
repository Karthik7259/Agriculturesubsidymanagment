import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';

const STATES = [
  'Andhra Pradesh', 'Bihar', 'Gujarat', 'Haryana', 'Karnataka', 'Kerala',
  'Madhya Pradesh', 'Maharashtra', 'Odisha', 'Punjab', 'Rajasthan', 'Tamil Nadu',
  'Telangana', 'Uttar Pradesh', 'West Bengal',
];

export default function Register() {
  const nav = useNavigate();
  const [form, setForm] = useState({
    full_name: '', phone: '', password: '',
    state: 'Maharashtra', district: '', annual_income: '',
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await api.post('/auth/register', { ...form, annual_income: Number(form.annual_income) });
      nav('/login');
    } catch (ex: any) {
      setErr(ex?.response?.data?.detail ?? 'Registration failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 520 }}>
      <div className="card">
        <h2>Register as a Farmer</h2>
        <form onSubmit={onSubmit}>
          <label>Full name</label>
          <input value={form.full_name} onChange={set('full_name')} required />

          <label>Phone (10 digits)</label>
          <input value={form.phone} onChange={set('phone')} required />

          <label>Password (min 6 chars)</label>
          <input type="password" value={form.password} onChange={set('password')} required minLength={6} />

          <div className="grid-2">
            <div>
              <label>State</label>
              <select value={form.state} onChange={set('state')}>
                {STATES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label>District</label>
              <input value={form.district} onChange={set('district')} required />
            </div>
          </div>

          <label>Annual income (₹)</label>
          <input type="number" value={form.annual_income} onChange={set('annual_income')} required min={0} />

          {err && <div className="error">{err}</div>}

          <button className="btn btn-primary" type="submit" disabled={busy}
            style={{ marginTop: 16, width: '100%' }}>
            {busy ? 'Creating…' : 'Create account'}
          </button>
        </form>
        <p className="muted" style={{ marginTop: 16 }}>
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}
