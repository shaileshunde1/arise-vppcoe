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

// ── Proctoring constants ──────────────────────────────────────
const MAX_FS_VIOLATIONS   = 2;   // auto-submit after 2nd fullscreen exit
const MAX_TAB_VIOLATIONS  = 2;   // auto-submit after 2nd tab switch
const NO_FACE_THRESHOLD   = 4;   // consecutive 2-s polls with no face → warn
const LOOK_AWAY_THRESHOLD = 3;   // consecutive polls looking away → warn
const FACE_POLL_MS        = 2000;

type AnswerState = 'unanswered' | 'correct' | 'wrong';
type FSWarning   = 'none' | 'first' | 'second';
type FaceStatus  = 'checking' | 'ok' | 'missing' | 'multiple' | 'lookaway';

// ── Lightweight look-away heuristic via eye landmark bounding box ──
// We use FaceDetector (Chrome 123+). If unavailable, graceful fallback.
async function detectFaceStatus(
  detector: any,
  video: HTMLVideoElement
): Promise<FaceStatus> {
  try {
    const faces: any[] = await detector.detect(video);
    if (faces.length === 0)  return 'missing';
    if (faces.length > 1)    return 'multiple';

    // Look-away heuristic: check if the face bounding box is heavily off-center
    // A fully centred face would have boundingBox.x ≈ (video.width - box.width) / 2
    const box   = faces[0].boundingBox;
    const vidW  = video.videoWidth  || 320;
    const vidH  = video.videoHeight || 240;
    const centerX = box.x + box.width  / 2;
    const centerY = box.y + box.height / 2;
    const offX = Math.abs(centerX - vidW / 2) / vidW;  // 0–0.5
    const offY = Math.abs(centerY - vidH / 2) / vidH;

    // If face centroid is >40% away from centre in either axis → looking away
    if (offX > 0.40 || offY > 0.42) return 'lookaway';
    return 'ok';
  } catch {
    return 'ok'; // fail safe
  }
}

export default function DiagnosticQuiz() {
  const navigate  = useNavigate();
  const { theme } = useTheme();
  const dark      = theme === 'dark';

  // ── Quiz state ──────────────────────────────────────────────
  const [currentIdx,     setCurrentIdx]     = useState(0);
  const [answers,        setAnswers]         = useState<number[]>([]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answerState,    setAnswerState]     = useState<AnswerState>('unanswered');
  const [timeLeft,       setTimeLeft]        = useState(30);
  const [timerActive,    setTimerActive]     = useState(false); // starts false until ready
  const [isFinished,     setIsFinished]      = useState(false);
  const [saving,         setSaving]          = useState(false);

  // ── Setup phase ─────────────────────────────────────────────
  // camera → fullscreen → quiz starts
  const [setupPhase, setSetupPhase] = useState<'camera' | 'ready'>('camera');
  const [cameraGranted, setCameraGranted] = useState<boolean | null>(null); // null = pending

  // ── Fullscreen state ─────────────────────────────────────────
  const [isFullscreen,        setIsFullscreen]        = useState(false);
  const [fsWarning,           setFsWarning]            = useState<FSWarning>('none');
  const [fsRequested,         setFsRequested]          = useState(false);
  const [autoSubmitCountdown, setAutoSubmitCountdown]  = useState(10);
  const autoSubmitRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const fsViolationsRef  = useRef(0);

  // ── Tab-switch state ─────────────────────────────────────────
  const tabViolationsRef = useRef(0);
  const [tabWarningVisible, setTabWarningVisible] = useState(false);
  const [tabCountdown,      setTabCountdown]       = useState(10);
  const tabAutoSubmitRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Camera / face detection ──────────────────────────────────
  const videoRef          = useRef<HTMLVideoElement>(null);
  const streamRef         = useRef<MediaStream | null>(null);
  const faceDetectorRef   = useRef<any>(null);
  const faceIntervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const [faceStatus,      setFaceStatus]      = useState<FaceStatus>('checking');
  const noFaceCountRef    = useRef(0);
  const lookAwayCountRef  = useRef(0);
  const [camWarning,      setCamWarning]       = useState<string | null>(null);

  // ── Misc refs ────────────────────────────────────────────────
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRef       = useRef(false);

  // ────────────────────────────────────────────────────────────
  // STEP 1: Request camera FIRST — fullscreen comes AFTER
  // ────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    const requestCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        if (mounted) setCameraGranted(true);
      } catch {
        if (mounted) setCameraGranted(false); // denied — continue anyway
      }
    };
    requestCamera();
    return () => { mounted = false; };
  }, []);

  
  // ────────────────────────────────────────────────────────────
  // Face detection loop (starts once camera is ready)
  // ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (cameraGranted !== true) return;
    if (!('FaceDetector' in window)) {
      setFaceStatus('ok'); // unsupported browser — don't penalise
      return;
    }

    faceDetectorRef.current = new (window as any).FaceDetector({ fastMode: true });

    faceIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2 || isFinished) return;

      const status = await detectFaceStatus(faceDetectorRef.current, videoRef.current);
      setFaceStatus(status);

      if (status === 'missing') {
        noFaceCountRef.current   += 1;
        lookAwayCountRef.current  = 0;
        if (noFaceCountRef.current === NO_FACE_THRESHOLD) {
          setCamWarning('⚠ Face not detected. Please stay in front of the camera.');
        }
        if (noFaceCountRef.current >= NO_FACE_THRESHOLD + 3) {
          // Persistent absence → treat as violation
          triggerFsViolation();
          noFaceCountRef.current = 0;
        }
      } else if (status === 'lookaway') {
        noFaceCountRef.current    = 0;
        lookAwayCountRef.current += 1;
        if (lookAwayCountRef.current === LOOK_AWAY_THRESHOLD) {
          setCamWarning('⚠ Please look at the screen while answering.');
        }
        if (lookAwayCountRef.current >= LOOK_AWAY_THRESHOLD + 2) {
          triggerFsViolation();
          lookAwayCountRef.current = 0;
        }
      } else if (status === 'multiple') {
        noFaceCountRef.current    = 0;
        lookAwayCountRef.current  = 0;
        setCamWarning('⚠ Multiple faces detected! Only the student should be visible.');
        triggerFsViolation();
      } else {
        // ok
        noFaceCountRef.current    = 0;
        lookAwayCountRef.current  = 0;
        if (camWarning) setCamWarning(null);
      }
    }, FACE_POLL_MS);

    return () => {
      if (faceIntervalRef.current) clearInterval(faceIntervalRef.current);
    };
  }, [cameraGranted, isFinished]);

  // ────────────────────────────────────────────────────────────
  // Fullscreen helpers
  // ────────────────────────────────────────────────────────────
  const enterFullscreen = () => {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen();
    else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen();
  };

  const exitFullscreenAPI = () => {
    if (document.exitFullscreen) document.exitFullscreen();
    else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
  };

  // Central violation handler (shared by FS exits + camera events)
  const triggerFsViolation = useCallback(() => {
    if (isFinished) return;
    fsViolationsRef.current += 1;

    if (fsViolationsRef.current >= MAX_FS_VIOLATIONS) {
      // Final violation → start auto-submit countdown
      setFsWarning('second');
      setAutoSubmitCountdown(10);
      if (autoSubmitRef.current) clearInterval(autoSubmitRef.current);
      autoSubmitRef.current = setInterval(() => {
        setAutoSubmitCountdown(prev => {
          if (prev <= 1) {
            clearInterval(autoSubmitRef.current!);
            setIsFinished(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setFsWarning('first');
    }
  }, [isFinished]);

  useEffect(() => {
    const handleFsChange = () => {
      const inFs = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      setIsFullscreen(inFs);
      // Only count as violation if we requested FS, quiz is live, and student exited
      if (!inFs && fsRequested && !isFinished && setupPhase === 'ready') {
        triggerFsViolation();
      }
    };
    document.addEventListener('fullscreenchange',       handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange',       handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, [fsRequested, isFinished, setupPhase, triggerFsViolation]);

  // ────────────────────────────────────────────────────────────
  // Alt-tab / window switch detection
  // ────────────────────────────────────────────────────────────
 useEffect(() => {
  const handleBlur = () => {
    if (isFinished || setupPhase !== 'ready') return;
    setTimerActive(false);
    tabViolationsRef.current += 1;
    if (tabViolationsRef.current >= MAX_TAB_VIOLATIONS) {
      setTabWarningVisible(true);
      setTabCountdown(10);
      if (tabAutoSubmitRef.current) clearInterval(tabAutoSubmitRef.current);
      tabAutoSubmitRef.current = setInterval(() => {
        setTabCountdown(prev => {
          if (prev <= 1) { clearInterval(tabAutoSubmitRef.current!); setIsFinished(true); return 0; }
          return prev - 1;
        });
      }, 1000);
    } else {
      setTabWarningVisible(true);
    }
  };
  const handleFocus = () => {
    if (tabViolationsRef.current < MAX_TAB_VIOLATIONS) {
      setTabWarningVisible(false);
      setTimerActive(true);
    }
  };
  window.addEventListener('blur', handleBlur);
  window.addEventListener('focus', handleFocus);
  return () => { window.removeEventListener('blur', handleBlur); window.removeEventListener('focus', handleFocus); };
}, [isFinished, setupPhase]);

  // Cleanup on unmount
  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (faceIntervalRef.current)  clearInterval(faceIntervalRef.current);
    if (autoSubmitRef.current)    clearInterval(autoSubmitRef.current);
    if (tabAutoSubmitRef.current) clearInterval(tabAutoSubmitRef.current);
    if (autoAdvanceRef.current)   clearTimeout(autoAdvanceRef.current);
    if (document.fullscreenElement) exitFullscreenAPI();
  }, []);

  // ────────────────────────────────────────────────────────────
  // Quiz timer
  // ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!timerActive || isFinished || answerState !== 'unanswered' || fsWarning !== 'none' || tabWarningVisible) return;
    if (timeLeft <= 0) {
      setSelectedOption(-1);
      setAnswerState('wrong');
      setTimerActive(false);
      return;
    }
    const t = setInterval(() => setTimeLeft(n => n - 1), 1000);
    return () => clearInterval(t);
  }, [timeLeft, timerActive, isFinished, answerState, fsWarning, tabWarningVisible]);

  // ────────────────────────────────────────────────────────────
  // Answer handling
  // ────────────────────────────────────────────────────────────
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
    if (answerState !== 'unanswered' || fsWarning !== 'none' || tabWarningVisible) return;
    setSelectedOption(optIdx);
    setTimerActive(false);
    const isCorrect = optIdx === questions[currentIdx].correct;
    setAnswerState(isCorrect ? 'correct' : 'wrong');
    if (isCorrect) {
      autoAdvanceRef.current = setTimeout(() => advanceToNext(optIdx), 1000);
    }
  }, [answerState, currentIdx, advanceToNext, fsWarning, tabWarningVisible]);

  const handleReturnToFullscreen = () => {
    enterFullscreen();
    if (autoSubmitRef.current) clearInterval(autoSubmitRef.current);
    setFsWarning('none');
    setTimerActive(true);
  };

  const handleReturnFromTab = () => {
    if (tabViolationsRef.current >= MAX_TAB_VIOLATIONS) return; // countdown running, can't dismiss
    setTabWarningVisible(false);
    setTimerActive(true);
  };

  // ────────────────────────────────────────────────────────────
  // Save results to Supabase
  // ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isFinished || savedRef.current || answers.length === 0) return;
    savedRef.current = true;
    if (document.fullscreenElement) exitFullscreenAPI();

    const saveResults = async () => {
      setSaving(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const score = answers.filter((a, i) => a === questions[i].correct).length;
        const topicResults = questions.map((q, i) => ({
          topic: q.topic, correct: answers[i] === q.correct,
          answeredIdx: answers[i], correctIdx: q.correct,
        }));
        await supabase.from('quiz_results').delete().eq('user_id', user.id);
        await supabase.from('quiz_results').insert({ user_id: user.id, answers: topicResults, score });
      } catch (err) {
        console.error('Failed to save quiz results:', err);
      } finally {
        setSaving(false);
      }
    };
    saveResults();
  }, [isFinished, answers]);

  // ────────────────────────────────────────────────────────────
  // Theme tokens
  // ────────────────────────────────────────────────────────────
  const tk = {
    bg:      dark ? '#0F111A' : '#F0EEE9',
    card:    dark ? '#1C1F2E' : '#FFFFFF',
    border:  dark ? '#232840' : '#E8E5DF',
    heading: dark ? '#EDEDF0' : '#111111',
    body:    dark ? '#8890A4' : '#666666',
    muted:   dark ? '#525870' : '#AAAAAA',
    alt:     dark ? '#161929' : '#E8E6E1',
  };

  // ────────────────────────────────────────────────────────────
  // CAMERA PERMISSION SCREEN (shown while awaiting getUserMedia)
  // ────────────────────────────────────────────────────────────
  if (setupPhase === 'camera' && cameraGranted === null) {
    return (
      <div style={{ minHeight: '100vh', background: tk.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 24 }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{ background: tk.card, border: `1px solid ${tk.border}`, borderRadius: 20, padding: '40px 48px', maxWidth: 460, textAlign: 'center' }}
        >
          {/* Animated camera icon */}
          <motion.div
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            style={{ width: 72, height: 72, borderRadius: '50%', background: dark ? 'rgba(29,78,216,0.15)' : '#EEF2FF', border: '2px solid rgba(29,78,216,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" strokeWidth="1.8">
              <path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
            </svg>
          </motion.div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: tk.heading, marginBottom: 10 }}>Camera Access Required</h2>
          <p style={{ fontSize: 14, color: tk.body, lineHeight: 1.7, marginBottom: 6 }}>
            This diagnostic quiz uses AI-powered proctoring. Please <strong>Allow</strong> camera access when prompted by your browser.
          </p>
          <p style={{ fontSize: 12, color: tk.muted, lineHeight: 1.6 }}>
            Your camera feed is used for face presence and attention tracking only. No footage is recorded or stored.
          </p>
          <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <motion.div
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ repeat: Infinity, duration: 1.2 }}
              style={{ width: 8, height: 8, borderRadius: '50%', background: '#1D4ED8' }}
            />
            <span style={{ fontSize: 13, color: '#1D4ED8', fontWeight: 600 }}>Waiting for permission...</span>
          </div>
        </motion.div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────
  // RESULTS SCREEN
  // ────────────────────────────────────────────────────────────
  if (isFinished) {
    const score = answers.filter((a, i) => a === questions[i].correct).length;
    const total = questions.length;
    const pct   = Math.round((score / total) * 100);

    const totalViolations = fsViolationsRef.current + tabViolationsRef.current;

    const weakTopics = questions
      .filter((q, i) => answers[i] !== q.correct)
      .map(q => q.topic);
    const recommendedLabIds = [...new Set(weakTopics.map(t => TOPIC_TO_LAB[t]).filter(Boolean))].slice(0, 3);
    const defaultLabs = ['simple-pendulum', 'ohms-law', 'acid-base-titration'];
    while (recommendedLabIds.length < 3) {
      const next = defaultLabs.find(l => !recommendedLabIds.includes(l));
      if (next) recommendedLabIds.push(next); else break;
    }
    const labReasons: Record<string, string> = {
      'simple-pendulum':    'Mechanics needs reinforcement',
      'ohms-law':           'Electrostatics gap detected',
      'acid-base-titration':'Physical Chemistry needs work',
      'flame-test':         'Inorganic Chemistry gap detected',
      'le-chatelier':       'Thermodynamics needs reinforcement',
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
              You answered {score} out of {total} questions correctly.
            </p>

            {/* Proctoring summary */}
            {totalViolations > 0 && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999, background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.25)', marginBottom: 16 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#DC2626' }}>
                  {totalViolations} proctoring violation{totalViolations > 1 ? 's' : ''} recorded
                </span>
              </div>
            )}

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

            {saving && <div style={{ marginTop: 14, fontSize: 12, color: tk.muted }}>Saving your results...</div>}
          </div>

          {/* Recommended labs */}
          <div style={{ background: tk.card, border: `1px solid ${tk.border}`, borderRadius: 20, padding: '24px 28px', marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#1D4ED8', marginBottom: 4 }}>AI Recommendations</div>
            <p style={{ fontSize: 13, color: tk.body, marginBottom: 16 }}>Based on your weak areas, start with these labs:</p>
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

          <button onClick={() => navigate('/dashboard')} style={{ width: '100%', padding: '14px', background: '#1D4ED8', color: '#fff', fontWeight: 700, fontSize: 14, borderRadius: 12, border: 'none', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#1E40AF')}
            onMouseLeave={e => (e.currentTarget.style.background = '#1D4ED8')}
          >Go to Dashboard →</button>
        </motion.div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────
  // QUIZ SCREEN
  // ────────────────────────────────────────────────────────────
  const q = questions[currentIdx];

  const getOptionStyle = (i: number): React.CSSProperties => {
    const base: React.CSSProperties = {
      width: '100%', textAlign: 'left', padding: '16px 20px', borderRadius: 12,
      border: `1.5px solid ${tk.border}`, background: tk.card,
      cursor: answerState === 'unanswered' && fsWarning === 'none' && !tabWarningVisible ? 'pointer' : 'default',
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

      {/* ── Tab-switch warning overlay ──────────────────────── */}
      <AnimatePresence>
        {tabWarningVisible && !isFinished && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 350, background: 'rgba(10,10,20,0.97)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}
          >
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(220,38,38,0.15)', border: '2px solid rgba(220,38,38,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
              </svg>
            </div>
            <div style={{ textAlign: 'center', maxWidth: 440 }}>
              <div style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, color: '#DC2626', background: 'rgba(220,38,38,0.15)', padding: '3px 12px', borderRadius: 999, marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Tab Switch #{tabViolationsRef.current}
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: '#F0F0F0', marginBottom: 10 }}>
                {tabViolationsRef.current >= MAX_TAB_VIOLATIONS ? '⚠ Final Warning' : 'Window Switch Detected'}
              </h2>
              <p style={{ fontSize: 15, color: '#8890A4', lineHeight: 1.7, marginBottom: 8 }}>
                {tabViolationsRef.current >= MAX_TAB_VIOLATIONS
                  ? 'You have switched tabs or windows too many times. Return to this window or the quiz will be auto-submitted.'
                  : 'You switched away from this window. The timer has been paused. Return to continue your quiz.'}
              </p>
              {tabViolationsRef.current >= MAX_TAB_VIOLATIONS && (
                <>
                  <div style={{ fontSize: 52, fontWeight: 800, color: '#DC2626', fontFamily: 'monospace', margin: '16px 0 4px' }}>{tabCountdown}</div>
                  <p style={{ fontSize: 13, color: '#525870' }}>Auto-submitting in {tabCountdown} second{tabCountdown !== 1 ? 's' : ''}</p>
                </>
              )}
            </div>
            {tabViolationsRef.current < MAX_TAB_VIOLATIONS && (
              <button onClick={handleReturnFromTab} style={{ padding: '13px 36px', background: '#1D4ED8', color: '#fff', fontWeight: 700, fontSize: 15, borderRadius: 12, border: 'none', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#1E40AF')}
                onMouseLeave={e => (e.currentTarget.style.background = '#1D4ED8')}
              >Resume Quiz</button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Fullscreen violation overlay ────────────────────── */}
      <AnimatePresence>
        {fsWarning !== 'none' && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(10,10,20,0.97)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}
          >
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
                  ? 'You exited fullscreen. The quiz must remain in fullscreen mode to maintain academic integrity.'
                  : 'This is your final warning. Return to fullscreen immediately or your quiz will be auto-submitted.'}
              </p>
              {fsWarning === 'second' && (
                <>
                  <div style={{ fontSize: 52, fontWeight: 800, color: '#DC2626', fontFamily: 'monospace', margin: '16px 0 4px' }}>{autoSubmitCountdown}</div>
                  <p style={{ fontSize: 13, color: '#525870' }}>Auto-submitting in {autoSubmitCountdown} second{autoSubmitCountdown !== 1 ? 's' : ''}</p>
                </>
              )}
            </div>
            <button onClick={handleReturnToFullscreen} style={{ padding: '13px 36px', background: '#DC2626', color: '#fff', fontWeight: 700, fontSize: 15, borderRadius: 12, border: 'none', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#B91C1C')}
              onMouseLeave={e => (e.currentTarget.style.background = '#DC2626')}
            >Return to Fullscreen Now</button>
            {fsWarning === 'first' && (
              <button onClick={() => { setIsFinished(true); exitFullscreenAPI(); }} style={{ background: 'none', border: 'none', color: '#525870', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>
                Submit quiz now
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Camera tile ─────────────────────────────────────── */}
      <div style={{ position: 'fixed', top: 80, right: 20, width: 164, zIndex: 50 }}>
        {/* Video */}
        <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: `1px solid ${faceStatus === 'ok' ? 'rgba(5,150,105,0.5)' : faceStatus === 'missing' || faceStatus === 'lookaway' ? 'rgba(220,38,38,0.5)' : faceStatus === 'multiple' ? 'rgba(217,119,6,0.6)' : tk.border}`, background: '#000', transition: 'border-color 0.3s' }}>
          <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: 104, objectFit: 'cover', transform: 'scaleX(-1)', display: 'block' }} />
          {/* Live dot */}
          <div style={{ position: 'absolute', top: 6, left: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
            <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1.2 }}
              style={{ width: 6, height: 6, borderRadius: '50%', background: '#EF4444' }} />
            <span style={{ fontSize: 9, fontWeight: 700, color: '#EF4444', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Live</span>
          </div>
          {/* Face status badge overlaid on video */}
          {faceStatus !== 'checking' && (
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              padding: '4px 8px', fontSize: 10, fontWeight: 700, textAlign: 'center',
              background: faceStatus === 'ok' ? 'rgba(5,150,105,0.8)' : faceStatus === 'multiple' ? 'rgba(217,119,6,0.85)' : 'rgba(220,38,38,0.8)',
              color: '#fff',
            }}>
              {faceStatus === 'ok'       ? '✓ Face detected'
               : faceStatus === 'missing'  ? '⚠ No face'
               : faceStatus === 'lookaway' ? '⚠ Look at screen'
               : '⚠ Multiple faces'}
            </div>
          )}
        </div>

        {/* Camera warning strip */}
        <AnimatePresence>
          {camWarning && (
            <motion.div
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ marginTop: 6, padding: '6px 10px', borderRadius: 8, fontSize: 10, fontWeight: 600, lineHeight: 1.4, background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.3)', color: '#FCA5A5' }}
            >
              {camWarning}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Camera denied notice */}
        {cameraGranted === false && (
          <div style={{ marginTop: 6, padding: '6px 10px', borderRadius: 8, fontSize: 10, fontWeight: 600, background: 'rgba(217,119,6,0.1)', border: '1px solid rgba(217,119,6,0.3)', color: '#FCD34D', lineHeight: 1.4 }}>
            Camera denied — proctoring limited
          </div>
        )}
      </div>

      {/* ── Status bar ──────────────────────────────────────── */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 56, background: dark ? '#161929' : '#FFFFFF', borderBottom: `1px solid ${dark ? '#232840' : '#E8E5DF'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', zIndex: 40 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: dark ? '#EDEDF0' : '#111' }}>ARISE — Diagnostic Quiz</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Violation count pill */}
          {(fsViolationsRef.current + tabViolationsRef.current) > 0 && (
            <div style={{ fontSize: 12, fontWeight: 700, color: '#DC2626', background: 'rgba(220,38,38,0.1)', padding: '3px 10px', borderRadius: 999 }}>
              ⚠ {fsViolationsRef.current + tabViolationsRef.current} violation{(fsViolationsRef.current + tabViolationsRef.current) > 1 ? 's' : ''}
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

      {/* ── Quiz content ────────────────────────────────────── */}
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
                  onMouseEnter={e => { if (answerState === 'unanswered' && fsWarning === 'none' && !tabWarningVisible) e.currentTarget.style.borderColor = '#1D4ED8'; }}
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