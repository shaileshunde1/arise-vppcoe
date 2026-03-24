import { useEffect, useRef, useState } from 'react';
import { useLabStore } from '../../store/useLabStore';
import gsap from 'gsap';

interface ApparatusProps {
  varState: Record<string, number | string>;
  setVarState: React.Dispatch<React.SetStateAction<Record<string, number | string>>>;
  addObservation: (data: any) => void;
}

export default function OhmsLaw({ varState, addObservation }: ApparatusProps) {
  const ammeterNeedleRef = useRef<SVGLineElement>(null);
  const voltmeterNeedleRef = useRef<SVGLineElement>(null);
  const electronDotsRef = useRef<SVGGElement>(null);
  const { setValidationError, hasAdjustedSlider } = useLabStore();
  
  const [isSwitchOn, setIsSwitchOn] = useState(false);
  const [userReading, setUserReading] = useState("");

  const voltage = Number(varState.voltage || 3); // 1V to 12V
  const resistance = Number(varState.resistance || 47); // 10Ω to 100Ω
  
  // I = V / R (Amperes), to mA -> * 1000
  const current_mA = (voltage / resistance) * 1000;

  useEffect(() => {
    // GSAP animations for meters
    // Ammeter scale: 0 to 1200 mA (mapped to -60deg to 60deg)
    const ammeterRotation = -60 + (current_mA / 1200) * 120;
    
    // Voltmeter scale: 0 to 15 V (mapped to -60deg to 60deg)
    const voltmeterRotation = -60 + (voltage / 15) * 120;

    if (isSwitchOn) {
      gsap.to(ammeterNeedleRef.current, { rotation: ammeterRotation, duration: 0.5, ease: "elastic.out(1, 0.75)", transformOrigin: "bottom center" });
      gsap.to(voltmeterNeedleRef.current, { rotation: voltmeterRotation, duration: 0.5, ease: "elastic.out(1, 0.75)", transformOrigin: "bottom center" });
      
      // Animate electrons
      const speed = 1000 / current_mA; // Higher current = lower duration = faster
      gsap.killTweensOf(".electron");
      gsap.to(".electron", { strokeDashoffset: -40, duration: speed, ease: "none", repeat: -1 });
    } else {
      gsap.to([ammeterNeedleRef.current, voltmeterNeedleRef.current], { rotation: -60, duration: 0.5, ease: "power2.out", transformOrigin: "bottom center" });
      gsap.killTweensOf(".electron");
    }
  }, [voltage, resistance, isSwitchOn, current_mA]);

  const recordObservation = () => {
    if (!isSwitchOn) return;
    
    if (resistance === 0) {
      setValidationError("Short Circuit Risk", "Operating a circuit with 0 resistance causes infinite current, which will damage components or start a fire.", "Set the resistance to at least 10Ω before turning on the circuit.");
      setIsSwitchOn(false);
      return;
    }

    const entered = parseFloat(userReading);
    if (isNaN(entered)) {
      setValidationError("Missing Reading", "You must enter the current reading from the Ammeter.", "Read the Ammeter dial and type the value in mA.");
      return;
    }

    // 15% tolerance check
    const errorMargin = current_mA * 0.15;
    if (Math.abs(entered - current_mA) > errorMargin) {
      setValidationError("Inaccurate Reading", `The recorded current doesn't match V/R within tolerance. The expected value is around ${Math.round(current_mA)} mA.`, "Please re-read the ammeter dial carefully and enter the correct value.");
      return;
    }

    addObservation({
      "Voltage V (V)": voltage.toFixed(1),
      "Current I (mA)": entered.toFixed(1),
      "Ratio V/I (Ω)": (voltage / (entered / 1000)).toFixed(1)
    });
    setUserReading("");
  };

  const handleSwitch = () => {
    if (!hasAdjustedSlider['ohms-law']) {
      setValidationError("Setup Incomplete", "You cannot start the experiment before adjusting the apparatus.", "Adjust the voltage or resistance slider before closing the switch.");
      return;
    }
    if (!isSwitchOn && resistance === 0) {
      setValidationError("Short Circuit Risk", "Circuit resistance is 0Ω. Closing the switch will cause a short circuit.", "Increase resistance using the slider before switching on.");
      return;
    }
    setIsSwitchOn(!isSwitchOn);
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative p-8">
      {/* Circuit Diagram SVG */}
      <svg width="100%" height="80%" viewBox="0 0 600 400" className="overflow-visible bg-[#0a1128] rounded-xl border border-gray-800 shadow-2xl">
        <defs>
          <radialGradient id="meterDial" cx="50%" cy="50%" r="50%">
            <stop offset="80%" stopColor="#fff" />
            <stop offset="100%" stopColor="#e2e8f0" />
          </radialGradient>
        </defs>

        {/* --- Circuit Wires base --- */}
        <polyline points="100,50 500,50 500,350 100,350 100,220" fill="none" stroke="#f59e0b" strokeWidth="4" />
        <line x1="100" y1="50" x2="100" y2="180" stroke="#f59e0b" strokeWidth="4" />
        
        {/* Parallel Voltmeter Wires */}
        <polyline points="200,350 200,250 400,250 400,350" fill="none" stroke="#f59e0b" strokeWidth="2" strokeDasharray="4 4" />

        {/* --- Electron Flow Animation paths --- */}
        <g ref={electronDotsRef} stroke="#00d4ff" strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray="4 36" opacity={isSwitchOn ? 0.8 : 0}>
           {/* Top wire (right to left) */}
           <path className="electron" d="M 500 50 L 100 50" />
           {/* Left wire (top down) */}
           <path className="electron" d="M 100 50 L 100 180" />
           <path className="electron" d="M 100 220 L 100 350" />
           {/* Bottom wire (left to right) */}
           <path className="electron" d="M 100 350 L 500 350" />
           {/* Right wire (bottom up) */}
           <path className="electron" d="M 500 350 L 500 50" />
        </g>

        {/* --- Components --- */}
        
        {/* Switch */}
        <g transform="translate(250, 50)" style={{ cursor: 'pointer' }} onClick={handleSwitch}>
          <circle cx="-20" cy="0" r="5" fill="#f8fafc" />
          <circle cx="20" cy="0" r="5" fill="#f8fafc" />
          <line x1="-20" y1="0" x2={isSwitchOn ? "20" : "15"} y2={isSwitchOn ? "0" : "-15"} stroke="#94a3b8" strokeWidth="4" strokeLinecap="round" style={{ transition: 'all 0.2s' }} />
          <text x="0" y="-20" fill="#cbd5e1" fontSize="14" textAnchor="middle" fontWeight="bold">SWITCH {isSwitchOn ? 'ON' : 'OFF'}</text>
        </g>

        {/* Battery */}
        <g transform="translate(100, 200)">
          <rect x="-30" y="-15" width="60" height="30" fill="#1e293b" />
          <line x1="-15" y1="-25" x2="-15" y2="25" stroke="#fff" strokeWidth="4" /> {/* Long + */}
          <line x1="15" y1="-15" x2="15" y2="15" stroke="#fff" strokeWidth="6" />  {/* Short - */}
          <text x="-25" y="-35" fill="#ef4444" fontSize="16" fontWeight="bold">+</text>
          <text x="15" y="-35" fill="#3b82f6" fontSize="16" fontWeight="bold">-</text>
          <text x="-45" y="5" fill="#fbbf24" fontSize="16" textAnchor="end">{voltage} V</text>
        </g>

        {/* Resistor (Zigzag) */}
        <g transform="translate(300, 350)">
          <rect x="-40" y="-15" width="80" height="30" fill="#020617" />
          <path d="M -40 0 L -30 -15 L -10 15 L 10 -15 L 30 15 L 40 0" fill="none" stroke="#f59e0b" strokeWidth="4" strokeLinejoin="round" />
          <text x="0" y="35" fill="#fbbf24" fontSize="16" textAnchor="middle" fontWeight="bold">R = {resistance} Ω</text>
        </g>

        {/* Ammeter */}
        <g transform="translate(500, 200)">
          <circle cx="0" cy="0" r="30" fill="url(#meterDial)" stroke="#475569" strokeWidth="4" />
          <text x="0" y="10" fill="#020617" fontSize="20" fontWeight="bold" textAnchor="middle">A</text>
          {/* Dial Marks */}
          <path d="M -15 -15 A 20 20 0 0 1 15 -15" fill="none" stroke="#94a3b8" strokeWidth="2" />
          {/* Needle starts at -60deg (zero) */}
          <line ref={ammeterNeedleRef} x1="0" y1="5" x2="0" y2="-20" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
          <text x="0" y="45" fill="#00d4ff" fontSize="14" textAnchor="middle">{isSwitchOn ? current_mA.toFixed(0) : '0'} mA</text>
        </g>

        {/* Voltmeter */}
        <g transform="translate(300, 250)">
          <circle cx="0" cy="0" r="30" fill="url(#meterDial)" stroke="#475569" strokeWidth="4" />
          <text x="0" y="10" fill="#020617" fontSize="20" fontWeight="bold" textAnchor="middle">V</text>
          <path d="M -15 -15 A 20 20 0 0 1 15 -15" fill="none" stroke="#94a3b8" strokeWidth="2" />
          {/* Needle starts at -60deg (zero) */}
          <line ref={voltmeterNeedleRef} x1="0" y1="5" x2="0" y2="-20" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
          <text x="0" y="-40" fill="#00d4ff" fontSize="14" textAnchor="middle">{isSwitchOn ? voltage.toFixed(1) : '0.0'} V</text>
        </g>

      </svg>

      {/* Record Controls */}
      <div className="absolute top-12 left-12 flex flex-col gap-3 bg-black/60 p-4 rounded-xl border border-gray-700 shadow-2xl">
        <label className="text-xs text-gray-400 font-bold uppercase">Ammeter Reading (mA)</label>
        <input 
          type="number" 
          value={userReading}
          onChange={(e) => setUserReading(e.target.value)}
          placeholder="e.g. 64" 
          className="bg-gray-900 border border-gray-700 text-white p-2 rounded w-48 font-mono focus:border-accent-cyan outline-none"
        />
        <button 
          onClick={recordObservation}
          disabled={!isSwitchOn}
          className="w-full py-2 bg-blue-500/20 text-blue-400 border border-blue-500/50 hover:bg-blue-500/30 rounded font-bold disabled:opacity-50 transition-colors"
        >
          Record Readings
        </button>
      </div>
    </div>
  );
}
