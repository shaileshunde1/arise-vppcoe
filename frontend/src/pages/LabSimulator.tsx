import { useState, useEffect, useRef, Suspense, lazy, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { experiments } from '../data/experiments';
import { useLabStore } from '../store/useLabStore';

const apparatusMap: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {
  'simple-pendulum':      lazy(() => import('../components/apparatus/SimplePendulum')),
  'ohms-law':             lazy(() => import('../components/apparatus/OhmsLaw')),
  'projectile-motion':    lazy(() => import('../components/apparatus/ProjectileMotion')),
  'prism-refraction':     lazy(() => import('../components/apparatus/PrismRefraction')),
  'magnetic-field':       lazy(() => import('../components/apparatus/MagneticField')),
  'acid-base-titration':  lazy(() => import('../components/apparatus/AcidBaseTitration')),
  'electrolysis-water':   lazy(() => import('../components/apparatus/ElectrolysisWater')),
  'flame-test':           lazy(() => import('../components/apparatus/FlameTest')),
  'le-chatelier':         lazy(() => import('../components/apparatus/LeChatelier')),
  'paper-chromatography': lazy(() => import('../components/apparatus/PaperChromatography')),
};

// ── Proctoring constants ─────────────────────────────────────
const MAX_TAB_VIOLATIONS = 2;

function buildInsightPrompt(expTitle: string, expId: string, data: any[]): string {
  const dataStr = data.map((d, i) =>
    `Point ${i + 1}: ${Object.entries(d).map(([k, v]) => `${k}=${typeof v === 'number' ? (v as number).toFixed(3) : v}`).join(', ')}`
  ).join('\n');

  const context: Record<string, string> = {
    'simple-pendulum':      'Simple Pendulum: T = 2π√(L/g), T² ∝ L.',
    'ohms-law':             "Ohm's Law: linear V vs I, slope = resistance R.",
    'projectile-motion':    'Projectile Motion: max range at 45°.',
    'prism-refraction':     "Prism Refraction: Snell's law n₁sinθ₁ = n₂sinθ₂.",
    'magnetic-field':       'Magnetic Field: field strength vs distance from wire.',
    'acid-base-titration':  'Acid-Base Titration: S-curve pH vs titrant volume.',
    'electrolysis-water':   'Electrolysis: H₂:O₂ volume ratio should be 2:1.',
    'flame-test':           'Flame Test: characteristic colours for metal ions.',
    'le-chatelier':         "Le Chatelier: equilibrium shifts under stress.",
    'paper-chromatography': 'Paper Chromatography: Rf values for compounds.',
  };

  return `You are an AI science tutor analyzing a student's lab experiment data in real time.

${context[expId] || `This is the ${expTitle} experiment.`}

The student has recorded the following ${data.length} observations:
${dataStr}

Analyze this data and provide a concise insight (2-3 sentences max) that:
1. Identifies the pattern or trend in the data
2. Confirms whether it matches the expected theoretical relationship
3. Gives one specific numerical insight (e.g. calculated slope, ratio, or coefficient)

Be encouraging, precise, and use scientific terminology appropriate for Class 11-12 students.
Do NOT use markdown formatting, bullet points, or headers. Just plain conversational sentences.`;
}

export default function LabSimulator() {
  const { experimentId } = useParams();
  const navigate         = useNavigate();
  const exp              = experiments.find(e => e.id === experimentId);
  const containerRef     = useRef<HTMLDivElement>(null);

  const {
    observationData, completedSteps, markStepComplete, addObservation,
    resetLabProgress, setHasAdjustedSlider, setValidationError, saveToJournal,
  } = useLabStore();

  const [activeAccordion, setActiveAccordion] = useState<number>(1);
  const [timer,           setTimer]           = useState(0);
  const [showResults,     setShowResults]     = useState(false);
  const [varState,        setVarState]        = useState<Record<string, number | string>>({});

  // AI Insight
  const [aiInsight,  setAiInsight]  = useState<string>('');
  const [aiLoading,  setAiLoading]  = useState(false);
  const lastAnalyzedCount = useRef(0);

  // ── Fullscreen ───────────────────────────────────────────────
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPaused,     setIsPaused]     = useState(false);
  const [fsRequested,  setFsRequested]  = useState(false);

  // ── Tab-switch ───────────────────────────────────────────────
  const tabViolationsRef    = useRef(0);
  const [tabWarning,        setTabWarning]        = useState(false);
  const [tabCountdown,      setTabCountdown]       = useState(10);
  const [tabAutoSubmitting, setTabAutoSubmitting]  = useState(false);
  const tabAutoSubmitRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  // snapshot ref so callbacks always have fresh values
  const snapshotRef = useRef<{
    currentData: any[];
    timer: number;
    scoreTotal: number;
    currentSteps: number[];
  }>({ currentData: [], timer: 0, scoreTotal: 0, currentSteps: [] });

  // ────────────────────────────────────────────────────────────
  // Init: set variable defaults + enter fullscreen
  // ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!exp) { navigate('/labs'); return; }
    const initialVars: Record<string, number | string> = {};
    exp.variables.forEach(v => { initialVars[v.id] = v.defaultValue; });
    setVarState(initialVars);

    const t = setTimeout(() => {
      enterFullscreen();
      setFsRequested(true);
    }, 200);
    return () => clearTimeout(t);
  }, [exp, navigate]);

  // ────────────────────────────────────────────────────────────
  // Fullscreen helpers
  // ────────────────────────────────────────────────────────────
  const enterFullscreen = () => {
    const el = containerRef.current || document.documentElement;
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
      if (!inFs && fsRequested) setIsPaused(true);
    };
    document.addEventListener('fullscreenchange',       handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange',       handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, [fsRequested]);

  // ────────────────────────────────────────────────────────────
  // Alt-tab detection
  // ────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleBlur = () => {
      if (showResults) return;
      setIsPaused(true);
      tabViolationsRef.current += 1;

      if (tabViolationsRef.current >= MAX_TAB_VIOLATIONS) {
        setTabAutoSubmitting(true);
        setTabWarning(true);
        setTabCountdown(10);
        if (tabAutoSubmitRef.current) clearInterval(tabAutoSubmitRef.current);
        tabAutoSubmitRef.current = setInterval(() => {
          setTabCountdown(prev => {
            if (prev <= 1) {
              clearInterval(tabAutoSubmitRef.current!);
              const snap = snapshotRef.current;
              if (exp && snap.currentData.length > 0) {
                saveToJournal({
                  experimentId: exp.id,
                  lab: exp.title,
                  date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
                  timeSeconds: snap.timer,
                  score: snap.scoreTotal,
                  observations: snap.currentData,
                  completedSteps: snap.currentSteps,
                });
              }
              resetLabProgress(exp!.id);
              exitFullscreenAPI();
              navigate('/labs');
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        setTabWarning(true);
      }
    };

    const handleFocus = () => {
      if (tabViolationsRef.current < MAX_TAB_VIOLATIONS) {
        setTabWarning(false);
        setIsPaused(false);
      }
    };

    window.addEventListener('blur',  handleBlur);
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('blur',  handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [showResults, exp, navigate, resetLabProgress, saveToJournal]);

  // Cleanup
  useEffect(() => () => {
    if (tabAutoSubmitRef.current) clearInterval(tabAutoSubmitRef.current);
    if (document.fullscreenElement) exitFullscreenAPI();
  }, []);

  // ────────────────────────────────────────────────────────────
  // Timer (pauses when isPaused or tabWarning)
  // ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isPaused || tabWarning || showResults) return;
    const interval = setInterval(() => setTimer(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [isPaused, tabWarning, showResults]);

  // ────────────────────────────────────────────────────────────
  // AI Insight
  // ────────────────────────────────────────────────────────────
  const fetchAiInsight = useCallback(async (data: any[]) => {
    if (!exp || data.length < 3 || aiLoading) return;
    if (data.length < lastAnalyzedCount.current + 2 && lastAnalyzedCount.current > 0) return;
    setAiLoading(true);
    lastAnalyzedCount.current = data.length;
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{ role: 'user', content: buildInsightPrompt(exp.title, exp.id, data) }],
        }),
      });
      const result = await response.json();
      if (result.content?.[0]?.text) setAiInsight(result.content[0].text);
    } catch {
      setAiInsight('Unable to analyze data at this time. Continue recording observations.');
    } finally {
      setAiLoading(false);
    }
  }, [exp, aiLoading]);

  if (!exp) return null;

  const currentData  = observationData[exp.id] || [];
  const currentSteps = completedSteps[exp.id]  || [];
  const ApparatusComponent = apparatusMap[exp.id];

  const scoreCompletion = Math.round((currentSteps.length / exp.procedure.length) * exp.scoring.completion);
  const scoreAccuracy   = Math.round(exp.scoring.accuracy * 0.9);
  const scoreTotal      = scoreCompletion + scoreAccuracy + exp.scoring.time;

  // Keep snapshot ref up to date
  snapshotRef.current = { currentData, timer, scoreTotal, currentSteps };

  // Trigger AI when data grows
  useEffect(() => {
    if (currentData.length >= 3) fetchAiInsight(currentData);
  }, [currentData.length]);

  const handleVariableChange = (id: string, value: number | string) => {
    setVarState(prev => ({ ...prev, [id]: value }));
    setHasAdjustedSlider(exp.id, true);
  };

  const handleReset = () => {
    resetLabProgress(exp.id);
    setTimer(0);
    setAiInsight('');
    lastAnalyzedCount.current = 0;
    const initialVars: Record<string, number | string> = {};
    exp.variables.forEach(v => { initialVars[v.id] = v.defaultValue; });
    setVarState(initialVars);
  };

  const handleResumeFullscreen = () => { enterFullscreen(); setIsPaused(false); };
  const handleResumeFromTab    = () => { setTabWarning(false); setIsPaused(false); };

  // ────────────────────────────────────────────────────────────
  // MAIN LAB UI
  // ────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} className="h-screen w-screen bg-[#02060d] text-gray-200 flex flex-col font-sans overflow-hidden" style={{ position: 'relative' }}>

      {/* ── Tab-switch warning overlay ──────────────────────── */}
      <AnimatePresence>
        {tabWarning && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'absolute', inset: 0, zIndex: 250, background: 'rgba(2,6,13,0.97)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}
          >
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(220,38,38,0.15)', border: '2px solid rgba(220,38,38,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
              </svg>
            </div>
            <div style={{ textAlign: 'center', maxWidth: 400 }}>
              <div style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, color: '#DC2626', background: 'rgba(220,38,38,0.15)', padding: '3px 12px', borderRadius: 999, marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Tab Switch #{tabViolationsRef.current}
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#F0F0F0', marginBottom: 10 }}>
                {tabAutoSubmitting ? '⚠ Final Warning — Experiment Ending' : 'Window Switch Detected'}
              </h2>
              <p style={{ fontSize: 15, color: '#8890A4', lineHeight: 1.7, marginBottom: 6 }}>
                {tabAutoSubmitting
                  ? 'Too many tab switches detected. Your experiment will be automatically submitted.'
                  : 'You switched away from this window. Your experiment has been paused. Return to continue.'}
              </p>
              {tabAutoSubmitting ? (
                <>
                  <div style={{ fontSize: 52, fontWeight: 800, color: '#DC2626', fontFamily: 'monospace', margin: '16px 0 4px' }}>{tabCountdown}</div>
                  <p style={{ fontSize: 13, color: '#525870' }}>Submitting in {tabCountdown} second{tabCountdown !== 1 ? 's' : ''}</p>
                </>
              ) : (
                <p style={{ fontSize: 13, color: '#525870' }}>
                  Warning {tabViolationsRef.current} of {MAX_TAB_VIOLATIONS}. One more switch will submit the experiment.
                </p>
              )}
            </div>
            {!tabAutoSubmitting && (
              <button
                onClick={handleResumeFromTab}
                style={{ padding: '13px 32px', background: '#1D4ED8', color: '#fff', fontWeight: 700, fontSize: 15, borderRadius: 12, border: 'none', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#1E40AF')}
                onMouseLeave={e => (e.currentTarget.style.background = '#1D4ED8')}
              >
                Resume Experiment
              </button>
            )}
            {!tabAutoSubmitting && (
              <button
                onClick={() => { if (exp) resetLabProgress(exp.id); exitFullscreenAPI(); navigate('/labs'); }}
                style={{ background: 'none', border: 'none', color: '#525870', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}
              >
                Exit experiment (progress will be lost)
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Fullscreen-exit paused overlay ──────────────────── */}
      <AnimatePresence>
        {isPaused && !tabWarning && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'absolute', inset: 0, zIndex: 200, background: 'rgba(2,6,13,0.97)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}
          >
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(220,38,38,0.15)', border: '2px solid rgba(220,38,38,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div style={{ textAlign: 'center', maxWidth: 400 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#F0F0F0', marginBottom: 10 }}>Experiment Paused</h2>
              <p style={{ fontSize: 15, color: '#8890A4', lineHeight: 1.7, marginBottom: 6 }}>You exited fullscreen. Re-enter fullscreen to continue your experiment.</p>
              <p style={{ fontSize: 13, color: '#525870' }}>Your progress is saved.</p>
            </div>
            <button
              onClick={handleResumeFullscreen}
              style={{ padding: '13px 32px', background: '#1D4ED8', color: '#fff', fontWeight: 700, fontSize: 15, borderRadius: 12, border: 'none', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#1E40AF')}
              onMouseLeave={e => (e.currentTarget.style.background = '#1D4ED8')}
            >
              Return to Fullscreen
            </button>
            <button
              onClick={() => { exitFullscreenAPI(); navigate('/labs'); }}
              style={{ background: 'none', border: 'none', color: '#525870', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}
            >
              Exit experiment (progress will be lost)
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Top Bar ─────────────────────────────────────────── */}
      <header className="h-14 border-b border-gray-800 flex items-center justify-between px-6 bg-[#050d1a] z-50 shrink-0 shadow-md">
        <div className="flex items-center gap-4">
          <Link
            to="/labs"
            onClick={() => { if (document.fullscreenElement) exitFullscreenAPI(); }}
            className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          </Link>
          <h1 className="font-heading font-bold text-white text-lg">{exp.title}</h1>
          <span className="text-xs text-gray-400 border border-gray-700 bg-gray-900 px-2 py-1 rounded">{exp.ncert}</span>
        </div>
        <div className="flex items-center gap-4">
          {tabViolationsRef.current > 0 && (
            <div style={{ fontSize: 12, fontWeight: 700, color: '#DC2626', background: 'rgba(220,38,38,0.1)', padding: '3px 10px', borderRadius: 999 }}>
              ⚠ {tabViolationsRef.current} tab switch{tabViolationsRef.current > 1 ? 'es' : ''}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: isFullscreen ? '#059669' : '#DC2626' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: isFullscreen ? '#059669' : '#DC2626', display: 'inline-block' }}></span>
            {isFullscreen ? 'Fullscreen' : 'Not Fullscreen'}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> {timer}s
          </div>
          {!isFullscreen && (
            <button
              onClick={enterFullscreen}
              style={{ padding: '4px 12px', background: 'rgba(29,78,216,0.2)', border: '1px solid rgba(29,78,216,0.4)', color: '#93B4FF', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              Enter Fullscreen
            </button>
          )}
        </div>
      </header>

      {/* ── Main Layout ─────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left Panel */}
        <div className="w-[28%] border-r border-gray-800 bg-[#080f1c] flex flex-col overflow-y-auto scrollbar-thin shadow-xl relative z-20">
          <div className="p-6 space-y-6">
            <div>
              <h2 className="text-sm font-bold text-accent-cyan tracking-widest uppercase mb-2">Aim</h2>
              <p className="text-sm text-gray-300 leading-relaxed bg-black/30 p-4 border border-white/5 rounded-lg">{exp.aim}</p>
            </div>
            <div className="border border-white/10 rounded-lg overflow-hidden">
              <button
                onClick={() => setActiveAccordion(0)}
                className="w-full flex justify-between items-center p-4 bg-white/5 hover:bg-white/10 transition-colors text-sm font-bold uppercase tracking-wider text-gray-200"
              >
                Theory & Apparatus <span>{activeAccordion === 0 ? '-' : '+'}</span>
              </button>
              <AnimatePresence>
                {activeAccordion === 0 && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden bg-black/20">
                    <div className="p-4 text-sm text-gray-300 leading-relaxed border-t border-white/5 space-y-4">
                      <p>{exp.theory}</p>
                      <div>
                        <strong className="text-accent-cyan">Apparatus List:</strong>
                        <ul className="list-disc pl-5 mt-2 opacity-80">{exp.apparatus.map((item: string) => <li key={item}>{item}</li>)}</ul>
                      </div>
                      <div>
                        <strong className="text-yellow-500">Safety Notes:</strong>
                        <ul className="list-disc pl-5 mt-2 opacity-80 text-yellow-500/80">{exp.safetyNotes.map((item: string) => <li key={item}>{item}</li>)}</ul>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="border border-white/10 rounded-lg overflow-hidden shadow-[0_0_15px_rgba(0,212,255,0.05)]">
              <button
                onClick={() => setActiveAccordion(1)}
                className="w-full flex justify-between items-center p-4 bg-accent-cyan/10 hover:bg-accent-cyan/20 border-b border-accent-cyan/20 transition-colors text-sm font-bold uppercase tracking-wider text-accent-cyan"
              >
                Procedure Steps <span>{activeAccordion === 1 ? '-' : '+'}</span>
              </button>
              <AnimatePresence>
                {activeAccordion === 1 && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden bg-[#0a1428]">
                    <div className="p-4 space-y-3">
                      {exp.procedure.map((step: string, idx: number) => {
                        const isComplete = currentSteps.includes(idx);
                        return (
                          <div key={idx} className={`p-3 rounded-lg border transition-all ${isComplete ? 'border-accent-cyan/50 bg-accent-cyan/10' : 'border-white/10 bg-black/40'}`}>
                            <div className="flex gap-3 text-sm items-start">
                              <span className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold font-mono transition-colors ${isComplete ? 'bg-accent-cyan text-black' : 'bg-gray-800 text-gray-400'}`}>{idx + 1}</span>
                              <span className={`pt-1 leading-relaxed ${isComplete ? 'text-gray-200' : 'text-gray-400'}`}>{step}</span>
                            </div>
                            {!isComplete && (
                              <button
                                onClick={() => {
                                  if (idx > 0 && !currentSteps.includes(idx - 1)) {
                                    setValidationError("Step Skipped", "The scientific method requires following the procedural sequence exactly.", `Please complete step ${idx} before moving on to this step.`);
                                    return;
                                  }
                                  markStepComplete(exp.id, idx);
                                }}
                                className="mt-3 ml-9 text-xs px-3 py-1.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition-colors"
                              >
                                Mark Step Complete
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Center Panel */}
        <div className="w-[44%] flex flex-col bg-black relative z-10 border-r border-gray-800">
          <div className="flex-1 relative overflow-hidden bg-gradient-to-b from-[#0a1128] to-black border-b border-gray-800 flex items-center justify-center">
            <Suspense fallback={<div className="text-accent-cyan animate-pulse">Loading Apparatus...</div>}>
              {ApparatusComponent && !isPaused && !tabWarning && (
                <ApparatusComponent
                  varState={varState}
                  setVarState={setVarState}
                  addObservation={(data: any) => addObservation(exp.id, data)}
                />
              )}
            </Suspense>
            {!isPaused && !tabWarning && (
              <button
                onClick={handleReset}
                className="absolute top-4 right-4 text-xs px-3 py-1.5 bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 rounded transition-all z-50"
              >
                Reset Apparatus
              </button>
            )}
          </div>
          <div className="bg-[#050d1a] border-b border-gray-800 p-4 shrink-0 flex items-center justify-center gap-8 overflow-x-auto shadow-inner">
            {exp.variables.map((v: any) => (
              <div key={v.id} className="min-w-[140px] flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs text-gray-400 font-bold uppercase tracking-wider">{v.name}</label>
                  <span className="text-xs font-mono text-accent-cyan">{varState[v.id] ?? v.defaultValue} {v.unit}</span>
                </div>
                {v.options ? (
                  <select
                    value={varState[v.id] ?? v.defaultValue}
                    onChange={e => handleVariableChange(v.id, e.target.value)}
                    className="w-full bg-black border border-gray-700 rounded text-sm px-2 py-1 outline-none focus:border-accent-cyan text-white"
                    disabled={isPaused || tabWarning}
                  >
                    {v.options.map((opt: any) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                ) : (
                  <input
                    type="range"
                    min={v.min} max={v.max} step={v.step}
                    value={varState[v.id] ?? v.defaultValue}
                    onChange={e => handleVariableChange(v.id, parseFloat(e.target.value))}
                    className="w-full accent-accent-cyan"
                    disabled={isPaused || tabWarning}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="h-48 bg-[#080f1c] shrink-0 overflow-y-auto w-full">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="sticky top-0 bg-[#0a1428] border-b border-gray-800 shadow-md">
                <tr>
                  <th className="p-3 text-gray-500 font-mono font-bold w-12">#</th>
                  {currentData[0] ? Object.keys(currentData[0]).map(key => (
                    <th key={key} className="p-3 text-gray-300 font-bold capitalize">{key}</th>
                  )) : <th className="p-3 text-gray-500 font-bold">Waiting for recorded observations...</th>}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {currentData.map((row: any, i: number) => (
                    <motion.tr
                      initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                      key={i}
                      className="border-b border-gray-800 hover:bg-white/5 transition-colors"
                    >
                      <td className="p-3 font-mono text-gray-500">{i + 1}</td>
                      {Object.values(row).map((val: any, j: number) => (
                        <td key={j} className="p-3 text-accent-cyan font-mono">{typeof val === 'number' ? val.toFixed(3) : val}</td>
                      ))}
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Panel */}
        <div className="w-[28%] bg-[#050d1a] flex flex-col relative z-20">

          {/* Chart */}
          <div className="flex-1 border-b border-gray-800 p-4 flex flex-col">
            <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-2">{exp.chartLabel.title}</h3>
            <div className="flex-1 bg-black rounded-lg border border-gray-800 overflow-hidden relative shadow-inner">
              {currentData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={currentData.map((d: any) => ({ x: d.x ?? d[Object.keys(d)[0]], y: d.y ?? d[Object.keys(d)[1]] }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="x"
                      label={{ value: exp.chartLabel.x, position: 'insideBottom', offset: -5, fill: '#94a3b8', fontSize: 10 }}
                      tick={{ fill: '#94a3b8', fontSize: 10 }}
                    />
                    <YAxis
                      label={{ value: exp.chartLabel.y, angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 10 }}
                      tick={{ fill: '#94a3b8', fontSize: 10 }}
                    />
                    <Tooltip
                      contentStyle={{ background: '#0a1428', border: '1px solid #1e293b', borderRadius: 8 }}
                      labelStyle={{ color: '#94a3b8' }}
                      itemStyle={{ color: exp.subject === 'physics' ? '#00d4ff' : '#22c55e' }}
                    />
                    <Line
                      type="monotone" dataKey="y"
                      stroke={exp.subject === 'physics' ? '#00d4ff' : '#22c55e'}
                      strokeWidth={2}
                      dot={{ fill: exp.subject === 'physics' ? '#00d4ff' : '#22c55e', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-xs text-center p-6">
                  Interact with the apparatus and record observations to generate the {exp.chartType} plot.
                </div>
              )}
            </div>

            {/* AI Insight */}
            <div style={{
              marginTop: 12, background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.25)',
              borderRadius: 10, padding: '10px 12px', transition: 'border-color 0.3s',
              ...(aiLoading ? { borderColor: 'rgba(124,58,237,0.5)' } : {}),
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#A78BFA', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span>✨</span> AI Data Insight
                </div>
                {currentData.length >= 3 && <span style={{ fontSize: 9, color: '#6D28D9', fontWeight: 600 }}>{currentData.length} pts</span>}
              </div>
              {currentData.length < 3 ? (
                <p style={{ fontSize: 11, color: '#6D5C8A', lineHeight: 1.6, margin: 0 }}>Record at least 3 observations to unlock AI analysis of your data.</p>
              ) : aiLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid #7C3AED', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', flexShrink: 0 }}></div>
                  <p style={{ fontSize: 11, color: '#8B5CF6', lineHeight: 1.6, margin: 0 }}>Analyzing your data...</p>
                </div>
              ) : aiInsight ? (
                <AnimatePresence mode="wait">
                  <motion.p
                    key={aiInsight.slice(0, 20)}
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                    style={{ fontSize: 11, color: '#C4B5FD', lineHeight: 1.7, margin: 0 }}
                  >
                    {aiInsight}
                  </motion.p>
                </AnimatePresence>
              ) : (
                <p style={{ fontSize: 11, color: '#6D5C8A', lineHeight: 1.6, margin: 0 }}>Preparing analysis...</p>
              )}
            </div>
          </div>

          {/* Score Tracker */}
          <div className="p-6 shrink-0 bg-[#080f1c]">
            <h3 className="text-sm font-bold text-white uppercase mb-4">Live Score Tracker</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Procedure Completion</span><span>{scoreCompletion} / {exp.scoring.completion}</span>
                </div>
                <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                  <motion.div className="h-full bg-accent-cyan" initial={{ width: 0 }} animate={{ width: `${(scoreCompletion / exp.scoring.completion) * 100}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Accuracy</span><span>{scoreAccuracy} / {exp.scoring.accuracy}</span>
                </div>
                <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                  <motion.div className="h-full bg-emerald-500" initial={{ width: 0 }} animate={{ width: `${(scoreAccuracy / exp.scoring.accuracy) * 100}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Bar ──────────────────────────────────────── */}
      <div className="h-16 border-t border-gray-800 bg-[#050d1a] shadow-[0_-10px_20px_rgba(0,0,0,0.5)] flex items-center justify-between px-6 z-50 shrink-0 relative">
        <div className="flex items-center gap-4 text-sm font-bold text-gray-300">
          Progress: <span className="text-accent-cyan">{currentSteps.length} of {exp.procedure.length} Steps Completed</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            disabled={isPaused || tabWarning}
            onClick={() => {
              if (currentData.length === 0) {
                setValidationError('No Data to Save', 'You have not recorded any observations yet.', 'Record at least one observation before saving to your journal.');
                return;
              }
              saveToJournal({
                experimentId: exp.id,
                lab: exp.title,
                date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
                timeSeconds: timer,
                score: scoreTotal,
                observations: currentData,
                completedSteps: currentSteps,
              });
              setValidationError('Saved to Journal ✓', 'Your observations have been recorded.', 'View them anytime in My Lab Journal.');
            }}
            className="px-4 py-2 border border-accent-cyan/50 text-accent-cyan bg-accent-cyan/10 hover:bg-accent-cyan/20 text-sm font-bold rounded transition-colors hidden lg:block disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save to Journal
          </button>
          <button
            disabled={isPaused || tabWarning}
            onClick={() => {
              if (currentData.length < 3) {
                setValidationError("Incomplete Data", "You need more data points to establish a reliable relationship or pattern.", "A minimum of three observations must be recorded before you can submit your data.");
                return;
              }
              setShowResults(true);
            }}
            className="px-8 py-2 bg-accent-cyan hover:bg-[#00b3d6] text-black text-sm font-bold rounded shadow-[0_0_15px_rgba(0,212,255,0.4)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Submit Experiment
          </button>
        </div>
      </div>

      {/* ── Results Modal ────────────────────────────────────── */}
      <AnimatePresence>
        {showResults && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-md bg-[#0a1428] border border-gray-700 rounded-xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-gray-800 flex flex-col items-center">
                <div className="w-24 h-24 rounded-full border-4 border-accent-cyan bg-accent-cyan/10 flex items-center justify-center text-4xl font-bold font-heading text-white shadow-[0_0_30px_rgba(0,212,255,0.3)] mb-4">
                  {scoreTotal}
                </div>
                <h2 className="text-xl font-heading font-bold text-white uppercase">Experiment Complete</h2>
                <p className="text-sm text-gray-400">Your lab report has been automatically scored.</p>
                {tabViolationsRef.current > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#DC2626', background: 'rgba(220,38,38,0.1)', padding: '4px 12px', borderRadius: 999 }}>
                      {tabViolationsRef.current} tab switch{tabViolationsRef.current > 1 ? 'es' : ''} recorded
                    </div>
                  </div>
                )}
              </div>
              {aiInsight && (
                <div className="px-6 pt-4 pb-0">
                  <div style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 10, padding: '10px 14px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#A78BFA', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>✨ AI Analysis</div>
                    <p style={{ fontSize: 12, color: '#C4B5FD', lineHeight: 1.65, margin: 0 }}>{aiInsight}</p>
                  </div>
                </div>
              )}
              <div className="p-6 bg-[#050d1a] space-y-4 mt-4">
                <div className="flex justify-between text-sm text-gray-300"><span>Completion Score:</span><span className="font-mono text-accent-cyan">+{scoreCompletion} pts</span></div>
                <div className="flex justify-between text-sm text-gray-300"><span>Data Accuracy:</span><span className="font-mono text-emerald-400">+{scoreAccuracy} pts</span></div>
                <div className="flex justify-between text-sm text-gray-300"><span>Time Efficiency:</span><span className="font-mono text-yellow-400">+{exp.scoring.time} pts</span></div>
              </div>
              <div className="p-4 border-t border-gray-800 flex gap-4">
                <button
                  onClick={() => { setShowResults(false); handleReset(); exitFullscreenAPI(); }}
                  className="flex-1 py-2 rounded text-sm font-bold bg-white/5 hover:bg-white/10 text-gray-300 transition-colors"
                >
                  Try Again
                </button>
                <button
                  onClick={() => { exitFullscreenAPI(); navigate('/labs'); }}
                  className="flex-1 py-2 rounded text-sm font-bold bg-accent-violet hover:bg-[#6b21a8] text-white shadow-[0_0_15px_rgba(124,58,237,0.4)] transition-colors"
                >
                  Next Lab
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}