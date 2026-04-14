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
  { label: 'Dashboard',   to: '/dashboard'   },
  { label: 'Labs',        to: '/labs'         },
  { label: 'Journal',     to: '/journal'      },
  { label: 'Leaderboard', to: '/leaderboard'  },
];

export default function TopNavbar() {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const dark = theme === 'dark';

  const { profile } = useUser();
  const isTeacher  = profile?.role === 'teacher';
  const avatarSeed = profile?.name || localStorage.getItem('arise-name') || 'Profile';

  const isActive = (to: string) => {
    if (to === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname.startsWith(to);
  };

  // All colors via CSS variables — matches Lab Catalog's token system exactly.
  // Active nav uses var(--secondary) which is #a8c0d8 dark / #1d4f82 light.
  // Active bg mirrors ncert-chip-bg which is the same palette as the catalog's active states.
  return (
    <nav style={{
      height: 58,
      background: 'var(--surface-container-low)',
      borderBottom: '1px solid var(--card-border)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 clamp(16px, 3vw, 28px)',
      flexShrink: 0,
      transition: 'background 0.3s, border-color 0.3s',
      position: 'sticky',
      top: 0,
      zIndex: 40,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        maxWidth: 1200,
        margin: '0 auto',
      }}>

        {/* ── Left: Logo + nav links ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

          {/* Logo */}
          <Link
            to="/"
            style={{ display: 'flex', alignItems: 'center', gap: 7, textDecoration: 'none', marginRight: 16 }}
          >
            <div style={{
              width: 26, height: 26,
              background: 'var(--primary)',
              borderRadius: 6,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.3s',
              flexShrink: 0,
            }}>
              <svg
                width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke={dark ? '#0c0e10' : '#f0ede8'}
                strokeWidth="2.5"
              >
                <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18"/>
              </svg>
            </div>
            <span style={{
              fontWeight: 800,
              fontSize: 15,
              letterSpacing: '-0.3px',
              color: 'var(--primary)',
              transition: 'color 0.3s',
            }}>
              ARISE
            </span>
          </Link>

          {/* Nav links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {NAV_LINKS.map(link => {
              const active = isActive(link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className="font-label"
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: active ? 700 : 500,
                    textDecoration: 'none',
                    color: active ? 'var(--secondary)' : 'var(--on-surface-variant)',
                    background: active ? 'var(--ncert-chip-bg)' : 'transparent',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => {
                    if (!active) {
                      e.currentTarget.style.background = 'var(--surface-container)';
                      e.currentTarget.style.color = 'var(--on-surface)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--on-surface-variant)';
                    }
                  }}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* ── Right: Teacher badge + theme toggle + avatar ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>

          {/* Teacher badge — only visible to teachers */}
          {isTeacher && (
            <Link
              to="/teacher"
              className="font-label"
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--secondary)',
                textDecoration: 'none',
                padding: '5px 10px',
                borderRadius: 7,
                background: 'var(--ncert-chip-bg)',
                border: '1px solid var(--filter-pill-border)',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              Teacher View
            </Link>
          )}

          {/* Divider */}
          <div style={{ width: 1, height: 20, background: 'var(--card-border)' }} />

          {/* Dark/light toggle */}
          <button
            onClick={toggleTheme}
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{
              width: 32, height: 32,
              borderRadius: 8,
              background: 'var(--surface-container)',
              border: '1px solid var(--card-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--on-surface-variant)',
              transition: 'all 0.2s',
              flexShrink: 0,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = 'var(--secondary)';
              e.currentTarget.style.borderColor = 'var(--secondary)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'var(--on-surface-variant)';
              e.currentTarget.style.borderColor = 'var(--card-border)';
            }}
          >
            {dark ? <SunIcon /> : <MoonIcon />}
          </button>

          {/* Profile avatar */}
          <Link
            to="/profile"
            style={{
              width: 32, height: 32,
              borderRadius: '50%',
              border: '2px solid var(--card-border)',
              overflow: 'hidden',
              display: 'block',
              transition: 'border-color 0.2s',
              flexShrink: 0,
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--secondary)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--card-border)')}
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