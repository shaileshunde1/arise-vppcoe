import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabaseClient';

function friendlyError(message: string): string {
  const msg = message.toLowerCase();
  if (msg.includes('email rate limit') || msg.includes('rate limit'))
    return "Too many attempts. Please wait a few minutes and try again, or use Google sign-in instead.";
  if (msg.includes('user already registered') || msg.includes('already been registered'))
    return "An account with this email already exists. Try logging in instead.";
  if (msg.includes('invalid login credentials') || msg.includes('invalid credentials'))
    return "INVALID_CREDENTIALS"; // handled specially below
  if (msg.includes('email not confirmed'))
    return "Please confirm your email address first. Check your inbox for a confirmation link.";
  if (msg.includes('password should be'))
    return "Password must be at least 6 characters long.";
  if (msg.includes('unable to validate email'))
    return "Please enter a valid email address.";
  if (msg.includes('signup is disabled'))
    return "New registrations are currently disabled. Please contact your administrator.";
  if (msg.includes('network') || msg.includes('fetch'))
    return "Connection error. Please check your internet and try again.";
  return message;
}

type AuthView = 'login' | 'signup' | 'magic_link';

export default function AuthPage() {
  const [view, setView] = useState<AuthView>('login');
  const navigate = useNavigate();
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [institution, setInstitution] = useState('');
  const [year, setYear] = useState('');
  const [stream, setStream] = useState('PCM');
  const [classDivision, setClassDivision] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  // When login fails with invalid credentials, offer magic link
  const [suggestMagicLink, setSuggestMagicLink] = useState(false);

  const tk = {
    pageBg:    dark ? '#0F111A' : '#F0EEE9',
    cardBg:    dark ? '#1C1F2E' : '#FFFFFF',
    border:    dark ? '#232840' : '#E8E5DF',
    leftBg:    dark ? '#161929' : '#F5F3EE',
    heading:   dark ? '#EDEDF0' : '#111111',
    body:      dark ? '#8890A4' : '#666666',
    muted:     dark ? '#525870' : '#AAAAAA',
    inputBg:   dark ? '#0F111A' : '#FAFAF8',
    inputText: dark ? '#EDEDF0' : '#111111',
    divider:   dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');
    setSuggestMagicLink(false);

    try {
      if (view === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate('/dashboard');

      } else if (view === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { data: { name, institution, year, stream } }
        });
        if (error) throw error;

        if (data.user && !data.session) {
          setSuccessMsg(`We've sent a confirmation link to ${email}. Check your inbox and click the link to activate your account.`);
          setLoading(false);
          return;
        }
        if (data.user && data.session) {
          await supabase.from('profiles').upsert({
            id: data.user.id,
            name: name || 'Student User',
            institution: institution || '',
            year: year || '12',
            stream: stream || 'PCM',
            class_division: classDivision || 'Unassigned',
            email,
            role: 'student',
          });
          navigate('/quiz');
        }

      } else if (view === 'magic_link') {
        // Send magic link — redirects to /auth/callback after click
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;
        setSuccessMsg(`Magic link sent to ${email}. Click the link in your inbox to sign in — no password needed.`);
      }
    } catch (err: any) {
      const mapped = friendlyError(err.message || 'Something went wrong.');
      if (mapped === 'INVALID_CREDENTIALS') {
        // Could be a Google account trying to log in with password
        setError("Incorrect email or password.");
        setSuggestMagicLink(true); // offer magic link as alternative
      } else {
        setError(mapped);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    setSuccessMsg('');
    setSuggestMagicLink(false);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(friendlyError(error.message));
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', background: tk.inputBg,
    border: `1px solid ${tk.border}`, borderRadius: 9,
    padding: '10px 14px', fontSize: 14, color: tk.inputText,
    outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 700,
    color: tk.body, marginBottom: 6,
    textTransform: 'uppercase', letterSpacing: '0.06em',
  };

  const isMagicLink = view === 'magic_link';
  const isSignup    = view === 'signup';
  const isLogin     = view === 'login';

  return (
    <div style={{
      minHeight: '100vh', background: tk.pageBg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '40px 16px', transition: 'background 0.3s',
    }}>
      <div style={{ width: '100%', maxWidth: 900 }}>
        <div style={{ marginBottom: 20 }}>
          <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: tk.body, textDecoration: 'none' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            Back to ARISE
          </Link>
        </div>

        <div style={{
          background: tk.cardBg, border: `1px solid ${tk.border}`,
          borderRadius: 20, overflow: 'hidden',
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          boxShadow: dark ? 'none' : '0 4px 24px rgba(0,0,0,0.07)',
        }}>

          {/* Left panel */}
          <div style={{
            background: tk.leftBg, borderRight: `1px solid ${tk.border}`,
            padding: '48px 40px', display: 'flex', flexDirection: 'column',
            justifyContent: 'space-between', position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', inset: 0, opacity: 0.3, backgroundImage: `radial-gradient(circle, ${tk.muted} 1px, transparent 1px)`, backgroundSize: '20px 20px' }}></div>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 40 }}>
                <div style={{ width: 28, height: 28, background: tk.heading, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={tk.pageBg} strokeWidth="2.5"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18"/></svg>
                </div>
                <span style={{ fontWeight: 800, fontSize: 16, color: tk.heading }}>ARISE</span>
              </div>
              <h2 style={{ fontSize: 28, fontWeight: 800, color: tk.heading, letterSpacing: '-0.5px', lineHeight: 1.2, marginBottom: 14 }}>
                {isLogin ? 'Welcome back.' : isSignup ? 'Start your science journey.' : 'Sign in without a password.'}
              </h2>
              <p style={{ fontSize: 14, color: tk.body, lineHeight: 1.7 }}>
                {isLogin
                  ? 'Log in to access your virtual labs, journal, and personalised recommendations.'
                  : isSignup
                  ? 'Create your account and take the diagnostic quiz to get personalised lab recommendations.'
                  : 'Enter your email and we will send you a magic link — no password required.'}
              </p>
            </div>
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { icon: '🔬', text: '10 interactive virtual experiments' },
                { icon: '🤖', text: 'AI-powered lab recommendations' },
                { icon: '📓', text: 'Automatic lab journal & scoring' },
              ].map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: dark ? 'rgba(29,78,216,0.15)' : '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{f.icon}</div>
                  <span style={{ fontSize: 13, color: tk.body }}>{f.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right panel */}
          <div style={{ padding: '48px 40px', background: tk.cardBg, overflowY: 'auto', maxHeight: '90vh' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
              <h3 style={{ fontSize: 22, fontWeight: 800, color: tk.heading, margin: 0 }}>
                {isLogin ? 'Log In' : isSignup ? 'Create Account' : 'Magic Link'}
              </h3>
              {!isMagicLink && (
                <button
                  onClick={() => { setView(isLogin ? 'signup' : 'login'); setError(''); setSuccessMsg(''); setSuggestMagicLink(false); }}
                  style={{ fontSize: 13, fontWeight: 600, color: '#1D4ED8', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  {isLogin ? 'Need an account?' : 'Already have one?'}
                </button>
              )}
            </div>

            {/* Error */}
            {error && (
              <div style={{ background: dark ? 'rgba(220,38,38,0.1)' : '#FEF2F2', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 9, padding: '12px 14px', fontSize: 13, color: '#DC2626', marginBottom: 12, lineHeight: 1.5 }}>
                {error}
              </div>
            )}

            {/* Magic link suggestion after failed password login */}
            {suggestMagicLink && !successMsg && (
              <div style={{
                background: dark ? 'rgba(29,78,216,0.08)' : '#EEF2FF',
                border: `1px solid ${dark ? 'rgba(29,78,216,0.25)' : '#BFDBFE'}`,
                borderRadius: 9, padding: '12px 14px', fontSize: 13,
                color: dark ? '#93B4FF' : '#1E40AF',
                marginBottom: 12, lineHeight: 1.6,
              }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Did you sign up with Google?</div>
                <div style={{ marginBottom: 8 }}>
                  If you created your account using Google, you won't have a password.
                  You can sign in with Google, or we can email you a magic link instead.
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleGoogleSignIn}
                    style={{ flex: 1, padding: '7px 10px', background: dark ? 'rgba(29,78,216,0.2)' : '#DBEAFE', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Use Google →
                  </button>
                  <button
                    onClick={() => { setView('magic_link'); setError(''); setSuggestMagicLink(false); }}
                    style={{ flex: 1, padding: '7px 10px', background: 'transparent', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Send Magic Link →
                  </button>
                </div>
              </div>
            )}

            {/* Success */}
            {successMsg && (
              <div style={{ background: dark ? 'rgba(5,150,105,0.1)' : '#ECFDF5', border: '1px solid rgba(5,150,105,0.3)', borderRadius: 9, padding: '12px 14px', fontSize: 13, color: dark ? '#6EE7B7' : '#065F46', marginBottom: 16, lineHeight: 1.6 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{isMagicLink ? 'Magic link sent ✓' : 'Check your inbox ✓'}</div>
                {successMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <AnimatePresence mode="popLayout">
                {isSignup && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 14 }}
                  >
                    <div>
                      <label style={labelStyle}>Full Name</label>
                      <input type="text" required placeholder="C.V. Raman" value={name} onChange={e => setName(e.target.value)} style={inputStyle}
                        onFocus={e => (e.target.style.borderColor = '#1D4ED8')} onBlur={e => (e.target.style.borderColor = tk.border)} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={labelStyle}>Institution</label>
                        <input type="text" required placeholder="KV No. 1" value={institution} onChange={e => setInstitution(e.target.value)} style={inputStyle}
                          onFocus={e => (e.target.style.borderColor = '#1D4ED8')} onBlur={e => (e.target.style.borderColor = tk.border)} />
                      </div>
                      <div>
                        <label style={labelStyle}>Year / Class</label>
                        <select value={year} onChange={e => setYear(e.target.value)} style={{ ...inputStyle, appearance: 'none' as any }}
                          onFocus={e => (e.target.style.borderColor = '#1D4ED8')} onBlur={e => (e.target.style.borderColor = tk.border)}>
                          <option value="">Select</option>
                          <option value="11">Class 11</option>
                          <option value="12">Class 12</option>
                          <option value="ug1">B.Sc 1st Year</option>
                          <option value="ug2">B.Sc 2nd Year</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={labelStyle}>Class Division</label>
                        <select value={classDivision} onChange={e => setClassDivision(e.target.value)} style={{ ...inputStyle, appearance: 'none' as any }}
                          onFocus={e => (e.target.style.borderColor = '#1D4ED8')} onBlur={e => (e.target.style.borderColor = tk.border)}>
                          <option value="">Select Division</option>
                          <option value="Div A">Division A</option>
                          <option value="Div B">Division B</option>
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>Stream</label>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {['PCM', 'PCB', 'Both'].map(s => (
                            <label key={s} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '8px 4px', borderRadius: 9, border: `1px solid ${stream === s ? '#1D4ED8' : tk.border}`, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: tk.heading, background: stream === s ? (dark ? 'rgba(29,78,216,0.15)' : '#EEF2FF') : tk.inputBg, transition: 'all 0.15s' }}>
                              <input type="radio" name="stream" value={s} checked={stream === s} onChange={() => setStream(s)} style={{ display: 'none' }} />
                              {s}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Email always shown */}
              <div>
                <label style={labelStyle}>Email Address</label>
                <input type="email" required placeholder="user@example.com" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = '#1D4ED8')} onBlur={e => (e.target.style.borderColor = tk.border)} />
              </div>

              {/* Password only for login/signup, not magic link */}
              {!isMagicLink && (
                <div>
                  <label style={labelStyle}>Password</label>
                  <input type="password" required placeholder="••••••••" minLength={6} value={password} onChange={e => setPassword(e.target.value)} style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = '#1D4ED8')} onBlur={e => (e.target.style.borderColor = tk.border)} />
                </div>
              )}

              {/* Forgot password / magic link link */}
              {isLogin && !isMagicLink && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: -4 }}>
                  <button type="button" onClick={() => { setView('magic_link'); setError(''); setSuggestMagicLink(false); }}
                    style={{ fontSize: 12, color: tk.muted, cursor: 'pointer', fontWeight: 600, background: 'none', border: 'none', padding: 0 }}>
                    Sign in with magic link
                  </button>
                  <span style={{ fontSize: 12, color: '#1D4ED8', cursor: 'pointer', fontWeight: 600 }}>Forgot password?</span>
                </div>
              )}

              {isMagicLink && (
                <div style={{ marginTop: -4 }}>
                  <button type="button" onClick={() => { setView('login'); setError(''); setSuccessMsg(''); }}
                    style={{ fontSize: 12, color: tk.muted, cursor: 'pointer', fontWeight: 600, background: 'none', border: 'none', padding: 0 }}>
                    ← Back to login
                  </button>
                </div>
              )}

              <button type="submit" disabled={loading || (!!successMsg && isMagicLink)} style={{
                width: '100%', padding: '12px',
                background: loading ? '#93A9D8' : '#1D4ED8',
                color: '#fff', fontWeight: 700, fontSize: 14, borderRadius: 10, border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer', marginTop: 4, transition: 'background 0.2s',
              }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#1E40AF'; }}
                onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#1D4ED8'; }}
              >
                {loading
                  ? 'Please wait...'
                  : isLogin   ? 'Sign In to ARISE'
                  : isSignup  ? 'Create Account & Take Quiz'
                  : 'Send Magic Link'}
              </button>
            </form>

            {/* Divider + Google button — hide on magic link view */}
            {!isMagicLink && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
                  <div style={{ flex: 1, height: 1, background: tk.divider }}></div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: tk.muted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>or</span>
                  <div style={{ flex: 1, height: 1, background: tk.divider }}></div>
                </div>

                <button type="button" onClick={handleGoogleSignIn} disabled={loading} style={{
                  width: '100%', background: tk.inputBg, border: `1px solid ${tk.border}`, borderRadius: 10,
                  padding: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, color: tk.heading,
                  transition: 'border-color 0.2s', opacity: loading ? 0.6 : 1,
                }}
                  onMouseEnter={e => { if (!loading) e.currentTarget.style.borderColor = '#1D4ED8'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = tk.border; }}
                >
                  {loading ? (
                    <span style={{ fontSize: 13, color: tk.muted }}>Redirecting to Google...</span>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 48 48">
                        <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                        <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                        <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
                        <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
                      </svg>
                      Continue with Google
                    </>
                  )}
                </button>
              </>
            )}

            <p style={{ fontSize: 12, color: tk.muted, textAlign: 'center', marginTop: 20, lineHeight: 1.6 }}>
              By continuing, you agree to ARISE's terms of use and privacy policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}