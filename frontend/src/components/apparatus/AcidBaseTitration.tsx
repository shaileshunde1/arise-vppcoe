import { useEffect, useRef, useState } from 'react';
import { useLabStore } from '../../store/useLabStore';
import gsap from 'gsap';

interface ApparatusProps {
  varState: Record<string, number | string>;
  setVarState: React.Dispatch<React.SetStateAction<Record<string, number | string>>>;
  addObservation: (data: any) => void;
}

export default function AcidBaseTitration({ varState, addObservation }: ApparatusProps) {
  const HCl_Molarity = Number(varState.molarity || 0.1);
  const NaOH_Volume = Number(varState.volumeFlask || 20);
  const speed = Number(varState.speed || 2);

  const { setValidationError } = useLabStore();

  const NaOH_Molarity = 0.15;
  const equivalenceVolume = (NaOH_Volume * NaOH_Molarity) / HCl_Molarity;

  const [tapped, setTapped] = useState(false);
  const [volAdded, setVolAdded] = useState(0);
  const [readingFinished, setReadingFinished] = useState(false);
  const [hasIndicator, setHasIndicator] = useState(false);

  const dripRef = useRef<SVGGElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const calculatePH = (added: number) => {
    const molesOH = NaOH_Molarity * NaOH_Volume;
    const molesHPlus = HCl_Molarity * added;
    const totalVol = NaOH_Volume + added;
    if (added === 0) return 14 + Math.log10(NaOH_Molarity);
    if (molesOH > molesHPlus) {
      const concOH = (molesOH - molesHPlus) / totalVol;
      return 14 + Math.log10(concOH);
    } else if (Math.abs(molesOH - molesHPlus) < 0.0001) {
      return 7.0;
    } else {
      const concH = (molesHPlus - molesOH) / totalVol;
      return -Math.log10(concH);
    }
  };

  const currentPH = calculatePH(volAdded);
  const flaskColor = hasIndicator && currentPH > 8.2
    ? 'rgba(219, 39, 119, 0.6)'
    : 'rgba(200, 230, 255, 0.3)';

  useEffect(() => {
    if (tapped && !readingFinished) {
      // Drip animation — safe null check
      if (dripRef.current) {
        gsap.to(dripRef.current, {
          y: 150, opacity: 0,
          duration: 0.6 / speed,
          repeat: -1, ease: 'power1.in',
        });
      }

      intervalRef.current = setInterval(() => {
        setVolAdded(prev => {
          const next = prev + speed * 0.2;
          if (next >= 50) {
            setReadingFinished(true);
            setTapped(false);
            return 50;
          }
          return next;
        });
      }, 200);
    } else {
      if (dripRef.current) {
        gsap.killTweensOf(dripRef.current);
        gsap.set(dripRef.current, { y: 0, opacity: 1 });
      }
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [tapped, speed, readingFinished]);

  // Burette: 0mL = full (liquid from y=30 height=250), 50mL = empty
  const buretteLiquidHeight = Math.max(0, 250 - volAdded * 5);
  const buretteLiquidY = 30;

  const handleTap = () => {
    if (!hasIndicator) {
      setValidationError("Missing Indicator", "Add Phenolphthalein to the flask first.", "Click 'Add Phenolphthalein' before opening the tap.");
      return;
    }
    if (readingFinished) return;
    setTapped(t => !t);
  };

  const recordObservation = () => {
    addObservation({
      "Vol HCl Added (mL)": Number(volAdded.toFixed(1)),
      "pH": Number(currentPH.toFixed(2)),
      "Color": hasIndicator ? (currentPH > 8.2 ? "Pink" : "Colorless") : "No Indicator",
    });
  };

  const handleReset = () => {
    setTapped(false);
    setVolAdded(0);
    setReadingFinished(false);
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative bg-[#02060d] pt-10">

      {/* Readouts */}
      <div className="absolute top-4 left-4 bg-black/60 border border-gray-700 px-4 py-2 rounded z-10 pointer-events-none">
        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Live Readings</div>
        <div className="font-mono text-sm flex flex-col gap-1">
          <span className="text-accent-cyan">Burette: {volAdded.toFixed(1)} mL</span>
          <span className="text-white">pH: {currentPH.toFixed(2)}</span>
          <span className="text-gray-500">M_HCl: {HCl_Molarity} M</span>
          <span className="text-pink-400">V_NaOH: {NaOH_Volume} mL</span>
          <span className="text-yellow-400">Equiv. Point: ~{equivalenceVolume.toFixed(1)} mL</span>
        </div>
      </div>

      <svg width="400" height="400" viewBox="0 0 200 400" className="overflow-visible">
        {/* Stand */}
        <line x1="30" y1="20" x2="30" y2="380" stroke="#334155" strokeWidth="6" strokeLinecap="round" />
        <rect x="10" y="380" width="180" height="15" fill="#f8fafc" rx="4" />
        <rect x="25" y="150" width="40" height="10" fill="#1e293b" />

        {/* Burette Glass */}
        <path d="M 60 20 L 80 20 L 80 280 L 72 290 L 72 310 L 68 310 L 68 290 L 60 280 Z"
          fill="rgba(255,255,255,0.05)" stroke="#94a3b8" strokeWidth="2" />

        {/* Burette Liquid */}
        <rect x="62" y={buretteLiquidY} width="16" height={buretteLiquidHeight}
          fill="rgba(251, 146, 60, 0.5)" />

        {/* Scale markings */}
        <g stroke="#94a3b8" strokeWidth="1">
          {[0, 10, 20, 30, 40, 50].map(v => (
            <g key={v}>
              <line x1="75" y1={30 + v * 5} x2="80" y2={30 + v * 5} />
              <text x="57" y={34 + v * 5} fill="#64748b" fontSize="6" textAnchor="end">{v}</text>
            </g>
          ))}
        </g>

        {/* Tap Valve */}
        <circle cx="70" cy="295" r="5"
          fill={tapped ? "#22c55e" : "#ef4444"}
          style={{ cursor: 'pointer', transition: 'fill 0.3s' }}
          onClick={handleTap} />

        {/* Drip */}
        <g ref={dripRef}>
          <path d="M 70 312 Q 74 318 70 325 Q 66 318 70 312"
            fill="rgba(251, 146, 60, 0.7)" />
        </g>

        {/* Conical Flask */}
        <g transform="translate(70, 315)">
          <path d="M -20 0 L 20 0 L 20 15 L 38 70 L -38 70 L -20 15 Z"
            fill="rgba(255,255,255,0.04)" stroke="#cbd5e1" strokeWidth="2" />
          {/* Liquid in flask */}
          <path d="M -18 25 L 18 25 L 36 68 L -36 68 Z"
            fill={flaskColor}
            style={{ transition: 'fill 0.6s ease-out' }} />
        </g>
      </svg>

      {/* Controls */}
      <div className="absolute top-4 right-4 bg-black/80 px-4 py-3 border border-gray-700 rounded flex flex-col gap-2 min-w-[200px]">
        <div className="font-bold text-center border-b border-gray-700 pb-2 text-sm">
          <span className="text-gray-400">Equiv: </span>
          <span className="text-pink-400">{equivalenceVolume.toFixed(1)} mL</span>
        </div>
        {!hasIndicator && (
          <button onClick={() => setHasIndicator(true)}
            className="w-full py-2 bg-pink-500/20 text-pink-400 border border-pink-500/50 hover:bg-pink-500/30 rounded font-bold text-sm transition-colors">
            Add Phenolphthalein
          </button>
        )}
        <button onClick={handleTap} disabled={readingFinished}
          className="w-full py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/30 rounded font-bold text-sm disabled:opacity-50 transition-colors">
          {tapped ? '⏸ Stop Drip' : '▶ Open Tap'}
        </button>
        <button onClick={recordObservation}
          className="w-full py-2 bg-blue-500/20 text-blue-400 border border-blue-500/50 hover:bg-blue-500/30 rounded font-bold text-sm transition-colors">
          Log Vol & pH
        </button>
        <button onClick={handleReset}
          className="w-full py-2 bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30 rounded font-bold text-sm transition-colors">
          Reset
        </button>
      </div>
    </div>
  );
}