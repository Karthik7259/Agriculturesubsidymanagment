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
  created_at: string;
  audit_trail?: AuditEntry[];
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
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>{t('appStatus.title')} {app.application_id}</h2>
          <div>
            <span className={`badge ${wsConnected ? 'badge-ok' : 'badge-muted'}`} style={{ marginRight: 8 }}>
              {wsConnected ? t('appStatus.live') : t('appStatus.offline')}
            </span>
            <span className={`badge ${statusBadge(app.status)}`}>{app.status}</span>
          </div>
        </div>
        <p className="muted">
          {t('appStatus.schemeLabel')} <b>{app.scheme_id}</b> · {t('appStatus.cropLabel')} <b>{app.crop_type}</b> · {t('appStatus.submitted')} {new Date(app.created_at).toLocaleString()}
        </p>
        {isActive && liveStep && STEP_LABEL[liveStep] && (
          <p style={{ color: 'var(--info)' }}>{STEP_LABEL[liveStep]}</p>
        )}
      </div>

      {app.ndvi_preview_url && (
        <div className="card">
          <h3>{t('appStatus.ndviPreview.title')}</h3>
          <p className="muted" style={{ marginTop: 0 }}>{t('appStatus.ndviPreview.caption')}</p>
          <img
            src={app.ndvi_preview_url}
            alt={t('appStatus.ndviPreview.alt')}
            style={{
              maxWidth: '100%',
              maxHeight: 360,
              borderRadius: 8,
              border: '1px solid var(--border)',
              imageRendering: 'pixelated',
            }}
          />
        </div>
      )}

      <div className="card">
        <h3>{t('appStatus.landVerification.title')}</h3>
        <div className="bar-container">
          <span className="bar-label">{t('appStatus.landVerification.declared')}</span>
          <div className="bar" style={{ width: pct(app.declared_land_ha) }} />
          <span className="bar-text">{app.declared_land_ha?.toFixed(2)} ha</span>
        </div>
        <div className="bar-container">
          <span className="bar-label">{t('appStatus.landVerification.satelliteVerified')}</span>
          <div className="bar" style={{ width: pct(app.verified_land_ha), background: 'var(--info)' }} />
          <span className="bar-text">{app.verified_land_ha != null ? `${app.verified_land_ha.toFixed(2)} ha` : '—'}</span>
        </div>
        <div className="bar-container">
          <span className="bar-label">{t('appStatus.landVerification.cadastral')}</span>
          <div className="bar" style={{ width: pct(app.cadastral_land_ha), background: 'var(--warning)' }} />
          <span className="bar-text">{app.cadastral_land_ha != null ? `${app.cadastral_land_ha.toFixed(2)} ha` : '—'}</span>
        </div>
        {app.mean_ndvi != null && (
          <p className="muted" style={{ marginTop: 12 }}>{t('appStatus.landVerification.meanNdvi')}: <b>{app.mean_ndvi.toFixed(3)}</b> {t('appStatus.landVerification.ndviHelp')}</p>
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

      {app.eligibility_prob != null && (
        <div className="card">
          <h3>{t('appStatus.eligibility.title')}</h3>
          <p>{t('appStatus.eligibility.probability')}: <b>{(app.eligibility_prob * 100).toFixed(1)}%</b></p>
          {app.shap_explanation && (
            <p className="muted" style={{ fontSize: 14 }}><b>{t('appStatus.eligibility.why')}</b> {app.shap_explanation}</p>
          )}
          {app.fraud_flags?.length > 0 && (
            <div>
              <span className="muted">{t('appStatus.eligibility.flags')}</span>{' '}
              {app.fraud_flags.map((f) => (
                <span key={f} className="badge badge-warn" style={{ marginRight: 6 }}>{f}</span>
              ))}
            </div>
          )}
        </div>
      )}

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

      {app.audit_trail && app.audit_trail.length > 0 && (
        <div className="card">
          <h3>{t('appStatus.audit.title')}</h3>
          <div className="timeline">
            {app.audit_trail.map((e, i) => (
              <div key={i} className="timeline-item">
                <div>
                  <b>{e.from_state ?? '∅'} → {e.to_state}</b>
                  <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>
                    {new Date(e.timestamp).toLocaleString()} · {t('appStatus.audit.by')} {e.triggered_by}
                  </span>
                </div>
                {e.note && <p className="muted" style={{ margin: '4px 0' }}>{t('appStatus.audit.noteLabel')} {e.note}</p>}
                {e.payload_hash && (
                  <p className="muted" style={{ fontSize: 11, fontFamily: 'monospace', margin: 0 }}>
                    #{e.payload_hash.slice(0, 16)}…
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
