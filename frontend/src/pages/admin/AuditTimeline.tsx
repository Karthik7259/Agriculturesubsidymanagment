import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';

export default function AdminAuditTimeline() {
  const { id } = useParams();
  const { t } = useTranslation();
  const [trail, setTrail] = useState<any[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get(`/admin/audit/${id}`)
      .then((r) => setTrail(r.data))
      .catch((ex) => setErr(ex?.response?.data?.detail ?? t('admin.queue.loadFailed')));
  }, [id, t]);

  return (
    <div className="container">
      <div className="card">
        <Link to="/admin" className="muted">{t('admin.audit.back')}</Link>
        <h2>{t('admin.audit.title')} {id}</h2>
        <p className="muted" style={{ fontSize: 13 }}>{t('admin.audit.caption')}</p>
      </div>

      <div className="card">
        {err && <div className="error">{err}</div>}
        <div className="timeline">
          {trail.map((e, i) => (
            <div key={i} className="timeline-item">
              <div>
                <b>{e.from_state ?? '∅'} → {e.to_state}</b>
                <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>
                  {new Date(e.timestamp).toLocaleString()} · {t('admin.audit.by')} <code>{e.triggered_by}</code>
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
