import { useEffect, useState } from 'react';
import { api } from '../../api/client';

export default function AdminAnalytics() {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get('/admin/analytics/summary')
      .then((r) => setData(r.data))
      .catch((ex) => setErr(ex?.response?.data?.detail ?? 'Load failed'));
  }, []);

  if (err) return <div className="container"><div className="card error">{err}</div></div>;
  if (!data) return <div className="container"><div className="card">Loading…</div></div>;

  const statusEntries = Object.entries(data.by_status ?? {}) as [string, number][];
  const maxCount = Math.max(...statusEntries.map(([, v]) => v), 1);

  return (
    <div className="container">
      <div className="grid-3">
        <div className="card">
          <h3 style={{ margin: 0 }}>{data.total}</h3>
          <p className="muted" style={{ margin: 0 }}>Total applications</p>
        </div>
        <div className="card">
          <h3 style={{ margin: 0 }}>{((data.approval_rate ?? 0) * 100).toFixed(1)}%</h3>
          <p className="muted" style={{ margin: 0 }}>Approval rate</p>
        </div>
        <div className="card">
          <h3 style={{ margin: 0, color: 'var(--warning)' }}>{data.flagged}</h3>
          <p className="muted" style={{ margin: 0 }}>Flagged for review</p>
        </div>
      </div>

      <div className="card">
        <h3>Applications by status</h3>
        {statusEntries.map(([k, v]) => (
          <div key={k} className="bar-container">
            <span className="bar-label">{k}</span>
            <div className="bar" style={{ width: `${(v / maxCount) * 100}%` }} />
            <span className="bar-text">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
