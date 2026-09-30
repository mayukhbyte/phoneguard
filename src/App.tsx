import { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';

function AppInner() {
  const { user, loading } = useAuth();
  const [pinVerified, setPinVerified] = useState(false);

  // Reset pin verification when user logs out
  useEffect(() => {
    if (!user) setPinVerified(false);
  }, [user]);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#080b14',
        flexDirection: 'column',
        gap: 16,
      }}>
        <div style={{
          width: 48, height: 48,
          border: '3px solid rgba(108,99,255,0.2)',
          borderTopColor: '#6c63ff',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <p style={{ color: '#94a3b8', fontSize: 14 }}>Loading PhoneGuard…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Not logged in or PIN not verified → show login
  if (!user || !pinVerified) {
    return <LoginPage onVerified={() => setPinVerified(true)} />;
  }

  return <DashboardPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1c2237',
            color: '#e2e8f0',
            border: '1px solid rgba(108,99,255,0.25)',
            fontSize: 13,
          },
        }}
      />
      <AppInner />
    </AuthProvider>
  );
}
