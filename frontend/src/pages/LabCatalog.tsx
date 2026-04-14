import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { experiments } from '../data/experiments';
import { useTheme } from '../contexts/ThemeContext';
import { useLabStore } from '../store/useLabStore';

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] } }),
};

const SUBJECT_FILTERS = ['All', 'Physics', 'Chemistry', 'Mechanics'];

const LAB_TIME: Record<string, string> = {
  'simple-pendulum':      '15 min',
  'ohms-law':             '20 min',
  'projectile-motion':    '20 min',
  'prism-refraction':     '25 min',
  'magnetic-field':       '20 min',
  'newtons-rings':        '25 min',
  'acid-base-titration':  '25 min',
  'electrolysis-water':   '20 min',
  'flame-test':           '15 min',
  'le-chatelier':         '20 min',
  'paper-chromatography': '25 min',
  'simply-supported-beam':'20 min',
};

const LAB_DIFFICULTY: Record<string, { label: string }> = {
  'simple-pendulum':      { label: 'Beginner'     },
  'ohms-law':             { label: 'Beginner'     },
  'flame-test':           { label: 'Beginner'     },
  'electrolysis-water':   { label: 'Intermediate' },
  'acid-base-titration':  { label: 'Intermediate' },
  'le-chatelier':         { label: 'Intermediate' },
  'projectile-motion':    { label: 'Intermediate' },
  'simply-supported-beam':{ label: 'Intermediate' },
  'prism-refraction':     { label: 'Advanced'     },
  'magnetic-field':       { label: 'Advanced'     },
  'paper-chromatography': { label: 'Advanced'     },
  'newtons-rings':        { label: 'Advanced'     },
};

const NCERT_META: Record<string, { class: 11 | 12; chapter: string; chapterNum: string }> = {
  'simple-pendulum':      { class: 11, chapter: 'Laws of Motion & Oscillations',             chapterNum: 'Ch. 14' },
  'projectile-motion':    { class: 11, chapter: 'Motion in a Plane',                         chapterNum: 'Ch. 4'  },
  'prism-refraction':     { class: 12, chapter: 'Ray Optics and Optical Instruments',        chapterNum: 'Ch. 9'  },
  'newtons-rings':        { class: 12, chapter: 'Ray Optics and Optical Instruments',        chapterNum: 'Ch. 9'  },
  'magnetic-field':       { class: 12, chapter: 'Moving Charges and Magnetism',              chapterNum: 'Ch. 4'  },
  'ohms-law':             { class: 12, chapter: 'Current Electricity',                       chapterNum: 'Ch. 3'  },
  'acid-base-titration':  { class: 11, chapter: 'Equilibrium',                               chapterNum: 'Ch. 7'  },
  'electrolysis-water':   { class: 12, chapter: 'Electrochemistry',                          chapterNum: 'Ch. 3'  },
  'flame-test':           { class: 11, chapter: 'The s-Block Elements',                      chapterNum: 'Ch. 10' },
  'le-chatelier':         { class: 11, chapter: 'Equilibrium',                               chapterNum: 'Ch. 7'  },
  'paper-chromatography': { class: 12, chapter: 'Biomolecules',                              chapterNum: 'Ch. 15' },
  'simply-supported-beam':{ class: 11, chapter: 'Systems of Particles and Rotational Motion',chapterNum: 'Ch. 9'  },
};

export default function LabCatalog() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const { journalEntries, observationData } = useLabStore();

  const [filterSubject, setFilterSubject] = useState('All');
  const [searchQuery,   setSearchQuery]   = useState('');
  const [groupByNCERT,  setGroupByNCERT]  = useState(false);

  const filteredLabs = experiments.filter(lab => {
    const matchSubject =
      filterSubject === 'All' ||
      lab.subject === filterSubject.toLowerCase();
    const matchSearch =
      searchQuery === '' ||
      lab.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lab.ncert.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (NCERT_META[lab.id]?.chapter || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchSubject && matchSearch;
  });

  const isCompleted  = (id: string) => journalEntries.some(j => j.experimentId === id);
  const isInProgress = (id: string) => {
    const hasData = (observationData[id] || []).length > 0;
    return hasData && !isCompleted(id);
  };

  const physicsLabs   = filteredLabs.filter(l => l.subject === 'physics');
  const chemLabs      = filteredLabs.filter(l => l.subject === 'chemistry');
  const mechanicsLabs = filteredLabs.filter(l => l.subject === 'mechanics');
  const class11Labs   = filteredLabs.filter(l => NCERT_META[l.id]?.class === 11);
  const class12Labs   = filteredLabs.filter(l => NCERT_META[l.id]?.class === 12);

  const groupByChapter = (labs: typeof experiments) => {
    const groups: Record<string, typeof experiments> = {};
    labs.forEach(lab => {
      const meta = NCERT_META[lab.id];
      if (!meta) return;
      const key = `${meta.chapterNum} — ${meta.chapter}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(lab);
    });
    return groups;
  };

  // ── Lab Card ──────────────────────────────────────────────────
  const LabCard = ({ lab, index }: { lab: typeof experiments[0]; index: number }) => {
    const diff       = LAB_DIFFICULTY[lab.id];
    const completed  = isCompleted(lab.id);
    const inProgress = isInProgress(lab.id);
    const meta       = NCERT_META[lab.id];
    const isPhysics  = lab.subject === 'physics';
    const isMechanics = lab.subject === 'mechanics';

    const accentVar = isMechanics
      ? 'var(--chip-mechanics-text)'
      : isPhysics
      ? 'var(--secondary)'
      : 'var(--primary)';

    const borderHoverVar = isMechanics
      ? 'var(--card-border-hover-mechanics)'
      : isPhysics
      ? 'var(--card-border-hover-physics)'
      : 'var(--card-border-hover-chem)';

    const stripeStyle = isMechanics
      ? 'linear-gradient(90deg, var(--chip-mechanics-text), var(--secondary))'
      : isPhysics
      ? 'var(--secondary)'
      : 'linear-gradient(90deg, var(--outline), var(--primary-container))';

    return (
      <motion.div
        variants={fadeUp} custom={index} initial="hidden" animate="show"
        onClick={() => navigate(`/labs/${lab.id}`)}
        whileHover={{ y: -3 }}
        whileTap={{ scale: 0.98 }}
        className="group"
        style={{
          background: 'var(--surface-container)',
          border: '1px solid var(--card-border)',
          borderRadius: 16,
          overflow: 'hidden',
          cursor: 'pointer',
          transition: 'background 0.25s, border-color 0.25s, box-shadow 0.25s, transform 0.2s',
          position: 'relative',
          boxShadow: 'var(--card-shadow)',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background  = 'var(--surface-container-high)';
          e.currentTarget.style.borderColor = borderHoverVar;
          e.currentTarget.style.boxShadow   = 'var(--card-shadow-hover)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background  = 'var(--surface-container)';
          e.currentTarget.style.borderColor = 'var(--card-border)';
          e.currentTarget.style.boxShadow   = 'var(--card-shadow)';
        }}
      >
        {/* Subject stripe */}
        <div style={{ height: dark ? 2 : 3, background: stripeStyle }} />

        {/* Status badge */}
        {(completed || inProgress) && (
          <div style={{
            position: 'absolute', top: 14, right: 14,
            fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
            padding: '3px 9px', borderRadius: 999,
            background: completed ? 'var(--badge-done-bg)' : 'var(--badge-progress-bg)',
            color:      completed ? 'var(--badge-done-text)' : 'var(--badge-progress-text)',
          }}>
            {completed ? '✓ Done' : '● In Progress'}
          </div>
        )}

        <div style={{ padding: '18px 20px 20px' }}>
          {/* Subject + NCERT tag */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <span className="font-label" style={{
              fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em',
              padding: '3px 10px', borderRadius: 999,
              background: isMechanics
                ? 'var(--chip-mechanics-bg)'
                : isPhysics
                ? 'var(--chip-physics-bg)'
                : 'var(--chip-chem-bg)',
              color: isMechanics
                ? 'var(--chip-mechanics-text)'
                : isPhysics
                ? 'var(--chip-physics-text)'
                : 'var(--chip-chem-text)',
            }}>{lab.subject}</span>
            <span className="font-label" style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>
              {lab.ncert}
            </span>
          </div>

          {/* Title */}
          <h3 className="serif" style={{
            fontSize: 18, fontWeight: 300, color: 'var(--primary)',
            marginBottom: 8, lineHeight: 1.3, letterSpacing: '-0.02em',
          }}>
            {lab.title}
          </h3>

          {/* Aim */}
          <p className="font-body" style={{
            fontSize: 13, color: 'var(--on-surface-variant)', lineHeight: 1.6, marginBottom: 14,
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>
            {lab.aim}
          </p>

          {/* NCERT chapter */}
          {meta && (
            <div className="font-label" style={{
              fontSize: 11, color: 'var(--outline)', marginBottom: 14,
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
              </svg>
              Class {meta.class} • {meta.chapterNum}
            </div>
          )}

          {/* Footer row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {diff && (
                <span className="font-label" style={{
                  fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
                  padding: '2px 9px', borderRadius: 999,
                  background: diff.label === 'Beginner'
                    ? 'var(--diff-beginner-bg)'
                    : diff.label === 'Intermediate'
                    ? 'var(--diff-intermediate-bg)'
                    : 'var(--diff-advanced-bg)',
                  color: diff.label === 'Beginner'
                    ? 'var(--diff-beginner-text)'
                    : diff.label === 'Intermediate'
                    ? 'var(--diff-intermediate-text)'
                    : 'var(--diff-advanced-text)',
                }}>{diff.label}</span>
              )}
              <span className="font-label" style={{
                fontSize: 11, color: 'var(--on-surface-variant)',
                display: 'flex', alignItems: 'center', gap: 3,
              }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                {LAB_TIME[lab.id] || '20 min'}
              </span>
            </div>
            <span className="font-label" style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
              color: accentVar,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              {completed ? 'Redo' : inProgress ? 'Continue' : 'Open Lab'}
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </span>
          </div>
        </div>
      </motion.div>
    );
  };

  // ── Chapter Group ─────────────────────────────────────────────
  const ChapterGroup = ({ title, labs, startIdx }: { title: string; labs: typeof experiments; startIdx: number }) => (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
        padding: '10px 16px', borderRadius: 12,
        background: 'var(--chapter-header-bg)',
        border: '1px solid var(--chapter-header-border)',
      }}>
        <div style={{
          width: 2, height: 16, borderRadius: 999, flexShrink: 0,
          background: labs[0]?.subject === 'mechanics'
            ? 'var(--chip-mechanics-text)'
            : labs[0]?.subject === 'physics'
            ? 'var(--secondary)'
            : 'var(--primary)',
        }} />
        <span className="font-label" style={{
          fontSize: 12, fontWeight: 700, color: 'var(--on-surface)', letterSpacing: '0.05em',
        }}>{title}</span>
        <span className="font-label" style={{
          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
          background: 'var(--ncert-chip-bg)', color: 'var(--ncert-chip-text)',
        }}>
          {labs.length} lab{labs.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
        {labs.map((lab, i) => <LabCard key={lab.id} lab={lab} index={startIdx + i} />)}
      </div>
    </div>
  );

  // ── Subject Section Header ────────────────────────────────────
  const SubjectHeader = ({
    label, count, accentVar, chipBg, chipText,
  }: { label: string; count: number; accentVar: string; chipBg: string; chipText: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
      <div style={{ width: 3, height: 20, background: accentVar, borderRadius: 999 }} />
      <h2 className="serif" style={{ fontSize: 20, fontWeight: 300, color: 'var(--primary)' }}>{label}</h2>
      <span className="font-label" style={{
        fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
        letterSpacing: '0.1em', textTransform: 'uppercase',
        background: chipBg, color: chipText,
      }}>{count} lab{count !== 1 ? 's' : ''}</span>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface)', transition: 'background 0.3s', color: 'var(--on-background)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 'clamp(20px, 4vw, 40px) clamp(16px, 4vw, 32px)' }}>

        {/* ── Page Header ───────────────────────────────────── */}
        <motion.div variants={fadeUp} initial="hidden" animate="show" style={{ marginBottom: 32 }}>
          <span className="font-label" style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase',
            color: 'var(--secondary)', display: 'block', marginBottom: 8,
          }}>Lab Catalog</span>
          <h1 className="serif" style={{
            fontSize: 'clamp(1.75rem, 4vw, 3rem)',
            fontWeight: 300, color: 'var(--primary)',
            letterSpacing: '-0.03em', marginBottom: 8, lineHeight: 1.1,
          }}>Virtual Experiments</h1>
          <p className="font-body" style={{ fontSize: 14, color: 'var(--on-surface-variant)' }}>
            {experiments.length} experiments across Physics, Chemistry, and Mechanics — fully NCERT aligned.
          </p>
        </motion.div>

        {/* ── Filters ───────────────────────────────────────── */}
        <motion.div
          variants={fadeUp} custom={1} initial="hidden" animate="show"
          style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32, flexWrap: 'wrap' }}
        >
          <div style={{ position: 'relative', flex: 1, minWidth: 180, maxWidth: 340 }}>
            <svg style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--outline)' }}
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input type="text" placeholder="Search experiments or chapters..."
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="font-body"
              style={{
                width: '100%', padding: '10px 14px 10px 36px',
                background: 'var(--input-bg)', border: '1px solid var(--input-border)',
                borderRadius: 10, fontSize: 13, color: 'var(--on-surface)',
                outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s',
              }}
              onFocus={e => (e.target.style.borderColor = 'var(--secondary)')}
              onBlur={e  => (e.target.style.borderColor = 'var(--input-border)')}
            />
          </div>

          <div style={{
            display: 'flex', background: 'var(--filter-pill-bg)',
            border: '1px solid var(--filter-pill-border)', borderRadius: 12, padding: 4, gap: 2,
          }}>
            {SUBJECT_FILTERS.map(sub => {
              const active = filterSubject === sub;
              return (
                <button key={sub} onClick={() => setFilterSubject(sub)}
                  className="font-label"
                  style={{
                    padding: '7px 14px', borderRadius: 9, border: 'none',
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                    background: active ? 'var(--secondary)' : 'transparent',
                    color: active ? (dark ? 'var(--surface)' : '#ffffff') : 'var(--on-surface-variant)',
                    cursor: 'pointer', transition: 'all 0.2s',
                  }}>{sub}</button>
              );
            })}
          </div>

          <button onClick={() => setGroupByNCERT(g => !g)}
            className="font-label"
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '8px 14px', borderRadius: 10,
              border: `1px solid ${groupByNCERT ? 'var(--secondary)' : 'var(--input-border)'}`,
              background: groupByNCERT ? 'var(--ncert-chip-bg)' : 'transparent',
              color: groupByNCERT ? 'var(--secondary)' : 'var(--on-surface-variant)',
              fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
              cursor: 'pointer', transition: 'all 0.2s',
            }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
            </svg>
            NCERT Chapters
          </button>

          <span className="font-label" style={{
            fontSize: 11, color: 'var(--outline-variant)', marginLeft: 'auto', letterSpacing: '0.06em',
          }}>
            {filteredLabs.length} result{filteredLabs.length !== 1 ? 's' : ''}
          </span>
        </motion.div>

        {/* ── No Results ────────────────────────────────────── */}
        {filteredLabs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ fontSize: 36, marginBottom: 16 }}>🔬</div>
            <h3 className="serif" style={{ fontSize: 22, fontWeight: 300, color: 'var(--primary)', marginBottom: 8 }}>
              No experiments found
            </h3>
            <p className="font-body" style={{ fontSize: 14, color: 'var(--on-surface-variant)' }}>
              Try adjusting your filters or search query.
            </p>
          </div>
        )}

        {/* ── NCERT Chapter View ────────────────────────────── */}
        {groupByNCERT && filteredLabs.length > 0 && (
          <>
            {class11Labs.length > 0 && (
              <div style={{ marginBottom: 48 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                  <div style={{ width: 3, height: 24, background: 'var(--secondary)', borderRadius: 999 }} />
                  <h2 className="serif" style={{ fontSize: 24, fontWeight: 300, color: 'var(--primary)' }}>Class 11</h2>
                  <span className="font-label" style={{
                    fontSize: 10, fontWeight: 700,
                    color: 'var(--ncert-chip-text)', background: 'var(--ncert-chip-bg)',
                    padding: '3px 10px', borderRadius: 999,
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                  }}>{class11Labs.length} labs</span>
                </div>
                {Object.entries(groupByChapter(class11Labs)).map(([chapter, labs], gi) => (
                  <ChapterGroup key={chapter} title={chapter} labs={labs} startIdx={gi * 3} />
                ))}
              </div>
            )}

            {class12Labs.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                  <div style={{ width: 3, height: 24, background: 'var(--primary-container)', borderRadius: 999 }} />
                  <h2 className="serif" style={{ fontSize: 24, fontWeight: 300, color: 'var(--primary)' }}>Class 12</h2>
                  <span className="font-label" style={{
                    fontSize: 10, fontWeight: 700,
                    color: 'var(--on-surface-variant)', background: 'var(--chip-chem-bg)',
                    padding: '3px 10px', borderRadius: 999,
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                  }}>{class12Labs.length} labs</span>
                </div>
                {Object.entries(groupByChapter(class12Labs)).map(([chapter, labs], gi) => (
                  <ChapterGroup key={chapter} title={chapter} labs={labs} startIdx={gi * 3} />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Standard Subject View ─────────────────────────── */}
        {!groupByNCERT && filteredLabs.length > 0 && (
          <>
            {physicsLabs.length > 0 && (
              <div style={{ marginBottom: 48 }}>
                <SubjectHeader
                  label="Physics" count={physicsLabs.length}
                  accentVar="var(--secondary)"
                  chipBg="var(--chip-physics-bg)" chipText="var(--chip-physics-text)"
                />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                  {physicsLabs.map((lab, i) => <LabCard key={lab.id} lab={lab} index={i} />)}
                </div>
              </div>
            )}

            {chemLabs.length > 0 && (
              <div style={{ marginBottom: 48 }}>
                <SubjectHeader
                  label="Chemistry" count={chemLabs.length}
                  accentVar="var(--primary-container)"
                  chipBg="var(--chip-chem-bg)" chipText="var(--chip-chem-text)"
                />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                  {chemLabs.map((lab, i) => <LabCard key={lab.id} lab={lab} index={i} />)}
                </div>
              </div>
            )}

            {mechanicsLabs.length > 0 && (
              <div>
                <SubjectHeader
                  label="Mechanics" count={mechanicsLabs.length}
                  accentVar="var(--chip-mechanics-text)"
                  chipBg="var(--chip-mechanics-bg)" chipText="var(--chip-mechanics-text)"
                />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                  {mechanicsLabs.map((lab, i) => <LabCard key={lab.id} lab={lab} index={i} />)}
                </div>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}