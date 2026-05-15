import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import LanguageSwitcher from './LanguageSwitcher';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const nav = useNavigate();
  const loc = useLocation();

  const linkStyle = (path: string): React.CSSProperties => ({
    color: loc.pathname === path ? 'var(--primary)' : undefined,
    fontWeight: loc.pathname === path ? 600 : undefined,
  });

  return (
    <header className="navbar">
      <Link to="/" className="brand" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
        <div style={{
          width: 36, height: 36, borderRadius: 12,
          background: 'linear-gradient(135deg, #16a34a, #059669)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 3px 10px rgba(22,163,74,0.3)',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
          </svg>
        </div>
        <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.03em', color: '#1c1917' }}>{t('nav.brand')}</span>
      </Link>
      <nav>
        {user ? (
          <>
            {user.role === 'admin' ? (
              <>
                <Link to="/admin" style={linkStyle('/admin')}>{t('nav.queue')}</Link>
                <Link to="/admin/analytics" style={linkStyle('/admin/analytics')}>{t('nav.analytics')}</Link>
                <Link to="/admin/demo" style={linkStyle('/admin/demo')}>{t('nav.demoData')}</Link>
              </>
            ) : (
              <>
                <Link to="/dashboard" style={linkStyle('/dashboard')}>{t('nav.dashboard')}</Link>
                <Link to="/apply" style={linkStyle('/apply')}>{t('nav.apply')}</Link>
              </>
            )}
            <button
              onClick={() => { logout(); nav('/'); }}
              style={{
                background: 'none', border: '1px solid var(--border)', borderRadius: 10,
                padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6,
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--danger)'; e.currentTarget.style.color = 'var(--danger)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)'; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
              {user.farmer_id}
            </button>
          </>
        ) : (
          <>
            <Link to="/login" style={linkStyle('/login')}>{t('nav.login')}</Link>
            <Link to="/register" className="btn btn-primary" style={{ padding: '8px 18px', fontSize: 13, textDecoration: 'none' }}>
              {t('nav.register')}
            </Link>
          </>
        )}
        <LanguageSwitcher />
      </nav>
    </header>
  );
}
