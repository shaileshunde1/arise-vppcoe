import { useEffect, useRef, useState } from 'react';
import { useLabStore } from '../../store/useLabStore';
import gsap from 'gsap';

interface ApparatusProps {
  varState: Record<string, number | string>;
  setVarState: React.Dispatch<React.SetStateAction<Record<string, number | string>>>;
  addObservation: (data: any) => void;
}

export default function MagneticField({ varState, addObservation }: ApparatusProps) {
  const poleStrength = Number(varState.strength || 5); // 1 to 10
  const mode = Number(varState.mode || 0); // 0=Single, 1=Unlike, 2=Like
  
  const { setValidationError, hasAdjustedSlider } = useLabStore();

  const compassRef = useRef<SVGGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const linesRef = useRef<SVGGElement>(null);

  const [compassPos, setCompassPos] = useState({ x: 300, y: 150 });
  const [isDragging, setIsDragging] = useState(false);
  const [compassAngle, setCompassAngle] = useState(0);
  const [fieldStrength, setFieldStrength] = useState(0);

  // Constants
  const centerX = 300;
  const centerY = 250;

  // Calculate field vector B at point (px, py)
  const calculateField = (px: number, py: number) => {
    // Dipole approximation or two-monopole model
    // Model 1: Single Magnet at (centerX, centerY). 
    // N pole at (centerX + 60, centerY), S pole at (centerX - 60, centerY)
    
    let Bx = 0;
    let By = 0;

    const addMonopole = (x: number, y: number, q: number) => {
      const dx = px - x;
      const dy = py - y;
      const r2 = dx * dx + dy * dy;
      const r = Math.sqrt(r2);
      if (r < 1) return; // avoid singularity
      const factor = (q * poleStrength * 1000) / (r2 * r); 
      Bx += factor * dx;
      By += factor * dy;
    };

    if (mode === 0) {
      // Single
      addMonopole(centerX + 60, centerY, 1);  // North
      addMonopole(centerX - 60, centerY, -1); // South
    } else if (mode === 1) {
      // Unlike: N-S ... N-S
      // Mag1: (150, 250)
      addMonopole(150 + 60, centerY, 1);
      addMonopole(150 - 60, centerY, -1);
      // Mag2: (450, 250) 
      addMonopole(450 + 60, centerY, 1);
      addMonopole(450 - 60, centerY, -1);
    } else {
      // Like: N-S ... S-N
      addMonopole(150 + 60, centerY, 1);
      addMonopole(150 - 60, centerY, -1);
      
      addMonopole(450 - 60, centerY, -1);
      addMonopole(450 + 60, centerY, 1); // Flipped
    }

    const B_total = Math.sqrt(Bx * Bx + By * By);
    const angle = (Math.atan2(By, Bx) * 180) / Math.PI;

    return { B: B_total, angle };
  };

  useEffect(() => {
    // Update compass orientation on move or state change
    const f = calculateField(compassPos.x, compassPos.y);
    setCompassAngle(f.angle);
    setFieldStrength(f.B);

    if (compassRef.current) {
       gsap.to(compassRef.current, { rotation: f.angle, transformOrigin: 'center center', duration: 0.2 });
    }
  }, [compassPos, mode, poleStrength]);

  useEffect(() => {
    // Animate flow lines
    const flowSpeed = 3 - (poleStrength / 10) * 2; // Stronger = Faster (lower duration)
    const ctx = gsap.context(() => {
      gsap.to(".flow-line", {
        strokeDashoffset: -100,
        duration: flowSpeed,
        repeat: -1,
        ease: "none"
      });
    }, linesRef);
    return () => ctx.revert();
  }, [mode, poleStrength]);

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    updateCompass(e);
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    updateCompass(e);
  };
  const handlePointerUp = () => setIsDragging(false);

  const updateCompass = (e: React.PointerEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;

    if (x < 20 || x > rect.width - 20 || y < 20 || y > rect.height - 20) {
      setValidationError("Compass Out of Bounds", "The compass has been dragged outside the valid magnetic field diagram area.", "Please keep the compass within the visible simulation field diagram.");
      setIsDragging(false);
      x = Math.max(24, Math.min(rect.width - 24, x));
      y = Math.max(24, Math.min(rect.height - 24, y));
    }

    setCompassPos({ x, y });
  };

  const recordObservation = () => {
    if (!hasAdjustedSlider['magnetic-field']) {
      setValidationError("Setup Incomplete", "You cannot map the field correctly before configuring the magnets.", "Adjust the pole strength or magnet configuration before recording field dots.");
      return;
    }
    // Distance from center (assuming single mode for basic data)
    let dist = Math.sqrt(Math.pow(compassPos.x - centerX, 2) + Math.pow(compassPos.y - centerY, 2));
    
    addObservation({
      "Distance from center (px)": dist.toFixed(1),
      "Relative Field Strength": fieldStrength.toFixed(3),
      "Compass Angle (°)": compassAngle.toFixed(1)
    });
  };

  // Generate approximate field lines for UI
  const renderLines = () => {
    if (mode === 0) {
      // Single Magnet
      const lines = [];
      for(let step=1; step<=8; step++) {
        const h = step * 40;
        lines.push(<path key={`u${step}`} className="flow-line" d={`M 360 250 C 450 ${250-h}, 150 ${250-h}, 240 250`} fill="none" stroke="#00d4ff" strokeWidth="2" strokeDasharray="5,15" opacity="0.6" />);
        lines.push(<path key={`d${step}`} className="flow-line" d={`M 360 250 C 450 ${250+h}, 150 ${250+h}, 240 250`} fill="none" stroke="#00d4ff" strokeWidth="2" strokeDasharray="5,15" opacity="0.6" />);
      }
      return lines;
    } else if (mode === 1) {
      // Unlike
      return (
        <>
          <path className="flow-line" d="M 210 250 L 390 250" fill="none" stroke="#00d4ff" strokeWidth="2" strokeDasharray="5,15" opacity="0.6" />
          <path className="flow-line" d="M 210 240 C 300 150, 300 150, 390 240" fill="none" stroke="#00d4ff" strokeWidth="2" strokeDasharray="5,15" opacity="0.6" />
          <path className="flow-line" d="M 210 260 C 300 350, 300 350, 390 260" fill="none" stroke="#00d4ff" strokeWidth="2" strokeDasharray="5,15" opacity="0.6" />
        </>
      );
    } else {
      // Like (repulsion)
      return (
        <>
          <path className="flow-line" d="M 210 240 C 250 150, 350 150, 390 240" fill="none" stroke="#00d4ff" strokeWidth="2" strokeDasharray="5,15" opacity="0.6" />
          <path className="flow-line" d="M 210 260 C 250 350, 350 350, 390 260" fill="none" stroke="#00d4ff" strokeWidth="2" strokeDasharray="5,15" opacity="0.6" />
          <path className="flow-line" d="M 210 250 C 250 200, 250 100, 150 100" fill="none" stroke="#00d4ff" strokeWidth="2" strokeDasharray="5,15" opacity="0.6" />
          <path className="flow-line" d="M 390 250 C 350 200, 350 100, 450 100" fill="none" stroke="#00d4ff" strokeWidth="2" strokeDasharray="5,15" opacity="0.6" />
        </>
      );
    }
  };

  return (
    <div 
      className="w-full h-full flex flex-col pt-6 relative touch-none select-none bg-[#02060d]"
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      style={{ cursor: isDragging ? 'grabbing' : 'crosshair' }}
    >
      <div className="absolute top-4 left-4 flex gap-4 z-10">
         <div className="bg-black/60 border border-gray-700 px-4 py-2 rounded pointer-events-none">
            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Compass Telemetry</div>
            <div className="font-mono text-sm text-accent-cyan flex flex-col gap-1">
               <span>B: {fieldStrength.toFixed(3)} uT</span>
               <span>θ: {compassAngle.toFixed(1)}°</span>
            </div>
         </div>
      </div>

      <svg width="100%" height="100%" viewBox="0 0 600 500" className="overflow-visible pointer-events-none">
         <g ref={linesRef}>
           {renderLines()}
         </g>

         {/* Magnets */}
         {mode === 0 && (
           <g transform={`translate(${centerX}, ${centerY})`}>
              {/* South Left, North Right */}
              <rect x="-60" y="-20" width="60" height="40" fill="#3b82f6" />
              <rect x="0" y="-20" width="60" height="40" fill="#ef4444" />
              <text x="-30" y="6" fill="white" fontWeight="bold" textAnchor="middle">S</text>
              <text x="30" y="6" fill="white" fontWeight="bold" textAnchor="middle">N</text>
           </g>
         )}

         {mode === 1 && (
           <>
             <g transform="translate(150, 250)">
                <rect x="-60" y="-20" width="60" height="40" fill="#3b82f6" /><rect x="0" y="-20" width="60" height="40" fill="#ef4444" />
                <text x="-30" y="6" fill="white" fontWeight="bold" textAnchor="middle">S</text><text x="30" y="6" fill="white" fontWeight="bold" textAnchor="middle">N</text>
             </g>
             <g transform="translate(450, 250)">
                <rect x="-60" y="-20" width="60" height="40" fill="#3b82f6" /><rect x="0" y="-20" width="60" height="40" fill="#ef4444" />
                <text x="-30" y="6" fill="white" fontWeight="bold" textAnchor="middle">S</text><text x="30" y="6" fill="white" fontWeight="bold" textAnchor="middle">N</text>
             </g>
           </>
         )}

         {mode === 2 && (
           <>
             <g transform="translate(150, 250)">
                <rect x="-60" y="-20" width="60" height="40" fill="#3b82f6" /><rect x="0" y="-20" width="60" height="40" fill="#ef4444" />
                <text x="-30" y="6" fill="white" fontWeight="bold" textAnchor="middle">S</text><text x="30" y="6" fill="white" fontWeight="bold" textAnchor="middle">N</text>
             </g>
             <g transform="translate(450, 250)">
                <rect x="-60" y="-20" width="60" height="40" fill="#ef4444" /><rect x="0" y="-20" width="60" height="40" fill="#3b82f6" />
                <text x="-30" y="6" fill="white" fontWeight="bold" textAnchor="middle">N</text><text x="30" y="6" fill="white" fontWeight="bold" textAnchor="middle">S</text>
             </g>
           </>
         )}

         {/* Draggable Compass */}
         <g transform={`translate(${compassPos.x}, ${compassPos.y})`}>
            {/* The compass body */}
            <circle cx="0" cy="0" r="24" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
            
            {/* The needle */}
            <g ref={compassRef}>
              <polygon points="-4,0 0,-18 4,0" fill="#ef4444" /> {/* N points away from source N */}
              <polygon points="-4,0 0,18 4,0" fill="#f8fafc" />
            </g>
         </g>
      </svg>

      <div className="absolute top-4 right-4 bg-black/80 px-4 py-3 border border-gray-700 rounded z-20">
         <button 
           onClick={recordObservation}
           className="w-full px-6 py-2 bg-blue-500/20 text-blue-400 border border-blue-500/50 hover:bg-blue-500/30 rounded font-bold transition-colors"
         >
           Log Field Strength
         </button>
         <div className="text-xs text-gray-400 mt-2 text-center">Click and drag anywhere to move the compass.</div>
      </div>
    </div>
  );
}
