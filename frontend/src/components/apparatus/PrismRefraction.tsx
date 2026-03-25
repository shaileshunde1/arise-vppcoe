import { useEffect, useRef } from 'react';
import { useLabStore } from '../../store/useLabStore';
import gsap from 'gsap';

interface ApparatusProps {
  varState: Record<string, number | string>;
  setVarState: React.Dispatch<React.SetStateAction<Record<string, number | string>>>;
  addObservation: (data: any) => void;
}

export default function PrismRefraction({ varState, addObservation }: ApparatusProps) {
  const incidentAngle = Number(varState.angle || 45); // 20 to 70 deg
  const materialIdx   = Number(varState.material || 1.5);

  const { setValidationError, hasAdjustedSlider } = useLabStore();

  const A     = 60;
  const A_rad = (A * Math.PI) / 180;
  const i1_rad = (incidentAngle * Math.PI) / 180;

  // Snell's Law – surface 1
  const r1_rad = Math.asin(Math.sin(i1_rad) / materialIdx);
  const r2_rad = A_rad - r1_rad;

  // Snell's Law – surface 2
  let e_rad = 0;
  let TIR   = false;
  const sin_e = materialIdx * Math.sin(r2_rad);
  if (sin_e > 1) {
    TIR = true;
  } else {
    e_rad = Math.asin(sin_e);
  }

  const emergentAngle = (e_rad * 180) / Math.PI;
  const deviation     = TIR ? 0 : incidentAngle + emergentAngle - A;

  // ── Prism geometry ──────────────────────────────────────────────────────────
  // Original equilateral prism dimensions (A=60° is exact with these ratios)
  const cx    = 300;
  const apex  = { x: cx,       y: 110 };
  const baseL = { x: cx - 127, y: 390 };
  const baseR = { x: cx + 127, y: 390 };

  // Left-face outward normal
  const leftFaceNorm     = Math.sqrt(280 * 280 + 127 * 127);
  const leftNormX        = -280 / leftFaceNorm;
  const leftNormY        = -127 / leftFaceNorm;
  const leftNormAngleDeg = (Math.atan2(leftNormY, leftNormX) * 180) / Math.PI;

  // Entry point — t=0.25 (upper quarter of left face) keeps P2 on the right face at high angles
  const t  = 0.25;
  const P1 = {
    x: apex.x + t * (baseL.x - apex.x),
    y: apex.y + t * (baseL.y - apex.y),
  };

  // Incident ray direction
  const inwardNormAngle     = leftNormAngleDeg + 180;
  const incidentDirAngleDeg = inwardNormAngle - incidentAngle;
  const incidentDirRad      = (incidentDirAngleDeg * Math.PI) / 180;

  const laserDist = 110;
  const P0 = {
    x: P1.x - laserDist * Math.cos(incidentDirRad),
    y: P1.y - laserDist * Math.sin(incidentDirRad),
  };

  // Inside ray direction
  const insideDirAngleDeg = inwardNormAngle + (r1_rad * 180) / Math.PI;
  const insideDirRad      = (insideDirAngleDeg * Math.PI) / 180;

  // P2: intersection with right face, s_param clamped to [0,0.98] so it never escapes past baseR
  const dx  = baseR.x - apex.x;
  const dy  = baseR.y - apex.y;
  const rdx = Math.cos(insideDirRad);
  const rdy = Math.sin(insideDirRad);
  const det = rdx * (-dy) - (-dx) * rdy;
  const bx  = apex.x - P1.x;
  const by  = apex.y - P1.y;
  const s_raw = (rdx * (apex.y - P1.y) - (apex.x - P1.x) * rdy) / det;
  const s_param = Math.min(Math.max(s_raw, 0), 0.98);
  const P2 = {
    x: apex.x + s_param * dx,
    y: apex.y + s_param * dy,
  };

  // Right-face outward normal
  const rightFaceNorm     = leftFaceNorm;
  const rightNormX        =  280 / rightFaceNorm;
  const rightNormY        = -127 / rightFaceNorm;
  const rightNormAngleDeg = (Math.atan2(rightNormY, rightNormX) * 180) / Math.PI;

  // Emergent ray, clipped so P3 never goes below y=480
  const emergentDirAngleDeg = rightNormAngleDeg - emergentAngle;
  const emergentDirRad      = (emergentDirAngleDeg * Math.PI) / 180;
  const emergentLen = 140;
  const P3raw = {
    x: P2.x + emergentLen * Math.cos(emergentDirRad),
    y: P2.y + emergentLen * Math.sin(emergentDirRad),
  };
  const maxY = 480;
  const P3 = (P3raw.y > maxY)
    ? { x: P2.x + (maxY - P2.y) / (P3raw.y - P2.y) * (P3raw.x - P2.x), y: maxY }
    : P3raw;

  // ── Refs ────────────────────────────────────────────────────────────────────
  const incidentRayRef = useRef<SVGLineElement>(null);
  const insideRayRef   = useRef<SVGLineElement>(null);
  const emergentRayRef = useRef<SVGLineElement>(null);
  const spectrumRef    = useRef<SVGGElement>(null);
  const normal1Ref     = useRef<SVGLineElement>(null);
  const normal2Ref     = useRef<SVGLineElement>(null);

  useEffect(() => {
    const normalLen = 70;

    gsap.set(normal1Ref.current, {
      attr: {
        x1: P1.x + normalLen * leftNormX,  y1: P1.y + normalLen * leftNormY,
        x2: P1.x - normalLen * leftNormX,  y2: P1.y - normalLen * leftNormY,
      },
    });
    gsap.set(normal2Ref.current, {
      attr: {
        x1: P2.x + normalLen * rightNormX, y1: P2.y + normalLen * rightNormY,
        x2: P2.x - normalLen * rightNormX, y2: P2.y - normalLen * rightNormY,
      },
    });

    gsap.to(incidentRayRef.current, { attr: { x1: P0.x, y1: P0.y, x2: P1.x, y2: P1.y }, duration: 0.3 });
    gsap.to(insideRayRef.current,   { attr: { x1: P1.x, y1: P1.y, x2: P2.x, y2: P2.y }, duration: 0.3 });

    if (TIR) {
      const reflectAngleRad =
        (insideDirAngleDeg - 2 * (insideDirAngleDeg - (rightNormAngleDeg + 180))) * Math.PI / 180;
      gsap.set(emergentRayRef.current, {
        attr: {
          x1: P2.x, y1: P2.y,
          x2: P2.x + 100 * Math.cos(reflectAngleRad),
          y2: P2.y + 100 * Math.sin(reflectAngleRad),
        },
      });
      gsap.to(spectrumRef.current, { opacity: 0, duration: 0.3 });
    } else {
      gsap.to(emergentRayRef.current, { attr: { x1: P2.x, y1: P2.y, x2: P3.x, y2: P3.y }, duration: 0.3 });
      gsap.to(spectrumRef.current, { opacity: 1, duration: 0.4 });
    }
  }, [incidentAngle, materialIdx, TIR,
    P0.x, P0.y, P1.x, P1.y, P2.x, P2.y, P3.x, P3.y,
    emergentDirRad, leftNormAngleDeg, rightNormAngleDeg]);

  const spectrumRay = (deltaEDeg: number) => {
    const dir = ((emergentDirAngleDeg + deltaEDeg) * Math.PI) / 180;
    const rx = P2.x + emergentLen * Math.cos(dir);
    const ry = P2.y + emergentLen * Math.sin(dir);
    if (ry > maxY) {
      return { x2: P2.x + (maxY - P2.y) / (ry - P2.y) * (rx - P2.x), y2: maxY };
    }
    return { x2: rx, y2: ry };
  };

  const specColors = [
    { color: 'rgba(255,0,0,0.9)',   delta: -3.0 },
    { color: 'rgba(255,140,0,0.9)', delta: -1.8 },
    { color: 'rgba(255,255,0,0.9)', delta: -0.8 },
    { color: 'rgba(0,200,0,0.9)',   delta:  0.2 },
    { color: 'rgba(0,80,255,0.9)',  delta:  1.4 },
    { color: 'rgba(180,0,255,0.9)', delta:  2.8 },
  ];

  const recordObservation = () => {
    if (!hasAdjustedSlider['prism-refraction']) {
      setValidationError(
        'Setup Incomplete',
        'You cannot record data before adjusting the apparatus.',
        'Adjust the incident angle or change the prism material first.'
      );
      return;
    }
    if (incidentAngle < 30) {
      setValidationError(
        'Angle Too Narrow',
        'At an incidence angle below 30°, deviation curve characteristics won\'t be easily observable.',
        'Set the incident angle to at least 35°.'
      );
      return;
    }
    if (TIR) {
      alert('Total Internal Reflection occurred. Cannot measure deviation.');
      return;
    }
    addObservation({
      'Angle i (°)':  incidentAngle,
      'Angle r₁ (°)': Number(((r1_rad * 180) / Math.PI).toFixed(2)),
      'Angle e (°)':  Number(emergentAngle.toFixed(2)),
      'Angle δ (°)':  Number(deviation.toFixed(2)),
    });
  };



  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative bg-[#050B14]">

      {/* Optical metrics */}
      <div className="absolute top-4 left-4 flex gap-4 z-10">
        <div className="bg-black/60 border border-gray-700 px-4 py-2 rounded">
          <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Optical Metrics</div>
          <div className="font-mono text-sm text-accent-cyan flex flex-col gap-1">
            <span>Incidence:  i  = {incidentAngle}°</span>
            <span>Refraction: r₁ = {((r1_rad * 180) / Math.PI).toFixed(2)}°</span>
            <span>Emergence:  e  = {TIR ? 'T.I.R' : emergentAngle.toFixed(2) + '°'}</span>
            <span>Deviation:  δ  = {TIR ? '—' : deviation.toFixed(2) + '°'}</span>
          </div>
        </div>
      </div>

      <svg width="100%" height="90%" viewBox="0 0 600 500" preserveAspectRatio="xMidYMid meet" className="overflow-visible">

        {/* Prism */}
        <polygon
          points={`${apex.x},${apex.y} ${baseL.x},${baseL.y} ${baseR.x},${baseR.y}`}
          fill="rgba(0,212,255,0.08)"
          stroke="rgba(0,212,255,0.55)"
          strokeWidth="2.5"
        />
        <text x={apex.x} y={apex.y - 10} textAnchor="middle" fill="rgba(0,212,255,0.55)" fontSize="11">A = 60°</text>

        {/* Normals */}
        <line ref={normal1Ref} stroke="#475569" strokeDasharray="5,4" strokeWidth="1" />
        <line ref={normal2Ref} stroke="#475569" strokeDasharray="5,4" strokeWidth="1" />

        {/* Rays */}
        <line ref={incidentRayRef} stroke="white"                strokeWidth="3" strokeLinecap="round" />
        <line ref={insideRayRef}   stroke="rgba(0,212,255,0.85)" strokeWidth="3" strokeLinecap="round" />
        <line ref={emergentRayRef} stroke="white"                strokeWidth="3" strokeLinecap="round" />

        {/* Spectrum fan + deviation arc */}
        <g ref={spectrumRef} opacity={TIR ? 0 : 1}>
          {!TIR && specColors.map(({ color, delta }) => {
            const { x2, y2 } = spectrumRay(delta);
            return (
              <line
                key={delta}
                x1={P2.x} y1={P2.y} x2={x2} y2={y2}
                stroke={color} strokeWidth="3" strokeLinecap="round"
              />
            );
          })}

          {!TIR && (() => {
            const arcR       = 38;
            const startAngle = incidentDirRad + Math.PI;
            const endAngle   = emergentDirRad;
            const sx = P1.x + arcR * Math.cos(startAngle);
            const sy = P1.y + arcR * Math.sin(startAngle);
            const ex = P1.x + arcR * Math.cos(endAngle);
            const ey = P1.y + arcR * Math.sin(endAngle);
            return (
              <>
                <path
                  d={`M ${sx} ${sy} A ${arcR} ${arcR} 0 0 1 ${ex} ${ey}`}
                  fill="none" stroke="yellow" strokeWidth="1" strokeDasharray="3,3"
                />
                <text x={P1.x - 28} y={P1.y + 10} fill="yellow" fontSize="13" fontStyle="italic">δ</text>
              </>
            );
          })()}
        </g>

        {/* TIR label */}
        {TIR && (
          <text x={cx} y="460" textAnchor="middle" fill="orange" fontSize="13" fontWeight="bold">
            Total Internal Reflection — no emergent ray
          </text>
        )}

        {/* Incident angle label */}
        <text x={P0.x + 10} y={P0.y - 8} fill="white" fontSize="11" opacity={0.7}>
          i = {incidentAngle}°
        </text>
      </svg>

      {/* Record button */}
      <div className="absolute top-4 right-4 bg-black/80 px-4 py-3 border border-gray-700 rounded min-w-[200px]">
        <button
          onClick={recordObservation}
          disabled={TIR}
          className="w-full py-2 bg-blue-500/20 text-blue-400 border border-blue-500/50 hover:bg-blue-500/30 rounded font-bold disabled:opacity-50 transition-colors"
        >
          Record δ (Deviation)
        </button>
      </div>


    </div>
  );
} 