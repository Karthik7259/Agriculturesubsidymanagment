import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';

type AuditEntry = {
  from_state: string | null;
  to_state: string;
  triggered_by: string;
  timestamp: string;
  payload_hash?: string;
  note?: string;
};

type CadastralParcel = {
  parcel_id: string;
  state: string;
  district: string;
  taluka: string;
  survey_no: string;
  khata_no: string;
  total_hectares: number;
  classification: string;
  soil_type: string;
  irrigation_source: string;
  owner_name: string;
  ownership_since: string;
  ownership_history?: { owner_name: string; from: string; to: string; transfer_type: string }[];
  crop_history?: { season: string; crop: string; yield_t_per_ha: number; verified_by: string }[];
  disputes?: { opened_at: string; status: string; reason: string }[];
};

type MarketBenchmark = {
  available: boolean;
  district?: string;
  state?: string;
  commodity?: string;
  avg_modal_price?: number;
  min_price?: number;
  max_price?: number;
  markets_count?: number;
  sample_size?: number;
};

type GovCropData = {
  data_gov_enriched?: boolean;
  mandi_price_benchmark?: MarketBenchmark;
  market_context?: {
    mandi_benchmark?: MarketBenchmark;
    estimated_value_per_ha?: number;
    state_level_records?: number;
  };
};

type App = {
  application_id: string;
  scheme_id: string;
  status: string;
  crop_type: string;
  declared_land_ha: number;
  verified_land_ha?: number;
  cadastral_land_ha?: number;
  cadastral_parcel?: CadastralParcel;
  cadastral_match_kind?: string;
  mean_ndvi?: number;
  eligibility_prob?: number;
  shap_explanation?: string;
  fraud_flags: string[];
  dbt_status?: string;
  dbt_txn_id?: string;
  dbt_bank_name?: string;
  dbt_ifsc?: string;
  dbt_account_masked?: string;
  dbt_npci_ref?: string;
  dbt_balance_after?: number;
  dbt_error?: string;
  ndvi_preview_url?: string;
  gov_crop_data?: GovCropData;
  created_at: string;
  audit_trail?: AuditEntry[];
  admin_note?: string;
  admin_decision_at?: string;
  priority?: string;
};

const statusBadge = (s: string) => {
  const map: Record<string, string> = {
    SUBMITTED: 'badge-info', VERIFYING: 'badge-info',
    APPROVED: 'badge-ok', DISBURSED: 'badge-ok',
    REJECTED: 'badge-err', FLAGGED: 'badge-warn',
    DBT_FAILED: 'badge-err',
  };
  return map[s] ?? 'badge-muted';
};

const FLAG_META: Record<string, { label: string; desc: string; severity: 'critical' | 'warning' | 'info' }> = {
  HIGH_OVERCLAIM:          { label: 'High Overclaim',           desc: 'Satellite-verified area is less than 70% of declared area — significant land size mismatch.',             severity: 'critical' },
  NON_CROPPED_LAND:        { label: 'Non-Cropped Land',         desc: 'Mean NDVI below 0.15 for a crop that should show active vegetation — possible fallow or barren land.',     severity: 'critical' },
  CADASTRAL_MISMATCH:      { label: 'Cadastral Mismatch',       desc: 'Declared area exceeds the official cadastral record by more than 10%.',                                   severity: 'warning' },
  CADASTRAL_UNVERIFIED:    { label: 'Cadastral Unverified',     desc: 'No matching parcel found in the land registry — ownership could not be confirmed.',                       severity: 'info' },
  DUPLICATE_PARCEL:        { label: 'Duplicate Parcel',         desc: 'The same polygon has been submitted under another application.',                                           severity: 'critical' },
  ANOMALY:                 { label: 'Statistical Anomaly',      desc: 'IsolationForest model detected unusual feature patterns that deviate from normal applications.',           severity: 'warning' },
  CROP_HISTORY_MISMATCH:   { label: 'Crop History Mismatch',    desc: 'Declared crop does not appear in the parcel\'s cadastral crop history.',                                   severity: 'warning' },
  CADASTRAL_DISPUTE_OPEN:  { label: 'Open Land Dispute',        desc: 'The parcel has an unresolved ownership or boundary dispute in official records.',                          severity: 'critical' },
  LAND_NOT_AGRICULTURAL:   { label: 'Non-Agricultural Land',    desc: 'Parcel classification in the registry is not agricultural or horticultural.',                              severity: 'critical' },
  NO_MANDI_ACTIVITY:       { label: 'No Mandi Activity',        desc: 'Zero mandi trade records found for this crop in the farmer\'s state on data.gov.in.',                     severity: 'warning' },
  UNREALISTIC_PRODUCTION_VALUE: { label: 'Unrealistic Production', desc: 'Estimated production value exceeds ₹5 lakh per hectare — unusually high.',                             severity: 'warning' },
  CADASTRAL_API_ERROR:     { label: 'Registry Unavailable',     desc: 'Land records API returned an error — cadastral verification could not be completed.',                     severity: 'info' },
};

function parseShapFactors(explanation?: string): { feature: string; pct: number; direction: 'for' | 'against' }[] {
  if (!explanation) return [];
  return explanation.split('|').map(s => s.trim()).filter(Boolean).map(part => {
    const match = part.match(/^(\S+)\s+([\d.]+)%\s+(for|against)\s+eligibility$/i);
    if (!match) return null;
    return { feature: match[1], pct: parseFloat(match[2]), direction: match[3].toLowerCase() as 'for' | 'against' };
  }).filter(Boolean) as { feature: string; pct: number; direction: 'for' | 'against' }[];
}

function ndviColor(ndvi: number): string {
  if (ndvi < 0.15) return 'var(--danger)';
  if (ndvi < 0.30) return 'var(--warning)';
  if (ndvi < 0.50) return '#a3e635';
  return 'var(--primary)';
}

function ndviLabel(ndvi: number): string {
  if (ndvi < 0.15) return 'Barren / No Crop';
  if (ndvi < 0.30) return 'Sparse Vegetation';
  if (ndvi < 0.50) return 'Moderate Vegetation';
  if (ndvi < 0.70) return 'Healthy Vegetation';
  return 'Dense Vegetation';
}

const FEATURE_LABELS: Record<string, string> = {
  overclaim_ratio: 'Overclaim Ratio',
  mean_ndvi: 'Vegetation Index (NDVI)',
  annual_income: 'Annual Income',
  declared_land_ha: 'Declared Land',
  verified_land_ha: 'Verified Land',
  cadastral_land_ha: 'Cadastral Land',
  crop_is_high_vigor: 'Crop Vigor',
};

export default function ApplicationStatus() {
  const { id } = useParams();
  const { t } = useTranslation();
  const [app, setApp] = useState<App | null>(null);
  const [err, setErr] = useState('');
  const [liveStep, setLiveStep] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const STEP_LABEL: Record<string, string> = {
    ndvi_fetch_start: t('appStatus.progress.ndviStart'),
    ndvi_fetch_done: t('appStatus.progress.ndviDone'),
    cadastral_fetch_start: t('appStatus.progress.cadStart'),
    cadastral_fetch_done: t('appStatus.progress.cadDone'),
    ml_inference_start: t('appStatus.progress.mlStart'),
    ml_inference_done: t('appStatus.progress.mlDone'),
  };

  const load = async () => {
    try {
      const { data } = await api.get(`/applications/${id}`);
      setApp(data);
    } catch (ex: any) {
      setErr(ex?.response?.data?.detail ?? t('appStatus.failedToLoad'));
    }
  };

  useEffect(() => {
    load();
    const base = (import.meta.env.VITE_API_BASE as string) ?? 'http://localhost:8000';
    const wsUrl = base.replace(/^http/, 'ws') + `/api/ws/applications/${id}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setWsConnected(true);
    ws.onclose = () => setWsConnected(false);
    ws.onerror = () => setWsConnected(false);

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'progress') {
          setLiveStep(msg.step);
          if (msg.step === 'ndvi_fetch_done' && msg.preview_url) {
            setApp((prev) => prev ? { ...prev, ndvi_preview_url: msg.preview_url } : prev);
          }
        }
        if (msg.type === 'state_change') {
          load();
        }
      } catch {
        /* ignore */
      }
    };

    return () => { ws.close(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (err) return <div className="container"><div className="card error">{err}</div></div>;
  if (!app) return <div className="container"><div className="card">{t('common.loading')}</div></div>;

  const maxHa = Math.max(
    app.declared_land_ha ?? 0, app.verified_land_ha ?? 0, app.cadastral_land_ha ?? 0, 1,
  );
  const pct = (v?: number) => `${Math.min(100, ((v ?? 0) / maxHa) * 100)}%`;

  const isActive = ['SUBMITTED', 'VERIFYING'].includes(app.status);
  const p = app.cadastral_parcel;

  return (
    <div className="container">
      {/* ── Application Header ───────────────────────────────── */}
      {(() => {
        const statusConfig: Record<string, { color: string; bg: string; icon: string }> = {
          SUBMITTED:  { color: 'var(--info)',    bg: 'rgba(59,130,246,0.12)',  icon: 'send' },
          VERIFYING:  { color: 'var(--info)',    bg: 'rgba(59,130,246,0.12)',  icon: 'scan' },
          APPROVED:   { color: 'var(--primary)', bg: 'rgba(34,197,94,0.12)',   icon: 'check' },
          DISBURSED:  { color: 'var(--primary)', bg: 'rgba(34,197,94,0.12)',   icon: 'wallet' },
          REJECTED:   { color: 'var(--danger)',  bg: 'rgba(239,68,68,0.12)',   icon: 'x' },
          FLAGGED:    { color: 'var(--warning)', bg: 'rgba(245,158,11,0.12)',  icon: 'flag' },
          DBT_FAILED: { color: 'var(--danger)',  bg: 'rgba(239,68,68,0.12)',   icon: 'x' },
        };
        const sc = statusConfig[app.status] ?? { color: 'var(--muted)', bg: 'var(--surface-2)', icon: 'dot' };
        const submitted = new Date(app.created_at);
        const schemeName = app.scheme_id.replace(/^S-/, '').replace(/-/g, ' ');

        return (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Top gradient accent */}
            <div style={{
              height: 4,
              background: `linear-gradient(90deg, ${sc.color}, ${sc.color}60, transparent)`,
            }} />

            <div style={{ padding: '20px 24px' }}>
              {/* Row 1: ID + badges */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4 }}>
                    Application
                  </div>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: -0.3 }}>
                    {app.application_id}
                  </h2>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  {/* Live indicator */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 12px', borderRadius: 99,
                    background: wsConnected ? 'rgba(34,197,94,0.1)' : 'var(--surface-2)',
                    border: `1px solid ${wsConnected ? 'rgba(34,197,94,0.25)' : 'var(--border)'}`,
                  }}>
                    <div style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: wsConnected ? 'var(--primary)' : 'var(--muted)',
                      boxShadow: wsConnected ? '0 0 8px var(--primary)' : 'none',
                      animation: wsConnected ? 'pulse 2s infinite' : 'none',
                    }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: wsConnected ? 'var(--primary)' : 'var(--muted)' }}>
                      {wsConnected ? 'LIVE' : 'OFFLINE'}
                    </span>
                  </div>

                  {/* Status badge */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 14px', borderRadius: 99,
                    background: sc.bg,
                    border: `1px solid ${sc.color}30`,
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={sc.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      {sc.icon === 'send' && <><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>}
                      {sc.icon === 'scan' && <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>}
                      {sc.icon === 'check' && <polyline points="20 6 9 17 4 12"/>}
                      {sc.icon === 'wallet' && <><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></>}
                      {sc.icon === 'x' && <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>}
                      {sc.icon === 'flag' && <><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></>}
                    </svg>
                    <span style={{ fontSize: 12, fontWeight: 700, color: sc.color }}>{app.status}</span>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }} />

              {/* Row 2: Detail chips */}
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                  </svg>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Scheme</div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginTop: 1 }}>{schemeName}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Crop</div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginTop: 1, textTransform: 'capitalize' }}>{app.crop_type}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Submitted</div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginTop: 1 }}>
                      {submitted.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}, {submitted.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Live progress step */}
              {isActive && liveStep && STEP_LABEL[liveStep] && (
                <div style={{
                  marginTop: 16, padding: '10px 14px', borderRadius: 8,
                  background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', background: 'var(--info)',
                    boxShadow: '0 0 8px var(--info)',
                    animation: 'pulse 1.5s infinite',
                  }} />
                  <span style={{ fontSize: 13, color: 'var(--info)', fontWeight: 500 }}>{STEP_LABEL[liveStep]}</span>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Admin Decision Notice ────────────────────────────── */}
      {app.admin_note && (
        (() => {
          const isPositive = ['APPROVED', 'DISBURSED'].includes(app.status);
          const isNegative = ['REJECTED'].includes(app.status);
          const isWarning = ['FLAGGED', 'INFO_REQUESTED', 'UNDER_REVIEW'].includes(app.status);
          const borderColor = isPositive ? '#16a34a' : isNegative ? '#dc2626' : '#d97706';
          const bgColor = isPositive ? 'rgba(34,197,94,0.06)' : isNegative ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)';
          const icon = isPositive ? '✅' : isNegative ? '❌' : '📋';
          const label = isPositive ? 'Approved by Authority' : isNegative ? 'Rejected by Authority' : isWarning ? 'Action Required' : 'Official Notice';
          return (
            <div style={{ borderRadius: 14, border: `1.5px solid ${borderColor}40`, background: bgColor, padding: '16px 20px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ fontSize: 24, flexShrink: 0 }}>{icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: borderColor, marginBottom: 6 }}>
                  {label}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>{app.admin_note}</div>
                {app.admin_decision_at && (
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
                    Ministry of Agriculture &amp; Farmers Welfare ·{' '}
                    {new Date(app.admin_decision_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </div>
                )}
              </div>
            </div>
          );
        })()
      )}

      {/* ── Info Requested Notice ─────────────────────────────── */}
      {app.status === 'INFO_REQUESTED' && (
        <div style={{ borderRadius: 14, border: '1.5px solid rgba(147,51,234,0.3)', background: 'rgba(147,51,234,0.05)', padding: '16px 20px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#9333ea', marginBottom: 6 }}>📋 Additional Information Required</div>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0, lineHeight: 1.6 }}>
            The reviewing authority has requested additional documentation or clarification. Please contact your nearest Kisan Seva Kendra or respond via the helpline <b>1800-180-1551</b>.
          </p>
        </div>
      )}

      {/* ── Under Review Notice ───────────────────────────────── */}
      {app.status === 'UNDER_REVIEW' && (
        <div style={{ borderRadius: 14, border: '1.5px solid rgba(14,165,233,0.3)', background: 'rgba(14,165,233,0.05)', padding: '16px 20px', display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#0ea5e9', flexShrink: 0, boxShadow: '0 0 8px #0ea5e9', animation: 'pulse 2s infinite' }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#0ea5e9', marginBottom: 4 }}>Under Official Review</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Your application is currently being reviewed by the district authorities. You will be notified of the outcome.</div>
          </div>
        </div>
      )}

      {/* ── NDVI Preview ──────────────────────────────────────── */}
      {app.ndvi_preview_url && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{
            padding: '16px 22px',
            borderBottom: '1px solid var(--border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
              </svg>
              <h3 style={{ margin: 0 }}>{t('appStatus.ndviPreview.title')}</h3>
            </div>
            {app.mean_ndvi != null && (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
                background: `${ndviColor(app.mean_ndvi)}18`,
                color: ndviColor(app.mean_ndvi),
              }}>
                NDVI {app.mean_ndvi.toFixed(3)}
              </span>
            )}
          </div>

          {/* Image */}
          <div style={{ padding: '14px 22px 10px' }}>
            <div style={{
              position: 'relative', borderRadius: 10, overflow: 'hidden',
              border: '1px solid var(--border)', background: 'var(--bg)',
              maxHeight: 220,
            }}>
              <img
                src={app.ndvi_preview_url}
                alt={t('appStatus.ndviPreview.alt')}
                style={{
                  width: '100%', display: 'block', maxHeight: 220, objectFit: 'cover',
                  imageRendering: 'pixelated',
                }}
              />
              <div style={{
                position: 'absolute', bottom: 8, left: 8,
                padding: '3px 8px', borderRadius: 5,
                background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                fontSize: 10, color: '#fff', fontWeight: 600,
              }}>
                Sentinel-2 NDVI
              </div>
            </div>
          </div>

          {/* Compact horizontal legend */}
          <div style={{ padding: '6px 22px 14px', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginRight: 4 }}>Legend</span>
            {[
              { label: 'Dense',   color: '#145F28' },
              { label: 'Healthy', color: '#288C3C' },
              { label: 'Moderate', color: '#5AB45A' },
              { label: 'Sparse',  color: '#AAD264' },
              { label: 'Low',     color: '#FFE682' },
              { label: 'Bare',    color: '#D6B464' },
              { label: 'Water',   color: '#8B5A2B' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: item.color }} />
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Land Verification ─────────────────────────────────── */}
      <div className="card">
        <h3>{t('appStatus.landVerification.title')}</h3>

        {/* Stat cards row */}
        <div className="grid-3" style={{ marginBottom: 20 }}>
          <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '16px 18px', border: '1px solid var(--border)' }}>
            <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Declared</div>
            <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>{app.declared_land_ha?.toFixed(2)} <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--muted)' }}>ha</span></div>
          </div>
          <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '16px 18px', border: '1px solid var(--border)' }}>
            <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Satellite Verified</div>
            <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4, color: 'var(--info)' }}>
              {app.verified_land_ha != null ? app.verified_land_ha.toFixed(2) : '—'} <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--muted)' }}>ha</span>
            </div>
            {app.verified_land_ha != null && app.declared_land_ha > 0 && (
              <div style={{ fontSize: 12, marginTop: 4, color: app.verified_land_ha >= app.declared_land_ha * 0.7 ? 'var(--primary)' : 'var(--danger)' }}>
                {((app.verified_land_ha / app.declared_land_ha) * 100).toFixed(0)}% of declared
              </div>
            )}
          </div>
          <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '16px 18px', border: '1px solid var(--border)' }}>
            <div className="muted" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Cadastral Registry</div>
            <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4, color: app.cadastral_land_ha ? 'var(--warning)' : 'var(--muted)' }}>
              {app.cadastral_land_ha != null ? app.cadastral_land_ha.toFixed(2) : '—'} <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--muted)' }}>ha</span>
            </div>
            {!app.cadastral_land_ha && <div style={{ fontSize: 12, marginTop: 4, color: 'var(--muted)' }}>Not available</div>}
          </div>
        </div>

        {/* Comparison bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { label: 'Declared', val: app.declared_land_ha, color: 'var(--primary)' },
            { label: 'Verified', val: app.verified_land_ha, color: 'var(--info)' },
            { label: 'Cadastral', val: app.cadastral_land_ha, color: 'var(--warning)' },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 80, fontSize: 13, color: 'var(--muted)', textAlign: 'right' }}>{label}</span>
              <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 6, height: 24, overflow: 'hidden', position: 'relative' }}>
                <div style={{
                  width: pct(val),
                  height: '100%',
                  background: `linear-gradient(90deg, ${color}, ${color}cc)`,
                  borderRadius: 6,
                  transition: 'width 0.6s ease',
                }} />
              </div>
              <span style={{ width: 70, fontSize: 13, fontWeight: 600, textAlign: 'right' }}>
                {val != null ? `${val.toFixed(2)} ha` : '—'}
              </span>
            </div>
          ))}
        </div>

        {/* NDVI Meter */}
        {app.mean_ndvi != null && (
          <div style={{ marginTop: 24, padding: '16px 20px', background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Vegetation Health (NDVI)</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: ndviColor(app.mean_ndvi) }}>{ndviLabel(app.mean_ndvi)}</span>
            </div>
            <div style={{ position: 'relative', height: 14, background: 'var(--surface-2)', borderRadius: 7, overflow: 'hidden' }}>
              <div style={{
                background: 'linear-gradient(90deg, #dc2626, #f59e0b, #a3e635, #22c55e, #15803d)',
                height: '100%',
                borderRadius: 7,
                opacity: 0.3,
              }} />
              <div style={{
                position: 'absolute',
                left: `${Math.min(100, (app.mean_ndvi / 0.9) * 100)}%`,
                top: -3,
                transform: 'translateX(-50%)',
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: ndviColor(app.mean_ndvi),
                border: '3px solid var(--surface)',
                boxShadow: `0 0 8px ${ndviColor(app.mean_ndvi)}80`,
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>
              <span>0.0 Barren</span>
              <span style={{ fontWeight: 600, color: ndviColor(app.mean_ndvi) }}>{app.mean_ndvi.toFixed(3)}</span>
              <span>0.9 Dense</span>
            </div>
          </div>
        )}
      </div>

      {p && (
        <div className="card">
          <h3>{t('appStatus.cadastral.title')}</h3>
          <p className="muted" style={{ marginTop: 0, fontSize: 12 }}>
            {t('appStatus.cadastral.matchKind')}: <b>{app.cadastral_match_kind}</b> · {t('appStatus.cadastral.parcel')} <b>{p.parcel_id}</b> · {t('appStatus.cadastral.survey')} {p.survey_no} · {t('appStatus.cadastral.khata')} {p.khata_no}
          </p>
          <div className="grid-2">
            <div>
              <span className="muted">{t('appStatus.cadastral.owner')}</span><br />
              <b>{p.owner_name}</b><br />
              <span className="muted" style={{ fontSize: 12 }}>{t('appStatus.cadastral.since')} {p.ownership_since?.slice(0, 10)}</span>
            </div>
            <div>
              <span className="muted">{t('appStatus.cadastral.location')}</span><br />
              {p.taluka}, {p.district}, {p.state}
            </div>
            <div>
              <span className="muted">{t('appStatus.cadastral.classification')}</span><br />
              <span className="badge badge-info">{p.classification}</span>
            </div>
            <div>
              <span className="muted">{t('appStatus.cadastral.soilIrrigation')}</span><br />
              {p.soil_type} · {p.irrigation_source}
            </div>
          </div>

          {p.ownership_history && p.ownership_history.length > 0 && (
            <>
              <h4 style={{ marginBottom: 8 }}>{t('appStatus.cadastral.ownershipHistory')}</h4>
              <table style={{ fontSize: 13 }}>
                <thead><tr>
                  <th>{t('appStatus.cadastral.colsOwn.owner')}</th>
                  <th>{t('appStatus.cadastral.colsOwn.from')}</th>
                  <th>{t('appStatus.cadastral.colsOwn.to')}</th>
                  <th>{t('appStatus.cadastral.colsOwn.transfer')}</th>
                </tr></thead>
                <tbody>
                  {p.ownership_history.map((h, i) => (
                    <tr key={i}>
                      <td>{h.owner_name}</td>
                      <td>{h.from?.slice(0, 10)}</td>
                      <td>{h.to?.slice(0, 10)}</td>
                      <td><span className="badge badge-muted">{h.transfer_type}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {p.crop_history && p.crop_history.length > 0 && (
            <>
              <h4 style={{ marginBottom: 8, marginTop: 16 }}>{t('appStatus.cadastral.cropHistory')}</h4>
              <table style={{ fontSize: 13 }}>
                <thead><tr>
                  <th>{t('appStatus.cadastral.colsCrop.season')}</th>
                  <th>{t('appStatus.cadastral.colsCrop.crop')}</th>
                  <th>{t('appStatus.cadastral.colsCrop.yield')}</th>
                  <th>{t('appStatus.cadastral.colsCrop.verifiedBy')}</th>
                </tr></thead>
                <tbody>
                  {p.crop_history.map((c, i) => (
                    <tr key={i}>
                      <td>{c.season}</td>
                      <td>{c.crop}</td>
                      <td>{c.yield_t_per_ha}</td>
                      <td><span className="badge badge-muted">{c.verified_by}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {p.disputes && p.disputes.length > 0 && (
            <>
              <h4 style={{ marginBottom: 8, marginTop: 16, color: 'var(--warning)' }}>{t('appStatus.cadastral.disputes')}</h4>
              {p.disputes.map((d, i) => (
                <p key={i} className="muted" style={{ fontSize: 13 }}>
                  {d.opened_at?.slice(0, 10)} · <b>{d.reason}</b> · <span className={`badge ${d.status === 'resolved' ? 'badge-ok' : 'badge-warn'}`}>{d.status}</span>
                </p>
              ))}
            </>
          )}
        </div>
      )}

      {/* ── AI Eligibility Decision ─────────────────────────── */}
      {app.eligibility_prob != null && (() => {
        const prob = app.eligibility_prob * 100;
        const probColor = prob >= 70 ? 'var(--primary)' : prob >= 40 ? 'var(--warning)' : 'var(--danger)';
        const factors = parseShapFactors(app.shap_explanation);

        return (
          <div className="card">
            <h3>{t('appStatus.eligibility.title')}</h3>

            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              {/* Probability Ring */}
              <div style={{ textAlign: 'center', flexShrink: 0 }}>
                <div style={{ position: 'relative', width: 120, height: 120 }}>
                  <svg viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="60" cy="60" r="50" fill="none" stroke="var(--surface-2)" strokeWidth="10" />
                    <circle
                      cx="60" cy="60" r="50" fill="none"
                      stroke={probColor}
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={`${prob * 3.14} 999`}
                      style={{ transition: 'stroke-dasharray 1s ease' }}
                    />
                  </svg>
                  <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: 28, fontWeight: 700, color: probColor }}>{prob.toFixed(1)}</span>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>%</span>
                  </div>
                </div>
                <div style={{ marginTop: 6, fontSize: 12, fontWeight: 600, color: probColor }}>
                  {prob >= 70 ? 'Likely Eligible' : prob >= 40 ? 'Needs Review' : 'Likely Ineligible'}
                </div>
              </div>

              {/* SHAP Factors */}
              {factors.length > 0 && (
                <div style={{ flex: 1, minWidth: 250 }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Key Decision Factors</div>
                  {factors.map(f => (
                    <div key={f.feature} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{FEATURE_LABELS[f.feature] ?? f.feature}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: f.direction === 'for' ? 'var(--primary)' : 'var(--danger)' }}>
                          {f.pct}% {f.direction === 'for' ? 'supports' : 'opposes'}
                        </span>
                      </div>
                      <div style={{ height: 8, background: 'var(--bg)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{
                          width: `${Math.min(100, f.pct)}%`,
                          height: '100%',
                          borderRadius: 4,
                          background: f.direction === 'for'
                            ? 'linear-gradient(90deg, var(--primary), #86efac)'
                            : 'linear-gradient(90deg, var(--danger), #fca5a5)',
                          transition: 'width 0.6s ease',
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Verification Flags ─────────────────────────────────── */}
      {app.fraud_flags?.length > 0 && (() => {
        const flagItems = app.fraud_flags.map(flag =>
          ({ flag, ...(FLAG_META[flag] ?? { label: flag, desc: 'Verification flag raised during processing.', severity: 'info' as const }) })
        );
        const criticalCount = flagItems.filter(f => f.severity === 'critical').length;
        const warningCount = flagItems.filter(f => f.severity === 'warning').length;
        const infoCount = flagItems.filter(f => f.severity === 'info').length;
        const sorted = [...flagItems].sort((a, b) => {
          const order = { critical: 0, warning: 1, info: 2 };
          return order[a.severity] - order[b.severity];
        });

        return (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{
              padding: '18px 22px',
              borderBottom: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: criticalCount > 0 ? 'rgba(239,68,68,0.05)' : 'transparent',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={criticalCount > 0 ? 'var(--danger)' : 'var(--warning)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                </svg>
                <h3 style={{ margin: 0 }}>Verification Flags</h3>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {criticalCount > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: 'rgba(239,68,68,0.15)', color: 'var(--danger)' }}>
                    {criticalCount} critical
                  </span>
                )}
                {warningCount > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: 'rgba(245,158,11,0.15)', color: 'var(--warning)' }}>
                    {warningCount} warning
                  </span>
                )}
                {infoCount > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99, background: 'rgba(59,130,246,0.15)', color: 'var(--info)' }}>
                    {infoCount} info
                  </span>
                )}
              </div>
            </div>

            {/* Flag list */}
            <div style={{ padding: '6px 0' }}>
              {sorted.map((item, idx) => {
                const sevColor = item.severity === 'critical' ? 'var(--danger)' : item.severity === 'warning' ? 'var(--warning)' : 'var(--info)';
                const isLast = idx === sorted.length - 1;

                return (
                  <div key={item.flag} style={{
                    display: 'flex', alignItems: 'stretch',
                    borderBottom: isLast ? 'none' : '1px solid var(--border)',
                  }}>
                    {/* Severity accent strip */}
                    <div style={{
                      width: 4, flexShrink: 0,
                      background: sevColor,
                      borderRadius: idx === 0 ? '4px 0 0 0' : isLast ? '0 0 0 4px' : 0,
                    }} />

                    <div style={{ flex: 1, padding: '16px 20px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                      {/* Icon */}
                      <div style={{
                        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                        background: `${sevColor}15`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {item.severity === 'critical' ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={sevColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                          </svg>
                        ) : item.severity === 'warning' ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={sevColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                          </svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={sevColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                          </svg>
                        )}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 600, fontSize: 14 }}>{item.label}</span>
                          <span style={{
                            fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8,
                            padding: '2px 8px', borderRadius: 4,
                            background: `${sevColor}15`, color: sevColor,
                            flexShrink: 0,
                          }}>{item.severity}</span>
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6, lineHeight: 1.6 }}>
                          {item.desc}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {(() => {
        const bench = app.gov_crop_data?.market_context?.mandi_benchmark ?? app.gov_crop_data?.mandi_price_benchmark;
        const ctx = app.gov_crop_data?.market_context;
        if (!bench?.available) return null;
        return (
          <div className="card">
            <h3>{t('appStatus.marketContext.title', 'Market Price Context')}</h3>
            <p className="muted" style={{ marginTop: 0, fontSize: 12 }}>
              {t('appStatus.marketContext.source', 'Live mandi data from data.gov.in')}
            </p>
            <div className="grid-2">
              <div>
                <span className="muted">{t('appStatus.marketContext.commodity', 'Commodity')}</span><br />
                <b>{bench.commodity}</b>
              </div>
              <div>
                <span className="muted">{t('appStatus.marketContext.district', 'District')}</span><br />
                {bench.district}, {bench.state}
              </div>
              <div>
                <span className="muted">{t('appStatus.marketContext.avgPrice', 'Avg Modal Price')}</span><br />
                <b style={{ fontSize: 18 }}>₹{bench.avg_modal_price?.toLocaleString()}</b>
                <span className="muted" style={{ fontSize: 11 }}> /quintal</span>
              </div>
              <div>
                <span className="muted">{t('appStatus.marketContext.priceRange', 'Price Range')}</span><br />
                ₹{bench.min_price?.toLocaleString()} – ₹{bench.max_price?.toLocaleString()}
              </div>
              <div>
                <span className="muted">{t('appStatus.marketContext.markets', 'Markets Reporting')}</span><br />
                {bench.markets_count} {t('appStatus.marketContext.mandis', 'mandis')}
              </div>
              {ctx?.estimated_value_per_ha && (
                <div>
                  <span className="muted">{t('appStatus.marketContext.estValue', 'Est. Value / ha')}</span><br />
                  <b>₹{ctx.estimated_value_per_ha.toLocaleString()}</b>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {app.dbt_status && (
        <div className="card">
          <h3>{t('appStatus.dbt.title')}</h3>
          <p>
            {t('appStatus.dbt.status')}: <span className={`badge ${app.dbt_status === 'SUCCESS' ? 'badge-ok' : 'badge-err'}`}>{app.dbt_status}</span>
          </p>
          {app.dbt_status === 'SUCCESS' ? (
            <div className="grid-2">
              <div><span className="muted">{t('appStatus.dbt.bank')}</span><br /><b>{app.dbt_bank_name}</b> ({app.dbt_ifsc})</div>
              <div><span className="muted">{t('appStatus.dbt.account')}</span><br />{app.dbt_account_masked}</div>
              <div><span className="muted">{t('appStatus.dbt.txnId')}</span><br />{app.dbt_txn_id}</div>
              <div><span className="muted">{t('appStatus.dbt.npciRef')}</span><br />{app.dbt_npci_ref}</div>
              {app.dbt_balance_after != null && (
                <div><span className="muted">{t('appStatus.dbt.balanceAfter')}</span><br />₹{app.dbt_balance_after.toLocaleString()}</div>
              )}
            </div>
          ) : (
            <p style={{ color: 'var(--danger)' }}>{t('appStatus.dbt.errorLabel')} {app.dbt_error}</p>
          )}
        </div>
      )}

      {/* ── Audit Trail ──────────────────────────────────────── */}
      {app.audit_trail && app.audit_trail.length > 0 && (() => {
        const stateIcon = (state: string) => {
          if (state === 'SUBMITTED') return { color: 'var(--info)', icon: 'send' };
          if (state === 'VERIFYING') return { color: 'var(--info)', icon: 'search' };
          if (state === 'APPROVED') return { color: 'var(--primary)', icon: 'check' };
          if (state === 'DISBURSED') return { color: 'var(--primary)', icon: 'wallet' };
          if (state === 'REJECTED') return { color: 'var(--danger)', icon: 'x' };
          if (state === 'FLAGGED') return { color: 'var(--warning)', icon: 'flag' };
          if (state === 'DBT_FAILED') return { color: 'var(--danger)', icon: 'x' };
          return { color: 'var(--muted)', icon: 'dot' };
        };

        const renderIcon = (icon: string, color: string) => {
          const props = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
          switch (icon) {
            case 'send': return <svg {...props}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
            case 'search': return <svg {...props}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
            case 'check': return <svg {...props}><polyline points="20 6 9 17 4 12"/></svg>;
            case 'wallet': return <svg {...props}><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>;
            case 'x': return <svg {...props}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
            case 'flag': return <svg {...props}><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>;
            default: return <svg {...props}><circle cx="12" cy="12" r="4" fill={color}/></svg>;
          }
        };

        const formatTime = (ts: string) => {
          const d = new Date(ts);
          return {
            date: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
            time: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          };
        };

        const triggerLabel = (t: string) => {
          const map: Record<string, string> = {
            api: 'API Gateway',
            orchestrator: 'Verification Engine',
            'ml-inference': 'ML Pipeline',
            admin: 'Admin Override',
            dbt: 'DBT Processor',
          };
          return map[t] ?? t;
        };

        return (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{
              padding: '18px 22px',
              borderBottom: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--info)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                <h3 style={{ margin: 0 }}>{t('appStatus.audit.title')}</h3>
              </div>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                {app.audit_trail.length} {app.audit_trail.length === 1 ? 'event' : 'events'}
              </span>
            </div>

            {/* Timeline */}
            <div style={{ padding: '20px 22px 8px' }}>
              {app.audit_trail.map((entry, i) => {
                const { color, icon } = stateIcon(entry.to_state);
                const { date, time } = formatTime(entry.timestamp);
                const isLast = i === app.audit_trail!.length - 1;
                const isFinal = ['APPROVED', 'REJECTED', 'DISBURSED', 'FLAGGED', 'DBT_FAILED'].includes(entry.to_state);

                return (
                  <div key={i} style={{ display: 'flex', gap: 16, minHeight: isLast ? 'auto' : 80 }}>
                    {/* Timeline column */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 40, flexShrink: 0 }}>
                      {/* Node */}
                      <div style={{
                        width: isFinal ? 40 : 34,
                        height: isFinal ? 40 : 34,
                        borderRadius: '50%',
                        background: `${color}18`,
                        border: `2.5px solid ${color}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                        boxShadow: isFinal ? `0 0 16px ${color}40` : 'none',
                      }}>
                        {renderIcon(icon, color)}
                      </div>
                      {/* Connector line */}
                      {!isLast && (
                        <div style={{
                          flex: 1, width: 2, minHeight: 20,
                          background: `linear-gradient(180deg, ${color}80, var(--border))`,
                        }} />
                      )}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, paddingBottom: isLast ? 0 : 20, paddingTop: 2 }}>
                      {/* State transition */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {entry.from_state ? (
                          <span style={{
                            fontSize: 11, padding: '2px 8px', borderRadius: 4,
                            background: 'var(--surface-2)', color: 'var(--muted)',
                          }}>{entry.from_state}</span>
                        ) : (
                          <span style={{
                            fontSize: 11, padding: '2px 8px', borderRadius: 4,
                            background: 'var(--surface-2)', color: 'var(--muted)',
                          }}>NEW</span>
                        )}
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                        <span style={{
                          fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 700,
                          background: `${color}20`, color,
                        }}>{entry.to_state}</span>
                      </div>

                      {/* Meta row */}
                      <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{date}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{time}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                          <span style={{ fontSize: 12, color: 'var(--text)' }}>{triggerLabel(entry.triggered_by)}</span>
                        </div>
                      </div>

                      {/* Note */}
                      {entry.note && (
                        <div style={{
                          marginTop: 8, padding: '8px 12px', borderRadius: 6,
                          background: 'var(--bg)', border: '1px solid var(--border)',
                          fontSize: 13, color: 'var(--muted)', lineHeight: 1.5,
                        }}>
                          {entry.note}
                        </div>
                      )}

                      {/* Hash */}
                      {entry.payload_hash && (
                        <div style={{
                          marginTop: 6, display: 'flex', alignItems: 'center', gap: 6,
                        }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                          </svg>
                          <span style={{
                            fontSize: 11, fontFamily: 'monospace', color: 'var(--muted)',
                            background: 'var(--bg)', padding: '1px 6px', borderRadius: 3,
                            letterSpacing: 0.5,
                          }}>
                            SHA-256: {entry.payload_hash.slice(0, 16)}…
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
