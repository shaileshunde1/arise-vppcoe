import { motion } from 'framer-motion';
import { useTheme } from '../contexts/ThemeContext';
import { Link, useNavigate } from 'react-router-dom';
import { experiments } from '../data/experiments';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.1 } }),
};

const STATS = [
  { value: '10', label: 'Virtual Experiments' },
  { value: '2', label: 'Subjects' },
  { value: 'NCERT', label: 'Aligned Curriculum' },
  { value: 'AI', label: 'Powered Recommendations' },
];

const STEPS = [
  {
    num: '01', title: 'Take the Diagnostic Quiz',
    desc: 'A proctored adaptive test that maps your proficiency across NCERT concepts in Physics and Chemistry.',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>,
  },
  {
    num: '02', title: 'Receive Lab Recommendations',
    desc: 'Our ML engine analyses your results and recommends the most relevant experiments to strengthen weak areas.',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>,
  },
  {
    num: '03', title: 'Perform Virtual Labs',
    desc: 'Run interactive simulations with real apparatus controls, record observations, and get live data plotted automatically.',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/></svg>,
  },
  {
    num: '04', title: 'Store Results & Get Scored',
    desc: 'All observations are saved to your Lab Journal. AI evaluates accuracy, procedure, and time for a final score.',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  },
];

const FEATURED = experiments.slice(0, 3);
const MEDALS = ['🥇', '🥈', '🥉'];

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

interface LeaderRow { name: string; institution: string; score: number; }

export default function LandingPage() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const dark = theme === 'dark';

  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [leadersLoading, setLeadersLoading] = useState(true);

  useEffect(() => {
    const loadLeaders = async () => {
      try {
        const { data: profiles } = await supabase
          .from('profiles').select('id, name, institution').eq('role', 'student');

        if (!profiles || profiles.length === 0) { setLeadersLoading(false); return; }

        const { data: journals } = await supabase
          .from('journal_entries').select('user_id, score');

        const scoreMap: Record<string, number> = {};
        journals?.forEach(j => { scoreMap[j.user_id] = (scoreMap[j.user_id] || 0) + j.score; });

        const board: LeaderRow[] = profiles
          .map(p => ({ name: p.name || 'Student', institution: p.institution || '—', score: scoreMap[p.id] || 0 }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);

        setLeaders(board);
      } catch (err) {
        console.error('Failed to load leaderboard:', err);
      } finally {
        setLeadersLoading(false);
      }
    };
    loadLeaders();
  }, []);

  const tk = {
    pageBg:      dark ? '#0F111A' : '#F0EEE9',
    navBg:       dark ? '#161929' : '#FAFAF8',
    navBorder:   dark ? '#2E3040' : '#E2DED7',
    cardBg:      dark ? '#1C1F2E' : '#FFFFFF',
    cardBorder:  dark ? '#232840' : '#E8E5DF',
    sectionAlt:  dark ? '#161929' : '#E8E6E1',
    headingText: dark ? '#EDEDF0' : '#111111',
    bodyText:    dark ? '#8890A4' : '#666666',
    mutedText:   dark ? '#525870' : '#AAAAAA',
    accentBg:    dark ? 'rgba(29,78,216,0.14)' : '#EEF2FF',
    accentText:  dark ? '#93B4FF' : '#1D4ED8',
    accentBorder:dark ? 'rgba(29,78,216,0.3)' : '#C7D7FD',
    physBg:      dark ? 'rgba(29,78,216,0.18)' : '#EEF2FF',
    physText:    dark ? '#93B4FF' : '#1D4ED8',
    chemBg:      dark ? 'rgba(5,150,105,0.18)' : '#ECFDF5',
    chemText:    dark ? '#6EE7B7' : '#065F46',
    shadow:      dark ? 'none' : '0 1px 4px rgba(0,0,0,0.05)',
    shadowHover: dark ? 'none' : '0 6px 20px rgba(0,0,0,0.08)',
  };

  return (
    <div style={{ background: tk.pageBg, color: tk.headingText, minHeight: '100vh', transition: 'background 0.3s, color 0.3s' }}>

      {/* NAV */}
      <nav style={{ background: tk.navBg, borderBottom: `1px solid ${tk.navBorder}`, position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', padding: '0 24px', height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 26, height: 26, background: tk.headingText, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={tk.pageBg} strokeWidth="2.5"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18"/></svg>
            </div>
            <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.4px', color: tk.headingText }}>ARISE</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            <div style={{ display: 'flex', gap: 24, fontSize: 13, fontWeight: 500 }}>
              {[['How It Works','#how-it-works'],['Experiments','#experiments']].map(([label, href]) => (
                <a key={label} href={href} style={{ color: tk.bodyText, textDecoration: 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.color = tk.headingText)}
                  onMouseLeave={e => (e.currentTarget.style.color = tk.bodyText)}>{label}</a>
              ))}
              <Link to="/leaderboard" style={{ color: tk.bodyText, textDecoration: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.color = tk.headingText)}
                onMouseLeave={e => (e.currentTarget.style.color = tk.bodyText)}>Leaderboard</Link>
            </div>
            <button onClick={toggleTheme} style={{ width: 32, height: 32, borderRadius: 8, background: tk.sectionAlt, border: `1px solid ${tk.navBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: tk.bodyText, transition: 'all 0.2s', flexShrink: 0 }}>
              {dark ? <SunIcon /> : <MoonIcon />}
            </button>
            <Link to="/auth" style={{ fontSize: 13, fontWeight: 700, background: tk.headingText, color: tk.pageBg, padding: '8px 16px', borderRadius: 8, textDecoration: 'none', whiteSpace: 'nowrap' }}>
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ paddingTop: 96, paddingBottom: 72 }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', padding: '40px 24px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, alignItems: 'center' }}>
          <motion.div variants={fadeUp} initial="hidden" animate="show">
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: tk.accentBg, border: `1px solid ${tk.accentBorder}`, color: tk.accentText, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '5px 12px', borderRadius: 999, marginBottom: 22 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: tk.accentText, display: 'inline-block' }}></span>
              NCERT Aligned Virtual Science Lab
            </div>
            <h1 style={{ fontSize: 50, fontWeight: 800, lineHeight: 1.08, letterSpacing: '-1.5px', color: tk.headingText, marginBottom: 18 }}>
              Your Virtual<br /><span style={{ color: '#1D4ED8' }}>Science Lab</span><br />is Open 24/7.
            </h1>
            <p style={{ fontSize: 15, color: tk.bodyText, lineHeight: 1.75, marginBottom: 30, maxWidth: 420 }}>
              Perform precision physics and chemistry experiments in your browser. AI-driven recommendations, real-time scoring, and a complete lab journal — built for Indian science students.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={() => navigate('/auth')} style={{ padding: '11px 22px', background: '#1D4ED8', color: '#fff', fontWeight: 700, fontSize: 13, borderRadius: 9, border: 'none', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#1E40AF')}
                onMouseLeave={e => (e.currentTarget.style.background = '#1D4ED8')}>
                Start Experimenting Free
              </button>
              <button onClick={() => navigate('/quiz')} style={{ padding: '11px 22px', background: 'transparent', color: tk.headingText, fontWeight: 700, fontSize: 13, borderRadius: 9, border: `1.5px solid ${tk.cardBorder}`, cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = '#1D4ED8')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = tk.cardBorder)}>
                Take Diagnostic Quiz
              </button>
            </div>
          </motion.div>

          <motion.div variants={fadeUp} custom={2} initial="hidden" animate="show">
            <div style={{ background: tk.sectionAlt, border: `1px solid ${tk.cardBorder}`, borderRadius: 20, padding: 20, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, opacity: 0.35, backgroundImage: `radial-gradient(circle, ${tk.mutedText} 1px, transparent 1px)`, backgroundSize: '18px 18px' }}></div>
              <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ background: tk.cardBg, border: `1px solid ${tk.cardBorder}`, borderRadius: 13, padding: 14, boxShadow: tk.shadow }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: tk.mutedText, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Simple Pendulum — L vs T²</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#059669', background: dark ? 'rgba(5,150,105,0.15)' : '#ECFDF5', padding: '2px 8px', borderRadius: 999 }}>● Live</span>
                  </div>
                  <svg width="100%" height="52" viewBox="0 0 280 52">
                    <polyline points="0,46 40,30 80,34 120,14 160,20 200,8 240,12 280,4" fill="none" stroke="#1D4ED8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    {[40,80,120,160,200,240].map((x, i) => <circle key={i} cx={x} cy={[30,34,14,20,8,12][i]} r="2.5" fill="#1D4ED8"/>)}
                  </svg>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ background: tk.cardBg, border: `1px solid ${tk.cardBorder}`, borderRadius: 13, padding: 13 }}>
                    <div style={{ fontSize: 9, color: tk.mutedText, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Procedure</div>
                    {['Set string length','Release bob','Record time'].map((step, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '3px 0', fontSize: 11 }}>
                        <div style={{ width: 15, height: 15, borderRadius: '50%', background: i < 2 ? '#1D4ED8' : tk.sectionAlt, color: i < 2 ? '#fff' : tk.mutedText, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                        <span style={{ color: i < 2 ? tk.mutedText : tk.headingText, textDecoration: i < 2 ? 'line-through' : 'none' }}>{step}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: tk.cardBg, border: `1px solid ${tk.cardBorder}`, borderRadius: 13, padding: 13 }}>
                    <div style={{ fontSize: 9, color: tk.mutedText, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Live Score</div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: tk.headingText, lineHeight: 1 }}>74</div>
                    <div style={{ fontSize: 10, color: tk.mutedText, marginTop: 2 }}>/ 100 pts</div>
                    <div style={{ marginTop: 8, width: '100%', height: 4, background: tk.sectionAlt, borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ width: '74%', height: '100%', background: '#1D4ED8', borderRadius: 999 }}></div>
                    </div>
                  </div>
                </div>
                <div style={{ background: tk.accentBg, border: `1px solid ${tk.accentBorder}`, borderRadius: 11, padding: 11 }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: tk.accentText, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>✦ AI Insight</div>
                  <p style={{ fontSize: 11, color: tk.accentText, lineHeight: 1.5, opacity: 0.85 }}>Your L vs T² data confirms a linear relationship. Calculated g = 9.76 m/s² — within 0.2% of actual value.</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* STATS */}
      <section style={{ background: tk.sectionAlt, borderTop: `1px solid ${tk.navBorder}`, borderBottom: `1px solid ${tk.navBorder}`, margin: '40px 0 0' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', padding: '18px 24px', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          {STATS.map((s, i) => (
            <motion.div key={i} variants={fadeUp} custom={i} initial="hidden" whileInView="show" viewport={{ once: true }} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: tk.headingText }}>{s.value}</div>
              <div style={{ fontSize: 12, color: tk.bodyText, marginTop: 2 }}>{s.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" style={{ padding: '72px 24px', maxWidth: 1160, margin: '0 auto' }}>
        <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} style={{ marginBottom: 44 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#1D4ED8', marginBottom: 10 }}>The Flow</div>
          <h2 style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.7px', color: tk.headingText, marginBottom: 8 }}>How ARISE Works</h2>
          <p style={{ fontSize: 14, color: tk.bodyText, maxWidth: 440 }}>From login to scored lab report — the complete student journey.</p>
        </motion.div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          {STEPS.map((step, i) => (
            <motion.div key={i} variants={fadeUp} custom={i} initial="hidden" whileInView="show" viewport={{ once: true }}
              style={{ background: tk.cardBg, border: `1px solid ${tk.cardBorder}`, borderRadius: 16, padding: 22, boxShadow: tk.shadow }}
              whileHover={{ y: -2 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: tk.accentBg, color: tk.accentText, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>{step.icon}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: tk.mutedText, fontFamily: 'monospace', marginBottom: 7 }}>{step.num}</div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: tk.headingText, marginBottom: 7, lineHeight: 1.35 }}>{step.title}</h3>
              <p style={{ fontSize: 13, color: tk.bodyText, lineHeight: 1.65 }}>{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* FEATURED EXPERIMENTS */}
      <section id="experiments" style={{ padding: '72px 24px', background: tk.sectionAlt, borderTop: `1px solid ${tk.navBorder}`, borderBottom: `1px solid ${tk.navBorder}` }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 44 }}>
            <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#1D4ED8', marginBottom: 10 }}>Lab Catalog</div>
              <h2 style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.7px', color: tk.headingText, marginBottom: 6 }}>Featured Experiments</h2>
              <p style={{ fontSize: 14, color: tk.bodyText }}>Fully interactive simulations — no installation required.</p>
            </motion.div>
            <Link to="/labs" style={{ fontSize: 13, fontWeight: 700, color: '#1D4ED8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
              View All 10 Labs <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }}>
            {FEATURED.map((lab, i) => (
              <motion.div key={lab.id} variants={fadeUp} custom={i} initial="hidden" whileInView="show" viewport={{ once: true }}
                style={{ background: tk.cardBg, border: `1px solid ${tk.cardBorder}`, borderRadius: 16, overflow: 'hidden', boxShadow: tk.shadow }}
                whileHover={{ y: -3 }}>
                <div style={{ height: 3, background: lab.subject === 'physics' ? '#1D4ED8' : '#059669' }}></div>
                <div style={{ padding: '18px 20px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '3px 9px', borderRadius: 999, background: lab.subject === 'physics' ? tk.physBg : tk.chemBg, color: lab.subject === 'physics' ? tk.physText : tk.chemText }}>{lab.subject}</span>
                    <span style={{ fontSize: 11, color: tk.mutedText }}>{lab.ncert}</span>
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: tk.headingText, marginBottom: 7 }}>{lab.title}</h3>
                  <p style={{ fontSize: 13, color: tk.bodyText, lineHeight: 1.65, marginBottom: 18 }}>{lab.aim}</p>
                  <Link to={`/labs/${lab.id}`} style={{ fontSize: 13, fontWeight: 700, color: '#1D4ED8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
                    Open Lab <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── LEADERBOARD — real Supabase data ─────────────────── */}
      <section style={{ padding: '72px 24px', maxWidth: 1160, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center' }}>
          <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#1D4ED8', marginBottom: 10 }}>Competition</div>
            <h2 style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.7px', color: tk.headingText, marginBottom: 10 }}>Top Scholars</h2>
            <p style={{ fontSize: 14, color: tk.bodyText, lineHeight: 1.75, marginBottom: 22 }}>
              Earn points by completing experiments accurately and efficiently. Compete with students across institutions.
            </p>
            <Link to="/leaderboard" style={{ fontSize: 13, fontWeight: 700, color: '#1D4ED8', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              View Full Leaderboard <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
          </motion.div>

          <motion.div variants={fadeUp} custom={2} initial="hidden" whileInView="show" viewport={{ once: true }}>
            <div style={{ background: tk.cardBg, border: `1px solid ${tk.cardBorder}`, borderRadius: 16, overflow: 'hidden', boxShadow: tk.shadow }}>
              {/* Header */}
              <div style={{ padding: '13px 18px', borderBottom: `1px solid ${tk.navBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: tk.headingText }}>All Time Rankings</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#059669', fontWeight: 600 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#059669', display: 'inline-block' }}></span>
                  Live
                </span>
              </div>

              {/* Loading */}
              {leadersLoading && (
                <div style={{ padding: '32px', textAlign: 'center', color: tk.mutedText, fontSize: 13 }}>
                  Loading rankings...
                </div>
              )}

              {/* Empty state */}
              {!leadersLoading && leaders.length === 0 && (
                <div style={{ padding: '32px', textAlign: 'center' }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>🏆</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: tk.headingText, marginBottom: 4 }}>No scores yet</div>
                  <div style={{ fontSize: 12, color: tk.mutedText }}>Be the first to complete a lab and claim the top spot.</div>
                </div>
              )}

              {/* Real rows */}
              {!leadersLoading && leaders.map((s, i) => (
                <div key={i} style={{
                  padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12,
                  borderBottom: i < leaders.length - 1 ? `1px solid ${tk.navBorder}` : 'none',
                  transition: 'background 0.15s', cursor: 'default',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = tk.sectionAlt)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ width: 24, textAlign: 'center' }}>
                    {i < 3
                      ? <span style={{ fontSize: 14 }}>{MEDALS[i]}</span>
                      : <span style={{ fontSize: 12, fontWeight: 700, color: tk.mutedText }}>#{i + 1}</span>
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: tk.headingText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: tk.mutedText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.institution}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1D4ED8', fontFamily: 'monospace', flexShrink: 0 }}>
                    {s.score > 0 ? s.score.toLocaleString() : '—'}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section style={{ background: '#1E2028', padding: '72px 24px' }}>
        <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} style={{ maxWidth: 580, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 38, fontWeight: 800, color: '#EDEDF0', letterSpacing: '-1px', lineHeight: 1.15, marginBottom: 12 }}>
            Ready to start your first experiment?
          </h2>
          <p style={{ fontSize: 15, color: '#8890A4', lineHeight: 1.75, marginBottom: 32 }}>
            Join students using ARISE to master science concepts through hands-on virtual experiments.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/auth" style={{ padding: '12px 26px', background: '#FFFFFF', color: '#111', fontWeight: 700, fontSize: 13, borderRadius: 9, textDecoration: 'none' }}>Create Free Account</Link>
            <Link to="/labs" style={{ padding: '12px 26px', background: 'transparent', color: '#EDEDF0', fontWeight: 700, fontSize: 13, borderRadius: 9, textDecoration: 'none', border: '1.5px solid rgba(255,255,255,0.18)' }}>Browse All Labs</Link>
          </div>
        </motion.div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: `1px solid ${tk.navBorder}`, background: tk.navBg, padding: '24px' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 22, height: 22, background: tk.headingText, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={tk.pageBg} strokeWidth="2.5"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18"/></svg>
            </div>
            <span style={{ fontWeight: 800, fontSize: 13, color: tk.headingText }}>ARISE</span>
            <span style={{ color: tk.mutedText, margin: '0 6px' }}>|</span>
            <span style={{ fontSize: 12, color: tk.mutedText }}>Advanced Remote Interactive Science Environment</span>
          </div>
          <span style={{ fontSize: 12, color: tk.mutedText }}>© 2026 ARISE. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}