import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabaseClient';

const questions = [
  { id: 1, text: "A car accelerates uniformly from rest. Which graph correctly shows its velocity-time relationship?", options: ["Linear increasing", "Parabolic", "Constant horizontal", "Exponential"], correct: 0, topic: "Mechanics", explanation: "Uniform acceleration means velocity increases at a constant rate, producing a straight line (linear) on a v-t graph. v = u + at is a linear equation." },
  { id: 2, text: "According to Le Chatelier's principle, increasing pressure on N₂ + 3H₂ ⇌ 2NH₃ favors:", options: ["Forward reaction", "Backward reaction", "No effect", "Depends on temperature"], correct: 0, topic: "Physical Chemistry", explanation: "Increasing pressure shifts equilibrium toward the side with fewer moles of gas. Left side has 4 moles (1+3), right has 2 moles (2NH₃), so the forward reaction is favored." },
  { id: 3, text: "The first law of thermodynamics is essentially the law of conservation of:", options: ["Momentum", "Energy", "Mass", "Charge"], correct: 1, topic: "Thermodynamics", explanation: "The first law states ΔU = Q - W — energy cannot be created or destroyed, only transferred or converted. This is directly the law of conservation of energy." },
  { id: 4, text: "Which molecule exhibits sp³d hybridization?", options: ["CH₄", "SF₆", "PCl₅", "BF₃"], correct: 2, topic: "Inorganic Chemistry", explanation: "PCl₅ has 5 bond pairs and no lone pairs, requiring sp³d hybridization (trigonal bipyramidal). SF₆ is sp³d², CH₄ is sp³, and BF₃ is sp²." },
  { id: 5, text: "Two point charges +q and -q are distance r apart. How does the force change if the distance is doubled?", options: ["Halves", "Doubles", "Reduces to 1/4", "Increases 4x"], correct: 2, topic: "Electrostatics", explanation: "Coulomb's law: F = kq₁q₂/r². If r doubles, r² quadruples, so F reduces to 1/4 of its original value. Force is inversely proportional to the square of distance." },
  { id: 6, text: "In a p-n junction diode, the depletion region is formed due to:", options: ["Drift of majority carriers", "Diffusion of majority carriers", "Drift of minority carriers", "External electric field"], correct: 1, topic: "Electronics", explanation: "Majority carriers (electrons from n-side, holes from p-side) diffuse across the junction and recombine, creating the depletion region with immobile ions on both sides." },
  { id: 7, text: "The equivalent resistance of three resistors R each connected in parallel is:", options: ["3R", "R/3", "R", "2R/3"], correct: 1, topic: "Electrostatics", explanation: "For n identical resistors R in parallel: R_eq = R/n. With 3 resistors: R_eq = R/3. Each parallel path carries 1/3 of the total current." },
  { id: 8, text: "Which of the following is an example of a Lewis acid?", options: ["NH₃", "H₂O", "BF₃", "OH⁻"], correct: 2, topic: "Inorganic Chemistry", explanation: "A Lewis acid is an electron pair acceptor. BF₃ has an incomplete octet (only 6 electrons around B), making it electron-deficient and able to accept electron pairs." },
  { id: 9, text: "A body is thrown vertically upward. At the highest point, its acceleration is:", options: ["Zero", "g downward", "g upward", "2g downward"], correct: 1, topic: "Mechanics", explanation: "At the highest point, velocity is zero but acceleration due to gravity (g = 9.8 m/s²) still acts downward. Acceleration is independent of velocity." },
  { id: 10, text: "The process of electrolysis of water produces hydrogen and oxygen in the volume ratio:", options: ["1:1", "1:2", "2:1", "4:1"], correct: 2, topic: "Physical Chemistry", explanation: "Water electrolysis: 2H₂O → 2H₂ + O₂. Two moles of H₂ are produced for every one mole of O₂, giving a 2:1 volume ratio of H₂ to O₂." },
];

const TOPIC_TO_LAB: Record<string, string> = {
  'Mechanics': 'simple-pendulum', 'Thermodynamics': 'le-chatelier',
  'Electrostatics': 'ohms-law', 'Inorganic Chemistry': 'flame-test',
  'Physical Chemistry': 'acid-base-titration', 'Electronics': 'electrolysis-water',
};
const LAB_NAMES: Record<string, string> = {
  'simple-pendulum': 'Simple Pendulum', 'ohms-law': "Ohm's Law",
  'acid-base-titration': 'Acid-Base Titration', 'electrolysis-water': 'Electrolysis of Water',
  'flame-test': 'Flame Test', 'le-chatelier': "Le Chatelier's Principle",
  'paper-chromatography': 'Paper Chromatography', 'projectile-motion': 'Projectile Motion',
};

type AnswerState = 'unanswered' | 'correct' | 'wrong';
type FSWarning = 'none' | 'first' | 'second';

export default function DiagnosticQuiz() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answerState, setAnswerState] = useState<AnswerState>('unanswered');
  const [timeLeft, setTimeLeft] = useState(30);
  const [timerActive, setTimerActive] = useState(true);
  const [isFinished, setIsFinished] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fsWarning, setFsWarning] = useState<FSWarning>('none');
  const [fsRequested, setFsRequested] = useState(false);
  const [autoSubmitCountdown, setAutoSubmitCountdown] = useState(10);
  const autoSubmitRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fsViolationsRef = useRef(0);
  const tabViolationsRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRef = useRef(false); // prevent double-save

  const enterFullscreen = () => {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen();
    else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen();
  };

  const exitFullscreenAPI = () => {
    if (document.exitFullscreen) document.exitFullscreen();
    else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
  };

  useEffect(() => {
    const handleFsChange = () => {
      const inFs = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      setIsFullscreen(inFs);
      if (!inFs && fsRequested && !isFinished) {
        fsViolationsRef.current += 1;
        if (fsViolationsRef.current === 1) {
          setFsWarning('first');
        } else {
          setFsWarning('second');
          setAutoSubmitCountdown(10);
          autoSubmitRef.current = setInterval(() => {
            setAutoSubmitCountdown(prev => {
              if (prev <= 1) { clearInterval(autoSubmitRef.current!); setIsFinished(true); return 0; }
              return prev - 1;
            });
          }, 1000);
        }
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, [fsRequested, isFinished]);

  useEffect(() => {
    const t = setTimeout(() => { enterFullscreen(); setFsRequested(true); }, 500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => { return () => { if (autoSubmitRef.current) clearInterval(autoSubmitRef.current); }; }, []);
  useEffect(() => { return () => { if (document.fullscreenElement) exitFullscreenAPI(); }; }, []);

  const handleReturnToFullscreen = () => {
    enterFullscreen();
    if (autoSubmitRef.current) clearInterval(autoSubmitRef.current);
    setFsWarning('none');
  };

  useEffect(() => {
    let stream: MediaStream | null = null;
    if (navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(s => { stream = s; if (videoRef.current) videoRef.current.srcObject = s; })
        .catch(err => console.warn('Camera denied:', err));
    }
    return () => { stream?.getTracks().forEach(t => t.stop()); };
  }, []);

  useEffect(() => {
    const handle = () => {
      if (document.hidden && !isFinished) {
        tabViolationsRef.current += 1;
        if (tabViolationsRef.current >= 2) setIsFinished(true);
      }
    };
    document.addEventListener('visibilitychange', handle);
    return () => document.removeEventListener('visibilitychange', handle);
  }, [isFinished]);

  const advanceToNext = useCallback((answeredIdx: number) => {
    const newAnswers = [...answers, answeredIdx];
    setAnswers(newAnswers);
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(i => i + 1);
      setSelectedOption(null);
      setAnswerState('unanswered');
      setTimeLeft(30);
      setTimerActive(true);
    } else {
      setIsFinished(true);
    }
  }, [answers, currentIdx]);

  const handleOptionClick = useCallback((optIdx: number) => {
    if (answerState !== 'unanswered' || fsWarning !== 'none') return;
    setSelectedOption(optIdx);
    setTimerActive(false);
    const isCorrect = optIdx === questions[currentIdx].correct;
    setAnswerState(isCorrect ? 'correct' : 'wrong');
    if (isCorrect) {
      autoAdvanceRef.current = setTimeout(() => advanceToNext(optIdx), 1000);
    }
  }, [answerState, currentIdx, advanceToNext, fsWarning]);

  useEffect(() => {
    if (!timerActive || isFinished || answerState !== 'unanswered' || fsWarning !== 'none') return;
    if (timeLeft <= 0) { setSelectedOption(-1); setAnswerState('wrong'); setTimerActive(false); return; }
    const t = setInterval(() => setTimeLeft(n => n - 1), 1000);
    return () => clearInterval(t);
  }, [timeLeft, timerActive, isFinished, answerState, fsWarning]);

  useEffect(() => () => { if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current); }, []);

  // ── Save quiz results to Supabase when finished ───────────────
  useEffect(() => {
    if (!isFinished || savedRef.current || answers.length === 0) return;
    savedRef.current = true;

    const saveResults = async () => {
      setSaving(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const score = answers.filter((a, i) => a === questions[i].correct).length;

        // Build per-topic results: { topic: 'Mechanics', correct: true }
        const topicResults = questions.map((q, i) => ({
          topic: q.topic,
          correct: answers[i] === q.correct,
          answeredIdx: answers[i],
          correctIdx: q.correct,
        }));

        // Delete old quiz result and insert new one (only keep latest)
        await supabase.from('quiz_results').delete().eq('user_id', user.id);
        await supabase.from('quiz_results').insert({
          user_id: user.id,
          answers: topicResults,
          score,
        });
      } catch (err) {
        console.error('Failed to save quiz results:', err);
      } finally {
        setSaving(false);
      }
    };

    saveResults();
  }, [isFinished, answers]);

  const tk = {
    bg:      dark ? '#0F111A' : '#F0EEE9',
    card:    dark ? '#1C1F2E' : '#FFFFFF',
    border:  dark ? '#232840' : '#E8E5DF',
    heading: dark ? '#EDEDF0' : '#111111',
    body:    dark ? '#8890A4' : '#666666',
    muted:   dark ? '#525870' : '#AAAAAA',
    alt:     dark ? '#161929' : '#E8E6E1',
  };

  // ── Results screen ────────────────────────────────────────────
  if (isFinished) {
    if (document.fullscreenElement) exitFullscreenAPI();

    const score = answers.filter((a, i) => a === questions[i].correct).length;
    const total = questions.length;
    const pct = Math.round((score / total) * 100);

    // Find weak topics (wrong answers)
    const weakTopics = questions
      .filter((q, i) => answers[i] !== q.correct)
      .map(q => q.topic);

    // Recommended labs from weak topics
    const recommendedLabIds = [...new Set(
      weakTopics.map(t => TOPIC_TO_LAB[t]).filter(Boolean)
    )].slice(0, 3);

    const defaultLabs = ['simple-pendulum', 'ohms-law', 'acid-base-titration'];
    while (recommendedLabIds.length < 3) {
      const next = defaultLabs.find(l => !recommendedLabIds.includes(l));
      if (next) recommendedLabIds.push(next); else break;
    }

    // Reason per recommended lab
    const labReasons: Record<string, string> = {
      'simple-pendulum': 'Mechanics needs reinforcement',
      'ohms-law': 'Electrostatics gap detected',
      'acid-base-titration': 'Physical Chemistry needs work',
      'flame-test': 'Inorganic Chemistry gap detected',
      'le-chatelier': 'Thermodynamics needs reinforcement',
      'electrolysis-water': 'Electronics gap detected',
    };

    return (
      <div style={{ minHeight: '100vh', background: tk.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} style={{ width: '100%', maxWidth: 640 }}>

          {/* Score card */}
          <div style={{ background: tk.card, border: `1px solid ${tk.border}`, borderRadius: 20, padding: '40px 40px 32px', marginBottom: 16, textAlign: 'center' }}>
            <div style={{
              width: 96, height: 96, borderRadius: '50%',
              border: `4px solid ${pct >= 70 ? '#059669' : pct >= 40 ? '#D97706' : '#DC2626'}`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
              background: pct >= 70 ? (dark ? 'rgba(5,150,105,0.1)' : '#ECFDF5') : pct >= 40 ? (dark ? 'rgba(217,119,6,0.1)' : '#FFFBEB') : (dark ? 'rgba(220,38,38,0.1)' : '#FEF2F2'),
            }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: pct >= 70 ? '#059669' : pct >= 40 ? '#D97706' : '#DC2626', lineHeight: 1 }}>{pct}%</span>
              <span style={{ fontSize: 11, color: tk.muted, marginTop: 2 }}>{score}/{total}</span>
            </div>
            <h2 style={{ fontSize: 26, fontWeight: 800, color: tk.heading, marginBottom: 8, letterSpacing: '-0.5px' }}>
              {pct >= 70 ? 'Excellent work!' : pct >= 40 ? 'Good effort!' : 'Keep practising!'}
            </h2>
            <p style={{ fontSize: 14, color: tk.body, lineHeight: 1.65, maxWidth: 400, margin: '0 auto 16px' }}>
              You answered {score} out of {total} questions correctly. Your mastery index and recommendations have been updated.
            </p>

            {/* Per-question badges */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
              {questions.map((q, i) => (
                <div key={i} title={q.topic} style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: answers[i] === q.correct ? (dark ? 'rgba(5,150,105,0.2)' : '#ECFDF5') : (dark ? 'rgba(220,38,38,0.2)' : '#FEF2F2'),
                  border: `1px solid ${answers[i] === q.correct ? '#059669' : '#DC2626'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700,
                  color: answers[i] === q.correct ? '#059669' : '#DC2626',
                }}>
                  {answers[i] === q.correct ? '✓' : '✗'}
                </div>
              ))}
            </div>

            {saving && (
              <div style={{ marginTop: 14, fontSize: 12, color: tk.muted }}>
                Saving your results...
              </div>
            )}
          </div>

          {/* Recommended labs */}
          <div style={{ background: tk.card, border: `1px solid ${tk.border}`, borderRadius: 20, padding: '24px 28px', marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#1D4ED8', marginBottom: 4 }}>
              AI Recommendations
            </div>
            <p style={{ fontSize: 13, color: tk.body, marginBottom: 16 }}>
              Based on your weak areas, start with these labs:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recommendedLabIds.map((labId, i) => (
                <Link key={labId} to={`/labs/${labId}`} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', borderRadius: 12, background: tk.alt,
                  border: `1px solid ${tk.border}`, textDecoration: 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: dark ? 'rgba(29,78,216,0.15)' : '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#1D4ED8' }}>{i + 1}</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: tk.heading }}>{LAB_NAMES[labId]}</div>
                      <div style={{ fontSize: 11, color: tk.muted, marginTop: 1 }}>{labReasons[labId] || 'Recommended for you'}</div>
                    </div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </Link>
              ))}
            </div>
          </div>

          <button onClick={() => navigate('/dashboard')} style={{
            width: '100%', padding: '14px', background: '#1D4ED8', color: '#fff',
            fontWeight: 700, fontSize: 14, borderRadius: 12, border: 'none', cursor: 'pointer',
          }}
            onMouseEnter={e => (e.currentTarget.style.background = '#1E40AF')}
            onMouseLeave={e => (e.currentTarget.style.background = '#1D4ED8')}
          >
            Go to Dashboard →
          </button>
        </motion.div>
      </div>
    );
  }

  // ── Quiz screen ───────────────────────────────────────────────
  const q = questions[currentIdx];

  const getOptionStyle = (i: number): React.CSSProperties => {
    const base: React.CSSProperties = {
      width: '100%', textAlign: 'left', padding: '16px 20px', borderRadius: 12,
      border: `1.5px solid ${tk.border}`, background: tk.card,
      cursor: answerState === 'unanswered' && fsWarning === 'none' ? 'pointer' : 'default',
      display: 'flex', alignItems: 'center', gap: 14,
      transition: 'border-color 0.15s, background 0.15s', outline: 'none',
    };
    if (answerState === 'unanswered') return base;
    if (i === q.correct) return { ...base, borderColor: '#059669', background: dark ? 'rgba(5,150,105,0.12)' : '#ECFDF5' };
    if (i === selectedOption && selectedOption !== q.correct) return { ...base, borderColor: '#DC2626', background: dark ? 'rgba(220,38,38,0.1)' : '#FEF2F2' };
    return { ...base, opacity: 0.45 };
  };

  return (
    <div style={{ minHeight: '100vh', background: tk.bg, paddingTop: 80, paddingBottom: 40, position: 'relative' }}>

      {/* Fullscreen Warning Overlay */}
      {fsWarning !== 'none' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(10, 10, 20, 0.97)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(220,38,38,0.15)', border: '2px solid rgba(220,38,38,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div style={{ textAlign: 'center', maxWidth: 440 }}>
            <div style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, color: '#DC2626', background: 'rgba(220,38,38,0.15)', padding: '3px 12px', borderRadius: 999, marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Proctoring Violation #{fsViolationsRef.current}
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: '#F0F0F0', marginBottom: 10 }}>
              {fsWarning === 'first' ? 'Fullscreen Required' : '⚠ Final Warning'}
            </h2>
            <p style={{ fontSize: 15, color: '#8890A4', lineHeight: 1.7, marginBottom: 8 }}>
              {fsWarning === 'first'
                ? 'You have exited fullscreen mode. The quiz must be taken in fullscreen to maintain academic integrity.'
                : 'This is your final warning. Return to fullscreen immediately or your quiz will be auto-submitted.'}
            </p>
            {fsWarning === 'second' && (
              <>
                <div style={{ fontSize: 48, fontWeight: 800, color: '#DC2626', fontFamily: 'monospace', marginTop: 16, marginBottom: 4 }}>{autoSubmitCountdown}</div>
                <p style={{ fontSize: 13, color: '#525870' }}>Quiz will auto-submit in {autoSubmitCountdown} second{autoSubmitCountdown !== 1 ? 's' : ''}</p>
              </>
            )}
          </div>
          <button onClick={handleReturnToFullscreen} style={{ padding: '13px 36px', background: '#DC2626', color: '#fff', fontWeight: 700, fontSize: 15, borderRadius: 12, border: 'none', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#B91C1C')}
            onMouseLeave={e => (e.currentTarget.style.background = '#DC2626')}
          >Return to Fullscreen Now</button>
          {fsWarning === 'first' && (
            <button onClick={() => { setIsFinished(true); exitFullscreenAPI(); }} style={{ background: 'none', border: 'none', color: '#525870', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>
              Submit quiz now (current answers will be scored)
            </button>
          )}
        </div>
      )}

      {/* Camera feed */}
      <div style={{ position: 'fixed', top: 80, right: 20, width: 160, height: 100, background: '#000', borderRadius: 10, overflow: 'hidden', border: `1px solid ${dark ? '#232840' : '#E8E5DF'}`, zIndex: 50 }}>
        <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
        <div style={{ position: 'absolute', top: 6, left: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#EF4444' }}></div>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#EF4444', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Live</span>
        </div>
      </div>

      {/* Status bar */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 56, background: dark ? '#161929' : '#FFFFFF', borderBottom: `1px solid ${dark ? '#232840' : '#E8E5DF'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', zIndex: 40 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: dark ? '#EDEDF0' : '#111' }}>ARISE — Diagnostic Quiz</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {fsViolationsRef.current > 0 && (
            <div style={{ fontSize: 12, fontWeight: 700, color: '#DC2626', background: 'rgba(220,38,38,0.1)', padding: '3px 10px', borderRadius: 999 }}>
              ⚠ {fsViolationsRef.current} violation{fsViolationsRef.current > 1 ? 's' : ''}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: isFullscreen ? '#059669' : '#DC2626', fontWeight: 600 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: isFullscreen ? '#059669' : '#DC2626', display: 'inline-block' }}></span>
            {isFullscreen ? 'Fullscreen Active' : 'Fullscreen Required'}
          </div>
          {!isFullscreen && (
            <button onClick={enterFullscreen} style={{ padding: '4px 12px', background: 'rgba(29,78,216,0.15)', border: '1px solid rgba(29,78,216,0.4)', color: '#1D4ED8', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              Enter Fullscreen
            </button>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1D4ED8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Question {currentIdx + 1} of {questions.length}</div>
            <div style={{ fontSize: 13, color: tk.muted }}>Topic: {q.topic}</div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'monospace', color: timeLeft <= 10 ? '#DC2626' : tk.heading, transition: 'color 0.3s' }}>
            00:{timeLeft.toString().padStart(2, '0')}
          </div>
        </div>

        <div style={{ width: '100%', height: 4, background: tk.alt, borderRadius: 999, marginBottom: 32, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 999, background: '#1D4ED8', width: `${((currentIdx + 1) / questions.length) * 100}%`, transition: 'width 0.4s ease' }}></div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={currentIdx} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }}>
            <div style={{ background: tk.card, border: `1px solid ${tk.border}`, borderRadius: 16, padding: '28px 28px 24px', marginBottom: 16 }}>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: tk.heading, lineHeight: 1.5, margin: 0 }}>{q.text}</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {q.options.map((opt, i) => (
                <button key={i} onClick={() => handleOptionClick(i)} style={getOptionStyle(i)}
                  onMouseEnter={e => { if (answerState === 'unanswered' && fsWarning === 'none') e.currentTarget.style.borderColor = '#1D4ED8'; }}
                  onMouseLeave={e => { if (answerState === 'unanswered') e.currentTarget.style.borderColor = tk.border; }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700,
                    background: answerState !== 'unanswered' && i === q.correct ? '#059669' : answerState !== 'unanswered' && i === selectedOption && i !== q.correct ? '#DC2626' : tk.alt,
                    color: answerState !== 'unanswered' && (i === q.correct || (i === selectedOption && i !== q.correct)) ? '#fff' : tk.muted,
                    transition: 'background 0.15s',
                  }}>
                    {answerState !== 'unanswered' && i === q.correct ? '✓' : answerState !== 'unanswered' && i === selectedOption && i !== q.correct ? '✗' : String.fromCharCode(65 + i)}
                  </div>
                  <span style={{ fontSize: 15, color: tk.heading, fontWeight: 500 }}>{opt}</span>
                </button>
              ))}
            </div>

            {answerState === 'wrong' && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ background: dark ? 'rgba(29,78,216,0.1)' : '#EEF2FF', border: `1px solid ${dark ? 'rgba(29,78,216,0.25)' : '#C7D7FD'}`, borderRadius: 12, padding: '16px 18px', marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#1D4ED8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Explanation</div>
                <p style={{ fontSize: 14, color: dark ? '#93B4FF' : '#1E40AF', lineHeight: 1.65, margin: 0 }}>{q.explanation}</p>
              </motion.div>
            )}

            {answerState === 'wrong' && (
              <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                onClick={() => advanceToNext(selectedOption ?? -1)}
                style={{ width: '100%', padding: '13px', background: '#1D4ED8', color: '#fff', fontWeight: 700, fontSize: 14, borderRadius: 12, border: 'none', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#1E40AF')}
                onMouseLeave={e => (e.currentTarget.style.background = '#1D4ED8')}
              >
                {currentIdx < questions.length - 1 ? 'Next Question →' : 'See Results →'}
              </motion.button>
            )}

            {answerState === 'correct' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', fontSize: 13, color: '#059669', fontWeight: 600, padding: '8px 0' }}>
                Correct! Moving to next question...
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}