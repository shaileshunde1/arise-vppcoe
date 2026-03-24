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
  const conc = Number(varState.concentration || 5);

  const { setValidationError, hasAdjustedSlider } = useLabStore();

  const [isRunning, setIsRunning] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cathodeBubblesRef = useRef<SVGGElement>(null);
  const anodeBubblesRef = useRef<SVGGElement>(null);
  const electronRef = useRef<SVGGElement>(null);

  const reactionRateH2 = (voltage / 6) * (conc / 5) * 0.1;
  const reactionRateO2 = reactionRateH2 / 2;

  const volH2 = timeElapsed * reactionRateH2;
  const volO2 = timeElapsed * reactionRateO2;

  // Fixed bubble positions — generated once, never in render
  const cathodeBubbles = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => ({
      cx: 150 + (i % 3) * 4 - 4,
      cy: 250 + (i % 4) * 6,
      r: 1.5 + (i % 3) * 0.5,
    })), []);

  const anodeBubbles = useMemo(() =>
    Array.from({ length: 6 }, (_, i) => ({
      cx: 250 + (i % 3) * 4 - 4,
      cy: 250 + (i % 3) * 8,
      r: 1.5 + (i % 2) * 0.5,
    })), []);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);

      const bubbleSpeed = Math.max(0.5, 1 / reactionRateH2);

      if (cathodeBubblesRef.current) {
        gsap.killTweensOf(cathodeBubblesRef.current.children);
        gsap.to(cathodeBubblesRef.current.children, {
          y: -100, opacity: 0,
          stagger: { amount: 2, repeat: -1 },
          duration: bubbleSpeed,
          ease: 'power1.in',
        });
      }
      if (anodeBubblesRef.current) {
        gsap.killTweensOf(anodeBubblesRef.current.children);
        gsap.to(anodeBubblesRef.current.children, {
          y: -100, opacity: 0,
          stagger: { amount: 4, repeat: -1 },
          duration: bubbleSpeed * 2,
          ease: 'power1.in',
        });
      }
      if (electronRef.current) {
        gsap.killTweensOf(electronRef.current.children);
        gsap.to(electronRef.current.children, {
          strokeDashoffset: -20,
          duration: 0.5, repeat: -1, ease: 'none',
        });
      }
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (cathodeBubblesRef.current) gsap.killTweensOf(cathodeBubblesRef.current.children);
      if (anodeBubblesRef.current) gsap.killTweensOf(anodeBubblesRef.current.children);
      if (electronRef.current) gsap.killTweensOf(electronRef.current.children);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, reactionRateH2]);

  const testTubeMaxVol = 20;
  const h2Height = Math.min(150, (volH2 / testTubeMaxVol) * 150);
  const o2Height = Math.min(150, (volO2 / testTubeMaxVol) * 150);

  const handleStart = () => {
    if (!hasAdjustedSlider['electrolysis-water']) {
      setValidationError("Setup Incomplete", "Configure the circuit before starting electrolysis.", "Adjust the voltage or concentration slider first.");
      return;
    }
    if (!isRunning && voltage < 1.23) {
      setValidationError("Voltage Too Low", "Minimum decomposition voltage for water is 1.23V.", "Increase the voltage to at least 2V.");
      return;
    }
    setIsRunning(r => !r);
  };

  const recordObservation = () => {
    addObservation({
      "Time (s)": timeElapsed,
      "H₂ Vol (mL)": Number(volH2.toFixed(2)),
      "O₂ Vol (mL)": Number(volO2.toFixed(2)),
      "H₂:O₂ Ratio": volO2 > 0 ? Number((volH2 / volO2).toFixed(2)) : 0,
    });
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative p-8 bg-[#0a1128]">

      {/* Readouts */}
      <div className="absolute top-4 left-4 bg-black/60 border border-gray-700 px-4 py-2 rounded z-10 pointer-events-none">
        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Live Gas Collection</div>
        <div className="font-mono text-sm flex flex-col gap-1">
          <span className="text-accent-cyan">Time: {timeElapsed}s</span>
          <span className="text-white">H₂: {volH2.toFixed(2)} mL</span>
          <span className="text-blue-400">O₂: {volO2.toFixed(2)} mL</span>
          <span className="text-yellow-400">Ratio: {volO2 > 0 ? (volH2 / volO2).toFixed(2) : '—'} : 1</span>
        </div>
      </div>

      <svg width="400" height="400" viewBox="0 0 400 400" className="overflow-visible">
        {/* Circuit Wires */}
        <polyline points="150,50 150,150" fill="none" stroke="#64748b" strokeWidth="4" />
        <polyline points="250,50 250,150" fill="none" stroke="#64748b" strokeWidth="4" />
        <polyline points="150,50 250,50" fill="none" stroke="#64748b" strokeWidth="4" />

        {/* Electron flow */}
        <g ref={electronRef} opacity={isRunning ? 1 : 0} stroke="#00d4ff" strokeWidth="4" fill="none" strokeDasharray="4 16">
          <line x1="190" y1="50" x2="150" y2="50" />
          <line x1="150" y1="50" x2="150" y2="150" />
          <line x1="250" y1="150" x2="250" y2="50" />
          <line x1="250" y1="50" x2="210" y2="50" />
        </g>

        {/* Battery */}
        <g transform="translate(190, 40)">
          <rect x="0" y="-15" width="20" height="30" fill="#020617" />
          <line x1="15" y1="-25" x2="15" y2="25" stroke="#fff" strokeWidth="4" />
          <line x1="5" y1="-15" x2="5" y2="15" stroke="#fff" strokeWidth="6" />
          <text x="15" y="-30" fill="#ef4444" fontSize="14" fontWeight="bold" textAnchor="middle">+</text>
          <text x="5" y="-25" fill="#3b82f6" fontSize="14" fontWeight="bold" textAnchor="middle">-</text>
          <text x="10" y="-45" fill="#fbbf24" fontSize="12" textAnchor="middle">{voltage}V DC</text>
        </g>

        {/* U-Tube */}
        <path d="M 130 150 L 130 300 Q 130 350 200 350 Q 270 350 270 300 L 270 150" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="4" />
        <path d="M 170 200 L 170 300 Q 170 310 200 310 Q 230 310 230 300 L 230 200" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="4" />

        {/* Electrolyte */}
        <path d="M 132 180 L 168 180 L 168 300 Q 168 308 200 308 Q 232 308 232 300 L 232 180 L 268 180 L 268 300 Q 268 348 200 348 Q 132 348 132 300 Z" fill="rgba(253, 224, 71, 0.2)" />

        {/* Electrodes */}
        <rect x="145" y="150" width="10" height="120" fill="#334155" />
        <rect x="245" y="150" width="10" height="120" fill="#334155" />

        {/* Test tubes — H2 cathode left */}
        <rect x="135" y="80" width="30" height="150" rx="15" fill="none" stroke="#cbd5e1" strokeWidth="2" />
        <rect x="137" y={80 + h2Height} width="26" height={150 - h2Height} fill="rgba(253, 224, 71, 0.4)" />

        {/* Test tubes — O2 anode right */}
        <rect x="235" y="80" width="30" height="150" rx="15" fill="none" stroke="#cbd5e1" strokeWidth="2" />
        <rect x="237" y={80 + o2Height} width="26" height={150 - o2Height} fill="rgba(253, 224, 71, 0.4)" />

        {/* Cathode bubbles — stable positions */}
        <g ref={cathodeBubblesRef} opacity={isRunning ? 1 : 0}>
          {cathodeBubbles.map((b, i) => (
            <circle key={i} cx={b.cx} cy={b.cy} r={b.r} fill="white" />
          ))}
        </g>

        {/* Anode bubbles — stable positions */}
        <g ref={anodeBubblesRef} opacity={isRunning ? 1 : 0}>
          {anodeBubbles.map((b, i) => (
            <circle key={i} cx={b.cx} cy={b.cy} r={b.r} fill="white" />
          ))}
        </g>

        <text x="110" y="100" fill="#fff" fontSize="12" fontWeight="bold">H₂</text>
        <text x="280" y="100" fill="#fff" fontSize="12" fontWeight="bold">O₂</text>
      </svg>

      <div className="absolute top-4 right-4 bg-black/80 px-4 py-3 border border-gray-700 rounded flex flex-col gap-2 min-w-[200px]">
        <div className="font-bold text-center border-b border-gray-700 pb-2 text-white text-sm">
          Vol Ratio: <span className="text-accent-cyan">{volO2 > 0 ? (volH2 / volO2).toFixed(1) : "—"} : 1</span>
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
      </div>
    </div>
  );
}