import { useEffect, useRef, useState } from 'react';
import { useLabStore } from '../../store/useLabStore';
import gsap from 'gsap';

interface ApparatusProps {
  varState: Record<string, number | string>;
  setVarState: React.Dispatch<React.SetStateAction<Record<string, number | string>>>;
  addObservation: (data: any) => void;
}

type Step = 'empty' | 'filled' | 'indicator_added' | 'titrating' | 'done';

const STEP_LABELS: Record<Step, string> = {
  empty:          'Step 1: Fill the conical flask with HCl solution',
  filled:         'Step 2: Add phenolphthalein indicator to the flask',
  indicator_added:'Step 3: Open the burette tap to add NaOH dropwise',
  titrating:      'Step 3: Adding NaOH dropwise — watch for pale pink',
  done:           'Endpoint reached — pale pink persists! Log your reading.',
};

export default function AcidBaseTitration({ varState, addObservation }: ApparatusProps) {
  const NaOH_Molarity = Number(varState.molarity || 0.1);
  const HCl_Volume    = Number(varState.volumeFlask || 20);
  const speed         = Number(varState.speed || 2);

  const { setValidationError } = useLabStore();

  const HCl_Molarity      = 0.15;
  // equivalence: moles HCl = moles NaOH → V_NaOH = (HCl_M * HCl_V) / NaOH_M
  const equivalenceVolume = (HCl_Molarity * HCl_Volume) / NaOH_Molarity;

  const [step, setStep]                     = useState<Step>('empty');
  const [tapped, setTapped]                 = useState(false);
  const [volAdded, setVolAdded]             = useState(0);   // mL NaOH added from burette
  const [flaskFillLevel, setFlaskFillLevel] = useState(0);

  // Multiple drip elements for realistic animation
  const drip1Ref = useRef<SVGEllipseElement>(null);
  const drip2Ref = useRef<SVGEllipseElement>(null);
  const drip3Ref = useRef<SVGEllipseElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const hasIndicator    = step === 'indicator_added' || step === 'titrating' || step === 'done';
  const isTitrating     = step === 'titrating';
  const readingFinished = step === 'done';

  // pH: NaOH dripped into HCl flask
  const calculatePH = (naohAdded: number) => {
    const molesHCl   = (HCl_Molarity  * HCl_Volume) / 1000;
    const molesNaOH  = (NaOH_Molarity * naohAdded)  / 1000;
    const totalVol   = (HCl_Volume    + naohAdded)   / 1000;
    if (naohAdded === 0) return Math.max(0, -Math.log10(HCl_Molarity));
    if (molesNaOH < molesHCl - 0.000001) {
      // excess acid
      return Math.max(0, -Math.log10((molesHCl - molesNaOH) / totalVol));
    } else if (Math.abs(molesNaOH - molesHCl) < 0.000001) {
      return 7.0;
    } else {
      // excess base
      return Math.min(14, 14 + Math.log10((molesNaOH - molesHCl) / totalVol));
    }
  };

  const currentPH = calculatePH(volAdded);

  // Phenolphthalein: colourless in acid (pH<8.2), pink in base (pH>8.2)
  // Flask has HCl → starts COLOURLESS → endpoint = pale pink (just past equivalence)
  const getPinkIntensity = (pH: number) => {
    if (!hasIndicator) return 0;
    if (pH <= 8.2) return 0;                                          // colourless — acid
    if (pH <= 9)   return ((pH - 8.2) / 0.8) * 0.55;                // faint pink near endpoint
    if (pH <= 10)  return 0.55 + ((pH - 9) / 1) * 0.2;              // deeper pink
    return 0.75;
  };
  const pinkIntensity = getPinkIntensity(currentPH);

  // Flask geometry
  const BODY_TOP    = 12;
  const BODY_BOTTOM = 80;
  const BODY_H      = BODY_BOTTOM - BODY_TOP;
  const liquidH     = flaskFillLevel * BODY_H * 0.75;
  const liquidSurfY = BODY_BOTTOM - liquidH;
  const halfW       = (y: number) => 18 + ((y - BODY_TOP) / BODY_H) * (42 - 18);
  const surfHalfW   = halfW(Math.max(BODY_TOP, liquidSurfY));

  // Flask liquid colour: starts colourless (HCl), turns pink past equivalence
  const flaskFillColor = flaskFillLevel > 0
    ? pinkIntensity > 0
      ? `rgba(255, 105, 180, ${pinkIntensity.toFixed(2)})`
      : hasIndicator
        ? 'rgba(220, 235, 255, 0.13)'   // colourless (nearly transparent)
        : 'rgba(200, 225, 255, 0.28)'   // faint blue = HCl solution, no indicator
    : 'transparent';

  // Burette (contains NaOH — faint yellow/clear)
  const BURETTE_TOP    = 38;
  const BURETTE_HEIGHT = 220;
  const buretteLiqH    = Math.max(0, BURETTE_HEIGHT * (1 - volAdded / 50));
  const buretteLiqY    = BURETTE_TOP + (BURETTE_HEIGHT - buretteLiqH);

  // Drip animation using rAF for smooth independent drops
  useEffect(() => {
    if (!tapped || readingFinished) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      [drip1Ref, drip2Ref, drip3Ref].forEach(r => {
        if (r.current) { r.current.setAttribute('opacity', '0'); }
      });
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    // Stagger three drops independently
    const drops = [
      { ref: drip1Ref, offset: 0 },
      { ref: drip2Ref, offset: 0.33 },
      { ref: drip3Ref, offset: 0.66 },
    ];
    const DRIP_TRAVEL = 18; // px from burette tip (cy=302) to flask mouth (315+)
    const cycleDuration = Math.max(300, 900 - speed * 80); // ms per full drop cycle

    let startTime: number | null = null;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;

      drops.forEach(({ ref, offset }) => {
        if (!ref.current) return;
        const phase = ((elapsed / cycleDuration) + offset) % 1;
        if (phase < 0.15) {
          // forming at tip
          const scale = phase / 0.15;
          ref.current.setAttribute('ry', String(3 + scale * 2.5));
          ref.current.setAttribute('cy', '302');
          ref.current.setAttribute('opacity', String(0.5 + scale * 0.4));
        } else if (phase < 0.75) {
          // falling
          const fall = (phase - 0.15) / 0.60;
          ref.current.setAttribute('ry', '4.5');
          ref.current.setAttribute('cy', String(302 + fall * DRIP_TRAVEL));
          ref.current.setAttribute('opacity', String(0.9 - fall * 0.4));
        } else {
          // splashing / hidden
          ref.current.setAttribute('opacity', '0');
          ref.current.setAttribute('cy', '302');
        }
      });

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    // Volume counter
    intervalRef.current = setInterval(() => {
      setVolAdded(prev => {
        const next = +(prev + speed * 0.15).toFixed(2);
        if (next >= 50) { setStep('done'); setTapped(false); return 50; }
        return next;
      });
    }, 200);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [tapped, speed, readingFinished]);

  const handleFillFlask = () => {
    if (step !== 'empty') return;
    const obj = { level: 0 };
    gsap.to(obj, {
      level: 1, duration: 1.2, ease: 'power1.inOut',
      onUpdate: () => setFlaskFillLevel(obj.level),
      onComplete: () => { setFlaskFillLevel(1); setStep('filled'); },
    });
  };

  const handleAddIndicator = () => {
    if (step !== 'filled') return;
    setStep('indicator_added');
  };

  const handleTap = () => {
    if (step === 'empty') {
      setValidationError('Flask Empty', 'Fill the conical flask with HCl first.', "Click 'Fill Flask with HCl' to proceed.");
      return;
    }
    if (step === 'filled') {
      setValidationError('Missing Indicator', 'Add phenolphthalein indicator before titrating.', "Click 'Add Phenolphthalein' to proceed.");
      return;
    }
    if (readingFinished) return;
    if (step === 'indicator_added') setStep('titrating');
    setTapped(t => !t);
  };

  const recordObservation = () => {
    if (step === 'empty' || step === 'filled') {
      setValidationError('Not Ready', 'Complete the setup steps before recording.', 'Fill flask, add indicator, then start titration.');
      return;
    }
    addObservation({
      'Vol NaOH Added (mL)':  +volAdded.toFixed(1),
      'pH':                    +currentPH.toFixed(2),
      'Indicator Color':       hasIndicator ? (currentPH > 8.2 ? 'Pale Pink' : 'Colourless') : 'No indicator',
      'Stage':                 volAdded < equivalenceVolume - 0.5
        ? 'Before eq. point'
        : volAdded > equivalenceVolume + 0.5
          ? 'After eq. point'
          : 'At eq. point',
    });
  };

  const handleReset = () => {
    setTapped(false);
    setVolAdded(0);
    setFlaskFillLevel(0);
    setStep('empty');
  };

  const phColor = currentPH < 3 ? '#ef4444'
    : currentPH < 5  ? '#fb923c'
    : currentPH < 6.5? '#facc15'
    : currentPH < 7.5? '#a3e635'
    : currentPH < 10 ? '#f472b6'
    : '#ec4899';

  const stepDot = (s: Step) => {
    const order: Step[] = ['empty', 'filled', 'indicator_added', 'titrating', 'done'];
    const cur = order.indexOf(step), tgt = order.indexOf(s);
    if (tgt < cur) return 'bg-green-500';
    if (tgt === cur) return 'bg-yellow-400 animate-pulse';
    return 'bg-gray-600';
  };

  const atEndpoint = hasIndicator && Math.abs(volAdded - equivalenceVolume) < 1.5 && volAdded > 0;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative bg-[#02060d] overflow-hidden">

      {/* Live readouts */}
      <div className="absolute top-4 left-4 bg-black/70 border border-gray-700 px-4 py-3 rounded z-10 pointer-events-none">
        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2">Live Readings</div>
        <div className="font-mono text-sm flex flex-col gap-1.5">
          <span className="text-cyan-400">NaOH added: {volAdded.toFixed(1)} mL</span>
          <div className="flex items-center gap-2">
            <span className="text-white">pH: {flaskFillLevel > 0 ? currentPH.toFixed(2) : '—'}</span>
            {flaskFillLevel > 0 && (
              <div className="w-16 h-3 rounded overflow-hidden bg-gray-800">
                <div className="h-full rounded transition-all duration-300"
                  style={{ width: `${(currentPH / 14) * 100}%`, background: phColor }} />
              </div>
            )}
          </div>
          <span className="text-gray-400">NaOH Molarity: {NaOH_Molarity} M</span>
          <span className="text-blue-300">HCl: {HCl_Volume} mL @ {HCl_Molarity} M</span>
          {flaskFillLevel > 0 && (
            <span className="text-yellow-400 border-t border-gray-700 pt-1 mt-1">
              Eq. point ≈ {equivalenceVolume.toFixed(1)} mL
            </span>
          )}
          {hasIndicator && currentPH <= 8.2 && (
            <span className="text-blue-300">○ Colourless — acidic</span>
          )}
          {hasIndicator && currentPH > 8.2 && (
            <span className="text-pink-400 font-bold animate-pulse">● Pale pink — endpoint!</span>
          )}
        </div>
      </div>

      {/* Step banner */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <div className="bg-black/80 border border-yellow-500/40 px-4 py-2 rounded text-xs text-yellow-300 text-center max-w-xs">
          {STEP_LABELS[step]}
        </div>
      </div>

      {/* SVG apparatus */}
      <svg width="320" height="520" viewBox="0 0 200 500" className="overflow-visible">

        {/* Retort stand */}
        <line x1="28" y1="10" x2="28" y2="470" stroke="#334155" strokeWidth="5" strokeLinecap="round" />
        <rect x="8" y="468" width="184" height="12" fill="#475569" rx="3" />
        <rect x="24" y="100" width="44" height="8" fill="#1e293b" rx="2" />
        <rect x="24" y="290" width="44" height="8" fill="#1e293b" rx="2" />

        {/* Burette glass */}
        <path d="M 58 30 L 78 30 L 78 268 L 72 278 L 72 295 L 68 295 L 68 278 L 62 268 Z"
          fill="rgba(255,255,255,0.04)" stroke="#94a3b8" strokeWidth="1.5" />
        <clipPath id="burette-clip">
          <rect x="60" y="30" width="18" height="268" />
        </clipPath>
        {/* NaOH in burette — faint yellow/clear */}
        <rect x="60" y={buretteLiqY} width="18" height={buretteLiqH}
          fill="rgba(200,200,255,0.45)"
          clipPath="url(#burette-clip)"
          style={{ transition: 'y 0.3s, height 0.3s' }} />

        {/* Scale */}
        <g stroke="#475569" strokeWidth="0.75" fill="#64748b" fontSize="5.5" fontFamily="monospace">
          {[0,10,20,30,40,50].map(v => {
            const markY = BURETTE_TOP + (v / 50) * BURETTE_HEIGHT;
            return (
              <g key={v}>
                <line x1="74" y1={markY} x2="78" y2={markY} />
                <text x="81" y={markY + 2} textAnchor="start">{v}</text>
              </g>
            );
          })}
        </g>
        <text x="90" y="34" fill="#64748b" fontSize="5" textAnchor="start">mL NaOH</text>

        {/* Tap */}
        <g onClick={handleTap} style={{ cursor: step === 'indicator_added' || isTitrating ? 'pointer' : 'not-allowed' }}>
          <rect x="64" y="285" width="12" height="14" rx="3"
            fill={tapped ? '#22c55e' : '#ef4444'}
            style={{ transition: 'fill 0.3s' }} />
          <rect x="58" y="289" width="24" height="6" rx="2"
            fill={tapped ? '#16a34a' : '#b91c1c'}
            style={{
              transition: 'fill 0.3s, transform 0.3s',
              transform: tapped ? 'rotate(90deg)' : 'rotate(0deg)',
              transformOrigin: '70px 292px',
            }} />
        </g>

        {/* Three drip drops — animated via rAF */}
        <ellipse ref={drip1Ref} cx="70" cy="302" rx="3" ry="1" fill="rgba(180,180,255,0.9)" opacity="0" />
        <ellipse ref={drip2Ref} cx="70" cy="302" rx="3" ry="1" fill="rgba(180,180,255,0.9)" opacity="0" />
        <ellipse ref={drip3Ref} cx="70" cy="302" rx="3" ry="1" fill="rgba(180,180,255,0.9)" opacity="0" />

        {/* Conical flask */}
        <g transform="translate(70, 315)">
          {flaskFillLevel > 0 && liquidSurfY < BODY_BOTTOM && (
            <>
              <clipPath id="flask-liquid-clip">
                <path d="M -18 12 L 18 12 L 42 80 L -42 80 Z" />
              </clipPath>
              <polygon
                clipPath="url(#flask-liquid-clip)"
                points={`
                  ${-surfHalfW} ${Math.max(BODY_TOP, liquidSurfY)},
                  ${surfHalfW}  ${Math.max(BODY_TOP, liquidSurfY)},
                  42 ${BODY_BOTTOM},
                  -42 ${BODY_BOTTOM}
                `}
                fill={flaskFillColor}
                style={{ transition: 'fill 0.6s ease-out' }}
              />
              <line
                x1={-surfHalfW} y1={Math.max(BODY_TOP, liquidSurfY)}
                x2={surfHalfW}  y2={Math.max(BODY_TOP, liquidSurfY)}
                stroke="rgba(255,255,255,0.15)" strokeWidth="1"
                clipPath="url(#flask-liquid-clip)"
              />
            </>
          )}
          {/* Glass outline on top */}
          <path d="M -18 0 L 18 0 L 18 12 L 42 80 L -42 80 L -18 12 Z"
            fill="rgba(255,255,255,0.03)" stroke="#94a3b8" strokeWidth="1.8" />
          <text x="0" y="52" fill="rgba(255,255,255,0.12)" fontSize="7" textAnchor="middle">HCl</text>
        </g>

        {/* 20 mL marker */}
        <line x1="32" y1="360" x2="36" y2="360" stroke="#475569" strokeWidth="0.75" />
        <text x="30" y="363" fill="#475569" fontSize="5" textAnchor="end">20mL</text>

        {/* Status labels */}
        {hasIndicator && currentPH <= 8.2 && volAdded > 0 && (
          <text x="70" y="455" fill="#93c5fd" fontSize="8" textAnchor="middle">Colourless — still acidic</text>
        )}
        {hasIndicator && currentPH > 8.2 && (
          <text x="70" y="455" fill="#f472b6" fontSize="8" textAnchor="middle" fontWeight="bold">
            Pale pink — endpoint! (pH {currentPH.toFixed(1)})
          </text>
        )}
        {atEndpoint && (
          <text x="70" y="466" fill="#fbbf24" fontSize="7" textAnchor="middle">≈ Equivalence point</text>
        )}
      </svg>

      {/* Control panel */}
      <div className="absolute top-16 right-4 bg-black/85 px-4 py-3 border border-gray-700 rounded flex flex-col gap-2 min-w-[210px] z-20">
        <div className="flex items-center justify-between mb-1">
          {(['empty','filled','indicator_added','titrating','done'] as Step[]).map((s,i) => (
            <div key={s} className="flex items-center gap-1">
              <div className={`w-2.5 h-2.5 rounded-full ${stepDot(s)}`} />
              {i < 4 && <div className="w-4 h-px bg-gray-700" />}
            </div>
          ))}
        </div>

        <div className="text-center text-sm border-b border-gray-700 pb-2">
          <span className="text-gray-400">Equiv. point: </span>
          <span className="text-pink-400 font-bold">{equivalenceVolume.toFixed(1)} mL NaOH</span>
        </div>

        <button onClick={handleFillFlask} disabled={step !== 'empty'}
          className="w-full py-2 bg-sky-500/20 text-sky-300 border border-sky-500/50 hover:bg-sky-500/30 rounded font-bold text-sm disabled:opacity-40 transition-colors">
          {step !== 'empty' ? '✓ Flask Filled' : '① Fill Flask with HCl'}
        </button>

        <button onClick={handleAddIndicator} disabled={step !== 'filled'}
          className="w-full py-2 bg-pink-500/20 text-pink-400 border border-pink-500/50 hover:bg-pink-500/30 rounded font-bold text-sm disabled:opacity-40 transition-colors">
          {hasIndicator ? '✓ Indicator Added' : '② Add Phenolphthalein'}
        </button>

        <button onClick={handleTap} disabled={readingFinished || (step !== 'indicator_added' && step !== 'titrating')}
          className="w-full py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/30 rounded font-bold text-sm disabled:opacity-40 transition-colors">
          {tapped ? '⏸ ③ Stop NaOH drip' : '▶ ③ Add NaOH dropwise'}
        </button>

        <button onClick={recordObservation}
          className="w-full py-2 bg-blue-500/20 text-blue-400 border border-blue-500/50 hover:bg-blue-500/30 rounded font-bold text-sm transition-colors">
          Log Vol & pH
        </button>

        <button onClick={handleReset}
          className="w-full py-2 bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30 rounded font-bold text-sm transition-colors">
          ↺ Reset Experiment
        </button>

        {readingFinished && (
          <div className="text-xs text-yellow-400 text-center mt-1">Burette empty — reset to repeat</div>
        )}

        <div className="border-t border-gray-700 pt-2 mt-1">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Phenolphthalein endpoint</div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full border border-gray-500 bg-transparent" />
            <span className="text-gray-400">Colourless = acidic (pH &lt; 8.2)</span>
          </div>
          <div className="flex items-center gap-2 text-xs mt-1">
            <div className="w-3 h-3 rounded-full bg-pink-400" />
            <span className="text-gray-400">Pale pink = endpoint (pH &gt; 8.2)</span>
          </div>
        </div>
      </div>
    </div>
  );
}