import { useEffect, useRef, useState } from 'react';
import { useLabStore } from '../../store/useLabStore';
import gsap from 'gsap';

interface ApparatusProps {
  varState: Record<string, number | string>;
  setVarState: React.Dispatch<React.SetStateAction<Record<string, number | string>>>;
  addObservation: (data: any) => void;
}

// Lab steps that match the left-panel instructions
type Step = 'empty' | 'filled' | 'indicator_added' | 'titrating' | 'done';

const STEP_LABELS: Record<Step, string> = {
  empty:          'Step 1: Fill the conical flask with NaOH solution',
  filled:         'Step 2: Add phenolphthalein indicator to the flask',
  indicator_added:'Step 3: Open the burette tap to begin titration',
  titrating:      'Step 3: Titrating — watch for colour change',
  done:           'Titration complete — log your reading and reset to repeat',
};

export default function AcidBaseTitration({ varState, addObservation }: ApparatusProps) {
  const HCl_Molarity = Number(varState.molarity || 0.1);
  const NaOH_Volume  = Number(varState.volumeFlask || 20);
  const speed        = Number(varState.speed || 2);

  const { setValidationError } = useLabStore();

  const NaOH_Molarity     = 0.15;
  const equivalenceVolume = (NaOH_Volume * NaOH_Molarity) / HCl_Molarity;

  // FIX 1: Proper step-by-step state instead of scattered booleans
  const [step, setStep]           = useState<Step>('empty');
  const [tapped, setTapped]       = useState(false);
  const [volAdded, setVolAdded]   = useState(0);
  // FIX 2: flaskFillLevel 0→1 animates the NaOH being poured in
  const [flaskFillLevel, setFlaskFillLevel] = useState(0);

  const dripRef     = useRef<SVGGElement>(null);
  const dripAnim    = useRef<gsap.core.Tween | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasIndicator    = step === 'indicator_added' || step === 'titrating' || step === 'done';
  const isTitrating     = step === 'titrating';
  const readingFinished = step === 'done';

  // pH calculation: HCl (acid) is dripped into NaOH (base) in flask
  const calculatePH = (added: number) => {
    if (flaskFillLevel < 1) return 14 + Math.log10(NaOH_Molarity); // pre-fill, show base pH
    const molesOH    = (NaOH_Molarity * NaOH_Volume) / 1000;
    const molesHPlus = (HCl_Molarity  * added)       / 1000;
    const totalVol   = (NaOH_Volume   + added)        / 1000;
    if (added === 0) return 14 + Math.log10(NaOH_Molarity);
    if (molesOH > molesHPlus + 0.000001) {
      return Math.min(14, 14 + Math.log10((molesOH - molesHPlus) / totalVol));
    } else if (Math.abs(molesOH - molesHPlus) < 0.000001) {
      return 7.0;
    } else {
      return Math.max(0, -Math.log10((molesHPlus - molesOH) / totalVol));
    }
  };

  const currentPH = calculatePH(volAdded);

  // Phenolphthalein: pink above pH 8.2, colourless below
  const getPinkIntensity = (pH: number) => {
    if (!hasIndicator) return 0;
    if (pH > 10) return 0.75;
    if (pH > 8.2) return 0.4 + (pH - 8.2) / (10 - 8.2) * 0.35;
    return 0;
  };
  const pinkIntensity = getPinkIntensity(currentPH);

  // FIX 3: Flask liquid path scales with flaskFillLevel (0 = empty, 1 = full at 20 mL mark)
  // The flask inner area spans from y=0 (neck bottom) to y=62 (base), width widens linearly.
  // At fillLevel=1, liquid fills up to y=14 from the bottom of the wide section.
  const FLASK_INNER_H  = 62; // total inner height of flask body
  const liquidFillH    = flaskFillLevel * (FLASK_INNER_H * 0.72); // ~72% height = 20 mL mark
  const liquidTopY     = FLASK_INNER_H - liquidFillH;              // y within flask g-group

  // Compute width at liquidTopY using linear interpolation (flask widens from neck to base)
  // At y=0 (neck): half-width ≈ 16; at y=62 (base): half-width ≈ 42
  const halfWidthAtTop = 16 + (liquidTopY / FLASK_INNER_H) * (42 - 16);

  const flaskFillColor = pinkIntensity > 0
    ? `rgba(219, 39, 119, ${pinkIntensity.toFixed(2)})`
    : flaskFillLevel > 0
      ? 'rgba(190, 220, 255, 0.35)'
      : 'transparent';

  // Burette liquid level
  const BURETTE_TOP    = 38;
  const BURETTE_HEIGHT = 220;
  const liquidHeight   = Math.max(0, BURETTE_HEIGHT * (1 - volAdded / 50));
  const liquidY        = BURETTE_TOP + (BURETTE_HEIGHT - liquidHeight);

  // FIX 4: Animate the flask filling over ~1 second when Step 1 button is clicked
  const handleFillFlask = () => {
    if (step !== 'empty') return;
    // Animate flaskFillLevel from 0 → 1
    const obj = { level: 0 };
    gsap.to(obj, {
      level: 1,
      duration: 1.2,
      ease: 'power1.inOut',
      onUpdate: () => setFlaskFillLevel(obj.level),
      onComplete: () => {
        setFlaskFillLevel(1);
        setStep('filled');
      },
    });
  };

  const handleAddIndicator = () => {
    if (step !== 'filled') return;
    setStep('indicator_added');
  };

  const handleTap = () => {
    if (step === 'empty') {
      setValidationError('Flask Empty', 'Fill the conical flask with NaOH first.', "Click 'Fill Flask with NaOH' to proceed.");
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

  // Drip animation
  useEffect(() => {
    if (tapped && !readingFinished) {
      if (dripRef.current) {
        gsap.set(dripRef.current, { y: 0, opacity: 1, scaleY: 0.5 });
        dripAnim.current = gsap.to(dripRef.current, {
          y: 160, opacity: 0, scaleY: 1,
          duration: 0.55 / Math.max(0.5, speed * 0.5),
          repeat: -1,
          ease: 'power1.in',
          repeatRefresh: true,
        });
      }
      intervalRef.current = setInterval(() => {
        setVolAdded(prev => {
          const next = +(prev + speed * 0.15).toFixed(2);
          if (next >= 50) {
            setStep('done');
            setTapped(false);
            return 50;
          }
          return next;
        });
      }, 200);
    } else {
      dripAnim.current?.kill();
      if (dripRef.current) gsap.set(dripRef.current, { y: 0, opacity: 0 });
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      dripAnim.current?.kill();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [tapped, speed, readingFinished]);

  const recordObservation = () => {
    if (step === 'empty' || step === 'filled') {
      setValidationError('Not Ready', 'Complete the setup steps before recording.', 'Fill flask, add indicator, then start titration.');
      return;
    }
    addObservation({
      'Vol HCl Added (mL)': +volAdded.toFixed(1),
      'pH':                  +currentPH.toFixed(2),
      'Indicator Color':     hasIndicator ? (currentPH > 8.2 ? 'Pink' : 'Colourless') : 'No indicator',
      'Stage':               volAdded < equivalenceVolume - 1
        ? 'Before eq. point'
        : volAdded > equivalenceVolume + 1
          ? 'After eq. point'
          : 'At eq. point',
    });
  };

  // FIX 5: Full reset — everything goes back to step 1 including flask
  const handleReset = () => {
    setTapped(false);
    setVolAdded(0);
    setFlaskFillLevel(0);
    setStep('empty');
  };

  const phColor = currentPH > 10 ? '#ec4899'
    : currentPH > 8.2 ? '#f472b6'
    : currentPH > 7.2 ? '#a3e635'
    : currentPH > 6.8 ? '#facc15'
    : currentPH > 4   ? '#fb923c'
    : '#ef4444';

  // Step indicator dot colours
  const stepDot = (s: Step) => {
    const order: Step[] = ['empty', 'filled', 'indicator_added', 'titrating', 'done'];
    const current = order.indexOf(step);
    const target  = order.indexOf(s);
    if (target < current) return 'bg-green-500';
    if (target === current) return 'bg-yellow-400 animate-pulse';
    return 'bg-gray-600';
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative bg-[#02060d] overflow-hidden">

      {/* Live readouts */}
      <div className="absolute top-4 left-4 bg-black/70 border border-gray-700 px-4 py-3 rounded z-10 pointer-events-none">
        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2">Live Readings</div>
        <div className="font-mono text-sm flex flex-col gap-1.5">
          <span className="text-cyan-400">HCl added: {volAdded.toFixed(1)} mL</span>
          <div className="flex items-center gap-2">
            <span className="text-white">pH: {flaskFillLevel > 0 ? currentPH.toFixed(2) : '—'}</span>
            {flaskFillLevel > 0 && (
              <div className="w-16 h-3 rounded overflow-hidden bg-gray-800">
                <div className="h-full rounded transition-all duration-300"
                  style={{ width: `${(currentPH / 14) * 100}%`, background: phColor }} />
              </div>
            )}
          </div>
          <span className="text-gray-400">HCl Molarity: {HCl_Molarity} M</span>
          <span className="text-pink-400">NaOH: {NaOH_Volume} mL @ {NaOH_Molarity} M</span>
          {flaskFillLevel > 0 && (
            <span className="text-yellow-400 border-t border-gray-700 pt-1 mt-1">
              Eq. point ≈ {equivalenceVolume.toFixed(1)} mL
            </span>
          )}
          {hasIndicator && currentPH > 8.2 && (
            <span className="text-pink-400 font-bold animate-pulse">● Pink — basic</span>
          )}
          {hasIndicator && currentPH <= 8.2 && (
            <span className="text-blue-300">○ Colourless — acidic/neutral</span>
          )}
        </div>
      </div>

      {/* Current step banner */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <div className="bg-black/80 border border-yellow-500/40 px-4 py-2 rounded text-xs text-yellow-300 text-center max-w-xs">
          {STEP_LABELS[step]}
        </div>
      </div>

      {/* Main SVG apparatus */}
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
        <rect x="60" y={liquidY} width="18" height={liquidHeight}
          fill="rgba(251,146,60,0.6)"
          clipPath="url(#burette-clip)"
          style={{ transition: 'y 0.3s, height 0.3s' }} />

        {/* Scale markings */}
        <g stroke="#475569" strokeWidth="0.75" fill="#64748b" fontSize="5.5" fontFamily="monospace">
          {[0, 10, 20, 30, 40, 50].map(v => {
            const markY = BURETTE_TOP + (v / 50) * BURETTE_HEIGHT;
            return (
              <g key={v}>
                <line x1="74" y1={markY} x2="78" y2={markY} />
                <text x="81" y={markY + 2} textAnchor="start">{v}</text>
              </g>
            );
          })}
        </g>
        <text x="90" y="34" fill="#64748b" fontSize="5" textAnchor="start">mL</text>

        {/* Tap valve */}
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

        {/* Drip */}
        <g ref={dripRef} opacity="0">
          <ellipse cx="70" cy="302" rx="3.5" ry="4.5" fill="rgba(251,146,60,0.85)" />
        </g>

        {/* Conical flask (Erlenmeyer) */}
        <g transform="translate(70, 315)">
          {/* Glass outline */}
          <path d="M -18 0 L 18 0 L 18 12 L 42 80 L -42 80 L -18 12 Z"
            fill="rgba(255,255,255,0.03)" stroke="#94a3b8" strokeWidth="1.8" />

          {/* FIX 3: Liquid that animates in from the bottom up */}
          {flaskFillLevel > 0 && (
            <>
              {/* Liquid body — polygon from liquidTopY to base */}
              <polygon
                points={`
                  -${halfWidthAtTop} ${liquidTopY},
                  ${halfWidthAtTop} ${liquidTopY},
                  42 ${FLASK_INNER_H},
                  -42 ${FLASK_INNER_H}
                `}
                fill={flaskFillColor}
                style={{ transition: 'fill 0.8s ease-out' }}
              />
              {/* Liquid surface shimmer */}
              <line
                x1={-halfWidthAtTop} y1={liquidTopY}
                x2={halfWidthAtTop}  y2={liquidTopY}
                stroke="rgba(255,255,255,0.2)" strokeWidth="1"
              />
            </>
          )}

          {/* Flask label */}
          <text x="0" y="52" fill="rgba(255,255,255,0.2)" fontSize="7" textAnchor="middle">NaOH</text>
        </g>

        {/* Volume marker on flask */}
        <line x1="32" y1="360" x2="36" y2="360" stroke="#475569" strokeWidth="0.75" />
        <text x="30" y="363" fill="#475569" fontSize="5" textAnchor="end">20mL</text>

        {/* Colour change label */}
        {hasIndicator && currentPH > 8.2 && (
          <text x="70" y="455" fill="#ec4899" fontSize="8" textAnchor="middle" fontWeight="bold">
            ↑ Colour change! (pH {currentPH.toFixed(1)})
          </text>
        )}
        {hasIndicator && Math.abs(volAdded - equivalenceVolume) < 2 && volAdded > 0 && (
          <text x="70" y="465" fill="#fbbf24" fontSize="7" textAnchor="middle">
            ≈ Equivalence point
          </text>
        )}
      </svg>

      {/* Control panel */}
      <div className="absolute top-16 right-4 bg-black/85 px-4 py-3 border border-gray-700 rounded flex flex-col gap-2 min-w-[210px] z-20">

        {/* Step progress dots */}
        <div className="flex items-center justify-between mb-1">
          {(['empty','filled','indicator_added','titrating','done'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <div className={`w-2.5 h-2.5 rounded-full ${stepDot(s)}`} />
              {i < 4 && <div className="w-4 h-px bg-gray-700" />}
            </div>
          ))}
        </div>

        <div className="text-center text-sm border-b border-gray-700 pb-2">
          <span className="text-gray-400">Equiv. point: </span>
          <span className="text-pink-400 font-bold">{equivalenceVolume.toFixed(1)} mL</span>
        </div>

        {/* Step 1: Fill flask */}
        <button
          onClick={handleFillFlask}
          disabled={step !== 'empty'}
          className="w-full py-2 bg-sky-500/20 text-sky-300 border border-sky-500/50 hover:bg-sky-500/30 rounded font-bold text-sm disabled:opacity-40 transition-colors"
        >
          {step !== 'empty' ? '✓ Flask Filled' : '① Fill Flask with NaOH'}
        </button>

        {/* Step 2: Add indicator */}
        <button
          onClick={handleAddIndicator}
          disabled={step !== 'filled'}
          className="w-full py-2 bg-pink-500/20 text-pink-400 border border-pink-500/50 hover:bg-pink-500/30 rounded font-bold text-sm disabled:opacity-40 transition-colors"
        >
          {hasIndicator ? '✓ Indicator Added' : '② Add Phenolphthalein'}
        </button>

        {/* Step 3: Open tap */}
        <button
          onClick={handleTap}
          disabled={readingFinished || (step !== 'indicator_added' && step !== 'titrating')}
          className="w-full py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/30 rounded font-bold text-sm disabled:opacity-40 transition-colors"
        >
          {tapped ? '⏸ ③ Stop Drip' : '▶ ③ Open Tap'}
        </button>

        {/* Log reading */}
        <button
          onClick={recordObservation}
          className="w-full py-2 bg-blue-500/20 text-blue-400 border border-blue-500/50 hover:bg-blue-500/30 rounded font-bold text-sm transition-colors"
        >
          Log Vol & pH
        </button>

        {/* Reset */}
        <button
          onClick={handleReset}
          className="w-full py-2 bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30 rounded font-bold text-sm transition-colors"
        >
          ↺ Reset Experiment
        </button>

        {readingFinished && (
          <div className="text-xs text-yellow-400 text-center mt-1">
            Burette empty — reset to repeat
          </div>
        )}

        {/* pH colour guide */}
        <div className="border-t border-gray-700 pt-2 mt-1">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Phenolphthalein</div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-pink-500" />
            <span className="text-gray-400">Pink = basic (pH &gt; 8.2)</span>
          </div>
          <div className="flex items-center gap-2 text-xs mt-1">
            <div className="w-3 h-3 rounded-full border border-gray-600" />
            <span className="text-gray-400">Colourless = acid/neutral</span>
          </div>
        </div>
      </div>
    </div>
  );
}