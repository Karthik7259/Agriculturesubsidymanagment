import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';

type AuditEntry = {
  from_state: string | null;
  to_state: string;
  triggered_by: string;
  timestamp: string;
  payload_hash?: string;
  note?: string;
};

const STATE_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
  SUBMITTED:      { color: '#3b82f6', icon: 'send',   label: 'Submitted' },
  VERIFYING:      { color: '#6366f1', icon: 'scan',   label: 'Verifying' },
  APPROVED:       { color: '#16a34a', icon: 'check',  label: 'Approved' },
  DISBURSED:      { color: '#15803d', icon: 'wallet', label: 'Disbursed' },
  REJECTED:       { color: '#dc2626', icon: 'x',      label: 'Rejected' },
  FLAGGED:        { color: '#d97706', icon: 'flag',   label: 'Flagged' },
  DBT_FAILED:     { color: '#ef4444', icon: 'x',      label: 'DBT Failed' },
  INFO_REQUESTED: { color: '#9333ea', icon: 'info',   label: 'Info Requested' },
  UNDER_REVIEW:   { color: '#0ea5e9', icon: 'eye',    label: 'Under Review' },
};

const TRIGGER_LABEL: Record<string, string> = {
  api: 'API Gateway',
  orchestrator: 'Verification Engine',
  'ml-inference': 'ML Pipeline',
  dbt: 'DBT Processor',
};

function getTriggerLabel(t: string) {
  if (t.startsWith('admin:')) return `Admin Override (${t.split(':')[1]})`;
  return TRIGGER_LABEL[t] ?? t;
}

function StateIcon({ icon, color }: { icon: string; color: string }) {
  const p = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none' as const, stroke: color, strokeWidth: 2.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (icon) {
    case 'send':   return <svg {...p}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
    case 'scan':   return <svg {...p}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
    case 'check':  return <svg {...p}><polyline points="20 6 9 17 4 12"/></svg>;
    case 'wallet': return <svg {...p}><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>;
    case 'x':      return <svg {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
    case 'flag':   return <svg {...p}><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>;
    case 'info':   return <svg {...p}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>;
    case 'eye':    return <svg {...p}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
    default:       return <svg {...p}><circle cx="12" cy="12" r="4" fill={color}/></svg>;
  }
}

export default function AdminAuditTimeline() {
  const { id } = useParams();
  const { t } = useTranslation();
  const [trail, setTrail] = useState<AuditEntry[]>([]);
  const [appData, setAppData] = useState<any>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    Promise.all([
      api.get(`/admin/audit/${id}`),
      api.get(`/applications/${id}`).catch(() => ({ data: null })),
    ]).then(([auditRes, appRes]) => {
      setTrail(auditRes.data);
      setAppData(appRes.data);
    }).catch((ex) => setErr(ex?.response?.data?.detail ?? t('admin.queue.loadFailed')));
  }, [id, t]);

  const latestStatus = trail.length > 0 ? trail[trail.length - 1].to_state : null;
  const sc = latestStatus ? (STATE_CONFIG[latestStatus] ?? { color: '#94a3b8', icon: 'dot', label: latestStatus }) : null;

  return (
    <div>
      {/* Banner */}
      <div style={{ position: 'relative', height: 130, overflow: 'hidden' }}>
        <img src="https://images.unsplash.com/photo-1560493676-04071c5f467b?w=1600&q=70"
          alt="Audit"
          style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.25)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(18,40,92,0.97) 0%, rgba(30,58,95,0.88) 100%)' }} />
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', height: 4 }}>
          <div style={{ flex: 1, background: '#FF9933' }} /><div style={{ flex: 1, background: '#ffffff' }} /><div style={{ flex: 1, background: '#138808' }} />
        </div>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px' }}>
          <div>
            <div style={{ color: '#f5c842', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>Admin Panel · Tamper-Evident Audit Log</div>
            <h2 style={{ color: 'white', fontSize: 20, fontWeight: 800, margin: 0 }}>🔍 Application Audit Trail</h2>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 4, fontFamily: 'monospace' }}>{id}</div>
          </div>
          {sc && (
            <div style={{ padding: '6px 14px', borderRadius: 99, background: sc.color + '25', border: `1px solid ${sc.color}50`, color: sc.color, fontSize: 13, fontWeight: 700 }}>
              {sc.label}
            </div>
          )}
        </div>
      </div>

      <div className="container">
        <Link to="/admin" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--muted)', fontSize: 13, textDecoration: 'none', marginTop: 0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Back to Queue
        </Link>

        {err && <div className="card error">{err}</div>}

        {/* Application summary card */}
        {appData && (
          <div className="card" style={{ padding: '16px 22px' }}>
            <div className="grid-3" style={{ margin: 0 }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Scheme</div>
                <div style={{ fontWeight: 600, marginTop: 2 }}>{appData.scheme_id?.replace('S-', '')}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Crop</div>
                <div style={{ fontWeight: 600, marginTop: 2, textTransform: 'capitalize' }}>{appData.crop_type}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Land Declared</div>
                <div style={{ fontWeight: 600, marginTop: 2 }}>{appData.declared_land_ha?.toFixed(2)} ha</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Satellite Verified</div>
                <div style={{ fontWeight: 600, marginTop: 2, color: 'var(--info)' }}>{appData.verified_land_ha != null ? `${appData.verified_land_ha.toFixed(2)} ha` : '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>ML Score</div>
                <div style={{ fontWeight: 600, marginTop: 2, color: appData.eligibility_prob >= 0.6 ? 'var(--primary)' : appData.eligibility_prob >= 0.4 ? 'var(--warning)' : 'var(--danger)' }}>
                  {appData.eligibility_prob != null ? `${(appData.eligibility_prob * 100).toFixed(0)}%` : '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Flags</div>
                <div style={{ fontWeight: 600, marginTop: 2, color: (appData.fraud_flags ?? []).length > 0 ? 'var(--warning)' : 'var(--primary)' }}>
                  {(appData.fraud_flags ?? []).length > 0 ? `${appData.fraud_flags.length} raised` : 'None'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--info)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              <h3 style={{ margin: 0 }}>State Transition History</h3>
            </div>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{trail.length} events · SHA-256 hashed</span>
          </div>

          <div style={{ padding: '20px 22px 8px' }}>
            {trail.length === 0 && !err && <p className="muted">No audit events found.</p>}
            {trail.map((entry, i) => {
              const cfg = STATE_CONFIG[entry.to_state] ?? { color: '#94a3b8', icon: 'dot', label: entry.to_state };
              const isLast = i === trail.length - 1;
              const isFinal = ['APPROVED', 'REJECTED', 'DISBURSED', 'FLAGGED', 'DBT_FAILED'].includes(entry.to_state);
              const isAdmin = entry.triggered_by.startsWith('admin:');
              const d = new Date(entry.timestamp);
              const date = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
              const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

              return (
                <div key={i} style={{ display: 'flex', gap: 16, minHeight: isLast ? 'auto' : 90 }}>
                  {/* Timeline column */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 44, flexShrink: 0 }}>
                    <div style={{
                      width: isFinal ? 44 : 36, height: isFinal ? 44 : 36, borderRadius: '50%',
                      background: `${cfg.color}18`, border: `2.5px solid ${cfg.color}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, boxShadow: isFinal ? `0 0 14px ${cfg.color}40` : 'none',
                      zIndex: 1,
                    }}>
                      <StateIcon icon={cfg.icon} color={cfg.color} />
                    </div>
                    {!isLast && (
                      <div style={{ flex: 1, width: 2, minHeight: 20, background: `linear-gradient(180deg, ${cfg.color}80, var(--border))` }} />
                    )}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, paddingBottom: isLast ? 0 : 24, paddingTop: 4 }}>
                    {/* Transition */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'var(--surface-2)', color: 'var(--muted)' }}>
                        {entry.from_state ?? 'NEW'}
                      </span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                      <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 4, fontWeight: 700, background: `${cfg.color}20`, color: cfg.color }}>
                        {entry.to_state}
                      </span>
                      {isAdmin && (
                        <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 99, background: 'rgba(245,200,66,0.15)', color: '#b45309', fontWeight: 600 }}>
                          Admin Override
                        </span>
                      )}
                    </div>

                    {/* Meta */}
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
                        <span style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>{getTriggerLabel(entry.triggered_by)}</span>
                      </div>
                    </div>

                    {/* Admin note */}
                    {entry.note && (
                      <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 6, background: 'var(--bg)', border: `1px solid ${isAdmin ? '#f5c842' : 'var(--border)'}`, fontSize: 13, color: isAdmin ? '#78350f' : 'var(--muted)', lineHeight: 1.5 }}>
                        {isAdmin && <span style={{ fontWeight: 600, marginRight: 6 }}>📝</span>}
                        {entry.note}
                      </div>
                    )}

                    {/* Hash */}
                    {entry.payload_hash && (
                      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                        </svg>
                        <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--muted)', background: 'var(--bg)', padding: '1px 6px', borderRadius: 3, letterSpacing: 0.5 }}>
                          SHA-256: {entry.payload_hash}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
