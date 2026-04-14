import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { experiments } from '../data/experiments';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useTheme } from '../contexts/ThemeContext';

// ─── Animation variants ───────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] },
  }),
};

// ─── Static data ──────────────────────────────────────────────
const STATS = [
  { value: '10',    label: 'Virtual Experiments' },
  { value: '2',     label: 'Subjects' },
  { value: 'NCERT', label: 'Aligned Curriculum' },
  { value: 'AI',    label: 'Powered Recommendations' },
];

const STEPS = [
  {
    num: '01', title: 'Take the Diagnostic Quiz',
    desc: 'A proctored adaptive test that maps your proficiency across NCERT concepts in Physics and Chemistry.',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>,
  },
  {
    num: '02', title: 'Receive Lab Recommendations',
    desc: 'Our ML engine analyses your results and recommends the most relevant experiments to strengthen weak areas.',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>,
  },
  {
    num: '03', title: 'Perform Virtual Labs',
    desc: 'Run interactive simulations with real apparatus controls, record observations, and get live data plotted automatically.',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/></svg>,
  },
  {
    num: '04', title: 'Store Results & Get Scored',
    desc: 'All observations are saved to your Lab Journal. AI evaluates accuracy, procedure, and time for a final score.',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  },
];

const FEATURED = experiments.slice(0, 3);
const MEDALS = ['🥇', '🥈', '🥉'];

// ─── Icons ────────────────────────────────────────────────────
const MoonIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
  </svg>
);
const SunIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
);

// ─── Types ────────────────────────────────────────────────────
interface LeaderRow { name: string; institution: string; score: number; }

// ─── Theme-aware text helpers ─────────────────────────────────
// These resolve the light-mode washed-out problem by giving explicit
// high-contrast values instead of relying on rgba(255,255,255,x) which
// is invisible on the #F0EEE9 light background.
function bodyText(dark: boolean) {
  return dark ? 'rgba(255,255,255,0.60)' : '#374151';   // gray-700 in light
}
function mutedText(dark: boolean) {
  return dark ? 'rgba(255,255,255,0.42)' : '#6B7280';   // gray-500 in light
}
function labelText(dark: boolean) {
  return dark ? 'rgba(255,255,255,0.32)' : '#9CA3AF';   // gray-400 in light
}
function cardBorder(dark: boolean) {
  return dark ? 'rgba(66,73,79,0.3)' : 'rgba(0,0,0,0.15)';
}
function sectionBorder(dark: boolean) {
  return dark ? 'rgba(66,73,79,0.2)' : 'rgba(0,0,0,0.12)';
}

// ─── Component ────────────────────────────────────────────────
export default function LandingPage() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const dark = theme === 'dark';

  const [leaders, setLeaders]               = useState<LeaderRow[]>([]);
  const [leadersLoading, setLeadersLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  // Close mobile menu on resize
  useEffect(() => {
    const handleResize = () => { if (window.innerWidth >= 768) setMobileMenuOpen(false); };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="min-h-screen" style={{ background: 'var(--surface)', color: 'var(--on-background)' }}>

      {/* ── NAV ─────────────────────────────────────────────── */}
      <nav className="frosted-nav fixed top-0 left-0 right-0 z-50">
        <div className="max-w-screen-xl mx-auto px-5 md:px-10 h-16 flex items-center justify-between">
          <span className="serif text-xl font-light tracking-tight" style={{ color: 'var(--primary)' }}>
            Arise
          </span>

          {/* Desktop nav links */}
          <div className="hidden md:flex gap-8 items-center">
            {[['How It Works', '#how-it-works'], ['Experiments', '#experiments']].map(([label, href]) => (
              <a key={label} href={href}
                className="text-[11px] font-label font-medium tracking-[0.15em] uppercase transition-colors duration-200"
                style={{ color: mutedText(dark) }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
                onMouseLeave={e => (e.currentTarget.style.color = mutedText(dark))}>
                {label}
              </a>
            ))}
            <Link to="/leaderboard"
              className="text-[11px] font-label font-medium tracking-[0.15em] uppercase transition-colors duration-200"
              style={{ color: mutedText(dark) }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = mutedText(dark))}>
              Leaderboard
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={toggleTheme}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-200"
              style={{ background: 'var(--surface-container-high)', color: 'var(--on-surface-variant)', border: `1px solid ${cardBorder(dark)}` }}
              aria-label="Toggle theme">
              {dark ? <SunIcon /> : <MoonIcon />}
            </button>
            <Link to="/auth"
              className="metallic text-[11px] font-label font-bold tracking-widest uppercase px-4 py-2.5 rounded-md transition-all duration-200 hover:scale-[0.97]"
              style={{ color: 'var(--on-primary)' }}>
              Get Started
            </Link>
            {/* Mobile hamburger */}
            <button
              className="md:hidden w-8 h-8 rounded-lg flex flex-col items-center justify-center gap-1.5 transition-colors duration-200"
              style={{ background: 'var(--surface-container-high)', border: `1px solid ${cardBorder(dark)}` }}
              onClick={() => setMobileMenuOpen(v => !v)}
              aria-label="Toggle menu">
              <span className="block w-4 h-px transition-all duration-200" style={{ background: 'var(--on-surface-variant)', transform: mobileMenuOpen ? 'rotate(45deg) translateY(4px)' : 'none' }} />
              <span className="block w-4 h-px transition-all duration-200" style={{ background: 'var(--on-surface-variant)', opacity: mobileMenuOpen ? 0 : 1 }} />
              <span className="block w-4 h-px transition-all duration-200" style={{ background: 'var(--on-surface-variant)', transform: mobileMenuOpen ? 'rotate(-45deg) translateY(-4px)' : 'none' }} />
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="md:hidden px-5 pb-4 flex flex-col gap-1"
            style={{ background: 'var(--surface-container)', borderTop: `1px solid ${sectionBorder(dark)}` }}>
            {[['How It Works', '#how-it-works'], ['Experiments', '#experiments']].map(([label, href]) => (
              <a key={label} href={href}
                onClick={() => setMobileMenuOpen(false)}
                className="py-3 text-[11px] font-label font-medium tracking-[0.15em] uppercase"
                style={{ color: bodyText(dark), borderBottom: `1px solid ${sectionBorder(dark)}` }}>
                {label}
              </a>
            ))}
            <Link to="/leaderboard"
              onClick={() => setMobileMenuOpen(false)}
              className="py-3 text-[11px] font-label font-medium tracking-[0.15em] uppercase"
              style={{ color: bodyText(dark) }}>
              Leaderboard
            </Link>
          </div>
        )}
      </nav>

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="relative min-h-[90vh] flex flex-col items-center justify-center overflow-hidden pt-16 text-center px-5">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] md:w-[700px] h-[400px] md:h-[700px] rounded-full blur-[180px]"
            style={{ background: 'var(--secondary)', opacity: dark ? 0.06 : 0.09 }} />
        </div>
        <div className="relative z-10 max-w-4xl mx-auto py-20 space-y-6">
          <motion.div variants={fadeUp} initial="hidden" animate="show"
            className="flex items-center justify-center gap-3">
            <div className="pulse-dot" />
            <span className="font-label text-xs tracking-[0.2em] uppercase" style={{ color: 'var(--secondary)' }}>
              NCERT Aligned Virtual Science Lab
            </span>
          </motion.div>

          <motion.h1 variants={fadeUp} custom={1} initial="hidden" animate="show"
            className="serif font-light tracking-tighter"
            style={{
              fontSize: 'clamp(4.5rem, 14vw, 10rem)',
              color: 'var(--primary)',
              lineHeight: 0.92,
              letterSpacing: '-0.04em',
            }}>
            ARISE
          </motion.h1>

          <motion.p variants={fadeUp} custom={2} initial="hidden" animate="show"
            className="serif font-light tracking-wide"
            style={{
              fontSize: 'clamp(0.875rem, 2vw, 1.25rem)',
              color: dark ? 'rgba(255,255,255,0.72)' : '#374151',
              letterSpacing: '0.06em',
            }}>
            Advanced Remote Interactive Science Environment.
          </motion.p>

          <motion.div variants={fadeUp} custom={2.5} initial="hidden" animate="show"
            className="w-12 h-px mx-auto" style={{ background: 'var(--secondary)', opacity: 0.4 }} />

          <motion.p variants={fadeUp} custom={3} initial="hidden" animate="show"
            className="font-body font-light leading-relaxed max-w-xl mx-auto"
            style={{ fontSize: '1rem', color: bodyText(dark) }}>
            A sophisticated ecosystem for global researchers and students to interface
            with physical laboratories from anywhere in the world.
          </motion.p>

          <motion.div variants={fadeUp} custom={4} initial="hidden" animate="show"
            className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
            <button onClick={() => navigate('/auth')}
              className="metallic font-label font-bold tracking-tight px-8 py-3.5 rounded-md transition-all hover:scale-[0.98]"
              style={{ color: 'var(--on-primary)', fontSize: '0.875rem' }}>
              Start Experimenting Free
            </button>
            <button onClick={() => navigate('/quiz')}
              className="font-label font-bold tracking-tight px-8 py-3.5 rounded-md transition-all ghost-border hover:bg-[var(--surface-bright)]"
              style={{ color: 'var(--primary)', fontSize: '0.875rem', background: 'var(--surface-container-highest)' }}>
              Take Diagnostic Quiz
            </button>
          </motion.div>
        </div>
      </section>

      {/* ── STATS ────────────────────────────────────────────── */}
      <section style={{ background: 'var(--surface-container-low)', borderTop: `1px solid ${sectionBorder(dark)}`, borderBottom: `1px solid ${sectionBorder(dark)}` }}>
        <div className="max-w-screen-xl mx-auto px-5 md:px-10 py-5 grid grid-cols-2 md:grid-cols-4 gap-6">
          {STATS.map((s, i) => (
            <motion.div key={i} variants={fadeUp} custom={i} initial="hidden" whileInView="show" viewport={{ once: true }}
              className="text-center py-1">
              <div className="serif text-2xl font-light" style={{ color: 'var(--primary)' }}>{s.value}</div>
              <div className="font-label text-xs tracking-[0.1em] uppercase mt-1" style={{ color: mutedText(dark) }}>{s.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── SCIENTIFIC DISCIPLINES ───────────────────────────── */}
      <section className="py-20 md:py-28 max-w-screen-xl mx-auto px-5 md:px-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 md:mb-16 gap-4 md:gap-8">
          <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>
            <h2 className="serif font-light tracking-tighter mb-4"
              style={{ fontSize: 'clamp(2rem, 4vw, 3.75rem)', color: 'var(--primary)' }}>
              Scientific Disciplines
            </h2>
            <p className="font-body text-sm" style={{ color: bodyText(dark) }}>
              Direct telemetry and real-time control across our specialized facilities.
            </p>
          </motion.div>
          <span className="font-label text-xs tracking-[0.2em] uppercase hidden md:block"
            style={{ color: 'var(--secondary)' }}>Scroll to Discover</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              title: 'Physics',
              desc: 'Quantum mechanics, optics, and particle interaction chambers equipped with sub-nanosecond sensors.',
              icon: 'blur_on',
              available: true,
              image: 'https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?w=800&q=80',
              href: '/labs?subject=physics',
            },
            {
              title: 'Chemistry',
              desc: 'Automated titration systems and spectroscopic analysis in a controlled atmosphere environment.',
              icon: 'science',
              available: true,
              image: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=800&q=80',
              href: '/labs?subject=chemistry',
            },
            {
              title: 'Mechanics',
              desc: 'Structural stress testing and fluid dynamic simulations with remote-actuated robotics.',
              icon: 'precision_manufacturing',
              available: false,
              image: 'https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?w=800&q=80',
              href: '#',
            },
            {
              title: 'BEE',
              desc: 'Basic Electrical Engineering pathways featuring programmable logic and high-fidelity signal monitoring.',
              icon: 'electric_bolt',
              available: false,
              image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80',
              href: '#',
            },
          ].map((disc, i) => (
            <motion.div key={disc.title}
              variants={fadeUp} custom={i} initial="hidden" whileInView="show" viewport={{ once: true }}
              whileHover={{ y: -4 }}
              className="relative rounded-xl overflow-hidden group transition-all duration-500 cursor-pointer"
              style={{ minHeight: 280, background: 'var(--surface-container)' }}
              onClick={() => disc.available && navigate(disc.href)}>
              {disc.image && (
                <div className="absolute inset-0 transition-all duration-700">
                  <img src={disc.image} alt={disc.title}
                    className="w-full h-full object-cover grayscale transition-all duration-700 group-hover:grayscale-0 group-hover:scale-105"
                    style={{ opacity: dark ? 0.18 : 0.38 }} />
                  <div className="absolute inset-0"
                    style={{ background: dark
                      ? 'linear-gradient(180deg, rgba(12,14,16,0.4) 0%, rgba(12,14,16,0.85) 100%)'
                      : 'linear-gradient(180deg, rgba(240,238,233,0.45) 0%, rgba(240,238,233,0.96) 100%)' }} />
                </div>
              )}
              {!disc.available && (
                <div className="absolute top-4 right-4 z-10">
                  <span className="font-label text-[9px] font-bold tracking-[0.15em] uppercase px-2.5 py-1 rounded-full"
                    style={{ background: 'var(--surface-container-highest)', color: mutedText(dark) }}>
                    Coming Soon
                  </span>
                </div>
              )}
              <div className="relative z-10 p-6 md:p-8 h-full flex flex-col justify-between" style={{ minHeight: 280 }}>
                <div className="w-10 h-10 flex items-center justify-center mb-6"
                  style={{ color: disc.available ? 'var(--secondary)' : labelText(dark) }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                    {disc.icon === 'blur_on'                && <><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="6" strokeOpacity="0.4"/><circle cx="12" cy="12" r="9" strokeOpacity="0.2"/></>}
                    {disc.icon === 'science'                && <><path d="M9 3v8l-4 7h14l-4-7V3"/><line x1="6" y1="6" x2="18" y2="6"/></>}
                    {disc.icon === 'precision_manufacturing' && <><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3l-4 4-4-4"/><circle cx="12" cy="14" r="2"/></>}
                    {disc.icon === 'electric_bolt'          && <><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></>}
                  </svg>
                </div>
                <div className="space-y-3">
                  <h3 className="serif font-light text-2xl" style={{ color: 'var(--primary)' }}>{disc.title}</h3>
                  <p className="font-body text-sm leading-relaxed"
                    style={{ color: disc.available ? bodyText(dark) : mutedText(dark) }}>
                    {disc.desc}
                  </p>
                  <div className="h-px w-0 transition-all duration-700 group-hover:w-full mt-4"
                    style={{ background: disc.available ? 'var(--secondary)' : labelText(dark), opacity: 0.5 }} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── FEATURED EXPERIMENTS ─────────────────────────────── */}
      <section id="experiments" className="py-20 md:py-28"
        style={{ background: 'var(--surface-container-low)', borderTop: `1px solid ${sectionBorder(dark)}`, borderBottom: `1px solid ${sectionBorder(dark)}` }}>
        <div className="max-w-screen-xl mx-auto px-5 md:px-10">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-12 md:mb-16 gap-4 md:gap-8">
            <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}>
              <span className="font-label text-xs font-bold tracking-[0.2em] uppercase block mb-4"
                style={{ color: 'var(--secondary)' }}>Lab Catalog</span>
              <h2 className="serif font-light tracking-tighter mb-3"
                style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)', color: 'var(--primary)' }}>
                Featured Experiments
              </h2>
              <p className="font-body text-sm" style={{ color: bodyText(dark) }}>
                Fully interactive simulations — no installation required.
              </p>
            </motion.div>
            <Link to="/labs" className="tertiary-link flex items-center gap-2 font-label text-xs font-bold tracking-[0.15em] uppercase shrink-0">
              View All 10 Labs
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {FEATURED.map((lab, i) => (
              <motion.div key={lab.id} variants={fadeUp} custom={i} initial="hidden" whileInView="show" viewport={{ once: true }}
                whileHover={{ y: -4 }}
                className="rounded-xl overflow-hidden group transition-colors duration-500"
                style={{ background: 'var(--surface-container)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-container-high)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface-container)')}>
                <div className="h-0.5 w-full"
                  style={{ background: lab.subject === 'physics' ? 'var(--secondary)' : 'var(--primary-container)' }} />
                <div className="p-6 md:p-8 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-label text-[10px] font-bold tracking-[0.15em] uppercase px-3 py-1 rounded-full"
                      style={{
                        background: lab.subject === 'physics' ? 'rgba(135,160,192,0.12)' : 'rgba(197,198,201,0.1)',
                        color: lab.subject === 'physics' ? 'var(--secondary)' : 'var(--primary)',
                      }}>
                      {lab.subject}
                    </span>
                    <span className="font-label text-[10px]" style={{ color: mutedText(dark) }}>
                      {lab.ncert}
                    </span>
                  </div>
                  <h3 className="serif font-light text-xl leading-snug" style={{ color: 'var(--primary)' }}>
                    {lab.title}
                  </h3>
                  <p className="font-body text-sm leading-relaxed" style={{ color: bodyText(dark) }}>
                    {lab.aim}
                  </p>
                  <Link to={`/labs/${lab.id}`}
                    className="tertiary-link inline-flex items-center gap-2 font-label text-xs font-bold tracking-[0.1em] uppercase mt-2">
                    Open Lab
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────── */}
      <section id="how-it-works" className="py-20 md:py-28 max-w-screen-xl mx-auto px-5 md:px-10">
        <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} className="mb-12 md:mb-16">
          <span className="font-label text-xs font-bold tracking-[0.2em] uppercase block mb-4"
            style={{ color: 'var(--secondary)' }}>The Flow</span>
          <h2 className="serif font-light tracking-tighter mb-4"
            style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)', color: 'var(--primary)' }}>
            How ARISE Works
          </h2>
          <p className="font-body max-w-md" style={{ color: bodyText(dark), fontSize: '0.9375rem' }}>
            From login to scored lab report — the complete student journey.
          </p>
        </motion.div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STEPS.map((step, i) => (
            <motion.div key={i} variants={fadeUp} custom={i} initial="hidden" whileInView="show" viewport={{ once: true }}
              whileHover={{ y: -4 }}
              className="p-6 md:p-8 rounded-xl transition-colors duration-500 group"
              style={{ background: 'var(--surface-container)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-container-high)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface-container)')}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-8"
                style={{ background: 'var(--surface-container-high)', color: 'var(--secondary)' }}>
                {step.icon}
              </div>
              <div className="font-label text-[10px] font-bold tracking-[0.2em] mb-4"
                style={{ color: labelText(dark) }}>
                {step.num}
              </div>
              <h3 className="serif font-light text-lg mb-3 leading-snug" style={{ color: 'var(--primary)' }}>
                {step.title}
              </h3>
              <p className="font-body text-sm leading-relaxed" style={{ color: bodyText(dark) }}>
                {step.desc}
              </p>
              <div className="h-px w-0 mt-6 transition-all duration-700 group-hover:w-full"
                style={{ background: 'var(--secondary)', opacity: 0.4 }} />
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── LEADERBOARD ──────────────────────────────────────── */}
      <section className="py-20 md:py-28 max-w-screen-xl mx-auto px-5 md:px-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 md:gap-20 items-center">
          <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} className="space-y-6">
            <span className="font-label text-xs font-bold tracking-[0.2em] uppercase block"
              style={{ color: 'var(--secondary)' }}>Competition</span>
            <h2 className="serif font-light tracking-tighter"
              style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)', color: 'var(--primary)' }}>
              Top Scholars
            </h2>
            <p className="font-body leading-relaxed max-w-sm"
              style={{ color: bodyText(dark), fontSize: '0.9375rem' }}>
              Earn points by completing experiments accurately and efficiently.
              Compete with students across institutions.
            </p>
            <Link to="/leaderboard"
              className="tertiary-link inline-flex items-center gap-2 font-label text-xs font-bold tracking-[0.15em] uppercase">
              View Full Leaderboard
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </Link>
          </motion.div>
          <motion.div variants={fadeUp} custom={2} initial="hidden" whileInView="show" viewport={{ once: true }}>
            <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface-container)' }}>
              <div className="flex items-center justify-between px-6 py-4"
                style={{ borderBottom: `1px solid ${sectionBorder(dark)}` }}>
                <span className="font-label text-xs font-bold tracking-[0.1em] uppercase"
                  style={{ color: mutedText(dark) }}>All Time Rankings</span>
                <span className="flex items-center gap-2 font-label text-[10px] font-bold"
                  style={{ color: 'var(--secondary)' }}>
                  <span className="pulse-dot" style={{ width: 5, height: 5 }} />
                  Live
                </span>
              </div>
              {leadersLoading && (
                <div className="py-10 text-center font-label text-xs" style={{ color: mutedText(dark) }}>
                  Loading rankings...
                </div>
              )}
              {!leadersLoading && leaders.length === 0 && (
                <div className="py-10 text-center space-y-2">
                  <div className="text-2xl">🏆</div>
                  <div className="font-label text-xs font-bold" style={{ color: 'var(--primary)' }}>No scores yet</div>
                  <div className="font-body text-xs" style={{ color: bodyText(dark) }}>
                    Be the first to complete a lab and claim the top spot.
                  </div>
                </div>
              )}
              {!leadersLoading && leaders.map((s, i) => (
                <div key={i}
                  className="flex items-center gap-4 px-6 py-3.5 transition-colors duration-150 cursor-default"
                  style={{ borderBottom: i < leaders.length - 1 ? `1px solid ${sectionBorder(dark)}` : 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-container-high)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <div className="w-6 text-center shrink-0">
                    {i < 3
                      ? <span className="text-sm">{MEDALS[i]}</span>
                      : <span className="font-label text-xs font-bold" style={{ color: mutedText(dark) }}>#{i + 1}</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-label text-sm font-bold truncate" style={{ color: 'var(--primary)' }}>{s.name}</div>
                    <div className="font-label text-[11px] truncate" style={{ color: mutedText(dark) }}>{s.institution}</div>
                  </div>
                  <div className="font-label text-sm font-bold shrink-0" style={{ color: 'var(--secondary)', fontVariantNumeric: 'tabular-nums' }}>
                    {s.score > 0 ? s.score.toLocaleString() : '—'}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 px-5 md:px-10">
        <div className="max-w-screen-xl mx-auto">
          <div className="rounded-2xl p-10 md:p-20 text-center relative overflow-hidden"
            style={{ background: 'var(--surface-container-low)' }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] md:w-[500px] h-[200px] md:h-[300px] rounded-full blur-[120px] pointer-events-none"
              style={{ background: 'var(--secondary)', opacity: dark ? 0.05 : 0.07 }} />
            <div className="relative z-10 space-y-6 max-w-2xl mx-auto">
              <motion.h2
                variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}
                className="serif font-light tracking-tighter"
                style={{ fontSize: 'clamp(2rem, 5vw, 4rem)', color: 'var(--primary)', lineHeight: 1.1 }}>
                Ready to start your first experiment?
              </motion.h2>
              <p className="font-body leading-relaxed" style={{ color: bodyText(dark), fontSize: '1rem' }}>
                Join students using ARISE to master science concepts through hands-on virtual experiments.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                <Link to="/auth"
                  className="metallic font-label font-bold tracking-widest uppercase px-8 md:px-10 py-4 rounded-md transition-all hover:scale-[0.98]"
                  style={{ color: 'var(--on-primary)', fontSize: '0.8125rem' }}>
                  Create Free Account
                </Link>
                <Link to="/labs"
                  className="font-label font-bold tracking-widest uppercase px-8 md:px-10 py-4 rounded-md ghost-border transition-all hover:bg-[var(--surface-bright)]"
                  style={{ color: 'var(--primary)', background: 'var(--surface-container-highest)', fontSize: '0.8125rem' }}>
                  Browse All Labs
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer style={{ background: 'var(--surface-container-lowest)', borderTop: `1px solid ${sectionBorder(dark)}` }}>
        <div className="max-w-screen-xl mx-auto px-5 md:px-10 py-10 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-col gap-2 items-center md:items-start">
            <span className="serif text-base font-light" style={{ color: 'var(--primary)' }}>Arise</span>
            <span className="font-label text-[11px] tracking-[0.12em] uppercase text-center md:text-left" style={{ color: 'var(--secondary)' }}>
              © 2026 ARISE. Advanced Remote Interactive Science Environment.
            </span>
          </div>
          <div className="flex flex-wrap justify-center gap-6 md:gap-8">
            {['Privacy Policy', 'Terms of Service', 'Laboratory Safety', 'Accessibility'].map(link => (
              <a key={link} href="#"
                className="font-label text-[11px] tracking-[0.12em] uppercase transition-colors duration-200"
                style={{ color: mutedText(dark) }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
                onMouseLeave={e => (e.currentTarget.style.color = mutedText(dark))}>
                {link}
              </a>
            ))}
          </div>
        </div>
      </footer>

    </div>
  );
}