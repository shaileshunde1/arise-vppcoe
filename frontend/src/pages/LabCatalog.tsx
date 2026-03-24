import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { experiments } from '../data/experiments';
import { useTheme } from '../contexts/ThemeContext';
import { useLabStore } from '../store/useLabStore';

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.35, delay: i * 0.06 } }),
};

const SUBJECT_FILTERS = ['All', 'Physics', 'Chemistry'];

const LAB_TIME: Record<string, string> = {
  'simple-pendulum': '15 min', 'ohms-law': '20 min', 'projectile-motion': '20 min',
  'prism-refraction': '25 min', 'magnetic-field': '20 min', 'acid-base-titration': '25 min',
  'electrolysis-water': '20 min', 'flame-test': '15 min', 'le-chatelier': '20 min',
  'paper-chromatography': '25 min',
};

const LAB_DIFFICULTY: Record<string, { label: string; color: string; bg: string; darkBg: string; darkColor: string }> = {
  'simple-pendulum':     { label: 'Beginner',     color: '#065F46', bg: '#ECFDF5', darkBg: 'rgba(5,150,105,0.15)',  darkColor: '#6EE7B7' },
  'ohms-law':            { label: 'Beginner',     color: '#065F46', bg: '#ECFDF5', darkBg: 'rgba(5,150,105,0.15)',  darkColor: '#6EE7B7' },
  'flame-test':          { label: 'Beginner',     color: '#065F46', bg: '#ECFDF5', darkBg: 'rgba(5,150,105,0.15)',  darkColor: '#6EE7B7' },
  'electrolysis-water':  { label: 'Intermediate', color: '#92400E', bg: '#FFFBEB', darkBg: 'rgba(217,119,6,0.15)', darkColor: '#FCD34D' },
  'acid-base-titration': { label: 'Intermediate', color: '#92400E', bg: '#FFFBEB', darkBg: 'rgba(217,119,6,0.15)', darkColor: '#FCD34D' },
  'le-chatelier':        { label: 'Intermediate', color: '#92400E', bg: '#FFFBEB', darkBg: 'rgba(217,119,6,0.15)', darkColor: '#FCD34D' },
  'projectile-motion':   { label: 'Intermediate', color: '#92400E', bg: '#FFFBEB', darkBg: 'rgba(217,119,6,0.15)', darkColor: '#FCD34D' },
  'prism-refraction':    { label: 'Advanced',     color: '#991B1B', bg: '#FEF2F2', darkBg: 'rgba(220,38,38,0.15)', darkColor: '#FCA5A5' },
  'magnetic-field':      { label: 'Advanced',     color: '#991B1B', bg: '#FEF2F2', darkBg: 'rgba(220,38,38,0.15)', darkColor: '#FCA5A5' },
  'paper-chromatography':{ label: 'Advanced',     color: '#991B1B', bg: '#FEF2F2', darkBg: 'rgba(220,38,38,0.15)', darkColor: '#FCA5A5' },
};

// NCERT chapter metadata for each lab
const NCERT_META: Record<string, { class: 11 | 12; chapter: string; chapterNum: string }> = {
  'simple-pendulum':     { class: 11, chapter: 'Laws of Motion & Oscillations', chapterNum: 'Ch. 14' },
  'projectile-motion':   { class: 11, chapter: 'Motion in a Plane',             chapterNum: 'Ch. 4'  },
  'prism-refraction':    { class: 12, chapter: 'Ray Optics and Optical Instruments', chapterNum: 'Ch. 9' },
  'magnetic-field':      { class: 12, chapter: 'Moving Charges and Magnetism',  chapterNum: 'Ch. 4'  },
  'ohms-law':            { class: 12, chapter: 'Current Electricity',           chapterNum: 'Ch. 3'  },
  'acid-base-titration': { class: 11, chapter: 'Equilibrium',                   chapterNum: 'Ch. 7'  },
  'electrolysis-water':  { class: 12, chapter: 'Electrochemistry',              chapterNum: 'Ch. 3'  },
  'flame-test':          { class: 11, chapter: 'The s-Block Elements',          chapterNum: 'Ch. 10' },
  'le-chatelier':        { class: 11, chapter: 'Equilibrium',                   chapterNum: 'Ch. 7'  },
  'paper-chromatography':{ class: 12, chapter: 'Biomolecules',                  chapterNum: 'Ch. 15' },
};

export default function LabCatalog() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const { journalEntries, observationData } = useLabStore();

  const [filterSubject, setFilterSubject] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [groupByNCERT, setGroupByNCERT] = useState(false);

  const tk = {
    pageBg:    dark ? '#0F111A' : '#F0EEE9',
    cardBg:    dark ? '#1C1F2E' : '#FFFFFF',
    border:    dark ? '#232840' : '#E8E5DF',
    heading:   dark ? '#EDEDF0' : '#111111',
    body:      dark ? '#8890A4' : '#666666',
    muted:     dark ? '#525870' : '#AAAAAA',
    alt:       dark ? '#161929' : '#F5F3EE',
    filterBg:  dark ? '#161929' : '#FFFFFF',
    inputBg:   dark ? '#0F111A' : '#FAFAF8',
    physBg:    dark ? 'rgba(29,78,216,0.15)' : '#EEF2FF',
    physText:  dark ? '#93B4FF' : '#1D4ED8',
    chemBg:    dark ? 'rgba(5,150,105,0.15)' : '#ECFDF5',
    chemText:  dark ? '#6EE7B7' : '#065F46',
    shadow:    dark ? 'none' : '0 1px 3px rgba(0,0,0,0.05)',
    shadowHov: dark ? 'none' : '0 6px 20px rgba(0,0,0,0.08)',
    sectionBg: dark ? 'rgba(255,255,255,0.02)' : '#FAFAF8',
  };

  const filteredLabs = experiments.filter(lab => {
    const matchSubject = filterSubject === 'All' || lab.subject === filterSubject.toLowerCase();
    const matchSearch = searchQuery === '' ||
      lab.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lab.ncert.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (NCERT_META[lab.id]?.chapter || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchSubject && matchSearch;
  });

  const isCompleted = (id: string) => journalEntries.some(j => j.experimentId === id);
  const isInProgress = (id: string) => {
    const hasData = (observationData[id] || []).length > 0;
    return hasData && !isCompleted(id);
  };

  // Group labs by subject (existing view)
  const physicsLabs = filteredLabs.filter(l => l.subject === 'physics');
  const chemLabs = filteredLabs.filter(l => l.subject === 'chemistry');

  // Group labs by NCERT class + chapter (new view)
  const class11Labs = filteredLabs.filter(l => NCERT_META[l.id]?.class === 11);
  const class12Labs = filteredLabs.filter(l => NCERT_META[l.id]?.class === 12);

  // Group class labs by chapter
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

  const LabCard = ({ lab, index }: { lab: typeof experiments[0]; index: number }) => {
    const diff = LAB_DIFFICULTY[lab.id];
    const completed = isCompleted(lab.id);
    const inProgress = isInProgress(lab.id);
    const meta = NCERT_META[lab.id];

    return (
      <motion.div
        variants={fadeUp} custom={index} initial="hidden" animate="show"
        onClick={() => navigate(`/labs/${lab.id}`)}
        style={{
          background: tk.cardBg, border: `1px solid ${tk.border}`,
          borderRadius: 16, overflow: 'hidden', cursor: 'pointer',
          boxShadow: tk.shadow, transition: 'box-shadow 0.2s, transform 0.2s, border-color 0.2s',
          position: 'relative',
        }}
        whileHover={{ y: -3 }}
        onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
          e.currentTarget.style.boxShadow = tk.shadowHov;
          e.currentTarget.style.borderColor = lab.subject === 'physics' ? '#1D4ED8' : '#059669';
        }}
        onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
          e.currentTarget.style.boxShadow = tk.shadow;
          e.currentTarget.style.borderColor = tk.border;
        }}
      >
        <div style={{ height: 3, background: lab.subject === 'physics' ? '#1D4ED8' : '#059669' }}></div>

        {(completed || inProgress) && (
          <div style={{
            position: 'absolute', top: 14, right: 14,
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
            padding: '3px 8px', borderRadius: 999,
            background: completed ? (dark ? 'rgba(5,150,105,0.2)' : '#ECFDF5') : (dark ? 'rgba(217,119,6,0.2)' : '#FFFBEB'),
            color: completed ? (dark ? '#6EE7B7' : '#065F46') : (dark ? '#FCD34D' : '#92400E'),
          }}>
            {completed ? '✓ Done' : '● In Progress'}
          </div>
        )}

        <div style={{ padding: '16px 18px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
              padding: '3px 9px', borderRadius: 999,
              background: lab.subject === 'physics' ? tk.physBg : tk.chemBg,
              color: lab.subject === 'physics' ? tk.physText : tk.chemText,
            }}>{lab.subject}</span>
            <span style={{ fontSize: 11, color: tk.muted }}>{lab.ncert}</span>
          </div>

          <h3 style={{ fontSize: 16, fontWeight: 700, color: tk.heading, marginBottom: 8, lineHeight: 1.3 }}>
            {lab.title}
          </h3>

          <p style={{
            fontSize: 12, color: tk.body, lineHeight: 1.6, marginBottom: 12,
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>
            {lab.aim}
          </p>

          {/* NCERT chapter tag */}
          {meta && (
            <div style={{
              fontSize: 11, color: tk.muted, marginBottom: 12,
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
              </svg>
              Class {meta.class} • {meta.chapterNum}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {diff && (
                <span style={{
                  fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                  padding: '2px 8px', borderRadius: 999,
                  background: dark ? diff.darkBg : diff.bg,
                  color: dark ? diff.darkColor : diff.color,
                }}>{diff.label}</span>
              )}
              <span style={{ fontSize: 11, color: tk.muted, display: 'flex', alignItems: 'center', gap: 3 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                {LAB_TIME[lab.id] || '20 min'}
              </span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: lab.subject === 'physics' ? '#1D4ED8' : '#059669', display: 'flex', alignItems: 'center', gap: 4 }}>
              {completed ? 'Redo Lab' : inProgress ? 'Continue' : 'Open Lab'}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </span>
          </div>
        </div>
      </motion.div>
    );
  };

  // Renders a chapter group section
  const ChapterGroup = ({ title, labs, color, startIdx }: { title: string; labs: typeof experiments; color: string; startIdx: number }) => (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
        padding: '10px 14px', borderRadius: 10,
        background: tk.sectionBg, border: `1px solid ${tk.border}`,
      }}>
        <div style={{ width: 2, height: 16, background: color, borderRadius: 999, flexShrink: 0 }}></div>
        <span style={{ fontSize: 13, fontWeight: 700, color: tk.heading }}>{title}</span>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
          background: color === '#1D4ED8' ? (dark ? 'rgba(29,78,216,0.15)' : '#EEF2FF') : (dark ? 'rgba(5,150,105,0.15)' : '#ECFDF5'),
          color,
        }}>
          {labs.length} lab{labs.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {labs.map((lab, i) => <LabCard key={lab.id} lab={lab} index={startIdx + i} />)}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: tk.pageBg, transition: 'background 0.3s' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>

        {/* Header */}
        <motion.div variants={fadeUp} initial="hidden" animate="show" style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: tk.heading, marginBottom: 4, letterSpacing: '-0.3px' }}>
            Lab Catalog
          </h1>
          <p style={{ fontSize: 13, color: tk.body }}>
            {experiments.length} experiments across Physics and Chemistry — fully NCERT aligned.
          </p>
        </motion.div>

        {/* Filters */}
        <motion.div variants={fadeUp} custom={1} initial="hidden" animate="show"
          style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}
        >
          {/* Search */}
          <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 320 }}>
            <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: tk.muted }}
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            <input type="text" placeholder="Search experiments or chapters..."
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '9px 12px 9px 34px', background: tk.inputBg, border: `1px solid ${tk.border}`, borderRadius: 9, fontSize: 13, color: tk.heading, outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
              onFocus={e => (e.target.style.borderColor = '#1D4ED8')}
              onBlur={e => (e.target.style.borderColor = tk.border)}
            />
          </div>

          {/* Subject filter */}
          <div style={{ display: 'flex', background: tk.filterBg, border: `1px solid ${tk.border}`, borderRadius: 10, padding: 3, gap: 2 }}>
            {SUBJECT_FILTERS.map(sub => {
              const active = filterSubject === sub;
              return (
                <button key={sub} onClick={() => setFilterSubject(sub)} style={{
                  padding: '6px 14px', borderRadius: 7, border: 'none',
                  fontSize: 13, fontWeight: active ? 700 : 500,
                  background: active ? '#1D4ED8' : 'transparent',
                  color: active ? '#fff' : tk.body,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}>{sub}</button>
              );
            })}
          </div>

          {/* NCERT grouping toggle */}
          <button onClick={() => setGroupByNCERT(g => !g)} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '7px 14px', borderRadius: 9,
            border: `1px solid ${groupByNCERT ? '#1D4ED8' : tk.border}`,
            background: groupByNCERT ? (dark ? 'rgba(29,78,216,0.15)' : '#EEF2FF') : 'transparent',
            color: groupByNCERT ? '#1D4ED8' : tk.body,
            fontSize: 13, fontWeight: groupByNCERT ? 700 : 500,
            cursor: 'pointer', transition: 'all 0.15s',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
            </svg>
            NCERT Chapters
          </button>

          <span style={{ fontSize: 13, color: tk.muted, marginLeft: 'auto' }}>
            {filteredLabs.length} result{filteredLabs.length !== 1 ? 's' : ''}
          </span>
        </motion.div>

        {/* No results */}
        {filteredLabs.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: tk.muted }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔬</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: tk.heading, marginBottom: 6 }}>No experiments found</div>
            <div style={{ fontSize: 13 }}>Try adjusting your filters or search query.</div>
          </div>
        )}

        {/* ── NCERT Chapter View ─────────────────────────────── */}
        {groupByNCERT && filteredLabs.length > 0 && (
          <>
            {/* Class 11 */}
            {class11Labs.length > 0 && (
              <div style={{ marginBottom: 36 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <div style={{ width: 3, height: 22, background: '#1D4ED8', borderRadius: 999 }}></div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: tk.heading }}>Class 11</h2>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#1D4ED8', background: dark ? 'rgba(29,78,216,0.15)' : '#EEF2FF', padding: '2px 10px', borderRadius: 999 }}>
                    {class11Labs.length} labs
                  </span>
                </div>
                {Object.entries(groupByChapter(class11Labs)).map(([chapter, labs], gi) => {
                  const isPhysics = labs[0]?.subject === 'physics';
                  return (
                    <ChapterGroup
                      key={chapter}
                      title={chapter}
                      labs={labs}
                      color={isPhysics ? '#1D4ED8' : '#059669'}
                      startIdx={gi * 3}
                    />
                  );
                })}
              </div>
            )}

            {/* Class 12 */}
            {class12Labs.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <div style={{ width: 3, height: 22, background: '#7C3AED', borderRadius: 999 }}></div>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: tk.heading }}>Class 12</h2>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED', background: dark ? 'rgba(124,58,237,0.15)' : '#F5F3FF', padding: '2px 10px', borderRadius: 999 }}>
                    {class12Labs.length} labs
                  </span>
                </div>
                {Object.entries(groupByChapter(class12Labs)).map(([chapter, labs], gi) => {
                  const isPhysics = labs[0]?.subject === 'physics';
                  return (
                    <ChapterGroup
                      key={chapter}
                      title={chapter}
                      labs={labs}
                      color={isPhysics ? '#1D4ED8' : '#059669'}
                      startIdx={gi * 3}
                    />
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── Standard Subject View ──────────────────────────── */}
        {!groupByNCERT && filteredLabs.length > 0 && (
          <>
            {physicsLabs.length > 0 && (
              <div style={{ marginBottom: 40 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <div style={{ width: 3, height: 18, background: '#1D4ED8', borderRadius: 999 }}></div>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: tk.heading }}>Physics</h2>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#1D4ED8', background: dark ? 'rgba(29,78,216,0.15)' : '#EEF2FF', padding: '2px 8px', borderRadius: 999 }}>
                    {physicsLabs.length} labs
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  {physicsLabs.map((lab, i) => <LabCard key={lab.id} lab={lab} index={i} />)}
                </div>
              </div>
            )}

            {chemLabs.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <div style={{ width: 3, height: 18, background: '#059669', borderRadius: 999 }}></div>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: tk.heading }}>Chemistry</h2>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#059669', background: dark ? 'rgba(5,150,105,0.15)' : '#ECFDF5', padding: '2px 8px', borderRadius: 999 }}>
                    {chemLabs.length} labs
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  {chemLabs.map((lab, i) => <LabCard key={lab.id} lab={lab} index={i} />)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}