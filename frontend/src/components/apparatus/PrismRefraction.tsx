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
  const materialIdx = Number(varState.material || 1.5); // refractive index mu

  const { setValidationError, hasAdjustedSlider } = useLabStore();

  // Fixed Equilateral Prism A = 60°
  const A = 60;
  const A_rad = (A * Math.PI) / 180;

  // Incident angle in radians
  const i1_rad = (incidentAngle * Math.PI) / 180;

  // Snell's Law at 1st surface: sin(i1) = μ * sin(r1)
  const r1_rad = Math.asin(Math.sin(i1_rad) / materialIdx);

  // Geometry of prism: r1 + r2 = A
  const r2_rad = A_rad - r1_rad;

  // Snell's Law at 2nd surface: μ * sin(r2) = sin(e)
  let e_rad = 0;
  let TIR = false;

  const sin_e = materialIdx * Math.sin(r2_rad);
  if (sin_e > 1) {
    TIR = true;
  } else {
    e_rad = Math.asin(sin_e);
  }

  const emergentAngle = (e_rad * 180) / Math.PI;
  const deviation = TIR ? 0 : incidentAngle + emergentAngle - A;

  // ─── Prism geometry (SVG coordinates) ───────────────────────────────────────
  // Equilateral triangle, side ≈ 220px, centered around (300, 280)
  // Apex at top, base at bottom
  const apex  = { x: 300, y: 110 };
  const baseL = { x: 173, y: 390 };
  const baseR = { x: 427, y: 390 };

  // Left face: from apex to baseL
  // The outward normal to the left face points LEFT and slightly up.
  // Left face direction vector (unnormalized): baseL - apex = (-127, 280)
  // Normal (rotate 90° CCW = outward): (-280, -127) → normalize
  const leftFaceNorm = Math.sqrt(280 * 280 + 127 * 127);
  // Outward unit normal of left face (pointing away from prism interior)
  const leftNormX = -280 / leftFaceNorm;  // ≈ -0.910
  const leftNormY = -127 / leftFaceNorm;  // ≈ -0.413

  // Angle of the left face outward normal from positive-x axis (degrees)
  // This is the direction the "normal line" dashes point
  const leftNormAngleDeg = (Math.atan2(leftNormY, leftNormX) * 180) / Math.PI; // ≈ -155.6°

  // ─── Entry point: fixed at midpoint of left face ────────────────────────────
  const t = 0.45; // parametric position along left face
  const P1 = {
    x: apex.x + t * (baseL.x - apex.x),
    y: apex.y + t * (baseL.y - apex.y),
  };

  // ─── Incident ray direction ──────────────────────────────────────────────────
  // The incident ray comes from the left. Its angle is measured from the
  // outward normal of the left face. We need to compute the ray's direction
  // in SVG space (x rightward, y downward).
  //
  // Left face outward normal angle (from +x axis): ~−155.6° (points up-left)
  // Inward normal angle (into prism): leftNormAngleDeg + 180° ≈ 24.4°
  //
  // The incident ray arrives such that it makes angle i1 with the outward normal.
  // The ray travels in the direction: inward-normal rotated by +i1 (refracted downward).
  // Concretely, incident ray direction = rotate inward normal by -i1 around it:
  const inwardNormAngle = leftNormAngleDeg + 180; // ≈ 24.4°
  const incidentDirAngleDeg = inwardNormAngle - incidentAngle; // rotate by -i1 (upward)
  const incidentDirRad = (incidentDirAngleDeg * Math.PI) / 180;

  // Trace back from P1 to find laser source (120px back along incident ray)
  const laserDist = 130;
  const P0 = {
    x: P1.x - laserDist * Math.cos(incidentDirRad),
    y: P1.y - laserDist * Math.sin(incidentDirRad),
  };

  // ─── Refracted ray inside prism ─────────────────────────────────────────────
  // Inside ray direction: inward normal rotated by r1 toward the base
  // (toward the right face), in SVG coords
  const insideDirAngleDeg = inwardNormAngle + (r1_rad * 180) / Math.PI;
  const insideDirRad = (insideDirAngleDeg * Math.PI) / 180;

  // ─── Find P2: intersection of inside ray with right face ─────────────────────
  // Right face: from apex (300,110) to baseR (427,390)
  // Parametric: Q(s) = apex + s*(baseR - apex)
  // Ray: P1 + u*(cos insideDirRad, sin insideDirRad)
  // Solve for s and u
  const dx = baseR.x - apex.x; // 127
  const dy = baseR.y - apex.y; // 280
  const rdx = Math.cos(insideDirRad);
  const rdy = Math.sin(insideDirRad);
  // P1 + u*(rdx, rdy) = apex + s*(dx, dy)
  // u*rdx - s*dx = apex.x - P1.x
  // u*rdy - s*dy = apex.y - P1.y
  const det = rdx * (-dy) - (-dx) * rdy; // rdx*(-dy) + dx*rdy
  const bx = apex.x - P1.x;
  const by = apex.y - P1.y;
  const u_param = (bx * (-dy) - (-dx) * by) / det;
  // const s_param = (rdx * by - bx * rdy) / det; // not needed

  const P2 = {
    x: P1.x + u_param * rdx,
    y: P1.y + u_param * rdy,
  };

  // ─── Right face outward normal ────────────────────────────────────────────────
  // Right face direction: baseR - apex = (127, 280)
  // Outward normal (rotate 90° CW = outward to the right): (280, -127) → normalize
  const rightFaceNorm = Math.sqrt(280 * 280 + 127 * 127); // same magnitude
  const rightNormX = 280 / rightFaceNorm;   // ≈ 0.910
  const rightNormY = -127 / rightFaceNorm;  // ≈ -0.413
  const rightNormAngleDeg = (Math.atan2(rightNormY, rightNormX) * 180) / Math.PI; // ≈ 24.4°

  // ─── Emergent ray direction ───────────────────────────────────────────────────
  // Emergent ray exits along outward normal rotated by e (emergent angle)
  const emergentDirAngleDeg = rightNormAngleDeg - emergentAngle; // rotate upward
  const emergentDirRad = (emergentDirAngleDeg * Math.PI) / 180;

  // Endpoints of the emergent ray (length 160px)
  const emergentLen = 160;
  const P3 = {
    x: P2.x + emergentLen * Math.cos(emergentDirRad),
    y: P2.y + emergentLen * Math.sin(emergentDirRad),
  };

  // ─── SVG Refs ─────────────────────────────────────────────────────────────────
  const incidentRayRef = useRef<SVGLineElement>(null);
  const insideRayRef   = useRef<SVGLineElement>(null);
  const emergentRayRef = useRef<SVGLineElement>(null);
  const spectrumRef    = useRef<SVGGElement>(null);
  const normal1Ref     = useRef<SVGLineElement>(null);
  const normal2Ref     = useRef<SVGLineElement>(null);

  useEffect(() => {
    // Normal at P1 (left face): draw dashes perpendicular to the left face
    const normalLen = 70;
    gsap.set(normal1Ref.current, {
      attr: {
        x1: P1.x + normalLen * leftNormX,
        y1: P1.y + normalLen * leftNormY,
        x2: P1.x - normalLen * leftNormX,
        y2: P1.y - normalLen * leftNormY,
      },
    });

    // Normal at P2 (right face)
    gsap.set(normal2Ref.current, {
      attr: {
        x1: P2.x + normalLen * rightNormX,
        y1: P2.y + normalLen * rightNormY,
        x2: P2.x - normalLen * rightNormX,
        y2: P2.y - normalLen * rightNormY,
      },
    });

    // Incident ray
    gsap.to(incidentRayRef.current, {
      attr: { x1: P0.x, y1: P0.y, x2: P1.x, y2: P1.y },
      duration: 0.3,
    });

    // Inside ray
    gsap.to(insideRayRef.current, {
      attr: { x1: P1.x, y1: P1.y, x2: P2.x, y2: P2.y },
      duration: 0.3,
    });

    if (TIR) {
      // Reflect inside the prism back from right face (bounce off left face)
      // Simplified: draw a reflected line going back left
      const reflectAngleRad = (insideDirAngleDeg - 2 * (insideDirAngleDeg - (rightNormAngleDeg + 180))) * Math.PI / 180;
      gsap.set(emergentRayRef.current, {
        attr: {
          x1: P2.x,
          y1: P2.y,
          x2: P2.x + 100 * Math.cos(reflectAngleRad),
          y2: P2.y + 100 * Math.sin(reflectAngleRad),
        },
      });
      gsap.to(spectrumRef.current, { opacity: 0, duration: 0.3 });
    } else {
      // Emergent ray (white)
      gsap.to(emergentRayRef.current, {
        attr: { x1: P2.x, y1: P2.y, x2: P3.x, y2: P3.y },
        duration: 0.3,
      });

      // Spectrum fan: each colour exits at a slightly different emergent angle
      // (dispersion: violet bends more, red bends less)
      // We spread ±4° around the white emergent angle
      gsap.to(spectrumRef.current, { opacity: 1, duration: 0.4 });
    }
  }, [incidentAngle, materialIdx, TIR,
    P0.x, P0.y, P1.x, P1.y, P2.x, P2.y, P3.x, P3.y,
    emergentDirRad, leftNormAngleDeg, rightNormAngleDeg]);

  // Helper: compute emergent endpoint for a given Δe offset (dispersion)
  const spectrumRay = (deltaEDeg: number) => {
    const dir = ((emergentDirAngleDeg + deltaEDeg) * Math.PI) / 180;
    return {
      x2: P2.x + emergentLen * Math.cos(dir),
      y2: P2.y + emergentLen * Math.sin(dir),
    };
  };

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
        'At an incidence angle below 30°, the deviation curve characteristics won\'t be easily observable.',
        'Set the incident angle to at least 35°.'
      );
      return;
    }
    if (TIR) {
      alert('Total Internal Reflection occurred. Cannot measure deviation.');
      return;
    }
    addObservation({
      'Angle i (°)': incidentAngle,
      'Angle r1 (°)': Number(((r1_rad * 180) / Math.PI).toFixed(2)),
      'Angle e (°)': Number(emergentAngle.toFixed(2)),
      'Angle δ (°)': Number(deviation.toFixed(2)),
    });
  };

  // Build spectrum ray coords once (React render, not useEffect, so SVG is correct on first paint)
  const specColors = [
    { color: 'rgba(255,0,0,0.9)',     delta: -3.0, label: 'R' },
    { color: 'rgba(255,140,0,0.9)',   delta: -1.8, label: 'O' },
    { color: 'rgba(255,255,0,0.9)',   delta: -0.8, label: 'Y' },
    { color: 'rgba(0,200,0,0.9)',     delta:  0.2, label: 'G' },
    { color: 'rgba(0,80,255,0.9)',    delta:  1.4, label: 'B' },
    { color: 'rgba(180,0,255,0.9)',   delta:  2.8, label: 'V' },
  ];

  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative bg-[#050B14]">

      {/* Readouts */}
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

      <svg width="100%" height="90%" viewBox="0 0 600 500" className="overflow-visible">

        {/* Prism */}
        <polygon
          points={`${apex.x},${apex.y} ${baseL.x},${baseL.y} ${baseR.x},${baseR.y}`}
          fill="rgba(0,212,255,0.08)"
          stroke="rgba(0,212,255,0.55)"
          strokeWidth="2.5"
        />

        {/* Normals (dashed) */}
        <line ref={normal1Ref} stroke="#475569" strokeDasharray="5,4" strokeWidth="1" />
        <line ref={normal2Ref} stroke="#475569" strokeDasharray="5,4" strokeWidth="1" />

        {/* Incident ray (white) */}
        <line ref={incidentRayRef} stroke="white" strokeWidth="3" strokeLinecap="round" />

        {/* Inside ray (cyan-tinted) */}
        <line ref={insideRayRef} stroke="rgba(0,212,255,0.85)" strokeWidth="3" strokeLinecap="round" />

        {/* Emergent / TIR ray */}
        <line ref={emergentRayRef} stroke="white" strokeWidth="3" strokeLinecap="round" />

        {/* Spectrum fan */}
        <g ref={spectrumRef} opacity={TIR ? 0 : 1}>
          {!TIR && specColors.map(({ color, delta }) => {
            const { x2, y2 } = spectrumRay(delta);
            return (
              <line
                key={delta}
                x1={P2.x} y1={P2.y}
                x2={x2}   y2={y2}
                stroke={color}
                strokeWidth="3"
                strokeLinecap="round"
              />
            );
          })}

          {/* Deviation arc annotation */}
          {!TIR && (() => {
            // Draw a small arc between the incident ray direction and the emergent ray direction
            // centered at P1 (simple visual indicator)
            const arcR = 38;
            const startAngle = incidentDirRad + Math.PI; // reverse (back along incident)
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
          <text x="300" y="460" textAnchor="middle" fill="orange" fontSize="13" fontWeight="bold">
            Total Internal Reflection — no emergent ray
          </text>
        )}

        {/* Angle label at incidence point */}
        <text
          x={P0.x + 10}
          y={P0.y - 8}
          fill="white"
          fontSize="11"
          opacity={0.7}
        >
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