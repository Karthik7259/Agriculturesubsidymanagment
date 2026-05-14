import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function Landing() {
  const { t } = useTranslation();
  return (
    <div className="container">
      <div className="hero">
        <h1>{t('landing.title')}</h1>
        <p>{t('landing.subtitle')}</p>
        <Link to="/register" className="btn btn-primary">{t('landing.getStarted')}</Link>
        <span style={{ marginLeft: 12 }}>
          <Link to="/login" className="btn btn-secondary">{t('landing.login')}</Link>
        </span>
      </div>

      <div className="grid-3">
        <div className="card">
          <h3>{t('landing.satelliteTitle')}</h3>
          <p className="muted">{t('landing.satelliteText')}</p>
        </div>
        <div className="card">
          <h3>{t('landing.aiTitle')}</h3>
          <p className="muted">{t('landing.aiText')}</p>
        </div>
        <div className="card">
          <h3>{t('landing.auditTitle')}</h3>
          <p className="muted">{t('landing.auditText')}</p>
        </div>
      </div>
    </div>
  );
}
