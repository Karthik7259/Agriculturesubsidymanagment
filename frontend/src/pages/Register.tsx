import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';

const STATES = [
  'Andhra Pradesh', 'Bihar', 'Gujarat', 'Haryana', 'Karnataka', 'Kerala',
  'Madhya Pradesh', 'Maharashtra', 'Odisha', 'Punjab', 'Rajasthan', 'Tamil Nadu',
  'Telangana', 'Uttar Pradesh', 'West Bengal',
];

export default function Register() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const [form, setForm] = useState({
    full_name: '', phone: '', password: '',
    state: 'Maharashtra', district: '', aadhaar_number: '', land_id: '', consent_to_tax_fetch: false,
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  type TextField = 'full_name' | 'phone' | 'password' | 'state' | 'district' | 'aadhaar_number' | 'land_id';
  const set = (k: TextField) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await api.post('/auth/register', {
        ...form,
        aadhaar_number: form.aadhaar_number || undefined,
        land_id: form.land_id || undefined,
      });
      nav('/login');
    } catch (ex: any) {
      setErr(ex?.response?.data?.detail ?? t('register.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 520 }}>
      <div className="card">
        <h2>{t('register.title')}</h2>
        <form onSubmit={onSubmit}>
          <label>{t('register.fullName')}</label>
          <input value={form.full_name} onChange={set('full_name')} required />

          <label>{t('register.phone')}</label>
          <input value={form.phone} onChange={set('phone')} required />

          <label>{t('register.password')}</label>
          <input type="password" value={form.password} onChange={set('password')} required minLength={6} />

          <div className="grid-2">
            <div>
              <label>{t('register.state')}</label>
              <select value={form.state} onChange={set('state')}>
                {STATES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label>{t('register.district')}</label>
              <input value={form.district} onChange={set('district')} required />
            </div>
          </div>

          <label>{t('register.aadhaar')}</label>
          <input value={form.aadhaar_number} onChange={set('aadhaar_number')} placeholder="XXXX XXXX XXXX" />

          <label>{t('register.landId')}</label>
          <input value={form.land_id} onChange={set('land_id')} placeholder="LND-..." />

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <input
              type="checkbox"
              checked={form.consent_to_tax_fetch}
              onChange={(e) => setForm((f) => ({ ...f, consent_to_tax_fetch: e.target.checked }))}
            />
            <span>{t('register.consentTax')}</span>
          </label>

          <p className="muted" style={{ marginTop: 8 }}>
            {t('register.incomeAuto')}
          </p>

          {err && <div className="error">{err}</div>}

          <button className="btn btn-primary" type="submit" disabled={busy}
            style={{ marginTop: 16, width: '100%' }}>
            {busy ? t('register.creating') : t('register.createAccount')}
          </button>
        </form>
        <p className="muted" style={{ marginTop: 16 }}>
          {t('register.haveAccount')} <Link to="/login">{t('register.loginLink')}</Link>
        </p>
      </div>
    </div>
  );
}
