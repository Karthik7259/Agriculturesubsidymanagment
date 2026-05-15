import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';

const STATES = [
  'Andhra Pradesh', 'Bihar', 'Gujarat', 'Haryana', 'Karnataka', 'Kerala',
  'Madhya Pradesh', 'Maharashtra', 'Odisha', 'Punjab', 'Rajasthan', 'Tamil Nadu',
  'Telangana', 'Uttar Pradesh', 'West Bengal',
];

type GovernmentProfile = {
  personal?: {
    full_name?: string;
    age?: number;
    gender?: string;
    address?: string;
    contact_details?: { mobile?: string };
  };
  land_records?: Array<{
    land_id?: string;
    survey_number?: string;
    ownership_details?: string;
    land_area_ha?: number;
    soil_type?: string;
    irrigation_availability?: string;
    village?: string;
    taluk?: string;
    district?: string;
    state?: string;
    polygon?: { type: 'Polygon'; coordinates: number[][][] };
  }>;
  financial?: {
    annual_income?: number;
    subsidy_history?: unknown[];
    loan_details?: unknown[];
    insurance_details?: unknown[];
  };
  agriculture?: {
    previously_cultivated_crops?: string[];
    crop_history?: Array<{ season?: string; crop?: string; yield_t_per_ha?: number }>;
    existing_government_scheme_benefits?: string[];
  };
  farmer_category?: string;
};

export default function Register() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    password: '',
    state: 'Maharashtra',
    district: '',
    aadhaar_number: '',
    land_id: '',
    annual_income: '',
    consent_to_tax_fetch: false,
  });
  const [otpSessionId, setOtpSessionId] = useState('');
  const [otp, setOtp] = useState('');
  const [aadhaarToken, setAadhaarToken] = useState('');
  const [govProfile, setGovProfile] = useState<GovernmentProfile | null>(null);
  const [status, setStatus] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  type TextField = Exclude<keyof typeof form, 'consent_to_tax_fetch'>;
  const set = (k: TextField) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const applyGovernmentProfile = (profile: GovernmentProfile) => {
    const land = profile.land_records?.[0] ?? {};
    const mobile = profile.personal?.contact_details?.mobile;
    setForm((current) => ({
      ...current,
      full_name: profile.personal?.full_name || current.full_name,
      phone: mobile || current.phone,
      state: land.state && STATES.includes(land.state) ? land.state : current.state,
      district: land.district || current.district,
      land_id: land.land_id || current.land_id,
      annual_income: profile.financial?.annual_income ? String(profile.financial.annual_income) : current.annual_income,
    }));
    setGovProfile(profile);
    localStorage.setItem('government_profile_autofill', JSON.stringify(profile));
  };

  const startOtp = async () => {
    setErr('');
    setStatus('');
    setBusy(true);
    try {
      const { data } = await api.post('/auth/aadhaar/start', {
        aadhaar_number: form.aadhaar_number,
        full_name: form.full_name || undefined,
      });
      setOtpSessionId(data.session_id);
      setOtp(data.demo_otp);
      setStatus(`Demo OTP sent. Use ${data.demo_otp}.`);
    } catch (ex: any) {
      console.error('Aadhaar OTP start failed', {
        status: ex?.response?.status,
        data: ex?.response?.data,
        message: ex?.message,
      });
      setErr(ex?.response?.data?.detail ?? 'Could not start Aadhaar OTP verification');
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    setErr('');
    setStatus('');
    setBusy(true);
    try {
      const { data } = await api.post('/auth/aadhaar/verify', {
        session_id: otpSessionId,
        otp,
      });
      setAadhaarToken(data.aadhaar_otp_token);
      applyGovernmentProfile(data.profile);
      setStatus('Aadhaar verified. Government land, crop, income, and benefit data linked.');
    } catch (ex: any) {
      console.error('Aadhaar OTP verification failed', {
        status: ex?.response?.status,
        data: ex?.response?.data,
        message: ex?.message,
      });
      setErr(ex?.response?.data?.detail ?? 'Aadhaar OTP verification failed');
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (!aadhaarToken) {
      setErr('Verify Aadhaar OTP before creating the farmer account.');
      return;
    }
    setBusy(true);
    try {
      await api.post('/auth/register', {
        ...form,
        aadhaar_otp_token: aadhaarToken,
        land_id: form.land_id || undefined,
        annual_income: form.annual_income ? Number(form.annual_income) : undefined,
      });
      nav('/login');
    } catch (ex: any) {
      setErr(ex?.response?.data?.detail ?? t('register.failed'));
    } finally {
      setBusy(false);
    }
  };

  const land = govProfile?.land_records?.[0];
  const crop = govProfile?.agriculture?.crop_history?.[0];

  return (
    <div style={{ background: 'linear-gradient(160deg, #fafaf9 0%, #ffffff 60%, #f0fdf4 100%)', minHeight: 'calc(100vh - 65px)' }}>

      {/* ── Hero banner with rice paddy image ──────────────── */}
      <div style={{ position: 'relative', height: 200, overflow: 'hidden' }}>
        <img src="https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=1800&q=80"
          alt="Indian farmland" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 40%' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(0,40,20,0.85) 0%, rgba(0,80,40,0.6) 100%)' }} />
        {/* Tricolor top */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', height: 4 }}>
          <div style={{ flex: 1, background: '#FF9933' }} />
          <div style={{ flex: 1, background: '#ffffff' }} />
          <div style={{ flex: 1, background: '#138808' }} />
        </div>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 16px', borderRadius: 999, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)', marginBottom: 14 }}>
            <span style={{ fontSize: 14 }}>🇮🇳</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.05em' }}>GOVERNMENT OF INDIA — KISAN SEVA PORTAL</span>
          </div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, color: 'white', letterSpacing: '-0.03em' }}>
            {t('register.title')}
          </h1>
          <p style={{ margin: '8px 0 0', fontSize: 14, color: 'rgba(255,255,255,0.65)' }}>
            {t('register.haveAccount')}{' '}
            <Link to="/login" style={{ color: '#86efac', fontWeight: 600 }}>{t('register.loginLink')}</Link>
          </p>
        </div>
      </div>

      {/* ── Ambient blobs ───────────────────────────────────── */}
      <div style={{ position: 'fixed', top: 200, left: 0, width: 400, height: 400, background: 'rgba(187,247,208,0.15)', borderRadius: '50%', filter: 'blur(64px)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: 0, right: 0, width: 480, height: 480, background: 'rgba(254,243,199,0.12)', borderRadius: '50%', filter: 'blur(64px)', pointerEvents: 'none', zIndex: 0 }} />

    <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 16px', position: 'relative', zIndex: 1 }}>
      <div className="card" style={{ padding: 32, borderRadius: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, padding: '10px 16px', background: 'rgba(245,200,66,0.08)', border: '1px solid rgba(245,200,66,0.2)', borderRadius: 12 }}>
          <span style={{ fontSize: 20 }}>ℹ️</span>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Aadhaar is the unique farmer ID for this prototype. Try seeded numbers: <b>111122223333</b>, <b>222233334444</b>, <b>333344445555</b>.
          </p>
        </div>

        <form onSubmit={onSubmit}>
          <div className="card" style={{ margin: '0 0 16px', background: 'var(--surface-2)' }}>
            <h3 style={{ marginBottom: 8 }}>Aadhaar verification</h3>
            <div className="grid-2">
              <div>
                <label>{t('register.aadhaar')}</label>
                <input value={form.aadhaar_number} onChange={set('aadhaar_number')} placeholder="111122223333" required />
              </div>
              <div>
                <label>{t('register.fullName')}</label>
                <input value={form.full_name} onChange={set('full_name')} required />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'end', marginTop: 12 }}>
              <button className="btn btn-secondary" type="button" onClick={startOtp} disabled={busy || form.aadhaar_number.length < 12}>
                Send OTP
              </button>
              <div style={{ flex: 1 }}>
                <label style={{ marginTop: 0 }}>OTP</label>
                <input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="123456" />
              </div>
              <button className="btn btn-primary" type="button" onClick={verifyOtp} disabled={busy || !otpSessionId || !otp}>
                Verify and fetch data
              </button>
            </div>
          </div>

          {govProfile && (
            <div className="card" style={{ margin: '0 0 16px' }}>
              <h3>Linked government profile</h3>
              <div className="grid-2">
                <div><span className="muted">Farmer</span><br />{govProfile.personal?.full_name} ({govProfile.personal?.age}, {govProfile.personal?.gender})</div>
                <div><span className="muted">Farmer category</span><br />{govProfile.farmer_category}</div>
                <div><span className="muted">Land</span><br />{land?.land_area_ha} ha, {land?.soil_type}, {land?.irrigation_availability}</div>
                <div><span className="muted">Location</span><br />{land?.village}, {land?.taluk}, {land?.district}, {land?.state}</div>
                <div><span className="muted">Survey</span><br />{land?.survey_number} · {land?.ownership_details}</div>
                <div><span className="muted">Latest crop</span><br />{crop?.crop ?? 'Not available'} {crop?.season ? `(${crop.season})` : ''}</div>
                <div><span className="muted">Annual income</span><br />Rs {govProfile.financial?.annual_income?.toLocaleString()}</div>
                <div><span className="muted">Existing benefits</span><br />{govProfile.agriculture?.existing_government_scheme_benefits?.join(', ') || 'None'}</div>
              </div>
            </div>
          )}

          <div className="grid-2">
            <div>
              <label>{t('register.phone')}</label>
              <input value={form.phone} onChange={set('phone')} required />
            </div>
            <div>
              <label>{t('register.password')}</label>
              <input type="password" value={form.password} onChange={set('password')} required minLength={6} />
            </div>
          </div>

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

          <div className="grid-2">
            <div>
              <label>{t('register.landId')}</label>
              <input value={form.land_id} onChange={set('land_id')} placeholder="LND-..." />
            </div>
            <div>
              <label>Annual income</label>
              <input type="number" value={form.annual_income} onChange={set('annual_income')} />
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <input
              type="checkbox"
              checked={form.consent_to_tax_fetch}
              onChange={(e) => setForm((f) => ({ ...f, consent_to_tax_fetch: e.target.checked }))}
            />
            <span>{t('register.consentTax')}</span>
          </label>

          {status && <div className="badge badge-ok" style={{ marginTop: 12 }}>{status}</div>}
          {err && <div className="error">{err}</div>}

          <button className="btn btn-primary" type="submit" disabled={busy || !aadhaarToken}
            style={{ marginTop: 20, width: '100%', padding: '12px 20px', borderRadius: 14, fontSize: 15 }}>
            {busy ? t('register.creating') : t('register.createAccount')}
          </button>
        </form>
      </div>
    </div>
    </div>
  );
}
