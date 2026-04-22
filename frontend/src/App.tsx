import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ApplyWizard from './pages/ApplyWizard';
import ApplicationStatus from './pages/ApplicationStatus';
import AdminQueue from './pages/admin/Queue';
import AdminAnalytics from './pages/admin/Analytics';
import AdminAuditTimeline from './pages/admin/AuditTimeline';
import AdminDemoData from './pages/admin/DemoData';

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/dashboard"
          element={<ProtectedRoute><Dashboard /></ProtectedRoute>}
        />
        <Route
          path="/apply"
          element={<ProtectedRoute><ApplyWizard /></ProtectedRoute>}
        />
        <Route
          path="/applications/:id"
          element={<ProtectedRoute><ApplicationStatus /></ProtectedRoute>}
        />
        <Route
          path="/admin"
          element={<ProtectedRoute adminOnly><AdminQueue /></ProtectedRoute>}
        />
        <Route
          path="/admin/analytics"
          element={<ProtectedRoute adminOnly><AdminAnalytics /></ProtectedRoute>}
        />
        <Route
          path="/admin/audit/:id"
          element={<ProtectedRoute adminOnly><AdminAuditTimeline /></ProtectedRoute>}
        />
        <Route
          path="/admin/demo"
          element={<ProtectedRoute adminOnly><AdminDemoData /></ProtectedRoute>}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
