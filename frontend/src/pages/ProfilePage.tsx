import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import { supabase } from '../lib/supabaseClient';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const dark = theme === 'dark';

  // Get profile from global context — always up to date
  const { profile, refreshProfile } = useUser();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [institution, setInstitution] = useState('');
  const [year, setYear] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [emailNotifs, setEmailNotifs] = useState(false);

  // Pre-fill form whenever profile loads or changes
  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setEmail(profile.email || '');
      setInstitution(profile.institution || '');
      setYear(profile.year || '');
    }
  }, [profile]);

  const tk = {
    pageBg:    dark ? '#0F111A' : '#F0EEE9',
    cardBg:    dark ? '#1C1F2E' : '#FFFFFF',
    border:    dark ? '#232840' : '#E8E5DF',
    divider:   dark ? '#1E2235' : '#F0EDE8',
    heading:   dark ? '#EDEDF0' : '#111111',
    body:      dark ? '#8890A4' : '#666666',
    muted:     dark ? '#525870' : '#AAAAAA',
    inputBg:   dark ? '#0F111A' : '#FAFAF8',
    inputText: dark ? '#EDEDF0' : '#111111',
    alt:       dark ? '#232840' : '#F5F3EE',
    shadow:    dark ? 'none' : '0 1px 3px rgba(0,0,0,0.05)',
  };

  const card: React.CSSProperties = {
    background: tk.cardBg, border: `1px solid ${tk.border}`,
    borderRadius: 16, boxShadow: tk.shadow,
    transition: 'background 0.3s, border-color 0.3s',
  };

  const inputStyle = (editable: boolean): React.CSSProperties => ({
    width: '100%', background: editable ? tk.inputBg : tk.alt,
    border: `1px solid ${editable ? '#1D4ED8' : tk.border}`,
    borderRadius: 9, padding: '10px 14px', fontSize: 13,
    color: editable ? tk.inputText : tk.muted,
    outline: 'none', boxSizing: 'border-box',
    cursor: editable ? 'text' : 'not-allowed',
    transition: 'border-color 0.2s',
  });

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 700, color: tk.muted,
    marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em',
  };

  const handleSave = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('profiles').update({
        name, institution, year,
      }).eq('id', user.id);

      // Refresh global profile so navbar + dashboard update immediately
      await refreshProfile();
    }
    setSaving(false);
    setIsEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('arise-name');
    navigate('/auth');
  };

  // Show loading state while profile hasn't arrived yet
  if (!profile) {
    return (
      <div style={{ minHeight: '100vh', background: tk.pageBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 14, color: tk.muted }}>Loading profile...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: tk.pageBg, transition: 'background 0.3s', padding: '32px 24px' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
          <Link to="/dashboard" style={{
            width: 36, height: 36, borderRadius: '50%',
            border: `1px solid ${tk.border}`, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            color: tk.body, textDecoration: 'none', transition: 'all 0.2s', flexShrink: 0,
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#1D4ED8'; e.currentTarget.style.color = '#1D4ED8'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = tk.border; e.currentTarget.style.color = tk.body; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
          </Link>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: tk.heading, letterSpacing: '-0.3px' }}>
            Profile Settings
          </h1>
          {saved && (
            <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: '#059669' }}>
              ✓ Changes saved
            </span>
          )}
        </div>

        {/* Avatar card */}
        <div style={{ ...card, padding: '24px 28px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', border: `2px solid #1D4ED8`, overflow: 'hidden', flexShrink: 0 }}>
            <img
              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${name || 'default'}`}
              alt="Avatar"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: tk.heading, marginBottom: 4 }}>{name || 'Student User'}</div>
            <div style={{ fontSize: 13, color: tk.body, marginBottom: 2 }}>
              {year ? `Class ${year}` : 'Student'} • {institution || 'ARISE'}
            </div>
            <div style={{ fontSize: 12, color: tk.muted }}>{email}</div>
          </div>
          <button onClick={() => setIsEditing(e => !e)} style={{
            padding: '8px 16px', borderRadius: 9,
            border: `1px solid ${tk.border}`,
            background: isEditing ? (dark ? 'rgba(220,38,38,0.1)' : '#FEF2F2') : 'transparent',
            color: isEditing ? '#DC2626' : tk.body,
            fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
          }}>
            {isEditing ? 'Cancel' : 'Edit Profile'}
          </button>
        </div>

        {/* Two column grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

          {/* Account details */}
          <div style={{ ...card, padding: '24px 24px 28px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: tk.heading, paddingBottom: 14, marginBottom: 20, borderBottom: `1px solid ${tk.divider}` }}>
              Account Details
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>Full Name</label>
                <input type="text" value={name} disabled={!isEditing}
                  onChange={e => setName(e.target.value)} style={inputStyle(isEditing)}
                  onFocus={e => isEditing && (e.target.style.borderColor = '#1D4ED8')}
                  onBlur={e => isEditing && (e.target.style.borderColor = tk.border)} />
              </div>
              <div>
                <label style={labelStyle}>Email Address</label>
                <input type="email" value={email} disabled style={inputStyle(false)} />
                <p style={{ fontSize: 11, color: tk.muted, marginTop: 5 }}>Email cannot be changed</p>
              </div>
              <div>
                <label style={labelStyle}>Institution</label>
                <input type="text" value={institution} disabled={!isEditing}
                  onChange={e => setInstitution(e.target.value)} style={inputStyle(isEditing)}
                  onFocus={e => isEditing && (e.target.style.borderColor = '#1D4ED8')}
                  onBlur={e => isEditing && (e.target.style.borderColor = tk.border)} />
              </div>
              <div>
                <label style={labelStyle}>Year / Class</label>
                <select value={year} disabled={!isEditing}
                  onChange={e => setYear(e.target.value)}
                  style={{ ...inputStyle(isEditing), appearance: 'none' as any }}>
                  <option value="">Select</option>
                  <option value="11">Class 11</option>
                  <option value="12">Class 12</option>
                  <option value="ug1">B.Sc 1st Year</option>
                  <option value="ug2">B.Sc 2nd Year</option>
                </select>
              </div>
            </div>
            {isEditing && (
              <button onClick={handleSave} disabled={saving} style={{
                marginTop: 20, width: '100%', padding: '10px',
                background: saving ? '#93A9D8' : '#1D4ED8', color: '#fff',
                fontSize: 13, fontWeight: 700, borderRadius: 9,
                border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
              }}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            )}
          </div>

          {/* Preferences + Sign out */}
          <div style={{ ...card, padding: '24px 24px 28px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: tk.heading, paddingBottom: 14, marginBottom: 20, borderBottom: `1px solid ${tk.divider}` }}>
              Preferences
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: `1px solid ${tk.divider}` }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: tk.heading, marginBottom: 2 }}>Dark Mode</div>
                  <div style={{ fontSize: 12, color: tk.muted }}>Switch between light and dark theme</div>
                </div>
                <button onClick={toggleTheme} style={{
                  width: 44, height: 24, borderRadius: 999,
                  background: dark ? '#1D4ED8' : tk.alt,
                  border: `1px solid ${dark ? '#1D4ED8' : tk.border}`,
                  position: 'relative', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0,
                }}>
                  <div style={{
                    position: 'absolute', top: 3,
                    left: dark ? 'calc(100% - 19px)' : 3,
                    width: 16, height: 16, borderRadius: '50%',
                    background: '#fff', transition: 'left 0.2s',
                  }}/>
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: tk.heading, marginBottom: 2 }}>Email Notifications</div>
                  <div style={{ fontSize: 12, color: tk.muted }}>Weekly progress reports</div>
                </div>
                <button onClick={() => setEmailNotifs(v => !v)} style={{
                  width: 44, height: 24, borderRadius: 999,
                  background: emailNotifs ? '#1D4ED8' : tk.alt,
                  border: `1px solid ${emailNotifs ? '#1D4ED8' : tk.border}`,
                  position: 'relative', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0,
                }}>
                  <div style={{
                    position: 'absolute', top: 3,
                    left: emailNotifs ? 'calc(100% - 19px)' : 3,
                    width: 16, height: 16, borderRadius: '50%',
                    background: '#fff', transition: 'left 0.2s',
                  }}/>
                </button>
              </div>
            </div>
            <div style={{ marginTop: 'auto', paddingTop: 20, borderTop: `1px solid ${tk.divider}` }}>
              <button onClick={handleSignOut} style={{
                width: '100%', padding: '10px',
                background: dark ? 'rgba(220,38,38,0.08)' : '#FEF2F2',
                border: '1px solid rgba(220,38,38,0.3)',
                color: '#DC2626', fontSize: 13, fontWeight: 700,
                borderRadius: 9, cursor: 'pointer', transition: 'background 0.2s',
              }}
                onMouseEnter={e => (e.currentTarget.style.background = dark ? 'rgba(220,38,38,0.15)' : '#FEE2E2')}
                onMouseLeave={e => (e.currentTarget.style.background = dark ? 'rgba(220,38,38,0.08)' : '#FEF2F2')}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}