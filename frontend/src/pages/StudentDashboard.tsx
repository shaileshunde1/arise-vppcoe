import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useLabStore } from '../store/useLabStore';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import { experiments } from '../data/experiments';
import { supabase } from '../lib/supabaseClient';

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.4, delay: i * 0.08 } }),
};

const TOPIC_TO_LABS: Record<string, string[]> = {
  'Mechanics':           ['simple-pendulum', 'projectile-motion'],
  'Electrostatics':      ['ohms-law', 'magnetic-field'],
  'Physical Chemistry':  ['acid-base-titration', 'le-chatelier', 'electrolysis-water'],
  'Inorganic Chemistry': ['flame-test', 'paper-chromatography'],
  'Thermodynamics':      ['le-chatelier'],
  'Electronics':         ['ohms-law', 'electrolysis-water'],
  'Optics':              ['prism-refraction'],
};

const TOPIC_TO_LAB_SINGLE: Record<string, string> = {
  'Mechanics':           'simple-pendulum',
  'Thermodynamics':      'le-chatelier',
  'Electrostatics':      'ohms-law',
  'Inorganic Chemistry': 'flame-test',
  'Physical Chemistry':  'acid-base-titration',
  'Electronics':         'electrolysis-water',
};

const ALL_TOPICS = [
  'Mechanics', 'Electrostatics', 'Physical Chemistry',
  'Inorganic Chemistry', 'Thermodynamics', 'Electronics',
];

interface TopicResult { topic: string; correct: boolean; }
interface QuizResult  { answers: TopicResult[]; score: number; }
interface RecommendedLab { id: string; match: number; reason: string; }
interface RankEntry { name: string; totalScore: number; medal: string; isMe: boolean; }

function calculateMastery(quizResult: QuizResult | null, journalEntries: any[]) {
  return ALL_TOPICS.map(topic => {
    let score = 0, maxScore = 0;
    if (quizResult) {
      const topicAnswers = quizResult.answers.filter(a => a.topic === topic);
      maxScore += topicAnswers.length * 60;
      score += topicAnswers.filter(a => a.correct).length * 60
             + topicAnswers.filter(a => !a.correct).length * 15;
    } else {
      maxScore += 60;
    }
    const relatedLabs = TOPIC_TO_LABS[topic] || [];
    relatedLabs.forEach(labId => {
      maxScore += 40;
      const entry = journalEntries.find(e => e.experimentId === labId);
      if (entry) score += Math.min(25 + Math.round((entry.score / 200) * 15), 40);
    });
    return { topic, p: maxScore === 0 ? 0 : Math.min(Math.round((score / maxScore) * 100), 100) };
  });
}

function buildRecommendations(quizResult: QuizResult | null, journalEntries: any[]): RecommendedLab[] {
  if (!quizResult) {
    return [
      { id: 'simple-pendulum',    match: 95, reason: 'Start with a classic Physics experiment' },
      { id: 'acid-base-titration', match: 90, reason: 'Foundation Chemistry experiment' },
      { id: 'ohms-law',           match: 85, reason: 'Core Electronics and Circuits lab' },
    ];
  }
  const topicScores: Record<string, { correct: number; total: number }> = {};
  quizResult.answers.forEach(a => {
    if (!topicScores[a.topic]) topicScores[a.topic] = { correct: 0, total: 0 };
    topicScores[a.topic].total += 1;
    if (a.correct) topicScores[a.topic].correct += 1;
  });
  const weakTopics = Object.entries(topicScores)
    .map(([topic, s]) => ({ topic, pct: s.correct / s.total }))
    .sort((a, b) => a.pct - b.pct);

  const recommendations: RecommendedLab[] = [];
  const used = new Set<string>();
  for (const { topic, pct } of weakTopics) {
    const labId = TOPIC_TO_LAB_SINGLE[topic];
    if (!labId || used.has(labId)) continue;
    const existing = journalEntries.find(e => e.experimentId === labId);
    if (existing && existing.score > 150) continue;
    recommendations.push({
      id: labId,
      match: Math.round(95 - pct * 30),
      reason: pct === 0 ? `${topic} needs immediate attention` : `${topic} gap detected from quiz`,
    });
    used.add(labId);
    if (recommendations.length >= 3) break;
  }
  const fillLabs = ['simple-pendulum', 'ohms-law', 'acid-base-titration', 'flame-test', 'le-chatelier'];
  for (const labId of fillLabs) {
    if (recommendations.length >= 3) break;
    if (used.has(labId)) continue;
    const existing = journalEntries.find(e => e.experimentId === labId);
    if (existing && existing.score > 150) continue;
    recommendations.push({ id: labId, match: 80, reason: 'Recommended to broaden your knowledge' });
    used.add(labId);
  }
  return recommendations.slice(0, 3);
}

export default function StudentDashboard() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const { profile } = useUser();
  const { journalEntries, observationData, completedSteps, loadJournalFromDB } = useLabStore();

  const [quizResult, setQuizResult]     = useState<QuizResult | null>(null);
  const [quizLoading, setQuizLoading]   = useState(true);
  const [rankEntries, setRankEntries]   = useState<RankEntry[]>([]);
  const [rankLoading, setRankLoading]   = useState(true);

  useEffect(() => { loadJournalFromDB(); }, []);

  // Load quiz results
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setQuizLoading(false); return; }
      const { data } = await supabase
        .from('quiz_results')
        .select('answers, score')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (data) setQuizResult(data as QuizResult);
      setQuizLoading(false);
    };
    load();
  }, []);

  // Load real leaderboard top 3
  useEffect(() => {
    const loadRanks = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('role', 'student');

      const { data: journals } = await supabase
        .from('journal_entries')
        .select('user_id, score');

      if (!profiles || !journals) { setRankLoading(false); return; }

      const scoreMap: Record<string, number> = {};
      journals.forEach(j => {
        scoreMap[j.user_id] = (scoreMap[j.user_id] || 0) + j.score;
      });

      const ranked = profiles
        .map(p => ({ id: p.id, name: p.name || 'Unknown', totalScore: scoreMap[p.id] || 0 }))
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, 3);

      const medals = ['🥇', '🥈', '🥉'];
      setRankEntries(ranked.map((r, i) => ({
        name: r.name,
        totalScore: r.totalScore,
        medal: medals[i],
        isMe: r.id === user?.id,
      })));
      setRankLoading(false);
    };
    loadRanks();
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const displayName = profile?.name || 'Student';

  // Profile completeness check for Google users
  const profileIncomplete = profile && (!profile.institution || !profile.year || !profile.class_division || profile.class_division === 'Unassigned');

  const masteryData = calculateMastery(quizResult, journalEntries);
  const overallMastery = masteryData.length > 0
    ? Math.round(masteryData.reduce((s, t) => s + t.p, 0) / masteryData.length)
    : 0;

  const recommendations = buildRecommendations(quizResult, journalEntries);

  const totalExperimentsDone = journalEntries.length;
  const totalObservations    = Object.values(observationData).reduce((s, a) => s + a.length, 0);
  const totalSteps           = Object.values(completedSteps).reduce((s, a) => s + a.length, 0);
  const bestScore            = journalEntries.length > 0 ? Math.max(...journalEntries.map(e => e.score)) : 0;

  const incompleteExp = experiments.find(e => {
    const hasData    = (observationData[e.id] || []).length > 0;
    const alreadySaved = journalEntries.some(j => j.experimentId === e.id);
    return hasData && !alreadySaved;
  });

  const recentJournal = journalEntries.slice(0, 3);

  const STATS = [
    { label: 'Labs Completed',       value: totalExperimentsDone,                     icon: '🧪' },
    { label: 'Observations Recorded', value: totalObservations,                        icon: '📊' },
    { label: 'Steps Completed',       value: totalSteps,                               icon: '✅' },
    { label: 'Best Score',            value: bestScore > 0 ? `${bestScore} pts` : '—', icon: '🏆' },
  ];

  const tk = {
    pageBg:    dark ? '#0F111A' : '#F0EEE9',
    cardBg:    dark ? '#1C1F2E' : '#FFFFFF',
    border:    dark ? '#232840' : '#E8E5DF',
    divider:   dark ? '#1E2235' : '#F3F1ED',
    heading:   dark ? '#EDEDF0' : '#111111',
    body:      dark ? '#8890A4' : '#666666',
    muted:     dark ? '#525870' : '#AAAAAA',
    alt:       dark ? '#161929' : '#F5F3EE',
    hoverBg:   dark ? 'rgba(255,255,255,0.03)' : '#FAFAF8',
    physBg:    dark ? 'rgba(29,78,216,0.15)' : '#EEF2FF',
    physText:  dark ? '#93B4FF' : '#1D4ED8',
    chemBg:    dark ? 'rgba(5,150,105,0.15)' : '#ECFDF5',
    chemText:  dark ? '#6EE7B7' : '#065F46',
    blueBg:    dark ? 'rgba(29,78,216,0.12)' : '#EEF2FF',
    blueText:  '#1D4ED8',
    amberBg:   dark ? 'rgba(217,119,6,0.12)' : '#FFFBEB',
    amberText: dark ? '#FCD34D' : '#D97706',
    shadow:    dark ? 'none' : '0 1px 3px rgba(0,0,0,0.05)',
  };

  const card: React.CSSProperties = {
    background: tk.cardBg, border: `1px solid ${tk.border}`,
    borderRadius: 16, boxShadow: tk.shadow, overflow: 'hidden',
    transition: 'background 0.3s, border-color 0.3s',
  };

  return (
    <div style={{ minHeight: '100vh', background: tk.pageBg, transition: 'background 0.3s' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>

        {/* Header */}
        <motion.div variants={fadeUp} initial="hidden" animate="show" style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: tk.heading, marginBottom: 4 }}>
            {greeting}, {displayName} 👋
          </h1>
          <p style={{ fontSize: 13, color: tk.body }}>Here's your learning overview for today.</p>
        </motion.div>

        {/* Profile incomplete nudge — for Google sign-in users */}
        {profileIncomplete && (
          <motion.div variants={fadeUp} initial="hidden" animate="show" style={{
            ...card, padding: '14px 20px', marginBottom: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderColor: dark ? 'rgba(217,119,6,0.35)' : '#FCD34D',
            background: dark ? 'rgba(217,119,6,0.07)' : '#FFFBEB',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 20 }}>👤</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: tk.heading, marginBottom: 2 }}>
                  Complete your profile
                </div>
                <div style={{ fontSize: 12, color: tk.body }}>
                  Add your institution, class, and division so teachers can find you on the leaderboard.
                </div>
              </div>
            </div>
            <button onClick={() => navigate('/profile')} style={{
              flexShrink: 0, padding: '8px 16px',
              background: dark ? 'rgba(217,119,6,0.2)' : '#FEF3C7',
              color: tk.amberText, border: `1px solid ${dark ? 'rgba(217,119,6,0.4)' : '#FCD34D'}`,
              fontSize: 12, fontWeight: 700, borderRadius: 9, cursor: 'pointer', marginLeft: 16,
            }}>
              Edit Profile →
            </button>
          </motion.div>
        )}

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
          {STATS.map((stat, i) => (
            <motion.div key={i} variants={fadeUp} custom={i} initial="hidden" animate="show"
              style={{ ...card, padding: '18px 20px' }}>
              <div style={{ fontSize: 20, marginBottom: 8 }}>{stat.icon}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: tk.heading, marginBottom: 3, fontFamily: 'monospace' }}>{stat.value}</div>
              <div style={{ fontSize: 11, color: tk.muted, fontWeight: 600 }}>{stat.label}</div>
            </motion.div>
          ))}
        </div>

        {/* No quiz banner */}
        {!quizLoading && !quizResult && (
          <motion.div variants={fadeUp} initial="hidden" animate="show" style={{
            ...card, padding: '16px 20px', marginBottom: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderColor: dark ? 'rgba(29,78,216,0.3)' : '#C7D7FD',
            background: dark ? 'rgba(29,78,216,0.06)' : '#EEF2FF',
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: tk.heading, marginBottom: 2 }}>
                Take the Diagnostic Quiz
              </div>
              <div style={{ fontSize: 12, color: tk.body }}>
                Get personalised lab recommendations and an accurate mastery index based on your knowledge.
              </div>
            </div>
            <button onClick={() => navigate('/quiz')} style={{
              flexShrink: 0, padding: '8px 18px', background: '#1D4ED8', color: '#fff',
              fontSize: 12, fontWeight: 700, borderRadius: 9, border: 'none', cursor: 'pointer', marginLeft: 16,
            }}>
              Start Quiz →
            </button>
          </motion.div>
        )}

        {/* Main grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>

          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>

            {/* AI Recommendations */}
            <motion.div variants={fadeUp} custom={1} initial="hidden" animate="show" style={card}>
              <div style={{ padding: '14px 20px', borderBottom: `1px solid ${tk.divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: tk.heading }}>AI Recommended For You</div>
                  <div style={{ fontSize: 11, color: tk.muted, marginTop: 2 }}>
                    {quizResult ? 'Based on your diagnostic quiz results' : 'Complete the quiz for personalised recommendations'}
                  </div>
                </div>
                <Link to="/labs" style={{ fontSize: 12, fontWeight: 700, color: tk.blueText, textDecoration: 'none' }}>View All →</Link>
              </div>
              <div style={{ padding: '18px 20px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                {recommendations.map((rec, i) => {
                  const exp = experiments.find(e => e.id === rec.id);
                  if (!exp) return null;
                  return (
                    <div key={i} onClick={() => navigate(`/labs/${exp.id}`)} style={{
                      border: `1px solid ${tk.border}`, borderRadius: 12, padding: '14px',
                      cursor: 'pointer', transition: 'border-color 0.2s, background 0.2s', background: tk.alt,
                    }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#1D4ED8'; e.currentTarget.style.background = dark ? 'rgba(29,78,216,0.08)' : '#F5F8FF'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = tk.border; e.currentTarget.style.background = tk.alt; }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '2px 7px', borderRadius: 999, background: exp.subject === 'physics' ? tk.physBg : tk.chemBg, color: exp.subject === 'physics' ? tk.physText : tk.chemText }}>{exp.subject}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: tk.blueText, background: tk.blueBg, padding: '2px 7px', borderRadius: 999 }}>{rec.match}%</span>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: tk.heading, marginBottom: 4 }}>{exp.title}</div>
                      <div style={{ fontSize: 11, color: tk.muted, lineHeight: 1.5, marginBottom: 10 }}>{rec.reason}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: tk.blueText, display: 'flex', alignItems: 'center', gap: 4 }}>
                        Start Lab
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            {/* Incomplete session */}
            {incompleteExp && (
              <motion.div variants={fadeUp} custom={2} initial="hidden" animate="show"
                style={{ ...card, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: tk.amberBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: tk.amberText }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: tk.amberText, marginBottom: 3 }}>Incomplete Session</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: tk.heading, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{incompleteExp.title}</div>
                  <div style={{ fontSize: 12, color: tk.muted, marginTop: 2 }}>{(observationData[incompleteExp.id] || []).length} observations recorded — finish to save to journal</div>
                </div>
                <button onClick={() => navigate(`/labs/${incompleteExp.id}`)} style={{ flexShrink: 0, padding: '8px 16px', background: tk.heading, color: tk.pageBg, fontSize: 12, fontWeight: 700, borderRadius: 9, border: 'none', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >Resume Lab</button>
              </motion.div>
            )}

            {/* Recent journal */}
            <motion.div variants={fadeUp} custom={3} initial="hidden" animate="show" style={card}>
              <div style={{ padding: '14px 20px', borderBottom: `1px solid ${tk.divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: tk.heading }}>Recent Lab Journal</div>
                <Link to="/journal" style={{ fontSize: 12, fontWeight: 700, color: tk.blueText, textDecoration: 'none' }}>View All →</Link>
              </div>
              {recentJournal.length === 0 ? (
                <div style={{ padding: '36px 20px', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>📓</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: tk.heading, marginBottom: 4 }}>No journal entries yet</div>
                  <div style={{ fontSize: 12, color: tk.muted, marginBottom: 16 }}>Complete a lab and save your observations to see them here.</div>
                  <button onClick={() => navigate('/labs')} style={{ padding: '8px 18px', background: '#1D4ED8', color: '#fff', fontSize: 12, fontWeight: 700, borderRadius: 8, border: 'none', cursor: 'pointer' }}>Browse Labs</button>
                </div>
              ) : (
                <div>
                  {recentJournal.map((entry, i) => (
                    <div key={i} style={{ padding: '13px 20px', display: 'flex', alignItems: 'center', gap: 14, borderBottom: i < recentJournal.length - 1 ? `1px solid ${tk.divider}` : 'none', transition: 'background 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = tk.hoverBg)}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: tk.blueBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: tk.blueText }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18"/></svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: tk.heading, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.lab}</div>
                        <div style={{ fontSize: 11, color: tk.muted, marginTop: 2 }}>{entry.date} • {entry.observations.length} observations</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: tk.blueText, fontFamily: 'monospace', flexShrink: 0 }}>{entry.score} pts</div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Mastery index */}
            <motion.div variants={fadeUp} custom={2} initial="hidden" animate="show" style={{ ...card, padding: '20px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: tk.heading, marginBottom: 3 }}>Mastery Index</div>
              <div style={{ fontSize: 11, color: tk.muted, marginBottom: 18 }}>
                {quizResult ? 'Based on quiz + lab performance' : 'Take the quiz to unlock full mastery tracking'}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 20 }}>
                <span style={{ fontSize: 38, fontWeight: 800, color: tk.heading, lineHeight: 1 }}>
                  {quizLoading ? '—' : overallMastery}
                </span>
                <span style={{ fontSize: 16, fontWeight: 700, color: tk.muted }}>/ 100</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {masteryData.map((t, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 12, color: tk.body, fontWeight: 500 }}>{t.topic}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: tk.heading, fontFamily: 'monospace' }}>
                        {quizLoading ? '…' : `${t.p}%`}
                      </span>
                    </div>
                    <div style={{ width: '100%', height: 5, background: tk.alt, borderRadius: 999, overflow: 'hidden' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: quizLoading ? '0%' : `${t.p}%` }}
                        transition={{ duration: 1, delay: i * 0.1, ease: 'easeOut' }}
                        style={{ height: '100%', borderRadius: 999, background: t.p >= 70 ? '#1D4ED8' : t.p >= 45 ? '#D97706' : '#DC2626' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {!quizResult && !quizLoading && (
                <button onClick={() => navigate('/quiz')} style={{ width: '100%', marginTop: 18, padding: '9px', background: '#1D4ED8', color: '#fff', borderRadius: 10, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                  Take Diagnostic Quiz →
                </button>
              )}
              {quizResult && (
                <div style={{ marginTop: 14, fontSize: 11, color: tk.muted, textAlign: 'center' }}>
                  Quiz score: {quizResult.score}/10 • Labs boost topic scores
                </div>
              )}
            </motion.div>

            {/* Rank Snapshot — real data */}
            <motion.div variants={fadeUp} custom={3} initial="hidden" animate="show" style={card}>
              <div style={{ padding: '14px 18px', borderBottom: `1px solid ${tk.divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: tk.heading }}>Rank Snapshot</div>
                <Link to="/leaderboard" style={{ fontSize: 12, fontWeight: 700, color: tk.blueText, textDecoration: 'none' }}>Full Board →</Link>
              </div>
              {rankLoading ? (
                <div style={{ padding: '20px', textAlign: 'center', fontSize: 12, color: tk.muted }}>Loading...</div>
              ) : rankEntries.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', fontSize: 12, color: tk.muted }}>
                  No scores yet — complete a lab to appear here!
                </div>
              ) : (
                rankEntries.map((s, i) => (
                  <div key={i} style={{
                    padding: '11px 18px', display: 'flex', alignItems: 'center', gap: 10,
                    borderBottom: i < rankEntries.length - 1 ? `1px solid ${tk.divider}` : 'none',
                    background: s.isMe ? (dark ? 'rgba(29,78,216,0.06)' : '#EEF2FF') : 'transparent',
                    transition: 'background 0.15s',
                  }}
                    onMouseEnter={e => { if (!s.isMe) e.currentTarget.style.background = tk.hoverBg; }}
                    onMouseLeave={e => { if (!s.isMe) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ fontSize: 16, width: 24, textAlign: 'center' }}>{s.medal}</span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: s.isMe ? 700 : 500, color: tk.heading }}>
                      {s.name}
                      {s.isMe && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: '#1D4ED8', background: dark ? 'rgba(29,78,216,0.15)' : '#EEF2FF', padding: '1px 5px', borderRadius: 999, textTransform: 'uppercase' }}>You</span>}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: tk.blueText, fontFamily: 'monospace' }}>
                      {s.totalScore > 0 ? s.totalScore.toLocaleString() : '—'}
                    </span>
                  </div>
                ))
              )}
            </motion.div>

            {/* Quick actions */}
            <motion.div variants={fadeUp} custom={4} initial="hidden" animate="show" style={{ ...card, padding: '18px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: tk.heading, marginBottom: 12 }}>Quick Actions</div>
              {[
                { label: 'Browse All Labs',  to: '/labs',        icon: '🔬' },
                { label: 'My Lab Journal',   to: '/journal',     icon: '📓' },
                { label: 'Leaderboard',      to: '/leaderboard', icon: '🏆' },
                { label: 'Profile Settings', to: '/profile',     icon: '⚙️' },
              ].map((action, i) => (
                <Link key={i} to={action.to} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 9, textDecoration: 'none', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = tk.hoverBg)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ fontSize: 15 }}>{action.icon}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: tk.body }}>{action.label}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={tk.muted} strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </Link>
              ))}
            </motion.div>

          </div>
        </div>
      </div>
    </div>
  );
}