import { useEffect, useRef, useState } from 'react';
import { useLabStore } from '../../store/useLabStore';
import gsap from 'gsap';

interface ApparatusProps {
  varState: Record<string, number | string>;
  setVarState: React.Dispatch<React.SetStateAction<Record<string, number | string>>>;
  addObservation: (data: any) => void;
}

export default function SimplePendulum({ varState, addObservation }: ApparatusProps) {
  const pendulumRef = useRef<SVGGElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timer, setTimer] = useState("0.00");
  const [readingsCount, setReadingsCount] = useState(0);
  const [calculatedG, setCalculatedG] = useState<number | null>(null);
  
  const { setValidationError, hasAdjustedSlider } = useLabStore();

  const length = Number(varState.length || 50);
  const mass = Number(varState.mass || 50);
  const angle = Number(varState.angle || 10);

  const T = 2 * Math.PI * Math.sqrt((length / 100) / 9.8);
  const T10 = T * 10;

  const prevAngleRef = useRef<number | null>(null);
  const prevLengthRef = useRef<number | null>(null);
  const hasRecordedRef = useRef(false);

  useEffect(() => {
    const angleChanged = angle !== prevAngleRef.current;
    const lengthChanged = length !== prevLengthRef.current;
    if (!isPlaying && (angleChanged || lengthChanged)) {
      gsap.set(pendulumRef.current, { rotation: angle, transformOrigin: 'top center' });
      setTimer("0.00");
      prevAngleRef.current = angle;
      prevLengthRef.current = length;
    }
  }, [angle, length, isPlaying]);

  const handleRelease = () => {
    if (!hasAdjustedSlider['simple-pendulum']) {
      setValidationError("Setup Incomplete", "You cannot start the experiment before adjusting the apparatus.", "Adjust at least one slider before releasing the bob.");
      return;
    }
    if (angle > 15) {
      setValidationError("Angle Too Large", "The small angle approximation breaks down for angles above 15°. Simple Harmonic Motion requires small angles.", "Set the angle to 15° or below.");
      return;
    }
    if (isPlaying) return;
    setIsPlaying(true);
    hasRecordedRef.current = false;
    
    const ctx = gsap.context(() => {
      gsap.to(pendulumRef.current, {
        rotation: -angle,
        duration: T / 2,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1
      });
      
      let secondsPassed = 0;
      const tId = setInterval(() => {
        secondsPassed += 0.05;
        if (secondsPassed >= T10) {
          clearInterval(tId);
          gsap.killTweensOf(pendulumRef.current);
          gsap.to(pendulumRef.current, { rotation: 0, duration: 0.5, ease: 'power2.out' });
          setIsPlaying(false);
          setTimer(T10.toFixed(2));
        } else {
          setTimer(secondsPassed.toFixed(2));
        }
      }, 50);

      return () => clearInterval(tId);
    });
    return () => ctx.revert();
  };

  const recordObservation = () => {
    if (timer === "0.00") return;
    if (isPlaying) {
      setValidationError("Early Recording", "Timer stopped before one full oscillation. The pendulum must complete its full designated cycle.", "Wait for a complete left-right-left swing before recording.");
      return;
    }
    if (hasRecordedRef.current) {
      setValidationError("Already Recorded", "This observation has already been saved.", "Release the bob again with a different length to record a new observation.");
      return;
    }
    hasRecordedRef.current = true;
    
    const timeT = Number((T10 / 10).toFixed(3));
    const tSquare = Number((timeT * timeT).toFixed(3));
    
    addObservation({
      "Length L (cm)": length,
      "T² (s²)": tSquare,
      "T for 10 osc (s)": Number(T10.toFixed(2)),
      "Time Period T (s)": timeT
    });
    setReadingsCount(r => r + 1);
  };

  const calculateG = () => {
    const timeT = T10 / 10;
    const tSq = timeT * timeT;
    const g = (4 * Math.PI * Math.PI * (length / 100)) / tSq;
    setCalculatedG(g);
  };

  // Scale string length so the bob never exits the SVG viewBox (max ~380px at length=150)
  const stringLenSvg = (length / 150) * 380;
  const bobRadius = 15 + (mass / 200) * 15;

  return (
    // Flex column: SVG grows to fill available space, controls are a fixed-height row below
    <div className="w-full h-full flex flex-col items-center" style={{ minHeight: 0 }}>

      {/* ── Pendulum canvas — takes all remaining vertical space ── */}
      <div className="w-full flex-1 relative" style={{ minHeight: 0 }}>
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 500 420"
          preserveAspectRatio="xMidYMid meet"
          style={{ display: 'block' }}
        >
          <defs>
            <radialGradient id="bobGradient" cx="30%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#fff" />
              <stop offset="100%" stopColor="#475569" />
            </radialGradient>
          </defs>

          {/* Rigid Stand */}
          <line x1="150" y1="20" x2="350" y2="20" stroke="#334155" strokeWidth="8" strokeLinecap="round" />
          <rect x="240" y="20" width="20" height="20" fill="#cbd5e1" rx="4" />
          <circle cx="250" cy="30" r="4" fill="#1e293b" />

          {/* Pendulum Group */}
          <g ref={pendulumRef} transform="translate(250, 30)">
            <line x1="0" y1="0" x2="0" y2={stringLenSvg} stroke="#e2e8f0" strokeWidth="2" />
            <circle cx="0" cy={stringLenSvg} r={bobRadius} fill="url(#bobGradient)" />
          </g>
        </svg>
      </div>

      {/* ── Controls — fixed height, always visible below the canvas ── */}
      <div
        className="w-full shrink-0 bg-black/60 border-t border-gray-700 px-4 py-3 flex flex-col gap-2"
        style={{ maxWidth: 360, margin: '0 auto', borderRadius: '0 0 8px 8px' }}
      >
        {/* Timer */}
        <div className="text-center font-mono text-xl text-accent-cyan font-bold tabular-nums">
          ⏱ {timer}s
        </div>

        {/* Action buttons in a row to save vertical space */}
        <div className="flex gap-2">
          <button
            onClick={handleRelease}
            disabled={isPlaying}
            className="flex-1 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/30 rounded font-bold disabled:opacity-50 transition-colors text-sm"
          >
            {isPlaying ? 'Swinging…' : 'Release Bob'}
          </button>

          <button
            onClick={recordObservation}
            className="flex-1 py-2 bg-blue-500/20 text-blue-400 border border-blue-500/50 hover:bg-blue-500/30 rounded font-bold transition-colors text-sm"
          >
            Record
          </button>
        </div>

        {/* Calculate g — only shown after 3 readings */}
        {readingsCount >= 3 && (
          <button
            onClick={calculateG}
            className="w-full py-2 bg-purple-500/20 text-purple-400 border border-purple-500/50 hover:bg-purple-500/30 rounded font-bold transition-colors text-sm"
          >
            Calculate 'g'
          </button>
        )}

        {calculatedG && (
          <div className="text-center text-sm">
            <span className="text-gray-400">g = </span>
            <span className="text-white font-mono">{calculatedG.toFixed(2)} m/s²</span>
          </div>
        )}
      </div>

    </div>
  );
}