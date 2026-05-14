import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';

export default function AdminQueue() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const [rows, setRows] = useState<any[]>([]);
  const [status, setStatus] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/queue', { params: status ? { status } : {} });
      setRows(data);
    } catch (ex: any) {
      setErr(ex?.response?.data?.detail ?? t('admin.queue.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  const override = async (id: string, decision: 'APPROVED' | 'REJECTED') => {
    const note = prompt(t('admin.queue.notePrompt', { decision }));
    if (!note) return;
    try {
      await api.patch(`/admin/applications/${id}`, { decision, note });
      load();
    } catch (ex: any) {
      alert(ex?.response?.data?.detail ?? t('admin.queue.overrideFailed'));
    }
  };

  return (
    <div className="container">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>{t('admin.queue.title')}</h2>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 220 }}>
            <option value="">{t('admin.queue.allStatuses')}</option>
            {['SUBMITTED', 'VERIFYING', 'APPROVED', 'REJECTED', 'FLAGGED', 'DISBURSED', 'DBT_FAILED'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card">
        {err && <div className="error">{err}</div>}
        {loading && <p className="muted">{t('common.loading')}</p>}
        <table>
          <thead>
            <tr>
              <th>{t('admin.queue.cols.app')}</th>
              <th>{t('admin.queue.cols.farmer')}</th>
              <th>{t('admin.queue.cols.scheme')}</th>
              <th>{t('admin.queue.cols.declVer')}</th>
              <th>{t('admin.queue.cols.prob')}</th>
              <th>{t('admin.queue.cols.flags')}</th>
              <th>{t('admin.queue.cols.status')}</th>
              <th>{t('admin.queue.cols.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.application_id}>
                <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{a.application_id}</td>
                <td>{a.farmer_id}</td>
                <td>{a.scheme_id}</td>
                <td>
                  {a.declared_land_ha?.toFixed(2)} / {a.verified_land_ha != null ? a.verified_land_ha.toFixed(2) : '—'}
                </td>
                <td>{a.eligibility_prob != null ? `${(a.eligibility_prob * 100).toFixed(0)}%` : '—'}</td>
                <td>
                  {(a.fraud_flags ?? []).map((f: string) => (
                    <span key={f} className="badge badge-warn" style={{ marginRight: 4, fontSize: 10 }}>{f}</span>
                  ))}
                </td>
                <td><span className="badge badge-info">{a.status}</span></td>
                <td>
                  <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: 12 }}
                    onClick={() => nav(`/admin/audit/${a.application_id}`)}>{t('admin.queue.audit')}</button>{' '}
                  <button className="btn btn-primary" style={{ padding: '4px 8px', fontSize: 12 }}
                    onClick={() => override(a.application_id, 'APPROVED')}>{t('admin.queue.approve')}</button>{' '}
                  <button className="btn btn-danger" style={{ padding: '4px 8px', fontSize: 12 }}
                    onClick={() => override(a.application_id, 'REJECTED')}>{t('admin.queue.reject')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
