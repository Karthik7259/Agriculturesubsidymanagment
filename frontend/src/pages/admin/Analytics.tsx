import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';

const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: '#3b82f6', VERIFYING: '#6366f1',
  APPROVED: '#16a34a', DISBURSED: '#15803d',
  REJECTED: '#dc2626', FLAGGED: '#d97706',
  DBT_FAILED: '#ef4444', INFO_REQUESTED: '#9333ea', UNDER_REVIEW: '#0ea5e9',
};

const CROP_COLORS: Record<string, string> = {
  wheat: '#f59e0b', rice: '#22c55e', sugarcane: '#84cc16', maize: '#fb923c',
  cotton: '#a78bfa', pulses: '#f87171', vegetables: '#34d399', other: '#94a3b8',
};

function Bar({ label, value, max, color, suffix = '' }: { label: string; value: number; max: number; color: string; suffix?: string }) {
  const pct = max > 0 ? Math.max(4, (value / max) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <span style={{ width: 130, fontSize: 12, color: 'var(--muted)', textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 5, height: 22, overflow: 'hidden', position: 'relative' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 5, transition: 'width 0.6s ease', opacity: 0.85 }} />
      </div>
      <span style={{ width: 48, fontSize: 12, fontWeight: 700, color, textAlign: 'right', flexShrink: 0 }}>{value}{suffix}</span>
    </div>
  );
}

export default function AdminAnalytics() {
  const { t } = useTranslation();
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get('/admin/analytics/summary')
      .then((r) => setData(r.data))
      .catch((ex) => setErr(ex?.response?.data?.detail ?? t('admin.queue.loadFailed')));
  }, [t]);

  if (err) return <div className="container"><div className="card error">{err}</div></div>;
  if (!data) return <div className="container"><div className="card">{t('common.loading')}</div></div>;

  const statusEntries = Object.entries(data.by_status ?? {}) as [string, number][];
  const cropEntries = Object.entries(data.by_crop ?? {}).sort(([, a], [, b]) => (b as number) - (a as number)) as [string, number][];
  const stateEntries = Object.entries(data.by_state ?? {}).sort(([, a], [, b]) => (b as number) - (a as number)) as [string, number][];
  const flagEntries = Object.entries(data.flag_frequency ?? {}).sort(([, a], [, b]) => (b as number) - (a as number)) as [string, number][];

  const maxStatus = Math.max(...statusEntries.map(([, v]) => v), 1);
  const maxCrop = Math.max(...cropEntries.map(([, v]) => v), 1);
  const maxState = Math.max(...stateEntries.map(([, v]) => v), 1);
  const maxFlag = Math.max(...flagEntries.map(([, v]) => v), 1);

  const total = data.total ?? 0;
  const approvalRate = ((data.approval_rate ?? 0) * 100).toFixed(1);
  const avgProb = ((data.avg_eligibility_prob ?? 0) * 100).toFixed(1);

  return (
    <div>
      {/* ── Header banner */}
      <div style={{ position: 'relative', height: 140, overflow: 'hidden' }}>
        <img src="https://images.unsplash.com/photo-1569336415962-a4bd9f69cd83?w=1600&q=70"
          alt="Agricultural analytics"
          style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.25) saturate(0.5)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(18,40,92,0.97) 0%, rgba(30,58,95,0.88) 100%)' }} />
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', height: 4 }}>
          <div style={{ flex: 1, background: '#FF9933' }} />
          <div style={{ flex: 1, background: '#ffffff' }} />
          <div style={{ flex: 1, background: '#138808' }} />
        </div>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', padding: '0 32px' }}>
          <div>
            <div style={{ color: '#f5c842', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>
              Ministry of Agriculture · Analytics Dashboard
            </div>
            <h2 style={{ color: 'white', fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
              📊 Application Intelligence &amp; Reporting
            </h2>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 4 }}>
              AI-powered subsidy application analytics · Real-time data
            </div>
          </div>
        </div>
      </div>

      <div className="container">

        {/* ── KPI cards */}
        <div className="grid-3" style={{ margin: '0 0 0' }}>
          {[
            { label: 'Total Applications', val: total, icon: '📋', color: '#3b82f6', sub: 'All time' },
            { label: 'Approval Rate', val: `${approvalRate}%`, icon: '✅', color: '#16a34a', sub: `${data.disbursed ?? 0} disbursed` },
            { label: 'Flagged', val: data.flagged ?? 0, icon: '🚩', color: '#d97706', sub: 'Needs review' },
            { label: 'Avg ML Score', val: `${avgProb}%`, icon: '🤖', color: '#6366f1', sub: 'Eligibility confidence' },
            { label: 'Approved', val: (data.by_status?.APPROVED ?? 0) + (data.by_status?.DISBURSED ?? 0), icon: '💰', color: '#15803d', sub: 'Incl. disbursed' },
            { label: 'Rejected', val: data.by_status?.REJECTED ?? 0, icon: '❌', color: '#dc2626', sub: 'Ineligible applications' },
          ].map(s => (
            <div key={s.label} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', margin: 0 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: s.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                {s.icon}
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, color: s.color, letterSpacing: '-0.02em' }}>{s.val}</div>
                <div style={{ fontSize: 12, color: '#78716c', marginTop: 1 }}>{s.label}</div>
                <div style={{ fontSize: 10, color: '#a8a29e' }}>{s.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Charts row */}
        <div className="grid-2" style={{ alignItems: 'start' }}>

          {/* By Status */}
          <div className="card">
            <h3 style={{ margin: '0 0 16px' }}>📊 By Status</h3>
            {statusEntries.map(([k, v]) => (
              <Bar key={k} label={k} value={v} max={maxStatus} color={STATUS_COLORS[k] ?? '#94a3b8'} />
            ))}
          </div>

          {/* By Crop */}
          <div className="card">
            <h3 style={{ margin: '0 0 16px' }}>🌾 By Crop Type</h3>
            {cropEntries.length === 0 && <p className="muted" style={{ fontSize: 13 }}>No crop data yet</p>}
            {cropEntries.map(([k, v]) => (
              <Bar key={k} label={k.charAt(0).toUpperCase() + k.slice(1)} value={v} max={maxCrop} color={CROP_COLORS[k] ?? '#94a3b8'} />
            ))}
          </div>

          {/* By State */}
          <div className="card">
            <h3 style={{ margin: '0 0 16px' }}>🗺️ By State</h3>
            {stateEntries.length === 0 && <p className="muted" style={{ fontSize: 13 }}>No state data yet</p>}
            {stateEntries.map(([k, v]) => (
              <Bar key={k} label={k} value={v} max={maxState} color="#6366f1" />
            ))}
          </div>

          {/* Flag Frequency */}
          <div className="card">
            <h3 style={{ margin: '0 0 16px' }}>🚩 Most Common Flags</h3>
            {flagEntries.length === 0 && <p className="muted" style={{ fontSize: 13 }}>No flags raised yet</p>}
            {flagEntries.map(([k, v]) => (
              <Bar key={k} label={k.replace(/_/g, ' ')} value={v} max={maxFlag} color="#dc2626" />
            ))}
          </div>
        </div>

        {/* ── Scheme breakdown */}
        {(data.by_scheme ?? []).length > 0 && (
          <div className="card">
            <h3 style={{ margin: '0 0 16px' }}>📜 By Scheme</h3>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Scheme</th>
                    <th style={{ textAlign: 'center' }}>Total</th>
                    <th style={{ textAlign: 'center' }}>Approved</th>
                    <th style={{ textAlign: 'center' }}>Approval Rate</th>
                    <th>Distribution</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.by_scheme as { scheme_id: string; count: number; approved: number }[]).map(s => {
                    const rate = s.count > 0 ? ((s.approved / s.count) * 100).toFixed(0) : '0';
                    const barPct = total > 0 ? (s.count / total) * 100 : 0;
                    return (
                      <tr key={s.scheme_id}>
                        <td style={{ fontSize: 13, fontWeight: 600 }}>{s.scheme_id.replace('S-', '').replace(/-/g, ' ')}</td>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>{s.count}</td>
                        <td style={{ textAlign: 'center', color: '#16a34a', fontWeight: 600 }}>{s.approved}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 99, background: Number(rate) >= 60 ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.1)', color: Number(rate) >= 60 ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
                            {rate}%
                          </span>
                        </td>
                        <td style={{ minWidth: 140 }}>
                          <div style={{ background: 'var(--bg)', borderRadius: 4, height: 16, overflow: 'hidden' }}>
                            <div style={{ width: `${barPct}%`, height: '100%', background: 'linear-gradient(90deg, #6366f1, #818cf8)', borderRadius: 4 }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Recent Applications */}
        {(data.recent ?? []).length > 0 && (
          <div className="card">
            <h3 style={{ margin: '0 0 16px' }}>🕐 Recent Applications</h3>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Application ID</th>
                    <th>Farmer</th>
                    <th>Scheme</th>
                    <th>Crop</th>
                    <th>ML Score</th>
                    <th>Status</th>
                    <th>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.recent as any[]).map(r => {
                    const sc = STATUS_COLORS[r.status] ?? '#94a3b8';
                    return (
                      <tr key={r.application_id}>
                        <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.application_id.slice(0, 14)}…</td>
                        <td style={{ fontWeight: 600, fontSize: 13 }}>{r.farmer_name}</td>
                        <td style={{ fontSize: 12 }}>{r.scheme_id.replace('S-', '').replace(/-/g, ' ')}</td>
                        <td style={{ fontSize: 12, textTransform: 'capitalize' }}>{r.crop_type}</td>
                        <td style={{ fontSize: 12 }}>
                          {r.eligibility_prob != null ? (
                            <span style={{ fontWeight: 700, color: r.eligibility_prob >= 0.6 ? '#16a34a' : r.eligibility_prob >= 0.4 ? '#d97706' : '#dc2626' }}>
                              {(r.eligibility_prob * 100).toFixed(0)}%
                            </span>
                          ) : '—'}
                        </td>
                        <td>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 99, background: sc + '20', color: sc }}>
                            {r.status}
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--muted)' }}>
                          {r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
