import { useEffect, useRef, useState, useMemo } from 'react';
import { useLabStore } from '../../store/useLabStore';
import gsap from 'gsap';

interface ApparatusProps {
  varState: Record<string, number | string>;
  setVarState: React.Dispatch<React.SetStateAction<Record<string, number | string>>>;
  addObservation: (data: any) => void;
}

export default function ElectrolysisWater({ varState, addObservation }: ApparatusProps) {
  const voltage = Number(varState.voltage || 6);
  const conc    = Number(varState.concentration || 5);

  const { setValidationError, hasAdjustedSlider } = useLabStore();

  const [isRunning, setIsRunning]     = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);

  const intervalRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const cathodeBubblesRef = useRef<SVGGElement>(null);
  const anodeBubblesRef   = useRef<SVGGElement>(null);
  const electronRef       = useRef<SVGGElement>(null);

  const reactionRateH2 = (voltage / 6) * (conc / 5) * 0.12;
  const reactionRateO2 = reactionRateH2 / 2;

  const volH2 = timeElapsed * reactionRateH2;
  const volO2 = timeElapsed * reactionRateO2;

  const TUBE_HEIGHT = 120;
  const MAX_VOL     = 18;

  const h2FillHeight = Math.min(TUBE_HEIGHT - 4, (volH2 / MAX_VOL) * (TUBE_HEIGHT - 4));
  const o2FillHeight = Math.min(TUBE_HEIGHT - 4, (volO2 / MAX_VOL) * (TUBE_HEIGHT - 4));

  // Bubbles spawn along electrode surface (x spread, y starts at electrode bottom going up)
  // Electrode is rect y=0 to y=160 inside the beaker (translate 200)
  // Bubbles should start near electrode mid-to-bottom and rise to tube opening
  const cathodeBubbles = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => ({
      cx: (i % 2 === 0 ? -1 : 1) * (3 + (i % 3) * 2.5),
      startY: 140 - (i % 4) * 22,   // spread along electrode height
      r: 1.8 + (i % 3) * 0.9,
      delay: i * 0.18,
    })), []);

  const anodeBubbles = useMemo(() =>
    Array.from({ length: 6 }, (_, i) => ({
      cx: (i % 2 === 0 ? -1 : 1) * (2 + (i % 3) * 2),
      startY: 140 - (i % 3) * 28,
      r: 2 + (i % 2) * 1,
      delay: i * 0.35,
    })), []);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => setTimeElapsed(t => t + 1), 1000);
      const bubbleSpeed = Math.max(0.5, 1.2 / reactionRateH2);

      if (cathodeBubblesRef.current) {
        gsap.killTweensOf(cathodeBubblesRef.current.children);
        Array.from(cathodeBubblesRef.current.children).forEach((el, i) => {
          gsap.fromTo(el,
            { y: 0, opacity: 1 },
            { y: -120, opacity: 0, duration: bubbleSpeed * (0.6 + (i % 3) * 0.15), repeat: -1, delay: i * 0.18, ease: 'power1.out' }
          );
        });
      }

      if (anodeBubblesRef.current) {
        gsap.killTweensOf(anodeBubblesRef.current.children);
        Array.from(anodeBubblesRef.current.children).forEach((el, i) => {
          gsap.fromTo(el,
            { y: 0, opacity: 1 },
            { y: -100, opacity: 0, duration: bubbleSpeed * 1.5 * (0.6 + (i % 2) * 0.25), repeat: -1, delay: i * 0.3, ease: 'power1.out' }
          );
        });
      }

      if (electronRef.current) {
        gsap.killTweensOf(electronRef.current.children);
        gsap.to(electronRef.current.children, {
          strokeDashoffset: -24, duration: 0.4, repeat: -1, ease: 'none',
        });
      }
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (cathodeBubblesRef.current) {
        gsap.killTweensOf(cathodeBubblesRef.current.children);
        Array.from(cathodeBubblesRef.current.children).forEach(el =>
          gsap.set(el, { y: 0, opacity: 0 }));
      }
      if (anodeBubblesRef.current) {
        gsap.killTweensOf(anodeBubblesRef.current.children);
        Array.from(anodeBubblesRef.current.children).forEach(el =>
          gsap.set(el, { y: 0, opacity: 0 }));
      }
      if (electronRef.current) gsap.killTweensOf(electronRef.current.children);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, reactionRateH2, cathodeBubbles, anodeBubbles]);

  const handleStart = () => {
    if (!hasAdjustedSlider['electrolysis-water']) {
      setValidationError('Setup Incomplete', 'Adjust voltage or concentration first.', 'Use the sliders in the left panel.');
      return;
    }
    if (!isRunning && voltage < 1.23) {
      setValidationError('Voltage Too Low', 'Minimum decomposition voltage is 1.23V.', 'Increase the voltage to at least 2V.');
      return;
    }
    setIsRunning(r => !r);
  };

  const recordObservation = () => {
    addObservation({
      'Time (s)':     timeElapsed,
      'H₂ Vol (mL)': +volH2.toFixed(2),
      'O₂ Vol (mL)': +volO2.toFixed(2),
      'H₂:O₂ Ratio': volO2 > 0 ? +(volH2 / volO2).toFixed(2) : 0,
    });
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative bg-[#0a1128]">

      {/* Readouts */}
      <div className="absolute top-4 left-4 bg-black/70 border border-gray-700 px-4 py-3 rounded z-10 pointer-events-none">
        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2">Gas Collection</div>
        <div className="font-mono text-sm flex flex-col gap-1.5">
          <span className="text-cyan-400">Time: {timeElapsed}s</span>
          <span className="text-white">H₂ (cathode): <strong>{volH2.toFixed(2)} mL</strong></span>
          <span className="text-blue-400">O₂ (anode): <strong>{volO2.toFixed(2)} mL</strong></span>
          <span className="text-yellow-400 border-t border-gray-700 pt-1 mt-1">
            H₂:O₂ = {volO2 > 0 ? (volH2 / volO2).toFixed(1) : '—'} : 1
          </span>
          <span className="text-gray-500 text-[10px]">Expected ratio: 2:1</span>
        </div>
      </div>

      <svg width="460" height="460" viewBox="0 0 460 460" className="overflow-visible">

        {/* Power supply */}
        <g transform="translate(185, 28)">
          <rect x="-40" y="-16" width="90" height="36" rx="6" fill="#0f172a" stroke="#334155" strokeWidth="1.5" />
          <text x="5" y="-2" fill="#fbbf24" fontSize="12" fontWeight="700" textAnchor="middle">{voltage}V DC</text>
          <text x="5" y="12" fill="#64748b" fontSize="8" textAnchor="middle">Power Supply</text>
          <text x="-30" y="26" fill="#ef4444" fontSize="10" fontWeight="700" textAnchor="middle">+</text>
          <text x="40"  y="26" fill="#3b82f6" fontSize="10" fontWeight="700" textAnchor="middle">−</text>
        </g>

        {/* Wires */}
        <polyline points="155,28 120,28 120,200" fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
        <polyline points="225,28 340,28 340,200" fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />

        {/* Electron flow */}
        <g ref={electronRef} opacity={isRunning ? 1 : 0.2} style={{ transition: 'opacity 0.4s' }}>
          <line x1="310" y1="28" x2="228" y2="28" stroke="#00d4ff" strokeWidth="3" strokeDasharray="5 10" strokeLinecap="round" />
          <line x1="155" y1="28" x2="120" y2="28" stroke="#00d4ff" strokeWidth="3" strokeDasharray="5 10" strokeLinecap="round" />
        </g>
        {isRunning && (
          <text x="228" y="18" fill="#00d4ff" fontSize="9" textAnchor="middle">e⁻ flow</text>
        )}

        {/* Beaker */}
        <path d="M 80 200 L 80 400 Q 80 420 100 420 L 360 420 Q 380 420 380 400 L 380 200 Z"
          fill="none" stroke="#475569" strokeWidth="3" />
        <line x1="72" y1="200" x2="388" y2="200" stroke="#475569" strokeWidth="3" strokeLinecap="round" />

        {/* Electrolyte */}
        <path d="M 82 260 L 378 260 L 378 400 Q 378 418 360 418 L 100 418 Q 82 418 82 400 Z"
          fill={`rgba(253,224,71,${0.1 + (conc / 10) * 0.15})`} />
        <line x1="82" y1="260" x2="378" y2="260" stroke="rgba(253,224,71,0.4)" strokeWidth="1.5" />
        <text x="230" y="360" fill="rgba(253,224,71,0.5)" fontSize="11" textAnchor="middle">Dilute H₂SO₄</text>
        <text x="230" y="375" fill="rgba(253,224,71,0.3)" fontSize="9"  textAnchor="middle">(electrolyte)</text>

        {/* Anode (+) — left */}
        <rect x="113" y="200" width="14" height="160" rx="2" fill="#334155" stroke="#ef4444" strokeWidth="1" />
        <text x="120" y="192" fill="#ef4444" fontSize="11" fontWeight="700" textAnchor="middle">+</text>
        <text x="120" y="445" fill="#ef4444" fontSize="9"  textAnchor="middle">Anode</text>

        {/* Cathode (−) — right */}
        <rect x="333" y="200" width="14" height="160" rx="2" fill="#334155" stroke="#3b82f6" strokeWidth="1" />
        <text x="340" y="192" fill="#3b82f6" fontSize="11" fontWeight="700" textAnchor="middle">−</text>
        <text x="340" y="445" fill="#3b82f6" fontSize="9"  textAnchor="middle">Cathode</text>

        {/* O₂ tube — over anode (left) */}
        <g transform="translate(120, 200)">
          <path d="M -18 -100 Q -18 -110 0 -110 Q 18 -110 18 -100 L 18 20 L -18 20 Z"
            fill="rgba(255,255,255,0.04)" stroke="#94a3b8" strokeWidth="1.5" />
          {o2FillHeight > 0 && (
            <rect x="-15" y={-106} width="30" height={o2FillHeight}
              fill="rgba(200,230,255,0.38)" style={{ transition: 'height 0.5s' }} />
          )}
          {volO2 > 1 && (
            <text x="0" y={-106 + o2FillHeight / 2 + 4}
              fill="rgba(200,230,255,0.8)" fontSize="9" textAnchor="middle" fontWeight="600">O₂</text>
          )}
        </g>

        {/* H₂ tube — over cathode (right) */}
        <g transform="translate(340, 200)">
          <path d="M -18 -100 Q -18 -110 0 -110 Q 18 -110 18 -100 L 18 20 L -18 20 Z"
            fill="rgba(255,255,255,0.04)" stroke="#94a3b8" strokeWidth="1.5" />
          {h2FillHeight > 0 && (
            <rect x="-15" y={-106} width="30" height={h2FillHeight}
              fill="rgba(250,220,100,0.42)" style={{ transition: 'height 0.5s' }} />
          )}
          {volH2 > 1 && (
            <text x="0" y={-106 + h2FillHeight / 2 + 4}
              fill="rgba(250,220,100,0.9)" fontSize="9" textAnchor="middle" fontWeight="600">H₂</text>
          )}
        </g>

        {/* Anode bubbles — absolute coords, rise from electrode surface (x≈120, y=260–360) upward */}
        <g ref={anodeBubblesRef}>
          {anodeBubbles.map((b, i) => (
            <circle key={i} cx={120 + b.cx} cy={260 + (i % 3) * 30} r={b.r}
              fill="rgba(200,230,255,0.9)" opacity="1" />
          ))}
        </g>

        {/* Cathode bubbles — absolute coords, rise from electrode surface (x≈340, y=260–360) upward */}
        <g ref={cathodeBubblesRef}>
          {cathodeBubbles.map((b, i) => (
            <circle key={i} cx={340 + b.cx} cy={265 + (i % 4) * 22} r={b.r}
              fill="rgba(250,220,100,0.9)" opacity="1" />
          ))}
        </g>

        {/* Volume bar */}
        {(volH2 > 0 || volO2 > 0) && (
          <g transform="translate(230,430)">
            <text x="0" y="-4" fill="#64748b" fontSize="8" textAnchor="middle">Volume comparison</text>
            <rect x="-60" y="0" width="120" height="10" rx="3" fill="#1e293b" />
            <rect x="-60" y="0"
              width={Math.min(120, (volH2 / (volH2 + volO2 + 0.001)) * 120)}
              height="10" rx="3" fill="#fde047" opacity="0.7" />
            <text x="-60" y="22" fill="#fde047" fontSize="8">H₂</text>
            <text x="60"  y="22" fill="#93c5fd" fontSize="8" textAnchor="end">O₂</text>
          </g>
        )}

        <text x="230" y="455" fill="#475569" fontSize="10" textAnchor="middle">
          2H₂O → 2H₂ + O₂ (electrolysis)
        </text>
      </svg>

      {/* Controls */}
      <div className="absolute top-4 right-4 bg-black/85 px-4 py-3 border border-gray-700 rounded flex flex-col gap-2 min-w-[210px] z-20">
        <div className="text-center border-b border-gray-700 pb-2 text-sm">
          <span className="text-white font-bold">
            H₂:O₂ = {volO2 > 0 ? (volH2 / volO2).toFixed(1) : '—'} : 1
          </span>
          <div className="text-xs text-gray-500 mt-0.5">expected: 2:1</div>
        </div>

        <button onClick={handleStart}
          className="w-full py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/30 rounded font-bold text-sm transition-colors">
          {isRunning ? '⏸ Pause' : '▶ Start Electrolysis'}
        </button>
        <button onClick={recordObservation}
          className="w-full py-2 bg-blue-500/20 text-blue-400 border border-blue-500/50 hover:bg-blue-500/30 rounded font-bold text-sm transition-colors">
          Log Gas Volumes
        </button>
        <button onClick={() => { setIsRunning(false); setTimeElapsed(0); }}
          className="w-full py-2 bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30 rounded font-bold text-sm transition-colors">
          Reset
        </button>

        <div className="border-t border-gray-700 pt-2 text-xs text-gray-500 space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ background: 'rgba(250,220,100,0.6)' }} />
            <span>H₂ collects at cathode (−)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ background: 'rgba(200,230,255,0.5)' }} />
            <span>O₂ collects at anode (+)</span>
          </div>
        </div>
      </div>
    </div>
  );
}