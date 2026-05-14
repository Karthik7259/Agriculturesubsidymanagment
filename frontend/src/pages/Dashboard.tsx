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

      {me?.government_profile && (
        <div className="card">
          <h3>Unified farmer profile</h3>
          <div className="grid-2">
            <div>
              <span className="muted">Personal details</span><br />
              {me.government_profile.personal?.age} years · {me.government_profile.personal?.gender}<br />
              <span className="muted">{me.government_profile.personal?.address}</span>
            </div>
            <div>
              <span className="muted">Farmer category</span><br />
              {me.farmer_category || me.government_profile.farmer_category}
            </div>
            <div>
              <span className="muted">Land ownership</span><br />
              {(me.land_records || []).map((land: any) => (
                <div key={land.land_id}>
                  <b>{land.land_id}</b> · Survey {land.survey_number} · {land.land_area_ha} ha · {land.ownership_details}
                  <br /><span className="muted">{land.soil_type} · {land.irrigation_availability} · {land.village}, {land.district}</span>
                </div>
              ))}
            </div>
            <div>
              <span className="muted">Financial records</span><br />
              Loans: {me.financial_records?.loan_details?.length ?? 0} · Insurance: {me.financial_records?.insurance_details?.length ?? 0} · Subsidies: {me.financial_records?.subsidy_history?.length ?? 0}
            </div>
          </div>
          {me.crop_history?.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <span className="muted">Crop history</span>
              <table style={{ marginTop: 6 }}>
                <thead>
                  <tr><th>Season</th><th>Crop</th><th>Yield</th></tr>
                </thead>
                <tbody>
                  {me.crop_history.map((row: any, index: number) => (
                    <tr key={`${row.season}-${row.crop}-${index}`}>
                      <td>{row.season}</td>
                      <td>{row.crop}</td>
                      <td>{row.yield_t_per_ha ? `${row.yield_t_per_ha} t/ha` : 'Not available'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

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
