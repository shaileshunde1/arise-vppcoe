import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';

const MoonIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
  </svg>
);

const SunIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
);

const NAV_LINKS = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Labs', to: '/labs' },
  { label: 'Journal', to: '/journal' },
  { label: 'Leaderboard', to: '/leaderboard' },
];

export default function TopNavbar() {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const dark = theme === 'dark';

  // Get real profile from global context — no more manual Supabase calls
  const { profile } = useUser();
  const isTeacher = profile?.role === 'teacher';
  const avatarSeed = profile?.name || localStorage.getItem('arise-name') || 'Profile';

  const tk = {
    navBg:    dark ? '#161929' : '#FFFFFF',
    border:   dark ? '#232840' : '#E8E5DF',
    heading:  dark ? '#EDEDF0' : '#111111',
    body:     dark ? '#8890A4' : '#666666',
    muted:    dark ? '#525870' : '#AAAAAA',
    toggleBg: dark ? '#232840' : '#F0EEE9',
    activeBg: dark ? 'rgba(29,78,216,0.14)' : '#EEF2FF',
    activeText: '#1D4ED8',
    hoverBg:  dark ? 'rgba(255,255,255,0.04)' : '#F5F3EE',
  };

  const isActive = (to: string) => {
    if (to === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname.startsWith(to);
  };

  return (
    <nav style={{
      height: 58, background: tk.navBg,
      borderBottom: `1px solid ${tk.border}`,
      display: 'flex', alignItems: 'center',
      padding: '0 28px', flexShrink: 0,
      transition: 'background 0.3s, border-color 0.3s',
      position: 'sticky', top: 0, zIndex: 40,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', width: '100%',
        maxWidth: 1200, margin: '0 auto',
      }}>

        {/* Left: Logo + Nav links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 7, textDecoration: 'none', marginRight: 16 }}>
            <div style={{
              width: 26, height: 26, background: tk.heading,
              borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.3s', flexShrink: 0,
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={dark ? '#0F111A' : '#F0EEE9'} strokeWidth="2.5">
                <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18"/>
              </svg>
            </div>
            <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-0.3px', color: tk.heading }}>ARISE</span>
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {NAV_LINKS.map(link => {
              const active = isActive(link.to);
              return (
                <Link key={link.to} to={link.to} style={{
                  padding: '6px 12px', borderRadius: 8,
                  fontSize: 13, fontWeight: active ? 700 : 500,
                  textDecoration: 'none',
                  color: active ? tk.activeText : tk.body,
                  background: active ? tk.activeBg : 'transparent',
                  transition: 'all 0.15s',
                }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.background = tk.hoverBg; e.currentTarget.style.color = tk.heading; } }}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = tk.body; } }}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Right: Teacher link + theme + avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>

          {/* Only visible to teachers */}
          {isTeacher && (
            <Link to="/teacher" style={{
              fontSize: 12, fontWeight: 700, color: '#1D4ED8',
              textDecoration: 'none', padding: '5px 10px', borderRadius: 7,
              background: dark ? 'rgba(29,78,216,0.12)' : '#EEF2FF',
              transition: 'opacity 0.15s',
            }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              Teacher View
            </Link>
          )}

          <div style={{ width: 1, height: 20, background: tk.border }}></div>

          {/* Dark mode toggle */}
          <button onClick={toggleTheme}
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: tk.toggleBg, border: `1px solid ${tk.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: tk.body, transition: 'all 0.2s', flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.color = tk.heading; e.currentTarget.style.borderColor = '#1D4ED8'; }}
            onMouseLeave={e => { e.currentTarget.style.color = tk.body; e.currentTarget.style.borderColor = tk.border; }}
          >
            {dark ? <SunIcon /> : <MoonIcon />}
          </button>

          {/* Profile avatar */}
          <Link to="/profile" style={{
            width: 32, height: 32, borderRadius: '50%',
            border: `2px solid ${tk.border}`,
            overflow: 'hidden', display: 'block',
            transition: 'border-color 0.2s', flexShrink: 0,
          }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#1D4ED8')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = tk.border)}
          >
            <img
              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}`}
              alt="Profile"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </Link>
        </div>
      </div>
    </nav>
  );
}