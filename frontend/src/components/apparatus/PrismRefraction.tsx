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
  
  // Snell's Law 1st surface: 1 * sin(i1) = μ * sin(r1)
  const r1_rad = Math.asin(Math.sin(i1_rad) / materialIdx);
  
  // Geometry of prism: r1 + r2 = A
  const r2_rad = A_rad - r1_rad;

  // Snell's Law 2nd surface: μ * sin(r2) = 1 * sin(i2) (i2=emergent angle e)
  let e_rad = 0;
  let TIR = false; // Total Internal Reflection check
  
  const sin_e = materialIdx * Math.sin(r2_rad);
  if (sin_e > 1) {
    TIR = true;
  } else {
    e_rad = Math.asin(sin_e);
  }

  const emergentAngle = (e_rad * 180) / Math.PI;

  // Deviation δ = i + e - A
  const deviation = TIR ? 0 : incidentAngle + emergentAngle - A;

  // Geometric coordinates for SVG drawing
  // Prism Center at (300, 250)
  // Side length roughly 200px
  // Points: Top(300, 100), BottomLeft(126.8, 400), BottomRight(473.2, 400)
  const prismPoints = "300,100 126.8,400 473.2,400";
  
  // The first point of contact on left face (x,y)
  // Line Top -> BottomLeft:
  // We'll fix contact height for visual simplicity (y = 250)
  const contact1_y = 250;
  // Left face line eq: x interpolates between 300 and 126.8 based on y from 100 to 400
  // fraction = (250 - 100)/(400 - 100) = 150/300 = 0.5
  // x = 300 + 0.5*(126.8-300) = 300 - 86.6 = 213.4
  const contact1_x = 213.4;

  // Normal to left face is -30deg from horizontal (left face angle is 60deg from horiz)
  // actually, normal to left face points at angle 150deg standard or 5π/6
  // Inside ray travels at angle (normal1 - r1_deg) ...
  // Geometry gets complex for SVG without a matrix approach.
  // Instead of full rigorous geometry mapping for SVG endpoints, we will use SVG transforms 
  // on a master group or calculate approximate vectors for visual representation.
  
  const r1_deg = (r1_rad * 180) / Math.PI;
  // Bending towards normal on entry.
  // Beam rotation inside prism.
  const inside_angle_visual = incidentAngle - r1_deg; 

  // SVG Refs
  const rayPathRef = useRef<SVGPathElement>(null);
  const spectrumRef = useRef<SVGGElement>(null);

  useEffect(() => {
    // Generate the path geometry mathematically
    
    // Simplification for diagram:
    // P0: Laser source
    const startX = 50;
    const startY = contact1_y - Math.tan((incidentAngle * Math.PI)/180) * (contact1_x - startX);
    
    // P1: Contact 1 (Left face)
    const p1 = { x: contact1_x, y: contact1_y };

    // P2: Contact 2 (Right face)
    const rayLengthInside = 150; // Approximated
    const insideAngleRad = (inside_angle_visual * Math.PI) / 180;
    // Ray travels downward/horizontal
    const p2_x = p1.x + rayLengthInside * Math.cos(insideAngleRad);
    const p2_y = p1.y + rayLengthInside * Math.sin(insideAngleRad);



    const pathData = `M ${startX} ${startY} L ${p1.x} ${p1.y} L ${p2_x} ${p2_y}`;

    // GSAP draw SVG path
    gsap.set(rayPathRef.current, { attr: { d: pathData } });
    
    if (TIR) {
       gsap.set(spectrumRef.current, { opacity: 0 });
    } else {
       gsap.to(spectrumRef.current, { 
         opacity: 1, 
         x: p2_x, y: p2_y, 
         rotation: emergentAngle * (1 + (materialIdx - 1.5)/2), // Spread scales lightly
         transformOrigin: "left center",
         duration: 0.5
       });
    }

  }, [incidentAngle, materialIdx, inside_angle_visual, emergentAngle, TIR]);

  const recordObservation = () => {
    if (!hasAdjustedSlider['prism-refraction']) {
      setValidationError("Setup Incomplete", "You cannot record data before adjusting the apparatus.", "Adjust the incident angle or change the prism material first.");
      return;
    }
    if (incidentAngle < 30) {
      setValidationError("Angle Too Narrow", "At an incidence angle below 30°, the emergent ray might undergo total internal reflection and the deviation curve characteristics won't be easily observable.", "Set the incident angle to at least 35°.");
      return;
    }
    if (TIR) {
      alert("Total Internal Reflection occurred. Cannot measure deviation.");
      return;
    }
    addObservation({
      "Angle i (°)": incidentAngle,
      "Angle δ (°)": Number(deviation.toFixed(2))
    });
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative bg-[#050B14]">
      
      {/* Readouts Header */}
      <div className="absolute top-4 left-4 flex gap-4 z-10">
         <div className="bg-black/60 border border-gray-700 px-4 py-2 rounded">
            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Optical Metrics</div>
            <div className="font-mono text-sm text-accent-cyan flex flex-col gap-1">
               <span>Incidence: i = {incidentAngle}°</span>
               <span>Emergence: e = {TIR ? "T.I.R" : emergentAngle.toFixed(2) + "°"}</span>
               <span>Deviation: δ = {TIR ? "-" : deviation.toFixed(2) + "°"}</span>
            </div>
         </div>
      </div>

      <svg width="100%" height="90%" viewBox="0 0 600 500" className="overflow-visible">
         {/* Normal left face */}
         <line x1={contact1_x - 80} y1={contact1_y - 46} x2={contact1_x + 80} y2={contact1_y + 46} stroke="#475569" strokeDasharray="5,5" />
         
         <polygon points={prismPoints} fill="rgba(0, 212, 255, 0.1)" stroke="rgba(0, 212, 255, 0.5)" strokeWidth="3" />
         
         {/* Incident and Inside Ray */}
         <path ref={rayPathRef} fill="none" stroke="white" strokeWidth="4" />

         {/* Spectral Exit Rays */}
         <g ref={spectrumRef} opacity={0}>
            <line x1="0" y1="0" x2="250" y2="40" stroke="rgba(255,0,0,0.8)" strokeWidth="4" />      {/* Red (Least deviated) */}
            <line x1="0" y1="0" x2="250" y2="50" stroke="rgba(255,165,0,0.8)" strokeWidth="4" />   {/* Orange */}
            <line x1="0" y1="0" x2="250" y2="60" stroke="rgba(255,255,0,0.8)" strokeWidth="4" />   {/* Yellow */}
            <line x1="0" y1="0" x2="250" y2="70" stroke="rgba(0,128,0,0.8)" strokeWidth="4" />     {/* Green */}
            <line x1="0" y1="0" x2="250" y2="80" stroke="rgba(0,0,255,0.8)" strokeWidth="4" />     {/* Blue */}
            <line x1="0" y1="0" x2="250" y2="90" stroke="rgba(238,130,238,0.8)" strokeWidth="4" /> {/* Violet (Most deviated) */}
            
            {/* Extended deviation arc annotation */}
            <path d="M 120 40 A 100 100 0 0 0 120 -80" fill="none" stroke="yellow" strokeWidth="1" strokeDasharray="3,3" />
            <text x="130" y="20" fill="yellow" fontSize="14">δ</text>
         </g>
      </svg>

      <div className="absolute top-4 right-4 bg-black/80 px-4 py-3 border border-gray-700 rounded flex flex-col gap-3 min-w-[200px]">
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
