import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';

export default function AdminQueue() {
  const nav = useNavigate();
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
      setErr(ex?.response?.data?.detail ?? 'Load failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  const override = async (id: string, decision: 'APPROVED' | 'REJECTED') => {
    const note = prompt(`Note for ${decision}?`);
    if (!note) return;
    try {
      await api.patch(`/admin/applications/${id}`, { decision, note });
      load();
    } catch (ex: any) {
      alert(ex?.response?.data?.detail ?? 'Override failed');
    }
  };

  return (
    <div className="container">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Admin Queue</h2>
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 220 }}>
            <option value="">All statuses</option>
            {['SUBMITTED', 'VERIFYING', 'APPROVED', 'REJECTED', 'FLAGGED', 'DISBURSED', 'DBT_FAILED'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card">
        {err && <div className="error">{err}</div>}
        {loading && <p className="muted">Loading…</p>}
        <table>
          <thead>
            <tr>
              <th>App</th>
              <th>Farmer</th>
              <th>Scheme</th>
              <th>Declared / Verified</th>
              <th>Prob</th>
              <th>Flags</th>
              <th>Status</th>
              <th>Actions</th>
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
                    onClick={() => nav(`/admin/audit/${a.application_id}`)}>Audit</button>{' '}
                  <button className="btn btn-primary" style={{ padding: '4px 8px', fontSize: 12 }}
                    onClick={() => override(a.application_id, 'APPROVED')}>✓</button>{' '}
                  <button className="btn btn-danger" style={{ padding: '4px 8px', fontSize: 12 }}
                    onClick={() => override(a.application_id, 'REJECTED')}>✗</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
