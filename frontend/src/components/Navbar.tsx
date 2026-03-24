import { Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';

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

export default function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === 'dark';

  const tk = {
    navBg:   dark ? '#161929' : '#FFFFFF',
    border:  dark ? '#232840' : '#E8E5DF',
    heading: dark ? '#EDEDF0' : '#111111',
    body:    dark ? '#8890A4' : '#666666',
    muted:   dark ? '#525870' : '#AAAAAA',
    toggleBg: dark ? '#232840' : '#F0EEE9',
    hoverBg:  dark ? 'rgba(255,255,255,0.04)' : '#F5F3EE',
  };

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
      height: 60, background: tk.navBg,
      borderBottom: `1px solid ${tk.border}`,
      display: 'flex', alignItems: 'center',
      padding: '0 24px',
      transition: 'background 0.3s, border-color 0.3s',
    }}>
      <div style={{
        maxWidth: 1160, margin: '0 auto', width: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>

        {/* Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <div style={{
            width: 26, height: 26, background: tk.heading, borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.3s',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={dark ? '#0F111A' : '#F0EEE9'} strokeWidth="2.5">
              <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18"/>
            </svg>
          </div>
          <span style={{ fontWeight: 800, fontSize: 16, color: tk.heading, letterSpacing: '-0.3px' }}>
            ARISE
          </span>
        </Link>

        {/* Nav links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {[
            { label: 'Home', to: '/' },
            { label: 'Labs', to: '/labs' },
            { label: 'Leaderboard', to: '/leaderboard' },
          ].map(link => (
            <Link key={link.to} to={link.to} style={{
              padding: '6px 12px', borderRadius: 8,
              fontSize: 13, fontWeight: 500, color: tk.body,
              textDecoration: 'none', transition: 'all 0.15s',
            }}
              onMouseEnter={e => {
                e.currentTarget.style.background = tk.hoverBg;
                e.currentTarget.style.color = tk.heading;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = tk.body;
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Theme toggle */}
          <button onClick={toggleTheme}
            title={dark ? 'Light mode' : 'Dark mode'}
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: tk.toggleBg, border: `1px solid ${tk.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: tk.body, transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#1D4ED8';
              e.currentTarget.style.color = tk.heading;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = tk.border;
              e.currentTarget.style.color = tk.body;
            }}
          >
            {dark ? <SunIcon /> : <MoonIcon />}
          </button>

          {/* Log in */}
          <Link to="/auth" style={{
            padding: '7px 14px', borderRadius: 8,
            fontSize: 13, fontWeight: 600, color: tk.body,
            textDecoration: 'none', border: `1px solid ${tk.border}`,
            background: 'transparent', transition: 'all 0.15s',
          }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = tk.heading;
              e.currentTarget.style.color = tk.heading;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = tk.border;
              e.currentTarget.style.color = tk.body;
            }}
          >
            Log In
          </Link>

          {/* Get started */}
          <Link to="/auth" style={{
            padding: '7px 14px', borderRadius: 8,
            fontSize: 13, fontWeight: 700,
            background: tk.heading, color: dark ? '#0F111A' : '#F0EEE9',
            textDecoration: 'none', transition: 'opacity 0.15s',
          }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  );
}