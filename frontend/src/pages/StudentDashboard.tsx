import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { useLabStore } from '../store/useLabStore';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import { experiments } from '../data/experiments';
import { supabase } from '../lib/supabaseClient';
import { askGeminiJSON } from '../lib/geminiClient';

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] } }),
};

// ── Data helpers (all logic preserved exactly) ───────────────────────────────

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

interface TopicResult  { topic: string; correct: boolean; }
interface QuizResult   { answers: TopicResult[]; score: number; }
interface RecommendedLab { id: string; match: number; reason: string; }
interface RankEntry    { name: string; totalScore: number; medal: string; isMe: boolean; rank: number; }
interface AIInsight    { type: 'strength' | 'gap' | 'tip'; title: string; body: string; }
interface AIInsightsState { insights: AIInsight[]; summary: string; }

function calculateMastery(quizResult: QuizResult | null, journalEntries: any[]) {
  return ALL_TOPICS.map(topic => {
    let score = 0, maxScore = 0;
    if (quizResult) {
      const ta = quizResult.answers.filter(a => a.topic === topic);
      maxScore += ta.length * 60;
      score    += ta.filter(a => a.correct).length * 60 + ta.filter(a => !a.correct).length * 15;
    } else { maxScore += 60; }
    (TOPIC_TO_LABS[topic] || []).forEach(labId => {
      maxScore += 40;
      const entry = journalEntries.find(e => e.experimentId === labId);
      if (entry) score += Math.min(25 + Math.round((entry.score / 200) * 15), 40);
    });
    return { topic, p: maxScore === 0 ? 0 : Math.min(Math.round((score / maxScore) * 100), 100) };
  });
}

function buildRecommendations(quizResult: QuizResult | null, journalEntries: any[]): RecommendedLab[] {
  if (!quizResult) return [
    { id: 'simple-pendulum',     match: 95, reason: 'Start with a classic Physics experiment'    },
    { id: 'acid-base-titration', match: 90, reason: 'Foundation Chemistry experiment'             },
    { id: 'ohms-law',            match: 85, reason: 'Core Electronics and Circuits lab'           },
  ];
  const topicScores: Record<string, { correct: number; total: number }> = {};
  quizResult.answers.forEach(a => {
    if (!topicScores[a.topic]) topicScores[a.topic] = { correct: 0, total: 0 };
    topicScores[a.topic].total   += 1;
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
  for (const labId of ['simple-pendulum', 'ohms-law', 'acid-base-titration', 'flame-test', 'le-chatelier']) {
    if (recommendations.length >= 3) break;
    if (used.has(labId)) continue;
    const existing = journalEntries.find(e => e.experimentId === labId);
    if (existing && existing.score > 150) continue;
    recommendations.push({ id: labId, match: 80, reason: 'Recommended to broaden your knowledge' });
    used.add(labId);
  }
  return recommendations.slice(0, 3);
}

async function fetchAIInsights(
  displayName: string,
  quizResult: QuizResult | null,
  masteryData: { topic: string; p: number }[],
  journalEntries: any[],
  overallMastery: number,
): Promise<AIInsightsState> {
  const labsDone   = journalEntries.map(e => `${e.lab} (score: ${e.score})`).join(', ') || 'none yet';
  const masteryStr = masteryData.map(m => `${m.topic}: ${m.p}%`).join(', ');
  const quizStr    = quizResult
    ? `Quiz score: ${quizResult.score}/10. Topic breakdown: ${masteryStr}`
    : 'No quiz taken yet.';
  const prompt = `You are a science tutor AI analyzing a student's lab performance.
Student: ${displayName}
Overall mastery: ${overallMastery}%
${quizStr}
Labs completed: ${labsDone}

Return ONLY a valid JSON object with this exact shape (no markdown, no backticks, no extra text):
{
  "summary": "One concise sentence (max 20 words) summarizing the student's overall progress.",
  "insights": [
    { "type": "strength", "title": "Short title (3-5 words)", "body": "One sentence about what they are doing well." },
    { "type": "gap",      "title": "Short title (3-5 words)", "body": "One sentence about the biggest knowledge gap." },
    { "type": "tip",      "title": "Short title (3-5 words)", "body": "One actionable next step they should take." }
  ]
}`;
  return await askGeminiJSON<AIInsightsState>(prompt);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function StudentDashboard() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const { profile } = useUser();
  const { journalEntries, observationData, completedSteps, loadJournalFromDB } = useLabStore();

  const [quizResult,  setQuizResult]  = useState<QuizResult | null>(null);
  const [quizLoading, setQuizLoading] = useState(true);
  const [rankEntries, setRankEntries] = useState<RankEntry[]>([]);
  const [rankLoading, setRankLoading] = useState(true);
  const [aiInsights,  setAiInsights]  = useState<AIInsightsState | null>(null);
  const [aiLoading,   setAiLoading]   = useState(false);
  const [aiError,     setAiError]     = useState(false);

  const aiTriggeredRef = useRef(false);

  useEffect(() => { loadJournalFromDB(); }, []);

  // Load quiz result
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

  // Load leaderboard ranks
  useEffect(() => {
    const loadRanks = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profiles  } = await supabase.from('profiles').select('id, name').eq('role', 'student');
      const { data: journals  } = await supabase.from('journal_entries').select('user_id, score');
      if (!profiles || !journals) { setRankLoading(false); return; }
      const scoreMap: Record<string, number> = {};
      journals.forEach(j => { scoreMap[j.user_id] = (scoreMap[j.user_id] || 0) + j.score; });
      const allRanked = profiles
        .map(p => ({ id: p.id, name: p.name || 'Unknown', totalScore: scoreMap[p.id] || 0 }))
        .sort((a, b) => b.totalScore - a.totalScore);
      const medals   = ['🥇', '🥈', '🥉'];
      const myIndex  = allRanked.findIndex(r => r.id === user?.id);
      const top3     = allRanked.slice(0, 3);
      const displayEntries: RankEntry[] = top3.map((r, i) => ({
        name: r.name, totalScore: r.totalScore, medal: medals[i],
        isMe: r.id === user?.id, rank: i + 1,
      }));
      if (user && myIndex >= 3) {
        const me = allRanked[myIndex];
        displayEntries.push({ name: me.name, totalScore: me.totalScore, medal: `#${myIndex + 1}`, isMe: true, rank: myIndex + 1 });
      }
      setRankEntries(displayEntries);
      setRankLoading(false);
    };
    loadRanks();
  }, []);

  // Derived values
  const hour        = new Date().getHours();
  const greeting    = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const displayName = profile?.name || 'Student';
  const profileIncomplete = profile && (
    !profile.institution || !profile.year || !profile.class_division || profile.class_division === 'Unassigned'
  );

  const masteryData    = calculateMastery(quizResult, journalEntries);
  const overallMastery = masteryData.length > 0
    ? Math.round(masteryData.reduce((s, t) => s + t.p, 0) / masteryData.length)
    : 0;
  const recommendations = buildRecommendations(quizResult, journalEntries);

  const totalExperimentsDone = journalEntries.length;
  const totalObservations    = Object.values(observationData).reduce((s, a) => s + a.length, 0);
  const totalSteps           = Object.values(completedSteps).reduce((s, a) => s + a.length, 0);
  const bestScore            = journalEntries.length > 0 ? Math.max(...journalEntries.map(e => e.score)) : 0;

  const incompleteExp = experiments.find(e => {
    const hasData      = (observationData[e.id] || []).length > 0;
    const alreadySaved = journalEntries.some(j => j.experimentId === e.id);
    return hasData && !alreadySaved;
  });

  const recentJournal = journalEntries.slice(0, 3);
  const showAiSection = quizResult !== null || journalEntries.length > 0;

  // Auto-trigger AI insights once per page load after quiz data is ready
  useEffect(() => {
    if (quizLoading) return;
    if (aiTriggeredRef.current) return;
    if (!quizResult && journalEntries.length === 0) return;
    aiTriggeredRef.current = true;
    setAiLoading(true);
    setAiError(false);
    fetchAIInsights(displayName, quizResult, masteryData, journalEntries, overallMastery)
      .then(result => { setAiInsights(result); })
      .catch(err => {
        console.error('[ARISE] AI insights error:', err);
        setAiError(true);
        aiTriggeredRef.current = false;
      })
      .finally(() => { setAiLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizLoading, quizResult, journalEntries.length]);

  const runRefreshInsights = () => {
    if (aiLoading) return;
    aiTriggeredRef.current = true;
    setAiInsights(null);
    setAiError(false);
    setAiLoading(true);
    fetchAIInsights(displayName, quizResult, masteryData, journalEntries, overallMastery)
      .then(result => { setAiInsights(result); })
      .catch(err => {
        console.error('[ARISE] AI insights refresh error:', err);
        setAiError(true);
        aiTriggeredRef.current = false;
      })
      .finally(() => { setAiLoading(false); });
  };

  const STATS = [
    { label: 'Labs Completed',        value: totalExperimentsDone,                        icon: '🧪' },
    { label: 'Observations Recorded', value: totalObservations,                           icon: '📊' },
    { label: 'Steps Completed',       value: totalSteps,                                  icon: '✅' },
    { label: 'Best Score',            value: bestScore > 0 ? `${bestScore} pts` : '—',    icon: '🏆' },
  ];

  // ── Shared card style — matches Lab Catalog exactly ──────────────────
  const card: React.CSSProperties = {
    background:   'var(--surface-container)',
    border:       '1px solid var(--card-border)',
    borderRadius: 16,
    boxShadow:    'var(--card-shadow)',
    overflow:     'hidden',
    transition:   'background 0.3s, border-color 0.3s',
  };

  // ── Divider between sections ──────────────────────────────────────────
  const sectionDivider: React.CSSProperties = {
    height:     '1px',
    background: 'var(--card-border)',
    margin:     0,
    border:     'none',
  };

  // ── AI insight type colours — CSS-var-based ───────────────────────────
  const insightTheme = {
    strength: {
      bg:   dark ? 'rgba(5,150,105,0.10)'  : 'rgba(5,150,105,0.07)',
      border: dark ? 'rgba(5,150,105,0.25)' : 'rgba(5,150,105,0.20)',
      text: 'var(--diff-beginner-text)',
      icon: '💪',
    },
    gap: {
      bg:   dark ? 'rgba(220,38,38,0.08)'  : 'rgba(220,38,38,0.06)',
      border: dark ? 'rgba(220,38,38,0.22)' : 'rgba(220,38,38,0.18)',
      text: 'var(--diff-advanced-text)',
      icon: '📍',
    },
    tip: {
      bg:   'var(--ncert-chip-bg)',
      border: 'var(--filter-pill-border)',
      text: 'var(--secondary)',
      icon: '💡',
    },
  };

  // ── Mastery bar colour — mirrors Lab Catalog's diff badge logic ───────
  const masteryBarColor = (p: number) =>
    p >= 70 ? 'var(--secondary)' :
    p >= 45 ? 'var(--diff-intermediate-text)' :
              'var(--diff-advanced-text)';

  return (
    <div style={{
      minHeight:  '100vh',
      background: 'var(--surface)',
      color:      'var(--on-background)',
      transition: 'background 0.3s',
    }}>
      <div style={{
        maxWidth: 1200,
        margin:   '0 auto',
        padding:  'clamp(20px, 4vw, 40px) clamp(16px, 4vw, 32px)',
      }}>

        {/* ── Page header ─────────────────────────────────────────── */}
        <motion.div variants={fadeUp} initial="hidden" animate="show" style={{ marginBottom: 28 }}>
          <span className="font-label" style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase',
            color: 'var(--secondary)', display: 'block', marginBottom: 6,
          }}>
            Student Dashboard
          </span>
          <h1 className="serif" style={{
            fontSize: 'clamp(1.5rem, 3.5vw, 2.25rem)',
            fontWeight: 300,
            color: 'var(--primary)',
            letterSpacing: '-0.03em',
            marginBottom: 6,
            lineHeight: 1.15,
          }}>
            {greeting}, {displayName} 👋
          </h1>
          <p className="font-body" style={{ fontSize: 14, color: 'var(--on-surface-variant)' }}>
            Here's your learning overview for today.
          </p>
        </motion.div>

        {/* ── Profile incomplete banner ────────────────────────────── */}
        {profileIncomplete && (
          <motion.div variants={fadeUp} initial="hidden" animate="show" style={{
            ...card,
            padding: '14px 20px',
            marginBottom: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderColor: 'var(--diff-intermediate-text)',
            background: 'var(--diff-intermediate-bg)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 20 }}>👤</span>
              <div>
                <div className="font-label" style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)', marginBottom: 2 }}>
                  Complete your profile
                </div>
                <div className="font-body" style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>
                  Add your institution, class, and division so teachers can find you on the leaderboard.
                </div>
              </div>
            </div>
            <button
              onClick={() => navigate('/profile')}
              className="font-label"
              style={{
                flexShrink: 0, marginLeft: 16,
                padding: '8px 16px', borderRadius: 9,
                background: 'var(--diff-intermediate-bg)',
                color: 'var(--diff-intermediate-text)',
                border: '1px solid var(--diff-intermediate-text)',
                fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                textTransform: 'uppercase', cursor: 'pointer',
              }}
            >
              Edit Profile →
            </button>
          </motion.div>
        )}

        {/* ── Stats row ───────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 14, marginBottom: 24 }}>
          {STATS.map((stat, i) => (
            <motion.div key={i} variants={fadeUp} custom={i} initial="hidden" animate="show" style={{ ...card, padding: '18px 20px' }}>
              <div style={{ fontSize: 20, marginBottom: 8 }}>{stat.icon}</div>
              <div className="font-label" style={{
                fontSize: 24, fontWeight: 800, color: 'var(--primary)',
                marginBottom: 3, fontFamily: 'monospace',
              }}>
                {stat.value}
              </div>
              <div className="font-label" style={{ fontSize: 11, color: 'var(--outline)', fontWeight: 600 }}>
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── Quiz CTA (when no quiz taken) ───────────────────────── */}
        {!quizLoading && !quizResult && (
          <motion.div variants={fadeUp} initial="hidden" animate="show" style={{
            ...card,
            padding: '16px 20px', marginBottom: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderColor: 'var(--secondary-container)',
            background: 'var(--ncert-chip-bg)',
          }}>
            <div>
              <div className="font-label" style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)', marginBottom: 2 }}>
                Take the Diagnostic Quiz
              </div>
              <div className="font-body" style={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>
                Get personalised lab recommendations and an accurate mastery index based on your knowledge.
              </div>
            </div>
            <button
              onClick={() => navigate('/quiz')}
              className="font-label"
              style={{
                flexShrink: 0, marginLeft: 16,
                padding: '8px 18px', borderRadius: 9,
                background: 'var(--secondary)',
                color: dark ? 'var(--surface)' : '#ffffff',
                border: 'none', fontSize: 11, fontWeight: 700,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              Start Quiz →
            </button>
          </motion.div>
        )}

        {/* ── Main two-column grid ─────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: 20 }}>

          {/* ── LEFT COLUMN ──────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>

            {/* AI Recommendations */}
            <motion.div variants={fadeUp} custom={1} initial="hidden" animate="show" style={card}>
              <div style={{
                padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <hr style={sectionDivider} />
              </div>
              <div style={{ padding: '0 20px 2px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="font-label" style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)' }}>
                    AI Recommended For You
                  </div>
                  <div className="font-body" style={{ fontSize: 11, color: 'var(--outline)', marginTop: 2 }}>
                    {quizResult ? 'Based on your diagnostic quiz results' : 'Complete the quiz for personalised recommendations'}
                  </div>
                </div>
                <Link to="/labs" className="font-label" style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: 'var(--secondary)', textDecoration: 'none',
                }}>
                  View All →
                </Link>
              </div>
              {/* Stripe accent — same pattern as Lab Catalog's top stripe */}
              <div style={{ height: 2, background: 'var(--secondary)', margin: '14px 0 0' }} />
              <div style={{ padding: '18px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                {recommendations.map((rec, i) => {
                  const exp = experiments.find(e => e.id === rec.id);
                  if (!exp) return null;
                  const isPhysics   = exp.subject === 'physics';
                  const isMechanics = exp.subject === 'mechanics';
                  return (
                    <div
                      key={i}
                      onClick={() => navigate(`/labs/${exp.id}`)}
                      style={{
                        background: 'var(--surface-container-high)',
                        border: '1px solid var(--card-border)',
                        borderRadius: 12, padding: '14px',
                        cursor: 'pointer',
                        transition: 'border-color 0.2s, box-shadow 0.2s',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = 'var(--card-border-hover-physics)';
                        e.currentTarget.style.boxShadow  = 'var(--card-shadow-hover)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = 'var(--card-border)';
                        e.currentTarget.style.boxShadow  = 'var(--card-shadow)';
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span className="font-label" style={{
                          fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em',
                          padding: '3px 10px', borderRadius: 999,
                          background: isMechanics ? 'var(--chip-mechanics-bg)' : isPhysics ? 'var(--chip-physics-bg)' : 'var(--chip-chem-bg)',
                          color:      isMechanics ? 'var(--chip-mechanics-text)' : isPhysics ? 'var(--chip-physics-text)' : 'var(--chip-chem-text)',
                        }}>
                          {exp.subject}
                        </span>
                        <span className="font-label" style={{
                          fontSize: 10, fontWeight: 700,
                          color: 'var(--secondary)', background: 'var(--ncert-chip-bg)',
                          padding: '2px 7px', borderRadius: 999,
                        }}>
                          {rec.match}%
                        </span>
                      </div>
                      <div className="font-label" style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)', marginBottom: 4 }}>
                        {exp.title}
                      </div>
                      <div className="font-body" style={{ fontSize: 11, color: 'var(--outline)', lineHeight: 1.5, marginBottom: 10 }}>
                        {rec.reason}
                      </div>
                      <div className="font-label" style={{
                        fontSize: 11, fontWeight: 700,
                        color: isMechanics ? 'var(--chip-mechanics-text)' : isPhysics ? 'var(--secondary)' : 'var(--primary)',
                        display: 'flex', alignItems: 'center', gap: 4,
                        textTransform: 'uppercase', letterSpacing: '0.08em',
                      }}>
                        Start Lab
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            {/* AI Insights */}
            {showAiSection && (
              <motion.div variants={fadeUp} custom={2} initial="hidden" animate="show" style={card}>
                <div style={{ padding: '14px 20px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="font-label" style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
                        padding: '3px 9px', borderRadius: 999,
                        background: dark ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.08)',
                        color: dark ? '#C4B5FD' : '#7C3AED',
                        border: `1px solid ${dark ? 'rgba(139,92,246,0.3)' : 'rgba(139,92,246,0.2)'}`,
                      }}>
                        AI
                      </span>
                      <span className="font-label" style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)' }}>
                        Personalised Insights
                      </span>
                    </div>
                    {!aiLoading && (
                      <button
                        onClick={runRefreshInsights}
                        className="font-label"
                        style={{
                          fontSize: 11, fontWeight: 700,
                          color: 'var(--secondary)', background: 'transparent',
                          border: 'none', cursor: 'pointer',
                          padding: '4px 8px', borderRadius: 6,
                          display: 'flex', alignItems: 'center', gap: 4,
                        }}
                      >
                        ↻ Refresh
                      </button>
                    )}
                  </div>
                  <div className="font-body" style={{ fontSize: 11, color: 'var(--outline)', marginBottom: 14 }}>
                    Generated from your quiz results and lab activity
                  </div>
                </div>
                <hr style={sectionDivider} />
                <div style={{ padding: '16px 20px' }}>
                  {aiLoading && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {[1, 2, 3].map(i => (
                        <div key={i} style={{
                          height: 64, borderRadius: 12,
                          background: 'var(--surface-container-high)',
                          animation: 'arise-pulse 1.5s ease-in-out infinite',
                          animationDelay: `${i * 0.15}s`,
                        }} />
                      ))}
                    </div>
                  )}
                  {aiError && !aiLoading && (
                    <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--outline)', fontSize: 13 }}>
                      Could not load insights right now.{' '}
                      <button
                        onClick={runRefreshInsights}
                        style={{ color: 'var(--secondary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}
                      >
                        Try again
                      </button>
                    </div>
                  )}
                  {aiInsights && !aiLoading && (
                    <>
                      <div className="font-body" style={{
                        fontSize: 13, color: 'var(--on-surface-variant)', lineHeight: 1.6,
                        marginBottom: 16,
                        padding: '10px 14px', borderRadius: 10,
                        background: 'var(--surface-container-high)',
                        border: '1px solid var(--card-border)',
                      }}>
                        {aiInsights.summary}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                        {aiInsights.insights.map((ins, i) => {
                          const col = insightTheme[ins.type] ?? insightTheme.tip;
                          return (
                            <div key={i} style={{
                              padding: '14px', borderRadius: 12,
                              background: col.bg,
                              border: `1px solid ${col.border}`,
                            }}>
                              <div style={{ fontSize: 18, marginBottom: 8 }}>{col.icon}</div>
                              <div className="font-label" style={{ fontSize: 12, fontWeight: 700, color: col.text, marginBottom: 5 }}>
                                {ins.title}
                              </div>
                              <div className="font-body" style={{ fontSize: 11, color: 'var(--on-surface-variant)', lineHeight: 1.55 }}>
                                {ins.body}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            )}

            {/* Incomplete session banner */}
            {incompleteExp && (
              <motion.div
                variants={fadeUp} custom={3} initial="hidden" animate="show"
                style={{ ...card, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                  background: 'var(--diff-intermediate-bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--diff-intermediate-text)',
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="font-label" style={{
                    fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em',
                    color: 'var(--diff-intermediate-text)', marginBottom: 3,
                  }}>
                    Incomplete Session
                  </div>
                  <div className="font-label" style={{
                    fontSize: 14, fontWeight: 700, color: 'var(--on-surface)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {incompleteExp.title}
                  </div>
                  <div className="font-body" style={{ fontSize: 12, color: 'var(--outline)', marginTop: 2 }}>
                    {(observationData[incompleteExp.id] || []).length} observations recorded — finish to save to journal
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/labs/${incompleteExp.id}`)}
                  className="font-label"
                  style={{
                    flexShrink: 0,
                    padding: '8px 16px', borderRadius: 9,
                    background: 'var(--primary)', color: dark ? 'var(--surface)' : '#f0ede8',
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                    border: 'none', cursor: 'pointer', transition: 'opacity 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >
                  Resume Lab
                </button>
              </motion.div>
            )}

            {/* Recent Lab Journal */}
            <motion.div variants={fadeUp} custom={4} initial="hidden" animate="show" style={card}>
              <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="font-label" style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)' }}>
                  Recent Lab Journal
                </div>
                <Link to="/journal" className="font-label" style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: 'var(--secondary)', textDecoration: 'none',
                }}>
                  View All →
                </Link>
              </div>
              <hr style={sectionDivider} />
              {recentJournal.length === 0 ? (
                <div style={{ padding: '36px 20px', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>📓</div>
                  <div className="font-label" style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)', marginBottom: 4 }}>
                    No journal entries yet
                  </div>
                  <div className="font-body" style={{ fontSize: 12, color: 'var(--outline)', marginBottom: 16 }}>
                    Complete a lab and save your observations to see them here.
                  </div>
                  <button
                    onClick={() => navigate('/labs')}
                    className="font-label"
                    style={{
                      padding: '8px 18px',
                      background: 'var(--secondary)',
                      color: dark ? 'var(--surface)' : '#ffffff',
                      fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
                      textTransform: 'uppercase', borderRadius: 8, border: 'none', cursor: 'pointer',
                    }}
                  >
                    Browse Labs
                  </button>
                </div>
              ) : (
                <div>
                  {recentJournal.map((entry, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '13px 20px',
                        display: 'flex', alignItems: 'center', gap: 14,
                        borderBottom: i < recentJournal.length - 1 ? '1px solid var(--card-border)' : 'none',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-container-high)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{
                        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                        background: 'var(--ncert-chip-bg)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--secondary)',
                      }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18"/>
                        </svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="font-label" style={{
                          fontSize: 13, fontWeight: 700, color: 'var(--on-surface)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {entry.lab}
                        </div>
                        <div className="font-body" style={{ fontSize: 11, color: 'var(--outline)', marginTop: 2 }}>
                          {entry.date} • {entry.observations.length} observations
                        </div>
                      </div>
                      <div className="font-label" style={{
                        fontSize: 13, fontWeight: 800, color: 'var(--secondary)',
                        fontFamily: 'monospace', flexShrink: 0,
                      }}>
                        {entry.score} pts
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>

          {/* ── RIGHT COLUMN ─────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Mastery Index */}
            <motion.div variants={fadeUp} custom={2} initial="hidden" animate="show" style={{ ...card, padding: '20px' }}>
              <div className="font-label" style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)', marginBottom: 3 }}>
                Mastery Index
              </div>
              <div className="font-body" style={{ fontSize: 11, color: 'var(--outline)', marginBottom: 18 }}>
                {quizResult ? 'Based on quiz + lab performance' : 'Take the quiz to unlock full mastery tracking'}
              </div>
              {/* Score display — accent bar + number, matching catalog's accentVar + serif heading style */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 20 }}>
                <div style={{ width: 3, height: 36, background: 'var(--secondary)', borderRadius: 999, flexShrink: 0 }} />
                <div>
                  <span className="serif" style={{
                    fontSize: 38, fontWeight: 300, color: 'var(--primary)', lineHeight: 1,
                  }}>
                    {quizLoading ? '—' : overallMastery}
                  </span>
                  <span className="font-label" style={{ fontSize: 14, fontWeight: 700, color: 'var(--outline)', marginLeft: 4 }}>
                    / 100
                  </span>
                </div>
              </div>
              {/* Topic bars */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {masteryData.map((t, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span className="font-body" style={{ fontSize: 12, color: 'var(--on-surface-variant)', fontWeight: 500 }}>
                        {t.topic}
                      </span>
                      <span className="font-label" style={{ fontSize: 12, fontWeight: 700, color: 'var(--on-surface)', fontFamily: 'monospace' }}>
                        {quizLoading ? '…' : `${t.p}%`}
                      </span>
                    </div>
                    <div style={{ width: '100%', height: 5, background: 'var(--surface-container-high)', borderRadius: 999, overflow: 'hidden' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: quizLoading ? '0%' : `${t.p}%` }}
                        transition={{ duration: 1, delay: i * 0.08, ease: 'easeOut' }}
                        style={{ height: '100%', borderRadius: 999, background: masteryBarColor(t.p) }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {!quizResult && !quizLoading && (
                <button
                  onClick={() => navigate('/quiz')}
                  className="font-label"
                  style={{
                    width: '100%', marginTop: 18, padding: '10px',
                    background: 'var(--secondary)',
                    color: dark ? 'var(--surface)' : '#ffffff',
                    borderRadius: 10, fontSize: 11, fontWeight: 700,
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                    border: 'none', cursor: 'pointer',
                  }}
                >
                  Take Diagnostic Quiz →
                </button>
              )}
              {quizResult && (
                <div className="font-body" style={{ marginTop: 14, fontSize: 11, color: 'var(--outline)', textAlign: 'center' }}>
                  Quiz score: {quizResult.score}/10 • Labs boost topic scores
                </div>
              )}
            </motion.div>

            {/* Rank Snapshot */}
            <motion.div variants={fadeUp} custom={3} initial="hidden" animate="show" style={card}>
              <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="font-label" style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)' }}>
                  Rank Snapshot
                </div>
                <Link to="/leaderboard" className="font-label" style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: 'var(--secondary)', textDecoration: 'none',
                }}>
                  Full Board →
                </Link>
              </div>
              <hr style={sectionDivider} />
              {rankLoading ? (
                <div style={{ padding: '20px', textAlign: 'center', fontSize: 12, color: 'var(--outline)' }}>Loading...</div>
              ) : rankEntries.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', fontSize: 12, color: 'var(--outline)' }}>
                  No scores yet — complete a lab to appear here!
                </div>
              ) : rankEntries.map((s, i) => {
                const showDivider = i === 3 && rankEntries.length === 4;
                return (
                  <div key={i}>
                    {showDivider && (
                      <div style={{ padding: '4px 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 1, background: 'var(--card-border)' }} />
                        <span className="font-label" style={{ fontSize: 9, color: 'var(--outline)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                          Your Rank
                        </span>
                        <div style={{ flex: 1, height: 1, background: 'var(--card-border)' }} />
                      </div>
                    )}
                    <div
                      style={{
                        padding: '11px 18px',
                        display: 'flex', alignItems: 'center', gap: 10,
                        borderBottom: i < rankEntries.length - 1 && !showDivider ? '1px solid var(--card-border)' : 'none',
                        background: s.isMe ? 'var(--ncert-chip-bg)' : 'transparent',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => { if (!s.isMe) e.currentTarget.style.background = 'var(--surface-container-high)'; }}
                      onMouseLeave={e => { if (!s.isMe) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <span style={{
                        fontSize: s.rank <= 3 ? 16 : 12,
                        fontWeight: 700, width: 28, textAlign: 'center',
                        color: s.rank > 3 ? 'var(--outline)' : undefined,
                        fontFamily: s.rank > 3 ? 'monospace' : undefined,
                      }}>
                        {s.medal}
                      </span>
                      <span className="font-body" style={{ flex: 1, fontSize: 13, fontWeight: s.isMe ? 700 : 500, color: 'var(--on-surface)' }}>
                        {s.name}
                        {s.isMe && (
                          <span className="font-label" style={{
                            marginLeft: 6, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                            color: 'var(--secondary)', background: 'var(--ncert-chip-bg)',
                            padding: '1px 5px', borderRadius: 999,
                            border: '1px solid var(--filter-pill-border)',
                          }}>
                            You
                          </span>
                        )}
                      </span>
                      <span className="font-label" style={{
                        fontSize: 12, fontWeight: 700, color: 'var(--secondary)',
                        fontFamily: 'monospace', flexShrink: 0,
                      }}>
                        {s.totalScore > 0 ? s.totalScore.toLocaleString() : '—'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </motion.div>

            {/* Quick Actions */}
            <motion.div variants={fadeUp} custom={4} initial="hidden" animate="show" style={{ ...card, padding: '18px' }}>
              <div className="font-label" style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)', marginBottom: 14 }}>
                Quick Actions
              </div>
              {[
                { label: 'Browse All Labs',  to: '/labs',        icon: '🔬' },
                { label: 'My Lab Journal',   to: '/journal',     icon: '📓' },
                { label: 'Leaderboard',      to: '/leaderboard', icon: '🏆' },
                { label: 'Profile Settings', to: '/profile',     icon: '⚙️' },
              ].map((action, i) => (
                <Link
                  key={i}
                  to={action.to}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 10px', borderRadius: 9,
                    textDecoration: 'none', transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-container-high)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ fontSize: 15 }}>{action.icon}</span>
                  <span className="font-body" style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--on-surface-variant)' }}>
                    {action.label}
                  </span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--outline)' }}>
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </Link>
              ))}
            </motion.div>

          </div>
        </div>

      </div>

      <style>{`
        @keyframes arise-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  );
}