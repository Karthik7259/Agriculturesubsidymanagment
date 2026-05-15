import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';

type Application = {
  application_id: string;
  scheme_id: string;
  status: string;
  declared_land_ha: number;
  verified_land_ha?: number;
  crop_type: string;
  created_at: string;
};

const statusBadge = (s: string) => {
  const map: Record<string, string> = {
    SUBMITTED: 'badge-info', VERIFYING: 'badge-info',
    APPROVED: 'badge-ok', DISBURSED: 'badge-ok',
    REJECTED: 'badge-err', FLAGGED: 'badge-warn', DBT_FAILED: 'badge-err',
  };
  return map[s] ?? 'badge-muted';
};

const statusColor: Record<string, string> = {
  APPROVED: '#16a34a', DISBURSED: '#16a34a',
  REJECTED: '#dc2626', DBT_FAILED: '#dc2626',
  FLAGGED: '#d97706', SUBMITTED: '#2563eb', VERIFYING: '#2563eb',
};

const CROP_IMAGES: Record<string, string> = {
  wheat:       'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=400&q=70',
  rice:        'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=400&q=70',
  sugarcane:   'https://images.unsplash.com/photo-1605000797499-95a51c5269ae?w=400&q=70',
  maize:       'https://images.unsplash.com/photo-1601593946098-19df3b37b732?w=400&q=70',
  cotton:      'https://images.unsplash.com/photo-1560493676-04071c5f467b?w=400&q=70',
  pulses:      'https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=400&q=70',
  vegetables:  'https://images.unsplash.com/photo-1592982537447-6f2a6a0c7c10?w=400&q=70',
  other:       'https://images.unsplash.com/photo-1560493676-04071c5f467b?w=400&q=70',
};

export default function Dashboard() {
  const { t } = useTranslation();
  const [apps, setApps] = useState<Application[]>([]);
  const [me, setMe] = useState<any>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [app, meResp] = await Promise.all([api.get('/applications/'), api.get('/auth/me')]);
        setApps(app.data);
        setMe(meResp.data);
      } catch (ex: any) {
        setErr(ex?.response?.data?.detail ?? t('dashboard.failedToLoad'));
      }
    })();
  }, [t]);

  const approved = apps.filter(a => ['APPROVED', 'DISBURSED'].includes(a.status)).length;
  const pending = apps.filter(a => ['SUBMITTED', 'VERIFYING'].includes(a.status)).length;
  const flagged = apps.filter(a => a.status === 'FLAGGED').length;

  return (
    <div>
      {/* ── Hero banner ──────────────────────────────────────── */}
      <div style={{ position: 'relative', height: 200, overflow: 'hidden' }}>
        <img
          src="https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=1800&q=75"
          alt="Indian farm aerial view"
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 35%' }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(0,40,20,0.88) 0%, rgba(0,80,40,0.65) 50%, rgba(0,50,30,0.55) 100%)' }} />
        {/* Tricolor stripe */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', height: 4 }}>
          <div style={{ flex: 1, background: '#FF9933' }} />
          <div style={{ flex: 1, background: '#ffffff' }} />
          <div style={{ flex: 1, background: '#138808' }} />
        </div>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', padding: '0 32px', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ color: '#86efac', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8 }}>
              🌾 Kisan Seva Portal
            </div>
            <h2 style={{ color: 'white', fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
              {t('dashboard.welcome')}{me?.full_name ? `, ${me.full_name}` : ''}
            </h2>
            {me && (
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, margin: '6px 0 0' }}>
                ID: <b style={{ color: 'rgba(255,255,255,0.85)' }}>{me.farmer_id}</b>
                &nbsp;·&nbsp; {me.district}, {me.state}
                &nbsp;·&nbsp; ₹{me.annual_income?.toLocaleString()} income
              </p>
            )}
          </div>
          <Link to="/apply" className="btn btn-primary"
            style={{ padding: '12px 24px', borderRadius: 14, fontSize: 14, flexShrink: 0, textDecoration: 'none' }}>
            + {t('dashboard.newApplication')}
          </Link>
        </div>
      </div>

      <div className="container">

        {/* ── Quick stats ──────────────────────────────────────── */}
        <div className="grid-3" style={{ marginTop: 0 }}>
          {[
            { label: 'Total Applications', val: apps.length, icon: '📋', color: '#2563eb' },
            { label: 'Approved / Disbursed', val: approved, icon: '✅', color: '#16a34a' },
            { label: 'Pending Review', val: pending, icon: '⏳', color: '#d97706' },
          ].map(s => (
            <div key={s.label} className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '18px 22px', margin: 0 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: s.color + '12', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                {s.icon}
              </div>
              <div>
                <div style={{ fontSize: 26, fontWeight: 800, color: s.color, letterSpacing: '-0.03em' }}>{s.val}</div>
                <div style={{ fontSize: 12, color: '#78716c', marginTop: 1 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Government profile card ──────────────────────────── */}
        {me?.government_profile && (
          <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
            {/* Card header with image */}
            <div style={{ position: 'relative', height: 100 }}>
              <img
                src="https://images.unsplash.com/photo-1592982537447-6f2a6a0c7c10?w=1200&q=70"
                alt="Farmland"
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 60%', filter: 'brightness(0.45)' }}
              />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', gap: 14, padding: '0 24px' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg,#16a34a,#059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0, border: '2px solid rgba(255,255,255,0.3)' }}>
                  👨‍🌾
                </div>
                <div>
                  <h3 style={{ margin: 0, color: 'white', fontSize: 16, fontWeight: 700 }}>Unified Farmer Profile</h3>
                  <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 }}>
                    Linked via Aadhaar · Ministry of Agriculture &amp; Farmers Welfare
                  </div>
                </div>
              </div>
            </div>

            <div style={{ padding: 24 }}>
              <div className="grid-2">
                <div>
                  <span className="muted">Personal details</span><br />
                  {me.government_profile.personal?.age} years · {me.government_profile.personal?.gender}<br />
                  <span className="muted">{me.government_profile.personal?.address}</span>
                </div>
                <div>
                  <span className="muted">Farmer category</span><br />
                  {me.farmer_category || me.government_profile.farmer_category}
                </div>
                <div>
                  <span className="muted">Land ownership</span><br />
                  {(me.land_records || []).map((land: any) => (
                    <div key={land.land_id}>
                      <b>{land.land_id}</b> · Survey {land.survey_number} · {land.land_area_ha} ha · {land.ownership_details}
                      <br /><span className="muted">{land.soil_type} · {land.irrigation_availability} · {land.village}, {land.district}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <span className="muted">Financial records</span><br />
                  Loans: {me.financial_records?.loan_details?.length ?? 0} · Insurance: {me.financial_records?.insurance_details?.length ?? 0} · Subsidies: {me.financial_records?.subsidy_history?.length ?? 0}
                </div>
              </div>
              {me.crop_history?.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <span className="muted">Crop history</span>
                  <table style={{ marginTop: 6 }}>
                    <thead><tr><th>Season</th><th>Crop</th><th>Yield</th></tr></thead>
                    <tbody>
                      {me.crop_history.map((row: any, i: number) => (
                        <tr key={`${row.season}-${i}`}>
                          <td>{row.season}</td>
                          <td style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <img src={CROP_IMAGES[row.crop] || CROP_IMAGES.other} alt={row.crop}
                              style={{ width: 24, height: 24, borderRadius: 6, objectFit: 'cover' }} />
                            {row.crop}
                          </td>
                          <td>{row.yield_t_per_ha ? `${row.yield_t_per_ha} t/ha` : 'Not available'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Applications table ───────────────────────────────── */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>{t('dashboard.yourApplications')}</h3>
            {flagged > 0 && (
              <span className="badge badge-warn">⚠ {flagged} flagged</span>
            )}
          </div>
          {err && <div className="error">{err}</div>}
          {apps.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🌱</div>
              <p className="muted">{t('dashboard.noneYet')}</p>
              <Link to="/apply" className="btn btn-primary" style={{ marginTop: 8 }}>{t('dashboard.newApplication')}</Link>
            </div>
          )}
          {apps.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>{t('dashboard.cols.id')}</th>
                    <th>Crop</th>
                    <th>{t('dashboard.cols.scheme')}</th>
                    <th>{t('dashboard.cols.declared')}</th>
                    <th>{t('dashboard.cols.verified')}</th>
                    <th>{t('dashboard.cols.status')}</th>
                    <th>{t('dashboard.cols.created')}</th>
                  </tr>
                </thead>
                <tbody>
                  {apps.map((a) => (
                    <tr key={a.application_id}
                      onClick={() => { window.location.href = `/applications/${a.application_id}`; }}
                      style={{ cursor: 'pointer' }}>
                      <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#78716c' }}>{a.application_id.slice(0, 12)}…</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <img src={CROP_IMAGES[a.crop_type] || CROP_IMAGES.other} alt={a.crop_type}
                            style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'cover' }} />
                          <span style={{ textTransform: 'capitalize' }}>{a.crop_type}</span>
                        </div>
                      </td>
                      <td>{a.scheme_id.replace('S-', '')}</td>
                      <td>{a.declared_land_ha.toFixed(2)} ha</td>
                      <td>{a.verified_land_ha != null ? `${a.verified_land_ha.toFixed(2)} ha` : '—'}</td>
                      <td>
                        <span className={`badge ${statusBadge(a.status)}`}
                          style={{ color: statusColor[a.status] }}>
                          {a.status}
                        </span>
                      </td>
                      <td className="muted">{new Date(a.created_at).toLocaleDateString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
