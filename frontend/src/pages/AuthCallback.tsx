import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const handle = async () => {
      try {
        // Supabase uses PKCE by default in v2 — OAuth redirect comes back
        // with ?code= in the URL. We must exchange it explicitly.
        // Fall back to getSession() for implicit flow (hash tokens).
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');

        let session = null;

        if (code) {
          // PKCE flow — exchange the code for a session
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          session = data.session;
        } else {
          // Implicit flow fallback — token is in the URL hash
          const { data, error } = await supabase.auth.getSession();
          if (error) throw error;
          session = data.session;
        }

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
          const googleName =
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.email?.split('@')[0] ||
            'Student';

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

          navigate('/quiz', { replace: true });
        } else {
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