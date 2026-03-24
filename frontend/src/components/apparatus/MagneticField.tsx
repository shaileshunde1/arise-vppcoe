import { useCallback, useEffect, useRef, useState } from 'react';
import { useLabStore } from '../../store/useLabStore';
import gsap from 'gsap';

interface ApparatusProps {
  varState: Record<string, number | string>;
  setVarState: React.Dispatch<React.SetStateAction<Record<string, number | string>>>;
  addObservation: (data: any) => void;
}

const VB_W = 700;
const VB_H = 480;
const MAG_HALF = 70;

export default function MagneticField({ varState, addObservation }: ApparatusProps) {
  const poleStrength = Number(varState.strength || 5);
  const mode = Number(varState.mode || 0);

  const { setValidationError } = useLabStore();
  const compassRef   = useRef<SVGGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const linesRef     = useRef<SVGGElement>(null);

  // FIX 1: Start compass at centre of canvas, at same height as magnet (y=260)
  // so it immediately reads a real field value, not some off-canvas default.
  const [compassPos, setCompassPos] = useState({ x: 350, y: 160 });
  const [isDragging, setIsDragging] = useState(false);
  const [compassAngle, setCompassAngle] = useState(0);
  const [fieldStrength, setFieldStrength] = useState(0);
  // FIX 2: track whether the compass has actually been moved by the user
  const [compassMoved, setCompassMoved] = useState(false);

  // Pole positions — N pole is red (+1), S pole is blue (-1)
  const getPoles = useCallback((m: number) => {
    if (m === 0) {
      return [
        { x: 350 + MAG_HALF, y: 260, q: +1 }, // N (right)
        { x: 350 - MAG_HALF, y: 260, q: -1 }, // S (left)
      ];
    } else if (m === 1) {
      return [
        { x: 170 + MAG_HALF, y: 260, q: +1 },
        { x: 170 - MAG_HALF, y: 260, q: -1 },
        { x: 530 - MAG_HALF, y: 260, q: -1 },
        { x: 530 + MAG_HALF, y: 260, q: +1 },
      ];
    } else {
      return [
        { x: 170 + MAG_HALF, y: 260, q: +1 },
        { x: 170 - MAG_HALF, y: 260, q: -1 },
        { x: 530 - MAG_HALF, y: 260, q: +1 },
        { x: 530 + MAG_HALF, y: 260, q: -1 },
      ];
    }
  }, []);

  const calculateField = useCallback((px: number, py: number, m: number, strength: number) => {
    let Bx = 0, By = 0;
    for (const pole of getPoles(m)) {
      const dx = px - pole.x;
      const dy = py - pole.y;
      const r2 = dx * dx + dy * dy;
      const r  = Math.sqrt(r2);
      if (r < 5) continue;
      const factor = (pole.q * strength * 800) / (r2 * r);
      Bx += factor * dx;
      By += factor * dy;
    }
    const B_total = Math.sqrt(Bx * Bx + By * By);
    const angle = (Math.atan2(By, Bx) * 180) / Math.PI;
    return { B: B_total, angle };
  }, [getPoles]);

  // FIX 3: Recompute field whenever compassPos, mode, OR poleStrength changes.
  // Previously this worked but the distance in recordObservation was wrong — fixed below.
  useEffect(() => {
    const f = calculateField(compassPos.x, compassPos.y, mode, poleStrength);
    setCompassAngle(f.angle);
    setFieldStrength(f.B);
    if (compassRef.current) {
      gsap.to(compassRef.current, {
        rotation: f.angle,
        transformOrigin: 'center center',
        duration: 0.3,
        ease: 'power2.out',
      });
    }
  }, [compassPos, mode, poleStrength, calculateField]);

  // Animate field lines
  useEffect(() => {
    const flowSpeed = Math.max(0.8, 3.5 - (poleStrength / 10) * 2.5);
    const ctx = gsap.context(() => {
      gsap.to('.flow-line', {
        strokeDashoffset: -80,
        duration: flowSpeed,
        repeat: -1,
        ease: 'none',
      });
    }, linesRef);
    return () => ctx.revert();
  }, [mode, poleStrength]);

  const toSVGCoords = (e: React.PointerEvent) => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width)  * VB_W,
      y: ((e.clientY - rect.top)  / rect.height) * VB_H,
    };
  };

  const updateCompass = (e: React.PointerEvent) => {
    const pos = toSVGCoords(e);
    if (!pos) return;
    const margin = 30;
    const x = Math.max(margin, Math.min(VB_W - margin, pos.x));
    const y = Math.max(margin, Math.min(VB_H - margin, pos.y));
    if (pos.x !== x || pos.y !== y) {
      setValidationError('Out of Bounds', 'Compass is outside the field area.', 'Keep it within the simulation boundary.');
    }
    setCompassPos({ x, y });
    setCompassMoved(true); // FIX 2: mark that the user actually moved the compass
  };

  const handlePointerDown = (e: React.PointerEvent) => { setIsDragging(true); updateCompass(e); };
  const handlePointerMove = (e: React.PointerEvent) => { if (isDragging) updateCompass(e); };
  const handlePointerUp   = () => setIsDragging(false);

  // FIX 4: Record observation correctly.
  // - Removed the hasAdjustedSlider gate — the relevant action here IS placing the compass.
  // - Distance is now computed from the NEAREST pole, not a hardcoded magnet centre.
  // - All readings come from the live compassPos/compassAngle/fieldStrength state.
  const recordObservation = () => {
    if (!compassMoved) {
      setValidationError(
        'Compass Not Placed',
        'Drag the compass to a position near the magnet first.',
        'Click and drag the compass to explore the field, then log a reading.'
      );
      return;
    }

    // Find closest pole to the current compass position
    const poles = getPoles(mode);
    let minDist = Infinity;
    let nearestPoleLabel = '';
    poles.forEach(pole => {
      const d = Math.sqrt(Math.pow(compassPos.x - pole.x, 2) + Math.pow(compassPos.y - pole.y, 2));
      if (d < minDist) {
        minDist = d;
        nearestPoleLabel = pole.q === +1 ? 'N' : 'S';
      }
    });

    // Convert SVG-px distance to a relative cm scale (1 px ≈ 0.05 cm at this scale)
    const distCm = (minDist * 0.05).toFixed(2);

    addObservation({
      'Distance from nearest pole (cm)': distCm,
      'Nearest Pole': nearestPoleLabel,
      'Field Strength (μT)': fieldStrength.toFixed(3),
      'Compass Angle (°)': compassAngle.toFixed(1),
      'Mode': mode === 0 ? 'Single magnet' : mode === 1 ? 'Unlike poles (attract)' : 'Like poles (repel)',
      'Pole Strength Setting': poleStrength,
    });
  };

  const lineOpacity = 0.4 + (poleStrength / 10) * 0.45;
  const lineWidth   = 1 + (poleStrength / 10) * 1.5;

  const lineProps = {
    fill: 'none' as const,
    stroke: '#00d4ff',
    strokeWidth: lineWidth,
    strokeDasharray: '8,12' as const,
    opacity: lineOpacity,
    className: 'flow-line',
  };

  const renderLines = () => {
    const arcs: JSX.Element[] = [];

    if (mode === 0) {
      const offsets = [35, 70, 110, 160, 220, 290];
      offsets.forEach((h, i) => {
        arcs.push(
          <path key={`u${i}`} {...lineProps}
            d={`M 280 260 C 280 ${260 - h}, 420 ${260 - h}, 420 260`} />,
          <path key={`d${i}`} {...lineProps}
            d={`M 280 260 C 280 ${260 + h}, 420 ${260 + h}, 420 260`} />
        );
      });
      arcs.push(<line key="centre" {...lineProps} x1="280" y1="260" x2="420" y2="260" />);
    } else if (mode === 1) {
      arcs.push(
        <line key="c0" {...lineProps} x1="240" y1="260" x2="460" y2="260" />,
        <path key="c1" {...lineProps} d="M 240 250 C 350 190, 350 190, 460 250" />,
        <path key="c2" {...lineProps} d="M 240 270 C 350 330, 350 330, 460 270" />,
        <path key="c3" {...lineProps} d="M 240 235 C 350 130, 350 130, 460 235" />,
        <path key="c4" {...lineProps} d="M 240 285 C 350 390, 350 390, 460 285" />,
        <path key="c5" {...lineProps} d="M 240 220 C 350 70, 350 70, 460 220" />,
        <path key="c6" {...lineProps} d="M 240 300 C 350 450, 350 450, 460 300" />,
        <path key="ol1" {...lineProps} d="M 100 260 C 100 30, 600 30, 600 260" />,
        <path key="ol2" {...lineProps} d="M 100 260 C 100 490, 600 490, 600 260" />,
      );
    } else {
      arcs.push(
        <path key="ll1" {...lineProps} d="M 240 260 C 220 200, 120 160, 60 190" />,
        <path key="ll2" {...lineProps} d="M 240 260 C 220 320, 120 360, 60 330" />,
        <path key="ll3" {...lineProps} d="M 240 255 C 180 160, 100 110, 50 140" />,
        <path key="ll4" {...lineProps} d="M 240 265 C 180 360, 100 410, 50 380" />,
        <path key="ll5" {...lineProps} d="M 240 250 C 150 110, 80 60,  40  90" />,
        <path key="ll6" {...lineProps} d="M 240 270 C 150 410, 80 460, 40 430" />,
        <path key="rl1" {...lineProps} d="M 460 260 C 480 200, 580 160, 640 190" />,
        <path key="rl2" {...lineProps} d="M 460 260 C 480 320, 580 360, 640 330" />,
        <path key="rl3" {...lineProps} d="M 460 255 C 520 160, 600 110, 650 140" />,
        <path key="rl4" {...lineProps} d="M 460 265 C 520 360, 600 410, 650 380" />,
        <path key="rl5" {...lineProps} d="M 460 250 C 550 110, 620 60,  660  90" />,
        <path key="rl6" {...lineProps} d="M 460 270 C 550 410, 620 460, 660 430" />,
        <path key="np1" {...lineProps} d="M 240 240 C 300 100, 400 100, 460 240" />,
        <path key="np2" {...lineProps} d="M 240 280 C 300 420, 400 420, 460 280" />,
      );
    }
    return arcs;
  };

  const renderMagnets = () => {
    const SingleMagnet = ({ cx }: { cx: number }) => (
      <g transform={`translate(${cx}, 260)`}>
        <rect x={-MAG_HALF} y="-22" width={MAG_HALF} height="44" fill="#2563eb" rx="4 0 0 4" />
        <rect x="0"         y="-22" width={MAG_HALF} height="44" fill="#dc2626" rx="0 4 4 0" />
        <text x={-MAG_HALF / 2} y="6" fill="white" fontWeight="800" fontSize="18" textAnchor="middle">S</text>
        <text x={ MAG_HALF / 2} y="6" fill="white" fontWeight="800" fontSize="18" textAnchor="middle">N</text>
        <line x1={-MAG_HALF + 4} y1="0" x2={MAG_HALF - 4} y2="0" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeDasharray="4,4" />
      </g>
    );

    if (mode === 0) return <SingleMagnet cx={350} />;

    if (mode === 1) {
      return (
        <g>
          <g transform="translate(170, 260)">
            <rect x={-MAG_HALF} y="-22" width={MAG_HALF} height="44" fill="#2563eb" />
            <rect x="0"         y="-22" width={MAG_HALF} height="44" fill="#dc2626" />
            <text x={-MAG_HALF / 2} y="6" fill="white" fontWeight="800" fontSize="18" textAnchor="middle">S</text>
            <text x={ MAG_HALF / 2} y="6" fill="white" fontWeight="800" fontSize="18" textAnchor="middle">N</text>
          </g>
          <g transform="translate(530, 260)">
            <rect x={-MAG_HALF} y="-22" width={MAG_HALF} height="44" fill="#2563eb" />
            <rect x="0"         y="-22" width={MAG_HALF} height="44" fill="#dc2626" />
            <text x={-MAG_HALF / 2} y="6" fill="white" fontWeight="800" fontSize="18" textAnchor="middle">S</text>
            <text x={ MAG_HALF / 2} y="6" fill="white" fontWeight="800" fontSize="18" textAnchor="middle">N</text>
          </g>
          <text x="350" y="230" fill="#22c55e" fontSize="13" textAnchor="middle" fontWeight="600">
            ← Unlike poles attract →
          </text>
        </g>
      );
    }

    return (
      <g>
        <g transform="translate(170, 260)">
          <rect x={-MAG_HALF} y="-22" width={MAG_HALF} height="44" fill="#2563eb" />
          <rect x="0"         y="-22" width={MAG_HALF} height="44" fill="#dc2626" />
          <text x={-MAG_HALF / 2} y="6" fill="white" fontWeight="800" fontSize="18" textAnchor="middle">S</text>
          <text x={ MAG_HALF / 2} y="6" fill="white" fontWeight="800" fontSize="18" textAnchor="middle">N</text>
        </g>
        <g transform="translate(530, 260)">
          <rect x={-MAG_HALF} y="-22" width={MAG_HALF} height="44" fill="#dc2626" />
          <rect x="0"         y="-22" width={MAG_HALF} height="44" fill="#2563eb" />
          <text x={-MAG_HALF / 2} y="6" fill="white" fontWeight="800" fontSize="18" textAnchor="middle">N</text>
          <text x={ MAG_HALF / 2} y="6" fill="white" fontWeight="800" fontSize="18" textAnchor="middle">S</text>
        </g>
        <text x="350" y="230" fill="#f87171" fontSize="13" textAnchor="middle" fontWeight="600">
          → Like poles repel ←
        </text>
      </g>
    );
  };

  return (
    <div
      className="w-full h-full flex flex-col relative touch-none select-none bg-[#02060d]"
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      style={{ cursor: isDragging ? 'grabbing' : 'crosshair' }}
    >
      {/* Telemetry */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none bg-black/60 border border-gray-700 px-4 py-2 rounded">
        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Compass Telemetry</div>
        <div className="font-mono text-sm text-cyan-400 flex flex-col gap-1">
          <span>B: {fieldStrength.toFixed(3)} μT</span>
          <span>θ: {compassAngle.toFixed(1)}°</span>
          <span className="text-gray-500 text-[10px]">
            {mode === 0 ? 'Single magnet' : mode === 1 ? 'Unlike poles (attract)' : 'Like poles (repel)'}
          </span>
        </div>
      </div>

      <svg
        width="100%" height="100%"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        style={{ pointerEvents: 'none' }}
      >
        <g ref={linesRef}>{renderLines()}</g>
        {renderMagnets()}

        {/* Compass */}
        <g transform={`translate(${compassPos.x}, ${compassPos.y})`}>
          <circle cx="0" cy="0" r="26"
            fill="rgba(255,255,255,0.07)"
            stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map(a => (
            <line key={a} x1="0" y1={a % 90 === 0 ? -21 : -19} x2="0" y2="-24"
              stroke={a % 90 === 0 ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.25)'}
              strokeWidth="1.5"
              transform={`rotate(${a})`} />
          ))}
          <text x="0" y="-29" fill="rgba(255,255,255,0.4)" fontSize="8" textAnchor="middle">N</text>
          <g ref={compassRef}>
            <polygon points="0,-20 4,2 0,6 -4,2" fill="#ef4444" />
            <polygon points="0,20 4,2 0,6 -4,2"  fill="#e2e8f0" />
            <circle cx="0" cy="0" r="3.5" fill="#94a3b8" />
          </g>
        </g>

        {/* FIX 5: Show a pulsing "drag me" hint until the compass has been moved */}
        {!compassMoved && (
          <text x={compassPos.x} y={compassPos.y + 42} textAnchor="middle"
            fill="rgba(250,204,21,0.7)" fontSize="11" fontWeight="bold">
            ← drag to explore →
          </text>
        )}
        {compassMoved && (
          <text x={compassPos.x} y={compassPos.y + 38} textAnchor="middle"
            fill="rgba(255,255,255,0.25)" fontSize="10">drag</text>
        )}

        <text x={VB_W / 2} y={VB_H - 18} textAnchor="middle"
          fill="rgba(255,255,255,0.2)" fontSize="11">
          Drag the compass to explore the field. Field line density increases with pole strength.
        </text>
      </svg>

      {/* Record button */}
      <div className="absolute top-4 right-4 bg-black/80 px-4 py-3 border border-gray-700 rounded z-20">
        <button onClick={recordObservation}
          className="w-full px-6 py-2 bg-blue-500/20 text-blue-400 border border-blue-500/50 hover:bg-blue-500/30 rounded font-bold transition-colors">
          Log Field Reading
        </button>
        <div className="text-xs text-gray-500 mt-2 text-center">
          Red needle tip → points away from S pole
        </div>
        {/* FIX 6: Show clear status so user knows what will be recorded */}
        <div className="text-xs text-center mt-1">
          {compassMoved
            ? <span className="text-green-400">✓ Reading from compass position</span>
            : <span className="text-yellow-400">Move compass first</span>
          }
        </div>
      </div>
    </div>
  );
}