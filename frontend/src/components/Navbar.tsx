import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import LanguageSwitcher from './LanguageSwitcher';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const nav = useNavigate();

  return (
    <header className="navbar">
      <Link to="/" className="brand">{t('nav.brand')}</Link>
      <nav>
        {user ? (
          <>
            {user.role === 'admin' ? (
              <>
                <Link to="/admin">{t('nav.queue')}</Link>
                <Link to="/admin/analytics">{t('nav.analytics')}</Link>
                <Link to="/admin/demo">{t('nav.demoData')}</Link>
              </>
            ) : (
              <>
                <Link to="/dashboard">{t('nav.dashboard')}</Link>
                <Link to="/apply">{t('nav.apply')}</Link>
              </>
            )}
            <a href="#" onClick={(e) => { e.preventDefault(); logout(); nav('/'); }}>
              {t('nav.logout')} ({user.farmer_id})
            </a>
          </>
        ) : (
          <>
            <Link to="/login">{t('nav.login')}</Link>
            <Link to="/register">{t('nav.register')}</Link>
          </>
        )}
        <LanguageSwitcher />
      </nav>
    </header>
  );
}
