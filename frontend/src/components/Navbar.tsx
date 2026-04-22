import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  return (
    <header className="navbar">
      <Link to="/" className="brand">AgriSubsidy</Link>
      <nav>
        {user ? (
          <>
            {user.role === 'admin' ? (
              <>
                <Link to="/admin">Queue</Link>
                <Link to="/admin/analytics">Analytics</Link>
                <Link to="/admin/demo">Demo data</Link>
              </>
            ) : (
              <>
                <Link to="/dashboard">Dashboard</Link>
                <Link to="/apply">Apply</Link>
              </>
            )}
            <a href="#" onClick={(e) => { e.preventDefault(); logout(); nav('/'); }}>
              Logout ({user.farmer_id})
            </a>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </nav>
    </header>
  );
}
