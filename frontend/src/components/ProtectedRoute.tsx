import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

interface ProtectedRouteProps {
  children?: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    // onAuthStateChange is the single source of truth.
    // It fires reliably after OAuth hash exchange is complete,
    // whereas getSession() can resolve before the hash is parsed.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthenticated(!!session);
      setChecking(false);
    });

    // Also call getSession() as an immediate check for already-logged-in users
    // (onAuthStateChange may not fire immediately on page load for existing sessions)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setAuthenticated(true);
        setChecking(false);
      }
      // If no session, wait for onAuthStateChange to fire before deciding —
      // this gives the OAuth hash exchange time to complete
      else {
        // Small grace period in case the hash is still being exchanged
        setTimeout(() => {
          setChecking(prev => {
            // Only set false if onAuthStateChange hasn't already done it
            if (prev) {
              setAuthenticated(false);
              return false;
            }
            return prev;
          });
        }, 1500);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (checking) {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0F111A', flexDirection: 'column', gap: 16,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          border: '3px solid #232840', borderTopColor: '#1D4ED8',
          animation: 'arise-spin 0.7s linear infinite',
        }} />
        <div style={{ color: '#8890A4', fontSize: 14 }}>Loading...</div>
        <style>{`@keyframes arise-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!authenticated) {
    return <Navigate to="/auth" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}