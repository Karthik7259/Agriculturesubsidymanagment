import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

const FARM_SLIDES = [
  { img: 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=1200&q=80', caption: 'Golden wheat fields of Punjab' },
  { img: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=1200&q=80', caption: 'Rice paddies of the Gangetic plains' },
  { img: 'https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=1200&q=80', caption: 'Aerial view of fertile farmlands' },
];

export default function Login() {
  const { login } = useAuth();
  const { t } = useTranslation();
  const nav = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [slide] = useState(() => Math.floor(Math.random() * FARM_SLIDES.length));

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

  const farm = FARM_SLIDES[slide];

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 65px)' }}>

      {/* ── Left: Farming image panel ──────────────────────── */}
      <div style={{
        flex: '0 0 48%', position: 'relative', overflow: 'hidden',
        display: 'none',  /* hidden on mobile — overridden below via media-query trick */
      }} className="login-img-panel">
        <img src={farm.img} alt="Indian farmland"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />

        {/* Gradient overlay */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(0,30,15,0.82) 0%, rgba(0,50,20,0.55) 60%, rgba(0,0,0,0.3) 100%)' }} />

        {/* Tricolor accent stripe */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', height: 4 }}>
          <div style={{ flex: 1, background: '#FF9933' }} />
          <div style={{ flex: 1, background: '#ffffff' }} />
          <div style={{ flex: 1, background: '#138808' }} />
        </div>

        {/* Content */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '48px 40px' }}>
          {/* Top: Brand */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#16a34a,#059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(22,163,74,0.4)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                </svg>
              </div>
              <div>
                <div style={{ color: 'white', fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em' }}>AgriVerify</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>Kisan Seva Portal</div>
              </div>
            </div>

            <div style={{ marginTop: 48 }}>
              <div style={{ color: '#86efac', fontSize: 12, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 12 }}>
                🇮🇳 Government of India Initiative
              </div>
              <h2 style={{ color: 'white', fontSize: 36, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.15, margin: '0 0 16px' }}>
                Empowering<br />
                <span style={{ background: 'linear-gradient(135deg, #86efac, #34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  14 Crore
                </span>
                <br />Farming Families
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, lineHeight: 1.7, maxWidth: 300 }}>
                Satellite-verified crop data, AI eligibility scoring, and instant UPI payouts — delivered with full transparency.
              </p>
            </div>
          </div>

          {/* Middle: Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { val: '64+', label: 'Govt Schemes', icon: '📜' },
              { val: '28', label: 'States Covered', icon: '🗺️' },
              { val: '<30s', label: 'Verification', icon: '⚡' },
              { val: '91%', label: 'ML Accuracy', icon: '🤖' },
            ].map(s => (
              <div key={s.label} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '12px 14px', backdropFilter: 'blur(8px)' }}>
                <div style={{ fontSize: 18 }}>{s.icon}</div>
                <div style={{ color: '#86efac', fontSize: 20, fontWeight: 800, marginTop: 4 }}>{s.val}</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Bottom: Photo caption */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: 16 }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>📷</span>{farm.caption}
            </div>
          </div>
        </div>
      </div>

      {/* ── Right: Login form ──────────────────────────────── */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        background: 'linear-gradient(160deg, #fafaf9 0%, #ffffff 60%, #f0fdf4 100%)',
        minHeight: 'calc(100vh - 65px)',
        position: 'relative',
        overflowY: 'auto',
      }}>
        {/* Ambient blobs */}
        <div style={{ position: 'fixed', top: 100, right: 0, width: 400, height: 400, background: 'rgba(187,247,208,0.18)', borderRadius: '50%', filter: 'blur(64px)', pointerEvents: 'none', zIndex: 0 }} />
        <div style={{ position: 'fixed', bottom: 60, left: 0, width: 300, height: 300, background: 'rgba(254,243,199,0.15)', borderRadius: '50%', filter: 'blur(64px)', pointerEvents: 'none', zIndex: 0 }} />

        <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>
          {/* Brand pill */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 18px', borderRadius: 999, background: 'rgba(220,252,231,0.8)', border: '1px solid rgba(187,247,208,0.7)', backdropFilter: 'blur(8px)', marginBottom: 20 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#15803d' }}>🌾 Kisan Seva Portal</span>
            </div>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, color: '#1c1917', letterSpacing: '-0.03em' }}>
              {t('login.title')}
            </h1>
            <p style={{ margin: '8px 0 0', fontSize: 14, color: '#78716c' }}>
              {t('login.noAccount')}{' '}
              <Link to="/register" style={{ color: '#16a34a', fontWeight: 600 }}>{t('login.registerHere')}</Link>
            </p>
          </div>

          {/* Form card */}
          <div style={{ background: 'rgba(255,255,255,0.92)', border: '1px solid rgba(231,229,228,0.7)', borderRadius: 24, padding: '36px 32px', boxShadow: '0 8px 32px rgba(0,0,0,0.06)', backdropFilter: 'blur(12px)' }}>
            <form onSubmit={onSubmit}>
              <label style={{ display: 'block', fontSize: 13, color: '#78716c', marginBottom: 6, fontWeight: 500 }}>{t('login.phone')}</label>
              <div style={{ position: 'relative', marginBottom: 4 }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16 }}>📱</span>
                <input value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder={t('login.phonePlaceholder')}
                  style={{ paddingLeft: 42 }} />
              </div>

              <label style={{ display: 'block', fontSize: 13, color: '#78716c', marginTop: 16, marginBottom: 6, fontWeight: 500 }}>{t('login.password')}</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16 }}>🔒</span>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ paddingLeft: 42 }} />
              </div>

              {err && (
                <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.15)', borderRadius: 10, fontSize: 13, color: '#dc2626' }}>
                  ⚠ {err}
                </div>
              )}

              <button type="submit" className="btn btn-primary" disabled={busy}
                style={{ marginTop: 22, width: '100%', padding: '13px 20px', borderRadius: 14, fontSize: 15, letterSpacing: '-0.01em' }}>
                {busy ? '⏳ ' + t('login.signingIn') : '→ ' + t('login.signIn')}
              </button>
            </form>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(231,229,228,0.8)' }} />
              <span style={{ fontSize: 12, color: '#a8a29e' }}>Demo credentials</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(231,229,228,0.8)' }} />
            </div>

            <div style={{ background: 'rgba(245,200,66,0.08)', border: '1px solid rgba(245,200,66,0.2)', borderRadius: 12, padding: '12px 16px' }}>
              <div style={{ fontSize: 12, color: '#92400e', fontWeight: 600, marginBottom: 4 }}>🔑 Admin Access</div>
              <div style={{ fontSize: 13, color: '#78716c' }}>
                Phone: <b style={{ color: '#1c1917' }}>9999999999</b> &nbsp;/&nbsp; Password: <b style={{ color: '#1c1917' }}>admin123</b>
              </div>
            </div>
          </div>

          {/* Ministry attribution */}
          <div style={{ textAlign: 'center', marginTop: 24, fontSize: 11, color: '#a8a29e' }}>
            <div>Ministry of Agriculture &amp; Farmers Welfare, Government of India</div>
            <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
              <span>All systems operational · NIC secured</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (min-width: 768px) {
          .login-img-panel { display: block !important; }
        }
      `}</style>
    </div>
  );
}
