import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const { t } = useTranslation();
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
      setErr(ex?.response?.data?.detail ?? t('login.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 420 }}>
      <div className="card">
        <h2>{t('login.title')}</h2>
        <form onSubmit={onSubmit}>
          <label>{t('login.phone')}</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('login.phonePlaceholder')} />
          <label>{t('login.password')}</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {err && <div className="error">{err}</div>}
          <button type="submit" className="btn btn-primary" disabled={busy} style={{ marginTop: 16, width: '100%' }}>
            {busy ? t('login.signingIn') : t('login.signIn')}
          </button>
        </form>
        <p className="muted" style={{ marginTop: 16 }}>
          {t('login.noAccount')} <Link to="/register">{t('login.registerHere')}</Link>
        </p>
        <p className="muted" style={{ fontSize: 12 }}>
          {t('login.adminSeed')} <b>9999999999</b> {t('login.and')} <b>admin123</b>
        </p>
      </div>
    </div>
  );
}
