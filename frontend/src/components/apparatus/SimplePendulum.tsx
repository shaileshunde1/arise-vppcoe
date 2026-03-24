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

  const length = Number(varState.length || 50); // 10 to 150 cm
  const mass = Number(varState.mass || 50);     // 10 to 200 g
  const angle = Number(varState.angle || 10);   // 5 to 15 deg

  // Real accurate period: T = 2π√(L/g)
  // L in meters = length / 100.
  const T = 2 * Math.PI * Math.sqrt((length / 100) / 9.8);
  const T10 = T * 10;

  const prevAngleRef = useRef<number | null>(null);
  const prevLengthRef = useRef<number | null>(null);

  useEffect(() => {
    const angleChanged = angle !== prevAngleRef.current;
    const lengthChanged = length !== prevLengthRef.current;

    if (!isPlaying && (angleChanged || lengthChanged)) {
      // static angle
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
    
    // Animate the swing (one full swing left and right takes Time T)
    const ctx = gsap.context(() => {
      // Start at +angle, go to -angle and back
      gsap.to(pendulumRef.current, {
        rotation: -angle,
        duration: T / 2,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1
      });
      
      // Counter for 10 oscillations
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
    // g = 4π²L/T² -> L in metrics
    const timeT = T10 / 10;
    const tSq = timeT * timeT;
    const g = (4 * Math.PI * Math.PI * (length / 100)) / tSq;
    setCalculatedG(g);
  };

  // Convert mm to pixels scaled for the SVG 500x500 box
  // Max length 150cm = 1500mm -> mapped to 400 SVG units
  const stringLenSvg = (length / 150) * 400;
  // Bob radius scales slightly with mass: 10g to 200g
  const bobRadius = 15 + (mass / 200) * 15;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative">
      <svg width="100%" height="80%" viewBox="0 0 500 500" className="overflow-visible">
        <defs>
          <radialGradient id="bobGradient" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#fff" />
            <stop offset="100%" stopColor="#475569" />
          </radialGradient>
        </defs>

        {/* Rigid Stand */}
        <line x1="150" y1="20" x2="350" y2="20" stroke="#334155" strokeWidth="8" strokeLinecap="round" />
        <rect x="240" y="20" width="20" height="20" fill="#cbd5e1" rx="4" />
        <circle cx="250" cy="30" r="4" fill="#1e293b" /> {/* Pivot point */}

        {/* Pendulum Group */}
        <g ref={pendulumRef} transform="translate(250, 30)">
          {/* String */}
          <line x1="0" y1="0" x2="0" y2={stringLenSvg} stroke="#e2e8f0" strokeWidth="2" />
          {/* Bob */}
          <circle cx="0" cy={stringLenSvg} r={bobRadius} fill="url(#bobGradient)" />
        </g>
      </svg>

      {/* Embedded Controls */}
      <div className="absolute top-4 left-4 bg-black/60 p-4 rounded-lg border border-gray-700 flex flex-col gap-3 min-w-[200px]">
        <div className="text-center font-mono text-2xl text-accent-cyan font-bold tabular-nums border-b border-gray-700 pb-2 mb-2">
          ⏱ {timer}s
        </div>
        
        <button 
          onClick={handleRelease} 
          disabled={isPlaying}
          className="w-full py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/30 rounded font-bold disabled:opacity-50 transition-colors"
        >
          {isPlaying ? 'Swinging...' : 'Release Bob'}
        </button>

        <button 
          onClick={recordObservation}
          className="w-full py-2 bg-blue-500/20 text-blue-400 border border-blue-500/50 hover:bg-blue-500/30 rounded font-bold transition-colors"
        >
          Record Observation
        </button>
        
        {readingsCount >= 3 && (
           <button 
             onClick={calculateG}
             className="w-full py-2 mt-2 bg-purple-500/20 text-purple-400 border border-purple-500/50 hover:bg-purple-500/30 rounded font-bold transition-colors"
           >
             Calculate 'g'
           </button>
        )}
        
        {calculatedG && (
          <div className="mt-2 text-center text-sm">
            <span className="text-gray-400">g = </span>
            <span className="text-white font-mono">{calculatedG.toFixed(2)} m/s²</span>
          </div>
        )}
      </div>
      
      {/* Information Overlay */}
      <div className="absolute bottom-4 right-4 bg-black/60 px-3 py-2 rounded text-xs text-gray-400 border border-gray-800">
        Angle: {angle}°, Mass: {mass}g (Independent of Period)
      </div>
    </div>
  );
}
