import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';

const FLAG_SEVERITY: Record<string, 'critical' | 'warning' | 'info'> = {
  HIGH_OVERCLAIM: 'critical',
  NON_CROPPED_LAND: 'critical',
  DUPLICATE_PARCEL: 'critical',
  CADASTRAL_DISPUTE_OPEN: 'critical',
  LAND_NOT_AGRICULTURAL: 'critical',
  CADASTRAL_MISMATCH: 'warning',
  ANOMALY: 'warning',
  CROP_HISTORY_MISMATCH: 'warning',
  NO_MANDI_ACTIVITY: 'warning',
  UNREALISTIC_PRODUCTION_VALUE: 'warning',
  CADASTRAL_UNVERIFIED: 'info',
  CADASTRAL_API_ERROR: 'info',
};

const FLAG_SHORT: Record<string, string> = {
  HIGH_OVERCLAIM: 'Overclaim',
  NON_CROPPED_LAND: 'No Crop',
  DUPLICATE_PARCEL: 'Duplicate',
  CADASTRAL_DISPUTE_OPEN: 'Dispute',
  LAND_NOT_AGRICULTURAL: 'Non-Agri',
  CADASTRAL_MISMATCH: 'Mismatch',
  ANOMALY: 'Anomaly',
  CROP_HISTORY_MISMATCH: 'Crop Hist.',
  NO_MANDI_ACTIVITY: 'No Mandi',
  UNREALISTIC_PRODUCTION_VALUE: 'High Value',
  CADASTRAL_UNVERIFIED: 'Unverified',
  CADASTRAL_API_ERROR: 'API Error',
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  SUBMITTED:      { bg: 'rgba(59,130,246,0.12)',  color: '#3b82f6' },
  VERIFYING:      { bg: 'rgba(99,102,241,0.12)',  color: '#6366f1' },
  APPROVED:       { bg: 'rgba(34,197,94,0.12)',   color: '#16a34a' },
  DISBURSED:      { bg: 'rgba(34,197,94,0.15)',   color: '#15803d' },
  REJECTED:       { bg: 'rgba(239,68,68,0.12)',   color: '#dc2626' },
  FLAGGED:        { bg: 'rgba(245,158,11,0.12)',  color: '#d97706' },
  DBT_FAILED:     { bg: 'rgba(239,68,68,0.10)',   color: '#ef4444' },
  INFO_REQUESTED: { bg: 'rgba(168,85,247,0.12)',  color: '#9333ea' },
  UNDER_REVIEW:   { bg: 'rgba(14,165,233,0.12)',  color: '#0ea5e9' },
};

type AppRow = {
  application_id: string;
  farmer_id: string;
  farmer_name?: string;
  farmer_state?: string;
  farmer_district?: string;
  scheme_id: string;
  crop_type: string;
  declared_land_ha?: number;
  verified_land_ha?: number;
  eligibility_prob?: number;
  fraud_flags?: string[];
  status: string;
  created_at: string;
  admin_note?: string;
  priority?: string;
  gov_crop_data?: any;
};

type ActionMenuProps = {
  app: AppRow;
  onAction: (id: string, action: string) => void;
};

function ActionMenu({ app, onAction }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const actions: { label: string; action: string; color?: string; icon: string; show?: boolean }[] = [
    { label: 'View Audit Trail', action: 'audit', icon: '🔍', show: true },
    { label: 'Re-Verify Application', action: 'reverify', icon: '🔄', show: true },
    { label: 'Approve', action: 'approve', icon: '✅', color: '#16a34a', show: app.status !== 'APPROVED' && app.status !== 'DISBURSED' },
    { label: 'Reject', action: 'reject', icon: '❌', color: '#dc2626', show: app.status !== 'REJECTED' },
    { label: 'Flag for Review', action: 'flag', icon: '🚩', color: '#d97706', show: app.status !== 'FLAGGED' },
    { label: 'Request More Info', action: 'info_request', icon: '📋', color: '#9333ea', show: app.status !== 'INFO_REQUESTED' },
    { label: 'Mark Under Review', action: 'under_review', icon: '👁️', color: '#0ea5e9', show: app.status !== 'UNDER_REVIEW' },
    { label: 'Clear Flags & Approve', action: 'clear_flags', icon: '🧹', color: '#16a34a', show: (app.fraud_flags?.length ?? 0) > 0 },
    { label: 'Force Disburse', action: 'disburse', icon: '💸', color: '#15803d', show: app.status === 'APPROVED' || app.status === 'DBT_FAILED' },
  ];

  const visible = actions.filter(a => a.show !== false);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)',
          background: 'var(--surface)', cursor: 'pointer', fontSize: 12, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text)',
        }}
      >
        Actions
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points={open ? '18 15 12 9 6 15' : '6 9 12 15 18 9'} />
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 100,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)', minWidth: 210, overflow: 'hidden',
        }}>
          {visible.map((a, i) => (
            <button
              key={a.action}
              onClick={() => { setOpen(false); onAction(app.application_id, a.action); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '10px 16px',
                background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                fontSize: 13, fontWeight: 500, color: a.color ?? 'var(--text)',
                borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <span style={{ fontSize: 15 }}>{a.icon}</span>
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminQueue() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const [rows, setRows] = useState<AppRow[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [cropFilter, setCropFilter] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const load = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get('/admin/queue', { params });
      setRows(data);
    } catch (ex: any) {
      setErr(ex?.response?.data?.detail ?? t('admin.queue.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [statusFilter]);

  const handleAction = async (id: string, action: string) => {
    setActionLoading(id + action);
    try {
      if (action === 'audit') {
        nav(`/admin/audit/${id}`);
        return;
      }

      if (action === 'reverify') {
        await api.post(`/admin/applications/${id}/reverify`);
        showToast('Application queued for re-verification');
        load();
        return;
      }

      if (action === 'clear_flags') {
        await api.post(`/admin/applications/${id}/clear-flags`);
        showToast('Flags cleared — application approved');
        load();
        return;
      }

      // All other actions need a note
      const actionLabels: Record<string, string> = {
        approve: 'APPROVED',
        reject: 'REJECTED',
        flag: 'FLAGGED',
        info_request: 'INFO_REQUESTED',
        under_review: 'UNDER_REVIEW',
        disburse: 'DISBURSED',
      };

      const decision = actionLabels[action];
      if (!decision) return;

      const note = prompt(`Note for ${decision} (required):`);
      if (!note?.trim()) return;

      const body: any = { decision, note };
      if (action === 'approve' || action === 'disburse') body.clear_flags = true;

      await api.patch(`/admin/applications/${id}`, body);
      showToast(`Application moved to ${decision}`);
      load();
    } catch (ex: any) {
      showToast(ex?.response?.data?.detail ?? 'Action failed', false);
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = cropFilter
    ? rows.filter(r => r.crop_type?.toLowerCase().includes(cropFilter.toLowerCase()))
    : rows;

  const crops = [...new Set(rows.map(r => r.crop_type).filter(Boolean))];

  return (
    <div>
      {/* ── Admin hero banner */}
      <div style={{ position: 'relative', height: 140, overflow: 'hidden' }}>
        <img src="https://images.unsplash.com/photo-1560493676-04071c5f467b?w=1600&q=70"
          alt="Satellite farm view"
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', filter: 'brightness(0.3) saturate(0.7)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(18,40,92,0.95) 0%, rgba(30,58,95,0.85) 100%)' }} />
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', height: 4 }}>
          <div style={{ flex: 1, background: '#FF9933' }} />
          <div style={{ flex: 1, background: '#ffffff' }} />
          <div style={{ flex: 1, background: '#138808' }} />
        </div>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ color: '#f5c842', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>
              Ministry of Agriculture &amp; Farmers Welfare · Admin Panel
            </div>
            <h2 style={{ color: 'white', fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
              🗂️ Application Review Queue
            </h2>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 4 }}>
              {filtered.length} applications · Satellite-verified review &amp; override portal
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: 8, padding: '7px 10px', fontSize: 12 }}>
              <option value="" style={{ background: '#1e3a5f' }}>All Statuses</option>
              {['SUBMITTED', 'VERIFYING', 'APPROVED', 'REJECTED', 'FLAGGED', 'DISBURSED', 'DBT_FAILED', 'INFO_REQUESTED', 'UNDER_REVIEW'].map((s) => (
                <option key={s} style={{ background: '#1e3a5f' }}>{s}</option>
              ))}
            </select>
            <select value={cropFilter} onChange={(e) => setCropFilter(e.target.value)}
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: 8, padding: '7px 10px', fontSize: 12 }}>
              <option value="" style={{ background: '#1e3a5f' }}>All Crops</option>
              {crops.map((c) => <option key={c} style={{ background: '#1e3a5f' }}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Toast notification */}
      {toast && (
        <div style={{
          position: 'fixed', top: 80, right: 24, zIndex: 999,
          padding: '12px 20px', borderRadius: 10, fontWeight: 600, fontSize: 13,
          background: toast.ok ? '#16a34a' : '#dc2626', color: 'white',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)', animation: 'fadeIn 0.2s ease',
        }}>
          {toast.ok ? '✓' : '✗'} {toast.msg}
        </div>
      )}

      <div className="container">
        {err && <div className="card error">{err}</div>}

        {/* Stats strip */}
        <div className="grid-3" style={{ margin: '0 0 0' }}>
          {[
            { label: 'Pending Review', val: rows.filter(r => ['SUBMITTED', 'VERIFYING', 'FLAGGED', 'UNDER_REVIEW', 'INFO_REQUESTED'].includes(r.status)).length, color: '#d97706', icon: '⏳' },
            { label: 'Approved / Disbursed', val: rows.filter(r => ['APPROVED', 'DISBURSED'].includes(r.status)).length, color: '#16a34a', icon: '✅' },
            { label: 'Rejected', val: rows.filter(r => r.status === 'REJECTED').length, color: '#dc2626', icon: '❌' },
          ].map(s => (
            <div key={s.label} className="card" style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '14px 18px', margin: 0 }}>
              <div style={{ fontSize: 24 }}>{s.icon}</div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.val}</div>
                <div style={{ fontSize: 11, color: '#78716c' }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Applications</h3>
            {loading && <span className="muted" style={{ fontSize: 12 }}>Loading…</span>}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ minWidth: 1100 }}>
              <thead>
                <tr>
                  <th>Application</th>
                  <th>Farmer</th>
                  <th>Scheme / Crop</th>
                  <th>Land (Decl / Sat)</th>
                  <th>ML Score</th>
                  <th>Flags</th>
                  <th>Market</th>
                  <th>Status</th>
                  <th style={{ minWidth: 130 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && !loading && (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
                      No applications found
                    </td>
                  </tr>
                )}
                {filtered.map((a) => {
                  const sc = STATUS_COLORS[a.status] ?? { bg: 'var(--surface-2)', color: 'var(--muted)' };
                  const criticalFlags = (a.fraud_flags ?? []).filter(f => FLAG_SEVERITY[f] === 'critical');
                  const warnFlags = (a.fraud_flags ?? []).filter(f => FLAG_SEVERITY[f] === 'warning');
                  const infoFlags = (a.fraud_flags ?? []).filter(f => FLAG_SEVERITY[f] === 'info');
                  const bench = a.gov_crop_data?.market_context?.mandi_benchmark ?? a.gov_crop_data?.mandi_price_benchmark;
                  const isLoading = actionLoading?.startsWith(a.application_id);

                  return (
                    <tr key={a.application_id} style={{ opacity: isLoading ? 0.6 : 1, transition: 'opacity 0.2s' }}>
                      {/* Application ID */}
                      <td>
                        <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--muted)' }}>
                          {a.application_id.slice(0, 14)}…
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                          {new Date(a.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </div>
                        {a.priority === 'high' && (
                          <span style={{ fontSize: 10, color: '#dc2626', fontWeight: 700 }}>HIGH PRIORITY</span>
                        )}
                      </td>

                      {/* Farmer */}
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{a.farmer_name ?? a.farmer_id}</div>
                        {a.farmer_district && (
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{a.farmer_district}, {a.farmer_state}</div>
                        )}
                        <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'monospace' }}>{a.farmer_id}</div>
                      </td>

                      {/* Scheme / Crop */}
                      <td>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{a.scheme_id.replace('S-', '')}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'capitalize', marginTop: 2 }}>{a.crop_type}</div>
                      </td>

                      {/* Land */}
                      <td>
                        <div style={{ fontSize: 13 }}>
                          {a.declared_land_ha?.toFixed(2)} ha
                        </div>
                        <div style={{ fontSize: 11, color: a.verified_land_ha != null && a.declared_land_ha && (a.verified_land_ha / a.declared_land_ha) < 0.7 ? '#dc2626' : 'var(--muted)' }}>
                          {a.verified_land_ha != null ? `↳ ${a.verified_land_ha.toFixed(2)} ha verified` : '↳ pending'}
                        </div>
                      </td>

                      {/* ML Score */}
                      <td>
                        {a.eligibility_prob != null ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 36, height: 36, borderRadius: '50%', border: `3px solid ${a.eligibility_prob >= 0.6 ? '#16a34a' : a.eligibility_prob >= 0.4 ? '#d97706' : '#dc2626'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: a.eligibility_prob >= 0.6 ? '#16a34a' : a.eligibility_prob >= 0.4 ? '#d97706' : '#dc2626' }}>
                              {(a.eligibility_prob * 100).toFixed(0)}%
                            </div>
                          </div>
                        ) : <span className="muted">—</span>}
                      </td>

                      {/* Flags */}
                      <td>
                        {(a.fraud_flags ?? []).length === 0 ? (
                          <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>✓ Clear</span>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {criticalFlags.map(f => (
                              <span key={f} title={f} style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(239,68,68,0.12)', color: '#dc2626', display: 'inline-block' }}>
                                🔴 {FLAG_SHORT[f] ?? f}
                              </span>
                            ))}
                            {warnFlags.map(f => (
                              <span key={f} title={f} style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'rgba(245,158,11,0.12)', color: '#d97706', display: 'inline-block' }}>
                                🟡 {FLAG_SHORT[f] ?? f}
                              </span>
                            ))}
                            {infoFlags.map(f => (
                              <span key={f} title={f} style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', display: 'inline-block' }}>
                                🔵 {FLAG_SHORT[f] ?? f}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Market */}
                      <td style={{ fontSize: 11 }}>
                        {bench?.available ? (
                          <div>
                            <div style={{ fontWeight: 600 }}>₹{bench.avg_modal_price?.toLocaleString()}/q</div>
                            <div style={{ color: 'var(--muted)', fontSize: 10 }}>{bench.markets_count} mandis</div>
                          </div>
                        ) : <span className="muted">—</span>}
                      </td>

                      {/* Status */}
                      <td>
                        <span style={{
                          display: 'inline-block', padding: '4px 10px', borderRadius: 99,
                          fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.color,
                          whiteSpace: 'nowrap',
                        }}>
                          {a.status}
                        </span>
                        {a.admin_note && (
                          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.admin_note}>
                            📝 {a.admin_note}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td>
                        <ActionMenu app={a} onAction={handleAction} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
