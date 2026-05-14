import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';

type Application = {
  application_id: string;
  scheme_id: string;
  status: string;
  declared_land_ha: number;
  verified_land_ha?: number;
  crop_type: string;
  created_at: string;
};

const statusBadge = (s: string) => {
  const map: Record<string, string> = {
    SUBMITTED: 'badge-info',
    VERIFYING: 'badge-info',
    APPROVED: 'badge-ok',
    DISBURSED: 'badge-ok',
    REJECTED: 'badge-err',
    FLAGGED: 'badge-warn',
    DBT_FAILED: 'badge-err',
  };
  return map[s] ?? 'badge-muted';
};

export default function Dashboard() {
  const { t } = useTranslation();
  const [apps, setApps] = useState<Application[]>([]);
  const [me, setMe] = useState<any>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [app, meResp] = await Promise.all([
          api.get('/applications/'),
          api.get('/auth/me'),
        ]);
        setApps(app.data);
        setMe(meResp.data);
      } catch (ex: any) {
        setErr(ex?.response?.data?.detail ?? t('dashboard.failedToLoad'));
      }
    })();
  }, [t]);

  return (
    <div className="container">
      <div className="card">
        <h2>{t('dashboard.welcome')}{me?.full_name ? `, ${me.full_name}` : ''}</h2>
        {me && (
          <p className="muted">
            {t('dashboard.farmerId')}: <b>{me.farmer_id}</b> · {me.district}, {me.state} · {t('dashboard.income')} ₹{me.annual_income?.toLocaleString()}
          </p>
        )}
        <Link to="/apply" className="btn btn-primary">{t('dashboard.newApplication')}</Link>
      </div>

      <div className="card">
        <h3>{t('dashboard.yourApplications')}</h3>
        {err && <div className="error">{err}</div>}
        {apps.length === 0 && <p className="muted">{t('dashboard.noneYet')}</p>}
        {apps.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>{t('dashboard.cols.id')}</th>
                <th>{t('dashboard.cols.scheme')}</th>
                <th>{t('dashboard.cols.crop')}</th>
                <th>{t('dashboard.cols.declared')}</th>
                <th>{t('dashboard.cols.verified')}</th>
                <th>{t('dashboard.cols.status')}</th>
                <th>{t('dashboard.cols.created')}</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((a) => (
                <tr key={a.application_id} onClick={() => { window.location.href = `/applications/${a.application_id}`; }}>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{a.application_id}</td>
                  <td>{a.scheme_id.replace('S-', '')}</td>
                  <td>{a.crop_type}</td>
                  <td>{a.declared_land_ha.toFixed(2)} ha</td>
                  <td>{a.verified_land_ha != null ? `${a.verified_land_ha.toFixed(2)} ha` : '—'}</td>
                  <td><span className={`badge ${statusBadge(a.status)}`}>{a.status}</span></td>
                  <td className="muted">{new Date(a.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
