import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../api/client';

export default function AdminAuditTimeline() {
  const { id } = useParams();
  const [trail, setTrail] = useState<any[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get(`/admin/audit/${id}`)
      .then((r) => setTrail(r.data))
      .catch((ex) => setErr(ex?.response?.data?.detail ?? 'Load failed'));
  }, [id]);

  return (
    <div className="container">
      <div className="card">
        <Link to="/admin" className="muted">← Back to queue</Link>
        <h2>Audit trail — {id}</h2>
        <p className="muted" style={{ fontSize: 13 }}>
          Insert-only log. No UI edit/delete controls — the MongoDB role backing this service has insert-only privileges.
        </p>
      </div>

      <div className="card">
        {err && <div className="error">{err}</div>}
        <div className="timeline">
          {trail.map((e, i) => (
            <div key={i} className="timeline-item">
              <div>
                <b>{e.from_state ?? '∅'} → {e.to_state}</b>
                <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>
                  {new Date(e.timestamp).toLocaleString()} · by <code>{e.triggered_by}</code>
                </span>
              </div>
              {e.note && <p style={{ margin: '6px 0' }}>📝 {e.note}</p>}
              {e.payload_hash && (
                <p className="muted" style={{ fontSize: 11, fontFamily: 'monospace', margin: 0 }}>
                  SHA-256: {e.payload_hash}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
