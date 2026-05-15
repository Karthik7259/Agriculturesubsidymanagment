import { Link } from 'react-router-dom';

/* ── Simplified Ashoka Chakra (National Emblem) ─────────── */
function NationalEmblem({ size = 64 }: { size?: number }) {
  const cx = size / 2;
  const cy = size * 0.5;
  const R = size * 0.42;

  const spokes = Array.from({ length: 24 }, (_, i) => {
    const angle = ((i * 15) - 90) * (Math.PI / 180);
    return {
      key: i,
      x1: cx + R * 0.23 * Math.cos(angle), y1: cy + R * 0.23 * Math.sin(angle),
      x2: cx + R * 0.85 * Math.cos(angle), y2: cy + R * 0.85 * Math.sin(angle),
    };
  });

  return (
    <svg width={size} height={size * 1.3} viewBox={`0 0 ${size} ${size * 1.3}`}>
      {/* Ashoka Chakra outer ring */}
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="#f5c842" strokeWidth={size * 0.024} />
      {/* Hub */}
      <circle cx={cx} cy={cy} r={R * 0.18} fill="#f5c842" />
      {/* 24 spokes */}
      {spokes.map(s => (
        <line key={s.key} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
          stroke="#f5c842" strokeWidth={size * 0.019} strokeLinecap="round" />
      ))}
      {/* Lion capital — 3 circles above (simplified) */}
      <circle cx={cx - R * 0.38} cy={cy - R * 1.1} r={R * 0.155} fill="#f5c842" />
      <circle cx={cx} cy={cy - R * 1.2} r={R * 0.175} fill="#f5c842" />
      <circle cx={cx + R * 0.38} cy={cy - R * 1.1} r={R * 0.155} fill="#f5c842" />
      {/* Connecting body bar */}
      <rect x={cx - R * 0.52} y={cy - R * 1.0} width={R * 1.04} height={R * 0.14} rx="2" fill="#f5c842" />
      {/* Base plinth */}
      <rect x={cx - R * 0.66} y={cy - R * 0.88} width={R * 1.32} height={R * 0.1} rx="1.5" fill="#f5c842" />
      {/* Satyamev Jayate */}
      <text x={cx} y={size * 1.26} textAnchor="middle" fill="#f5c842"
        fontSize={size * 0.147} fontFamily="'Noto Serif Devanagari', 'Mangal', serif" fontWeight="700">
        सत्यमेव जयते
      </text>
    </svg>
  );
}

/* ── Hover-aware link helper ─────────────────────────────── */
function FooterLink({ href, children, external = false }: { href: string; children: React.ReactNode; external?: boolean }) {
  const base: React.CSSProperties = { fontSize: 13, color: 'rgba(255,255,255,0.6)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5, transition: 'color 0.18s' };
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" style={base}
        onMouseEnter={e => (e.currentTarget.style.color = '#86efac')}
        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}>
        <span style={{ fontSize: 9, opacity: 0.4 }}>↗</span>{children}
      </a>
    );
  }
  return (
    <Link to={href} style={base}
      onMouseEnter={e => (e.currentTarget.style.color = '#86efac')}
      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.6)')}>
      {children}
    </Link>
  );
}

function FooterHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4 style={{
      fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
      color: '#f5c842', margin: '0 0 14px', paddingBottom: 10,
      borderBottom: '1px solid rgba(255,255,255,0.1)',
    }}>{children}</h4>
  );
}

/* ════════════════════════════════════════════════════════════
   FOOTER — Indian Government Portal Style
════════════════════════════════════════════════════════════ */
export default function Footer() {
  return (
    <footer style={{ fontFamily: "'Inter', system-ui, sans-serif", marginTop: 0 }}>

      {/* ── Tricolor top stripe ─────────────────────────────── */}
      <div style={{ display: 'flex', height: 5 }}>
        <div style={{ flex: 1, background: '#FF9933' }} />
        <div style={{ flex: 1, background: '#ffffff' }} />
        <div style={{ flex: 1, background: '#138808' }} />
      </div>

      {/* ── Government info / accessibility bar ─────────────── */}
      <div style={{ background: '#12285c', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>🇮🇳</span>
            <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: 700 }}>Government of India</span>
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>|</span>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>भारत सरकार</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
            <a href="#main" style={{ color: 'rgba(255,255,255,0.45)', textDecoration: 'none' }}>Skip to Content</a>
            <span>|</span>
            <a href="#" style={{ color: 'rgba(255,255,255,0.45)', textDecoration: 'none' }}>Screen Reader Access</a>
            <span>|</span>
            {['A-', 'A', 'A+'].map((t, i) => (
              <button key={t} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 3, padding: '1px 6px', cursor: 'pointer', fontSize: i === 2 ? 14 : i === 0 ? 11 : 12, color: 'rgba(255,255,255,0.5)', fontFamily: 'inherit' }}>{t}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Hero agriculture image strip ────────────────────── */}
      <div style={{ position: 'relative', height: 120, overflow: 'hidden' }}>
        <img
          src="https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=1800&q=60"
          alt="Indian agricultural fields"
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 60%', filter: 'brightness(0.35)' }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #12285c 0%, transparent 40%, #1e3a5f 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', padding: '0 32px', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ color: '#f5c842', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 600 }}>Ministry of Agriculture &amp; Farmers Welfare</div>
            <div style={{ color: 'white', fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 4 }}>
              AgriVerify — Kisan Seva Portal
            </div>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 2 }}>कृषि और किसान कल्याण मंत्रालय</div>
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            {[
              { val: '64+', label: 'Govt Schemes' },
              { val: '28', label: 'States Covered' },
              { val: '14 Cr', label: 'Farmer Families' },
              { val: '<30s', label: 'Verification Time' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#86efac' }}>{s.val}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main footer body ─────────────────────────────────── */}
      <div style={{ background: '#1e3a5f', color: 'white', padding: '44px 0 32px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '32px 40px' }}>

            {/* Col 1 — Emblem + Brand */}
            <div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 18 }}>
                <NationalEmblem size={64} />
                <div style={{ paddingTop: 4 }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>भारत सरकार</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'white', marginTop: 2, lineHeight: 1.2 }}>Government of India</div>
                  <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)', marginTop: 3 }}>Ministry of Agriculture &amp; Farmers Welfare</div>
                  <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', background: 'rgba(134,239,172,0.1)', border: '1px solid rgba(134,239,172,0.2)', borderRadius: 20 }}>
                    <span style={{ fontSize: 14 }}>🌾</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#86efac' }}>AgriVerify</span>
                  </div>
                </div>
              </div>

              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.75, margin: '0 0 16px', maxWidth: 300 }}>
                AI-powered subsidy verification using satellite imagery, machine learning, and tamper-proof audit trails — delivering transparent governance for India's farming families.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                  <span style={{ color: '#f5c842', fontWeight: 600 }}>☎</span>{' '}
                  <span style={{ fontWeight: 600, color: 'white' }}>Kisan Call Centre: 1800-180-1551</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginLeft: 6 }}>(Toll Free)</span>
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                  <span style={{ color: '#f5c842', fontWeight: 600 }}>✉</span>{' '}
                  <span style={{ color: 'rgba(255,255,255,0.65)' }}>helpdesk@agriverify.gov.in</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, marginTop: 18, flexWrap: 'wrap' }}>
                {['🛰️ ISRO', '🌍 GEE', '💳 NPCI', '📊 NIC', '🔒 UIDAI'].map(b => (
                  <span key={b} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 999, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}>
                    {b}
                  </span>
                ))}
              </div>
            </div>

            {/* Col 2 — Government Portals */}
            <div>
              <FooterHeading>Gov. Portals</FooterHeading>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { name: 'India.gov.in', href: 'https://india.gov.in' },
                  { name: 'PM-KISAN Portal', href: 'https://pmkisan.gov.in' },
                  { name: 'PMFBY Crop Insurance', href: 'https://pmfby.gov.in' },
                  { name: 'PMKSY Irrigation', href: 'https://pmksy.gov.in' },
                  { name: 'data.gov.in', href: 'https://data.gov.in' },
                  { name: 'DigiLocker', href: 'https://digilocker.gov.in' },
                  { name: 'NPCI / UPI', href: 'https://npci.org.in' },
                  { name: 'UIDAI (Aadhaar)', href: 'https://uidai.gov.in' },
                ].map(l => (
                  <li key={l.name}><FooterLink href={l.href} external>{l.name}</FooterLink></li>
                ))}
              </ul>
            </div>

            {/* Col 3 — Platform + Schemes */}
            <div>
              <FooterHeading>Platform</FooterHeading>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
                {[
                  { name: 'Register as Farmer', href: '/register' },
                  { name: 'Login', href: '/login' },
                  { name: 'Apply for Subsidy', href: '/apply' },
                  { name: 'My Dashboard', href: '/dashboard' },
                ].map(l => (
                  <li key={l.name}><FooterLink href={l.href}>{l.name}</FooterLink></li>
                ))}
              </ul>

              <div style={{ marginTop: 22 }}>
                <FooterHeading>Schemes</FooterHeading>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {['PM-KISAN', 'PMFBY', 'PM-KUSUM Solar', 'MIDH Horticulture', 'PMKSY Irrigation', 'State Schemes (35+)'].map(s => (
                    <li key={s} style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>{s}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Col 4 — Technology + Status */}
            <div>
              <FooterHeading>Technology Stack</FooterHeading>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  '🛰️ Sentinel-2 NDVI',
                  '🤖 XGBoost + SHAP ML',
                  '🌍 Google Earth Engine',
                  '🔍 IsolationForest AI',
                  '🏦 HMAC-SHA256 DBT',
                  '🔒 SHA-256 Audit Logs',
                  '📡 WebSocket Live Feed',
                ].map(t => (
                  <li key={t} style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>{t}</li>
                ))}
              </ul>

              {/* System status */}
              <div style={{ marginTop: 20, padding: '14px 16px', background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.18)', borderRadius: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block', boxShadow: '0 0 7px rgba(34,197,94,0.7)' }} />
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', fontWeight: 600 }}>All Systems Operational</span>
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>API · Celery Worker · MinIO · Redis</div>
              </div>

              {/* Crop image */}
              <div style={{ marginTop: 16, borderRadius: 12, overflow: 'hidden', height: 80, position: 'relative' }}>
                <img
                  src="https://images.unsplash.com/photo-1560493676-04071c5f467b?w=400&q=70"
                  alt="Drone view of farm fields"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.5) saturate(1.2)' }}
                />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Satellite Verified 🛰️</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom copyright bar ─────────────────────────────── */}
      <div style={{ background: '#0f2040', padding: '16px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                © 2026 AgriVerify &mdash; A Government of India Initiative under National e-Governance Plan (NeGP)
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.22)', marginTop: 3 }}>
                Designed, developed &amp; maintained by <span style={{ color: 'rgba(255,255,255,0.38)' }}>NIC (National Informatics Centre)</span> &nbsp;·&nbsp; Content owned by Ministry of Agriculture &amp; Farmers Welfare, GoI
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {['Privacy Policy', 'Terms of Use', 'Accessibility Statement', 'Sitemap', 'Copyright Policy'].map((l, i) => (
                <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {i > 0 && <span style={{ color: 'rgba(255,255,255,0.13)' }}>|</span>}
                  <a href="#" style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', textDecoration: 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.38)')}>
                    {l}
                  </a>
                </span>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', textAlign: 'right' }}>
              <div>Last Updated: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
              <div style={{ marginTop: 2 }}>Visitors: 1,42,857 &nbsp;|&nbsp; Best viewed in Chrome / Firefox</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom tricolor stripe ───────────────────────────── */}
      <div style={{ display: 'flex', height: 4 }}>
        <div style={{ flex: 1, background: '#FF9933' }} />
        <div style={{ flex: 1, background: '#ffffff' }} />
        <div style={{ flex: 1, background: '#138808' }} />
      </div>
    </footer>
  );
}
