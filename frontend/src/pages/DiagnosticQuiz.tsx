import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabaseClient';
import * as faceapi from '@vladmandic/face-api';

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
const MAX_FS_VIOLATIONS   = 2;
const MAX_TAB_VIOLATIONS  = 2;
const MAX_FACE_VIOLATIONS = 2;
const NO_FACE_THRESHOLD   = 3;   // consecutive bad polls before timer pauses
const LOOK_AWAY_THRESHOLD = 3;
const FACE_POLL_MS        = 2000;

// face-api.js models CDN — loaded at runtime so no bundling needed
const MODELS_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model';

type AnswerState = 'unanswered' | 'correct' | 'wrong';
type FSWarning   = 'none' | 'first' | 'second';
type FaceStatus  = 'loading' | 'unavailable' | 'ok' | 'missing' | 'multiple' | 'lookaway';

interface CheatEvent {
  ts: string;
  type: 'face_missing' | 'look_away' | 'multiple_faces' | 'tab_switch' | 'fullscreen_exit';
  questionIdx: number;
}

function calcAttentionScore(totalPolls: number, badPolls: number): number {
  if (totalPolls === 0) return 100;
  return Math.round(Math.max(0, 1 - badPolls / totalPolls) * 100);
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
  const [timerActive,    setTimerActive]     = useState(false);
  const [isFinished,     setIsFinished]      = useState(false);
  const [saving,         setSaving]          = useState(false);

  // ── Setup phase ─────────────────────────────────────────────
  const [setupPhase,    setSetupPhase]    = useState<'camera' | 'ready'>('camera');
  const [cameraGranted, setCameraGranted] = useState<boolean | null>(null);

  // ── face-api.js model loading ────────────────────────────────
  const [modelsLoaded,   setModelsLoaded]   = useState(false);
  const [modelsError,    setModelsError]    = useState(false);

  // ── Fullscreen ───────────────────────────────────────────────
  const [isFullscreen,        setIsFullscreen]        = useState(false);
  const [fsWarning,           setFsWarning]            = useState<FSWarning>('none');
  const [fsRequested,         setFsRequested]          = useState(false);
  const [autoSubmitCountdown, setAutoSubmitCountdown]  = useState(10);
  const autoSubmitRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const fsViolationsRef = useRef(0);

  // ── Tab-switch ───────────────────────────────────────────────
  const tabViolationsRef    = useRef(0);
  const [tabWarningVisible, setTabWarningVisible] = useState(false);
  const [tabCountdown,      setTabCountdown]       = useState(10);
  const tabAutoSubmitRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const [tabAutoSubmitting, setTabAutoSubmitting]  = useState(false);

  // ── Camera / face detection ──────────────────────────────────
  const streamRef        = useRef<MediaStream | null>(null);
  const videoElRef       = useRef<HTMLVideoElement | null>(null);
  const faceIntervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const [faceStatus,     setFaceStatus]     = useState<FaceStatus>('loading');
  const noFaceCountRef   = useRef(0);
  const lookAwayCountRef = useRef(0);

  // ── Attention score ──────────────────────────────────────────
  const totalPollsRef    = useRef(0);
  const badPollsRef      = useRef(0);
  const [attentionScore, setAttentionScore] = useState(100);

  // ── Face lock: pauses timer + blurs question card ────────────
  const [faceLocked,     setFaceLocked]     = useState(false);
  const [faceWarningMsg, setFaceWarningMsg] = useState<string | null>(null);

  // ── Face violations (escalate to auto-submit) ────────────────
  const faceViolationsRef   = useRef(0);
  const [faceAutoSubmit,    setFaceAutoSubmit]    = useState(false);
  const [faceCountdown,     setFaceCountdown]     = useState(10);
  const faceAutoSubmitRef2  = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Cheat log saved to Supabase for Teacher Dashboard ────────
  const cheatLogRef   = useRef<CheatEvent[]>([]);
  const currentIdxRef = useRef(0);

  // ── Misc ─────────────────────────────────────────────────────
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRef       = useRef(false);

  useEffect(() => { currentIdxRef.current = currentIdx; }, [currentIdx]);

  const logCheatEvent = useCallback((type: CheatEvent['type']) => {
    cheatLogRef.current.push({ ts: new Date().toISOString(), type, questionIdx: currentIdxRef.current });
  }, []);

  // ── Callback ref: assigns srcObject the instant <video> mounts
  const videoCallbackRef = useCallback((el: HTMLVideoElement | null) => {
    videoElRef.current = el;
    if (el && streamRef.current) el.srcObject = streamRef.current;
  }, []);

  // ────────────────────────────────────────────────────────────
  // STEP 0 — Load face-api.js models from CDN
  // ────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Load tiny face detector + landmark model (needed for look-away detection)
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODELS_URL),
        ]);
        if (!cancelled) setModelsLoaded(true);
      } catch (err) {
        console.warn('face-api.js models failed to load, face detection disabled:', err);
        if (!cancelled) {
          setModelsError(true);
          setModelsLoaded(true); // let quiz proceed without detection
          setFaceStatus('unavailable');
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ────────────────────────────────────────────────────────────
  // STEP 1 — Request camera
  // ────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = stream;
        if (videoElRef.current) videoElRef.current.srcObject = stream;
        if (mounted) setCameraGranted(true);
      } catch {
        if (mounted) setCameraGranted(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // STEP 2 — Enter fullscreen + start quiz (wait for camera + models)
  useEffect(() => {
    if (cameraGranted === null || !modelsLoaded) return;
    const t = setTimeout(() => {
      enterFullscreen();
      setFsRequested(true);
      setSetupPhase('ready');
      setTimerActive(true);
    }, 400);
    return () => clearTimeout(t);
  }, [cameraGranted, modelsLoaded]);

  // ────────────────────────────────────────────────────────────
  // Face violation escalation
  // ────────────────────────────────────────────────────────────
  const triggerFaceViolation = useCallback(() => {
    if (isFinished) return;
    faceViolationsRef.current += 1;
    logCheatEvent('face_missing');
    if (faceViolationsRef.current >= MAX_FACE_VIOLATIONS) {
      setFaceAutoSubmit(true);
      setFaceCountdown(10);
      if (faceAutoSubmitRef2.current) clearInterval(faceAutoSubmitRef2.current);
      faceAutoSubmitRef2.current = setInterval(() => {
        setFaceCountdown(prev => {
          if (prev <= 1) { clearInterval(faceAutoSubmitRef2.current!); setIsFinished(true); return 0; }
          return prev - 1;
        });
      }, 1000);
    }
  }, [isFinished, logCheatEvent]);

  // ────────────────────────────────────────────────────────────
  // FACE DETECTION — using face-api.js TinyFaceDetector
  // Replaces the broken window.FaceDetector (Chrome-only, disabled by default)
  // ────────────────────────────────────────────────────────────
  useEffect(() => {
    // Don't start polling until camera is ready + models loaded
    if (cameraGranted !== true || !modelsLoaded || modelsError) return;

    setFaceStatus('loading');

    // Wait for video to be playing before starting polls
    const startPolling = () => {
      setFaceStatus('ok'); // optimistic initial state

      faceIntervalRef.current = setInterval(async () => {
        const video = videoElRef.current;
        if (!video || video.readyState < 2 || isFinished) return;

        let status: FaceStatus = 'ok';

        try {
          const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 });

          // Detect faces with landmarks for look-away detection
          const detections = await faceapi
            .detectAllFaces(video, options)
            .withFaceLandmarks(true); // true = use tiny landmark model

          if (detections.length === 0) {
            status = 'missing';
          } else if (detections.length > 1) {
            status = 'multiple';
          } else {
            // Single face — check if looking at screen using nose/eye positions
            const landmarks = detections[0].landmarks;
            const nose      = landmarks.getNose();
            const leftEye   = landmarks.getLeftEye();
            const rightEye  = landmarks.getRightEye();

            // Nose tip is the last point of the nose array
            const noseTip = nose[nose.length - 1];

            // Eye centers
            const leftEyeCenter  = { x: leftEye.reduce((s, p) => s + p.x, 0) / leftEye.length,  y: leftEye.reduce((s, p) => s + p.y, 0) / leftEye.length };
            const rightEyeCenter = { x: rightEye.reduce((s, p) => s + p.x, 0) / rightEye.length, y: rightEye.reduce((s, p) => s + p.y, 0) / rightEye.length };

            // Inter-eye distance as a scale reference
            const eyeDist = Math.hypot(rightEyeCenter.x - leftEyeCenter.x, rightEyeCenter.y - leftEyeCenter.y);

            // Midpoint between eyes
            const eyeMidX = (leftEyeCenter.x + rightEyeCenter.x) / 2;
            const eyeMidY = (leftEyeCenter.y + rightEyeCenter.y) / 2;

            // Horizontal offset of nose from eye midpoint (normalized by eye distance)
            // If |offsetX| > 0.5 * eyeDist → head turned significantly left/right
            const offsetX = Math.abs(noseTip.x - eyeMidX) / eyeDist;
            // Vertical offset — large positive means nose is very far below eyes (head down)
            const offsetY = (noseTip.y - eyeMidY) / eyeDist;

            if (offsetX > 0.55 || offsetY > 1.1 || offsetY < -0.2) {
              status = 'lookaway';
            } else {
              status = 'ok';
            }
          }
        } catch (err) {
          // Inference error — treat as ok to avoid false positives
          status = 'ok';
        }

        setFaceStatus(status);

        // ── Attention score ──
        totalPollsRef.current += 1;
        if (status !== 'ok') badPollsRef.current += 1;
        setAttentionScore(calcAttentionScore(totalPollsRef.current, badPollsRef.current));

        // ── Per-status actions ──
        if (status === 'missing') {
          noFaceCountRef.current  += 1;
          lookAwayCountRef.current = 0;
          if (noFaceCountRef.current === NO_FACE_THRESHOLD) {
            setFaceLocked(true);
            setTimerActive(false);
            setFaceWarningMsg('👁 Face not detected — timer paused. Return to camera to continue.');
            logCheatEvent('face_missing');
          }
          if (noFaceCountRef.current >= NO_FACE_THRESHOLD + 3) {
            noFaceCountRef.current = 0;
            triggerFaceViolation();
          }
        } else if (status === 'lookaway') {
          noFaceCountRef.current   = 0;
          lookAwayCountRef.current += 1;
          if (lookAwayCountRef.current === LOOK_AWAY_THRESHOLD) {
            setFaceLocked(true);
            setTimerActive(false);
            setFaceWarningMsg('👁 Please look at the screen — timer paused until you face forward.');
            logCheatEvent('look_away');
          }
          if (lookAwayCountRef.current >= LOOK_AWAY_THRESHOLD + 2) {
            lookAwayCountRef.current = 0;
            triggerFaceViolation();
          }
        } else if (status === 'multiple') {
          noFaceCountRef.current   = 0;
          lookAwayCountRef.current = 0;
          setFaceLocked(true);
          setTimerActive(false);
          setFaceWarningMsg('⚠ Multiple faces detected — only the student should be visible.');
          logCheatEvent('multiple_faces');
          triggerFaceViolation();
        } else {
          // Face OK — unlock immediately
          noFaceCountRef.current   = 0;
          lookAwayCountRef.current = 0;
          setFaceLocked(prev => {
            if (prev) {
              setFaceWarningMsg(null);
              setTimerActive(true); // resume timer
            }
            return false;
          });
        }
      }, FACE_POLL_MS);
    };

    // Poll until video is ready
    const readyCheck = setInterval(() => {
      const v = videoElRef.current;
      if (v && v.readyState >= 2) {
        clearInterval(readyCheck);
        startPolling();
      }
    }, 200);

    return () => {
      clearInterval(readyCheck);
      if (faceIntervalRef.current) clearInterval(faceIntervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraGranted, modelsLoaded, modelsError, isFinished]);

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

  const triggerFsViolation = useCallback(() => {
    if (isFinished) return;
    fsViolationsRef.current += 1;
    logCheatEvent('fullscreen_exit');
    if (fsViolationsRef.current >= MAX_FS_VIOLATIONS) {
      setFsWarning('second');
      setAutoSubmitCountdown(10);
      if (autoSubmitRef.current) clearInterval(autoSubmitRef.current);
      autoSubmitRef.current = setInterval(() => {
        setAutoSubmitCountdown(prev => {
          if (prev <= 1) { clearInterval(autoSubmitRef.current!); setIsFinished(true); return 0; }
          return prev - 1;
        });
      }, 1000);
    } else {
      setFsWarning('first');
    }
  }, [isFinished, logCheatEvent]);

  useEffect(() => {
    const handleFsChange = () => {
      const inFs = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      setIsFullscreen(inFs);
      if (!inFs && fsRequested && !isFinished && setupPhase === 'ready') triggerFsViolation();
    };
    document.addEventListener('fullscreenchange',       handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange',       handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, [fsRequested, isFinished, setupPhase, triggerFsViolation]);

  // ────────────────────────────────────────────────────────────
  // Alt-tab detection
  // ────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleBlur = () => {
      if (isFinished || setupPhase !== 'ready') return;
      setTimerActive(false);
      tabViolationsRef.current += 1;
      logCheatEvent('tab_switch');
      if (tabViolationsRef.current >= MAX_TAB_VIOLATIONS) {
        setTabAutoSubmitting(true);
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
    window.addEventListener('blur',  handleBlur);
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('blur',  handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isFinished, setupPhase, logCheatEvent]);

  // Cleanup
  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (faceIntervalRef.current)    clearInterval(faceIntervalRef.current);
    if (autoSubmitRef.current)      clearInterval(autoSubmitRef.current);
    if (tabAutoSubmitRef.current)   clearInterval(tabAutoSubmitRef.current);
    if (faceAutoSubmitRef2.current) clearInterval(faceAutoSubmitRef2.current);
    if (autoAdvanceRef.current)     clearTimeout(autoAdvanceRef.current);
    if (document.fullscreenElement) exitFullscreenAPI();
  }, []);

  // ────────────────────────────────────────────────────────────
  // Timer
  // ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!timerActive || isFinished || faceLocked ||
        answerState !== 'unanswered' || fsWarning !== 'none' ||
        tabWarningVisible || faceAutoSubmit) return;
    if (timeLeft <= 0) {
      setSelectedOption(-1);
      setAnswerState('wrong');
      setTimerActive(false);
      return;
    }
    const t = setInterval(() => setTimeLeft(n => n - 1), 1000);
    return () => clearInterval(t);
  }, [timeLeft, timerActive, isFinished, faceLocked, answerState, fsWarning, tabWarningVisible, faceAutoSubmit]);

  // ────────────────────────────────────────────────────────────
  // Answer handling
  // ────────────────────────────────────────────────────────────
  const advanceToNext = useCallback((answeredIdx: number) => {
    const newAnswers = [...answers, answeredIdx];
    setAnswers(newAnswers);
    setFaceLocked(false);
    setFaceWarningMsg(null);
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
    if (answerState !== 'unanswered' || faceLocked ||
        fsWarning !== 'none' || tabWarningVisible || faceAutoSubmit) return;
    setSelectedOption(optIdx);
    setTimerActive(false);
    const isCorrect = optIdx === questions[currentIdx].correct;
    setAnswerState(isCorrect ? 'correct' : 'wrong');
    if (isCorrect) autoAdvanceRef.current = setTimeout(() => advanceToNext(optIdx), 1000);
  }, [answerState, faceLocked, currentIdx, advanceToNext, fsWarning, tabWarningVisible, faceAutoSubmit]);

  const handleReturnToFullscreen = () => {
    enterFullscreen();
    if (autoSubmitRef.current) clearInterval(autoSubmitRef.current);
    setFsWarning('none');
    setTimerActive(true);
  };
  const handleReturnFromTab = () => {
    if (tabViolationsRef.current >= MAX_TAB_VIOLATIONS) return;
    setTabWarningVisible(false);
    setTimerActive(true);
  };

  // ────────────────────────────────────────────────────────────
  // Save results + cheat log to Supabase
  // ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isFinished || savedRef.current || answers.length === 0) return;
    savedRef.current = true;
    if (document.fullscreenElement) exitFullscreenAPI();
    (async () => {
      setSaving(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const score = answers.filter((a, i) => a === questions[i].correct).length;
        const topicResults = questions.map((q, i) => ({
          topic: q.topic, correct: answers[i] === q.correct,
          answeredIdx: answers[i], correctIdx: q.correct,
        }));
        const finalAttention = calcAttentionScore(totalPollsRef.current, badPollsRef.current);
        await supabase.from('quiz_results').delete().eq('user_id', user.id);
        await supabase.from('quiz_results').insert({
          user_id:         user.id,
          answers:         topicResults,
          score,
          attention_score: finalAttention,
          cheat_log:       cheatLogRef.current,
          fs_violations:   fsViolationsRef.current,
          tab_violations:  tabViolationsRef.current,
          face_violations: faceViolationsRef.current,
        });
      } catch (err) { console.error('Failed to save quiz results:', err); }
      finally { setSaving(false); }
    })();
  }, [isFinished, answers]);

  // ── Theme tokens ─────────────────────────────────────────────
  const tk = {
    bg:      dark ? '#0F111A' : '#F0EEE9',
    card:    dark ? '#1C1F2E' : '#FFFFFF',
    border:  dark ? '#232840' : '#E8E5DF',
    heading: dark ? '#EDEDF0' : '#111111',
    body:    dark ? '#8890A4' : '#666666',
    muted:   dark ? '#525870' : '#AAAAAA',
    alt:     dark ? '#161929' : '#E8E6E1',
  };
  const attentionColor = attentionScore >= 80 ? '#059669' : attentionScore >= 60 ? '#D97706' : '#DC2626';

  // ── Status label for face tile ────────────────────────────────
  const faceStatusLabel = () => {
    switch (faceStatus) {
      case 'loading':     return '⏳ Loading AI...';
      case 'unavailable': return '⚠ Detection off';
      case 'ok':          return '✓ Face detected';
      case 'missing':     return '⚠ No face';
      case 'lookaway':    return '⚠ Look at screen';
      case 'multiple':    return '⚠ Multiple faces';
    }
  };
  const faceStatusColor = () => {
    switch (faceStatus) {
      case 'ok':          return 'rgba(5,150,105,0.85)';
      case 'multiple':    return 'rgba(217,119,6,0.9)';
      case 'loading':     return 'rgba(29,78,216,0.75)';
      case 'unavailable': return 'rgba(100,100,120,0.75)';
      default:            return 'rgba(220,38,38,0.85)';
    }
  };
  const faceBorderColor = () => {
    if (faceLocked)            return 'rgba(220,38,38,0.65)';
    if (faceStatus === 'ok')   return 'rgba(5,150,105,0.5)';
    if (faceStatus === 'multiple') return 'rgba(217,119,6,0.6)';
    if (faceStatus === 'loading' || faceStatus === 'unavailable') return 'rgba(80,80,120,0.4)';
    return 'rgba(220,38,38,0.45)';
  };

  // ────────────────────────────────────────────────────────────
  // CAMERA PERMISSION + MODELS LOADING SCREEN
  // ────────────────────────────────────────────────────────────
  if (setupPhase === 'camera') {
    const isWaitingForCamera = cameraGranted === null;
    const isLoadingModels    = cameraGranted !== null && !modelsLoaded;

    return (
      <div style={{ minHeight: '100vh', background: tk.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 24 }}>
        <video ref={videoCallbackRef} autoPlay playsInline muted
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          style={{ background: tk.card, border: `1px solid ${tk.border}`, borderRadius: 20, padding: '40px 48px', maxWidth: 480, textAlign: 'center' }}>
          <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 2 }}
            style={{ width: 72, height: 72, borderRadius: '50%', background: dark ? 'rgba(29,78,216,0.15)' : '#EEF2FF', border: '2px solid rgba(29,78,216,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" strokeWidth="1.8">
              <path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
            </svg>
          </motion.div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: tk.heading, marginBottom: 10 }}>
            {isWaitingForCamera ? 'Camera Access Required' : 'Loading Proctoring AI...'}
          </h2>
          <p style={{ fontSize: 14, color: tk.body, lineHeight: 1.7, marginBottom: 10 }}>
            {isWaitingForCamera
              ? <>Your camera tracks <strong>attention</strong> during the quiz. If you look away or leave the frame, the <strong>timer pauses</strong> and your focus score drops. Results are shared with your teacher.</>
              : 'Loading face detection models. This takes a few seconds on first launch — quiz begins automatically when ready.'}
          </p>
          <p style={{ fontSize: 12, color: tk.muted, lineHeight: 1.6 }}>No footage is recorded or stored.</p>

          {/* Loading stages */}
          <div style={{ marginTop: 20 }}>
            {[
              { label: 'Camera permission', done: cameraGranted === true, fail: cameraGranted === false },
              { label: 'Loading face-detection model', done: modelsLoaded && !modelsError, fail: modelsError },
            ].map((step, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 10 }}>
                {step.fail ? (
                  <span style={{ fontSize: 14, color: '#DC2626' }}>✗</span>
                ) : step.done ? (
                  <span style={{ fontSize: 14, color: '#059669' }}>✓</span>
                ) : (
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    style={{ width: 14, height: 14, border: '2px solid rgba(29,78,216,0.3)', borderTopColor: '#1D4ED8', borderRadius: '50%' }} />
                )}
                <span style={{ fontSize: 13, color: step.done ? '#059669' : step.fail ? '#DC2626' : '#1D4ED8', fontWeight: 600 }}>
                  {step.label}{step.fail ? ' — failed (quiz continues)' : ''}
                </span>
              </div>
            ))}
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
    const finalAttention = calcAttentionScore(totalPollsRef.current, badPollsRef.current);
    const finalAttentionColor = finalAttention >= 80 ? '#059669' : finalAttention >= 60 ? '#D97706' : '#DC2626';
    const totalViolations = fsViolationsRef.current + tabViolationsRef.current + faceViolationsRef.current;

    const weakTopics = questions.filter((q, i) => answers[i] !== q.correct).map(q => q.topic);
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

          {/* Main score card */}
          <div style={{ background: tk.card, border: `1px solid ${tk.border}`, borderRadius: 20, padding: '36px 36px 28px', marginBottom: 16, textAlign: 'center' }}>
            <div style={{
              width: 88, height: 88, borderRadius: '50%',
              border: `4px solid ${pct >= 70 ? '#059669' : pct >= 40 ? '#D97706' : '#DC2626'}`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
              background: pct >= 70 ? (dark ? 'rgba(5,150,105,0.1)' : '#ECFDF5') : pct >= 40 ? (dark ? 'rgba(217,119,6,0.1)' : '#FFFBEB') : (dark ? 'rgba(220,38,38,0.1)' : '#FEF2F2'),
            }}>
              <span style={{ fontSize: 26, fontWeight: 800, color: pct >= 70 ? '#059669' : pct >= 40 ? '#D97706' : '#DC2626', lineHeight: 1 }}>{pct}%</span>
              <span style={{ fontSize: 11, color: tk.muted, marginTop: 2 }}>{score}/{total}</span>
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: tk.heading, marginBottom: 6 }}>
              {pct >= 70 ? 'Excellent work!' : pct >= 40 ? 'Good effort!' : 'Keep practising!'}
            </h2>
            <p style={{ fontSize: 13, color: tk.body, maxWidth: 380, margin: '0 auto 20px' }}>
              You answered {score} out of {total} questions correctly.
            </p>

            {/* Attention Score */}
            {!modelsError && (
              <div style={{
                margin: '0 auto 20px', maxWidth: 360,
                background: dark ? 'rgba(255,255,255,0.03)' : '#F8F7F4',
                border: `1px solid ${dark ? 'rgba(255,255,255,0.07)' : '#E8E5DF'}`,
                borderRadius: 14, padding: '16px 20px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: tk.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
                      👁 Attention Score
                    </div>
                    <div style={{ fontSize: 11, color: tk.muted }}>Camera presence during quiz</div>
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: finalAttentionColor, fontFamily: 'monospace', lineHeight: 1 }}>
                    {finalAttention}%
                  </div>
                </div>
                <div style={{ width: '100%', height: 6, background: dark ? 'rgba(255,255,255,0.06)' : '#E8E5DF', borderRadius: 999, overflow: 'hidden', marginBottom: 8 }}>
                  <motion.div
                    initial={{ width: 0 }} animate={{ width: `${finalAttention}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    style={{ height: '100%', borderRadius: 999, background: finalAttentionColor }}
                  />
                </div>
                <div style={{ fontSize: 11, color: tk.muted, textAlign: 'center' }}>
                  {finalAttention >= 80
                    ? '✓ Great focus throughout the quiz'
                    : finalAttention >= 60
                    ? 'Moderate attention — some distractions detected'
                    : 'Low attention — significant time away from camera'}
                </div>
                {cheatLogRef.current.length > 0 && (
                  <div style={{ marginTop: 10, padding: '5px 10px', borderRadius: 8, fontSize: 10, fontWeight: 600, background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.15)', color: '#DC2626', textAlign: 'center' }}>
                    {cheatLogRef.current.length} proctoring event{cheatLogRef.current.length > 1 ? 's' : ''} flagged — visible to your teacher
                  </div>
                )}
              </div>
            )}

            {/* Per-question badges */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap', marginBottom: totalViolations > 0 ? 16 : 0 }}>
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

            {totalViolations > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 12 }}>
                {fsViolationsRef.current > 0 && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#DC2626', background: 'rgba(220,38,38,0.1)', padding: '3px 10px', borderRadius: 999, border: '1px solid rgba(220,38,38,0.2)' }}>
                    {fsViolationsRef.current} fullscreen exit{fsViolationsRef.current > 1 ? 's' : ''}
                  </div>
                )}
                {tabViolationsRef.current > 0 && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#DC2626', background: 'rgba(220,38,38,0.1)', padding: '3px 10px', borderRadius: 999, border: '1px solid rgba(220,38,38,0.2)' }}>
                    {tabViolationsRef.current} tab switch{tabViolationsRef.current > 1 ? 'es' : ''}
                  </div>
                )}
                {faceViolationsRef.current > 0 && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#DC2626', background: 'rgba(220,38,38,0.1)', padding: '3px 10px', borderRadius: 999, border: '1px solid rgba(220,38,38,0.2)' }}>
                    {faceViolationsRef.current} camera violation{faceViolationsRef.current > 1 ? 's' : ''}
                  </div>
                )}
              </div>
            )}
            {saving && <div style={{ marginTop: 14, fontSize: 12, color: tk.muted }}>Saving your results...</div>}
          </div>

          {/* Recommended labs */}
          <div style={{ background: tk.card, border: `1px solid ${tk.border}`, borderRadius: 20, padding: '22px 26px', marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#1D4ED8', marginBottom: 4 }}>AI Recommendations</div>
            <p style={{ fontSize: 13, color: tk.body, marginBottom: 14 }}>Based on your weak areas, start with these labs:</p>
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

          <button onClick={() => navigate('/dashboard')}
            style={{ width: '100%', padding: '14px', background: '#1D4ED8', color: '#fff', fontWeight: 700, fontSize: 14, borderRadius: 12, border: 'none', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#1E40AF')}
            onMouseLeave={e => (e.currentTarget.style.background = '#1D4ED8')}>
            Go to Dashboard →
          </button>
        </motion.div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────
  // QUIZ SCREEN
  // ────────────────────────────────────────────────────────────
  const q = questions[currentIdx];
  const blocked = faceLocked || fsWarning !== 'none' || tabWarningVisible || faceAutoSubmit;

  const getOptionStyle = (i: number): React.CSSProperties => {
    const base: React.CSSProperties = {
      width: '100%', textAlign: 'left', padding: '16px 20px', borderRadius: 12,
      border: `1.5px solid ${tk.border}`, background: tk.card,
      cursor: answerState === 'unanswered' && !blocked ? 'pointer' : 'default',
      display: 'flex', alignItems: 'center', gap: 14,
      transition: 'border-color 0.15s, background 0.15s, opacity 0.2s', outline: 'none',
      opacity: blocked && answerState === 'unanswered' ? 0.4 : 1,
    };
    if (answerState === 'unanswered') return base;
    if (i === q.correct) return { ...base, borderColor: '#059669', background: dark ? 'rgba(5,150,105,0.12)' : '#ECFDF5' };
    if (i === selectedOption && selectedOption !== q.correct) return { ...base, borderColor: '#DC2626', background: dark ? 'rgba(220,38,38,0.1)' : '#FEF2F2' };
    return { ...base, opacity: 0.45 };
  };

  return (
    <div style={{ minHeight: '100vh', background: tk.bg, paddingTop: 80, paddingBottom: 40, position: 'relative' }}>

      {/* ── Face auto-submit overlay ─────────────────────────── */}
      <AnimatePresence>
        {faceAutoSubmit && !isFinished && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(10,10,20,0.97)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(220,38,38,0.15)', border: '2px solid rgba(220,38,38,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2">
                <path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            </div>
            <div style={{ textAlign: 'center', maxWidth: 440 }}>
              <div style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, color: '#DC2626', background: 'rgba(220,38,38,0.15)', padding: '3px 12px', borderRadius: 999, marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Camera Violation #{faceViolationsRef.current}
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: '#F0F0F0', marginBottom: 10 }}>⚠ Proctoring Failed</h2>
              <p style={{ fontSize: 15, color: '#8890A4', lineHeight: 1.7 }}>Repeated camera violations detected. The quiz will be automatically submitted.</p>
              <div style={{ fontSize: 52, fontWeight: 800, color: '#DC2626', fontFamily: 'monospace', margin: '16px 0 4px' }}>{faceCountdown}</div>
              <p style={{ fontSize: 13, color: '#525870' }}>Submitting in {faceCountdown}s</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Tab-switch overlay ───────────────────────────────── */}
      <AnimatePresence>
        {tabWarningVisible && !isFinished && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 350, background: 'rgba(10,10,20,0.97)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
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
                {tabAutoSubmitting ? '⚠ Final Warning' : 'Window Switch Detected'}
              </h2>
              <p style={{ fontSize: 15, color: '#8890A4', lineHeight: 1.7 }}>
                {tabAutoSubmitting ? 'Too many tab switches. The quiz will be automatically submitted.' : 'You switched windows. Timer paused — return to continue.'}
              </p>
              {tabAutoSubmitting && (
                <>
                  <div style={{ fontSize: 52, fontWeight: 800, color: '#DC2626', fontFamily: 'monospace', margin: '16px 0 4px' }}>{tabCountdown}</div>
                  <p style={{ fontSize: 13, color: '#525870' }}>Auto-submitting in {tabCountdown}s</p>
                </>
              )}
              {!tabAutoSubmitting && <p style={{ fontSize: 13, color: '#525870', marginTop: 8 }}>Warning {tabViolationsRef.current} of {MAX_TAB_VIOLATIONS}.</p>}
            </div>
            {!tabAutoSubmitting && (
              <button onClick={handleReturnFromTab}
                style={{ padding: '13px 36px', background: '#1D4ED8', color: '#fff', fontWeight: 700, fontSize: 15, borderRadius: 12, border: 'none', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#1E40AF')}
                onMouseLeave={e => (e.currentTarget.style.background = '#1D4ED8')}>
                Resume Quiz
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Fullscreen violation overlay ────────────────────── */}
      <AnimatePresence>
        {fsWarning !== 'none' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(10,10,20,0.97)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
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
              <p style={{ fontSize: 15, color: '#8890A4', lineHeight: 1.7 }}>
                {fsWarning === 'first'
                  ? 'You exited fullscreen. The quiz must remain in fullscreen mode.'
                  : 'Return to fullscreen immediately or your quiz will be auto-submitted.'}
              </p>
              {fsWarning === 'second' && (
                <>
                  <div style={{ fontSize: 52, fontWeight: 800, color: '#DC2626', fontFamily: 'monospace', margin: '16px 0 4px' }}>{autoSubmitCountdown}</div>
                  <p style={{ fontSize: 13, color: '#525870' }}>Auto-submitting in {autoSubmitCountdown}s</p>
                </>
              )}
            </div>
            <button onClick={handleReturnToFullscreen}
              style={{ padding: '13px 36px', background: '#DC2626', color: '#fff', fontWeight: 700, fontSize: 15, borderRadius: 12, border: 'none', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#B91C1C')}
              onMouseLeave={e => (e.currentTarget.style.background = '#DC2626')}>
              Return to Fullscreen Now
            </button>
            {fsWarning === 'first' && (
              <button onClick={() => { setIsFinished(true); exitFullscreenAPI(); }}
                style={{ background: 'none', border: 'none', color: '#525870', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>
                Submit quiz now
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Camera tile (fixed top-right) ───────────────────── */}
      <div style={{ position: 'fixed', top: 68, right: 20, width: 168, zIndex: 50 }}>
        <div style={{
          position: 'relative', borderRadius: 10, overflow: 'hidden',
          border: `1.5px solid ${faceBorderColor()}`,
          background: '#000', transition: 'border-color 0.3s',
          boxShadow: faceLocked ? '0 0 0 3px rgba(220,38,38,0.15)' : 'none',
        }}>
          <video ref={videoCallbackRef} autoPlay playsInline muted
            style={{ width: '100%', height: 108, objectFit: 'cover', transform: 'scaleX(-1)', display: 'block', background: '#111' }} />

          {/* Live dot */}
          <div style={{ position: 'absolute', top: 6, left: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
            <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1.2 }}
              style={{ width: 6, height: 6, borderRadius: '50%', background: '#EF4444' }} />
            <span style={{ fontSize: 9, fontWeight: 700, color: '#EF4444', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Live</span>
          </div>

          {/* Attention % badge */}
          {!modelsError && (
            <div style={{
              position: 'absolute', top: 6, right: 8,
              fontSize: 10, fontWeight: 800, fontFamily: 'monospace', color: attentionColor,
              background: 'rgba(0,0,0,0.65)', padding: '1px 6px', borderRadius: 999,
            }}>
              {attentionScore}%
            </div>
          )}

          {/* Face status bar — bottom */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            padding: '3px 8px', fontSize: 10, fontWeight: 700, textAlign: 'center',
            background: faceStatusColor(),
            color: '#fff', transition: 'background 0.3s',
          }}>
            {faceStatusLabel()}
          </div>
        </div>

        {/* Attention bar + timer state */}
        {!modelsError && (
          <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 8, background: dark ? 'rgba(255,255,255,0.03)' : '#F0EEE9', border: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : '#E8E5DF'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: tk.muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Attention</span>
              <span style={{ fontSize: 10, fontWeight: 800, color: attentionColor, fontFamily: 'monospace' }}>{attentionScore}%</span>
            </div>
            <div style={{ width: '100%', height: 4, background: dark ? 'rgba(255,255,255,0.07)' : '#E0DDD8', borderRadius: 999, overflow: 'hidden' }}>
              <motion.div
                animate={{ width: `${attentionScore}%` }} transition={{ duration: 0.6, ease: 'easeOut' }}
                style={{ height: '100%', borderRadius: 999, background: attentionColor }}
              />
            </div>
            <div style={{ marginTop: 5, fontSize: 9, color: faceLocked ? '#DC2626' : tk.muted, fontWeight: faceLocked ? 700 : 400 }}>
              {faceLocked ? '⏸ Timer paused — face away' : faceStatus === 'ok' ? 'Timer running' : faceStatus === 'loading' ? 'Initialising...' : 'Monitoring...'}
            </div>
          </div>
        )}

        {/* Face-lock warning strip */}
        <AnimatePresence>
          {faceWarningMsg && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ marginTop: 6, padding: '7px 10px', borderRadius: 8, fontSize: 10, fontWeight: 600, lineHeight: 1.5, background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', color: '#FCA5A5' }}>
              {faceWarningMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {cameraGranted === false && (
          <div style={{ marginTop: 6, padding: '6px 10px', borderRadius: 8, fontSize: 10, fontWeight: 600, background: 'rgba(217,119,6,0.1)', border: '1px solid rgba(217,119,6,0.3)', color: '#FCD34D', lineHeight: 1.4 }}>
            Camera denied — proctoring limited
          </div>
        )}
        {modelsError && (
          <div style={{ marginTop: 6, padding: '6px 10px', borderRadius: 8, fontSize: 10, fontWeight: 600, background: 'rgba(100,100,120,0.1)', border: '1px solid rgba(100,100,120,0.3)', color: tk.muted, lineHeight: 1.4 }}>
            Face detection unavailable
          </div>
        )}
      </div>

      {/* ── Status bar ──────────────────────────────────────── */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 56, background: dark ? '#161929' : '#FFFFFF', borderBottom: `1px solid ${dark ? '#232840' : '#E8E5DF'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', zIndex: 40 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: dark ? '#EDEDF0' : '#111' }}>ARISE — Diagnostic Quiz</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {(fsViolationsRef.current + tabViolationsRef.current + faceViolationsRef.current) > 0 && (
            <div style={{ fontSize: 12, fontWeight: 700, color: '#DC2626', background: 'rgba(220,38,38,0.1)', padding: '3px 10px', borderRadius: 999 }}>
              ⚠ {fsViolationsRef.current + tabViolationsRef.current + faceViolationsRef.current} violation{(fsViolationsRef.current + tabViolationsRef.current + faceViolationsRef.current) > 1 ? 's' : ''}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: isFullscreen ? '#059669' : '#DC2626', fontWeight: 600 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: isFullscreen ? '#059669' : '#DC2626', display: 'inline-block' }}></span>
            {isFullscreen ? 'Fullscreen Active' : 'Fullscreen Required'}
          </div>
          {!isFullscreen && (
            <button onClick={enterFullscreen}
              style={{ padding: '4px 12px', background: 'rgba(29,78,216,0.15)', border: '1px solid rgba(29,78,216,0.4)', color: '#1D4ED8', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
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
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'monospace', color: faceLocked ? '#DC2626' : timeLeft <= 10 ? '#DC2626' : tk.heading, transition: 'color 0.3s' }}>
              00:{timeLeft.toString().padStart(2, '0')}
            </div>
            <AnimatePresence>
              {faceLocked && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  style={{ fontSize: 10, fontWeight: 700, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  ⏸ Paused
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div style={{ width: '100%', height: 4, background: tk.alt, borderRadius: 999, marginBottom: 32, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 999, background: '#1D4ED8', width: `${((currentIdx + 1) / questions.length) * 100}%`, transition: 'width 0.4s ease' }}></div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={currentIdx} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }}>

            <div style={{
              background: tk.card,
              border: `1px solid ${faceLocked ? 'rgba(220,38,38,0.3)' : tk.border}`,
              borderRadius: 16, padding: '28px 28px 24px', marginBottom: 16,
              transition: 'border-color 0.3s, opacity 0.3s',
              opacity: faceLocked ? 0.55 : 1,
              position: 'relative', overflow: 'hidden',
            }}>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: tk.heading, lineHeight: 1.5, margin: 0, filter: faceLocked ? 'blur(3px)' : 'none', transition: 'filter 0.3s' }}>
                {q.text}
              </h3>
              <AnimatePresence>
                {faceLocked && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    style={{
                      position: 'absolute', inset: 0, borderRadius: 16,
                      background: dark ? 'rgba(15,17,26,0.6)' : 'rgba(240,238,233,0.65)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      backdropFilter: 'blur(4px)',
                    }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 30, marginBottom: 8 }}>👁</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#DC2626' }}>Return to camera to continue</div>
                      <div style={{ fontSize: 12, color: tk.muted, marginTop: 4 }}>Timer is paused</div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {q.options.map((opt, i) => (
                <button key={i} onClick={() => handleOptionClick(i)} style={getOptionStyle(i)}
                  onMouseEnter={e => { if (answerState === 'unanswered' && !blocked) e.currentTarget.style.borderColor = '#1D4ED8'; }}
                  onMouseLeave={e => { if (answerState === 'unanswered') e.currentTarget.style.borderColor = tk.border; }}>
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
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                style={{ background: dark ? 'rgba(29,78,216,0.1)' : '#EEF2FF', border: `1px solid ${dark ? 'rgba(29,78,216,0.25)' : '#C7D7FD'}`, borderRadius: 12, padding: '16px 18px', marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#1D4ED8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Explanation</div>
                <p style={{ fontSize: 14, color: dark ? '#93B4FF' : '#1E40AF', lineHeight: 1.65, margin: 0 }}>{q.explanation}</p>
              </motion.div>
            )}

            {answerState === 'wrong' && (
              <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                onClick={() => advanceToNext(selectedOption ?? -1)}
                style={{ width: '100%', padding: '13px', background: '#1D4ED8', color: '#fff', fontWeight: 700, fontSize: 14, borderRadius: 12, border: 'none', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#1E40AF')}
                onMouseLeave={e => (e.currentTarget.style.background = '#1D4ED8')}>
                {currentIdx < questions.length - 1 ? 'Next Question →' : 'See Results →'}
              </motion.button>
            )}

            {answerState === 'correct' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{ textAlign: 'center', fontSize: 13, color: '#059669', fontWeight: 600, padding: '8px 0' }}>
                Correct! Moving to next question...
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}