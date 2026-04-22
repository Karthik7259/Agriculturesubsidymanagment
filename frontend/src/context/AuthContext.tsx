import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client';

type User = {
  farmer_id: string;
  role: 'farmer' | 'admin';
  full_name?: string;
};

type AuthCtx = {
  user: User | null;
  login: (phone: string, password: string) => Promise<User>;
  logout: () => void;
  loading: boolean;
};

const Ctx = createContext<AuthCtx | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const stored = localStorage.getItem('user');
    if (token && stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (phone: string, password: string) => {
    const form = new URLSearchParams();
    form.append('username', phone);
    form.append('password', password);
    const { data } = await api.post('/auth/login', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    const u: User = { farmer_id: data.farmer_id, role: data.role };
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('user', JSON.stringify(u));
    setUser(u);
    return u;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return <Ctx.Provider value={{ user, login, logout, loading }}>{children}</Ctx.Provider>;
};

export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth used outside AuthProvider');
  return c;
};
