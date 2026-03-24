import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

/**
 * /auth/callback
 *
 * Supabase redirects here after Google OAuth completes.
 * The URL contains a code/token in the hash/query that Supabase
 * exchanges automatically when we call getSession().
 *
 * After session is confirmed:
 * - If the user is brand new (no profile row) → create a stub profile → send to /quiz
 * - If the user already has a profile → send to /dashboard
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const handle = async () => {
      try {
        // Exchange the OAuth code for a session.
        // Supabase JS v2 does this automatically on getSession() when
        // the URL contains the token hash from the redirect.
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;
        if (!session) throw new Error('No session found after Google sign-in.');

        const user = session.user;

        // Check if this user already has a profile
        const { data: existing } = await supabase
          .from('profiles')
          .select('id, role')
          .eq('id', user.id)
          .single();

        if (!existing) {
          // Brand new Google user — create a stub profile
          // They'll fill in details from the Profile page later
          const googleName = user.user_metadata?.full_name
            || user.user_metadata?.name
            || user.email?.split('@')[0]
            || 'Student';

          await supabase.from('profiles').insert({
            id: user.id,
            email: user.email ?? '',
            name: googleName,
            institution: '',
            year: '',
            stream: 'PCM',
            class_division: 'Unassigned',
            role: 'student',
          });

          // New user → take the diagnostic quiz
          navigate('/quiz', { replace: true });
        } else {
          // Returning user → go to dashboard (or teacher dashboard)
          if (existing.role === 'teacher') {
            navigate('/teacher', { replace: true });
          } else {
            navigate('/dashboard', { replace: true });
          }
        }
      } catch (err: any) {
        console.error('OAuth callback error:', err);
        setErrorMsg(err.message || 'Authentication failed. Please try again.');
        setStatus('error');
      }
    };

    handle();
  }, [navigate]);

  // Minimal loading / error UI — matches ARISE dark palette
  if (status === 'error') {
    return (
      <div style={{
        minHeight: '100vh', background: '#0F111A',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16,
      }}>
        <div style={{ fontSize: 32 }}>⚠️</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#EDEDF0' }}>Sign-in failed</div>
        <div style={{ fontSize: 13, color: '#8890A4', maxWidth: 320, textAlign: 'center' }}>
          {errorMsg}
        </div>
        <button
          onClick={() => navigate('/auth', { replace: true })}
          style={{
            marginTop: 8, padding: '10px 24px',
            background: '#1D4ED8', color: '#fff',
            fontWeight: 700, fontSize: 13, borderRadius: 10, border: 'none',
            cursor: 'pointer',
          }}
        >
          Back to Sign In
        </button>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0F111A',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 14,
    }}>
      {/* Spinner */}
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        border: '3px solid #232840',
        borderTopColor: '#1D4ED8',
        animation: 'arise-spin 0.7s linear infinite',
      }} />
      <div style={{ fontSize: 14, color: '#8890A4', fontWeight: 500 }}>
        Completing sign-in…
      </div>
      <style>{`@keyframes arise-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}