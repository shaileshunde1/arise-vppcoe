import { useEffect, useRef, useState } from 'react';
import { useLabStore } from '../../store/useLabStore';
import gsap from 'gsap';

interface ApparatusProps {
  varState: Record<string, number | string>;
  setVarState: React.Dispatch<React.SetStateAction<Record<string, number | string>>>;
  addObservation: (data: any) => void;
}

// N₂O₄ ⇌ 2NO₂  (endothermic)
// Conserve nitrogen atoms: totalN = 2*n2o4 + no2  (invariant)
// At equilibrium let NO2_eq = x  →  N2O4_eq = (totalN - x) / 2
// Total moles = (totalN - x)/2 + x = totalN/2 + x/2
// χ_NO2 = x / (totalN/2 + x/2),  χ_N2O4 = (totalN-x)/2 / (totalN/2 + x/2)
// Kp = χ_NO2² * P / χ_N2O4
// Substituting and simplifying → quadratic in x:
//   (2 + Kp/P) x²  -  Kp/P * totalN * x  -  0  ... after full expansion:
//   2x² - Kp/P*(totalN - x)*( totalN/2 + x/2 ) / 1 ... use direct numerical approach:
// Simpler: let α = x / totalN  (fraction of N in NO₂ form), solve in [0,1]
// Use bisection — robust, no sign issues
function solveEquilibrium(n2o4: number, no2: number, tempC: number, pressureAtm: number) {
  const Kp    = Math.max(1e-6, 0.14 * Math.exp(0.030 * (tempC - 25)));
  const totalN = 2 * n2o4 + no2; // conserved N atoms

  // f(x) = Kp_actual(x) - Kp_target, where x = NO2_eq moles
  // Kp_actual = (χ_NO2)² * P / χ_N2O4
  const f = (x: number) => {
    const no2eq  = x;
    const n2o4eq = (totalN - x) / 2;
    if (n2o4eq <= 0) return Infinity;
    const tot    = no2eq + n2o4eq;
    const kp_act = (no2eq / tot) ** 2 * pressureAtm / (n2o4eq / tot);
    return kp_act - Kp;
  };

  // Bisect over x ∈ (0.01*totalN, 0.99*totalN)
  let lo = 0.01 * totalN, hi = 0.99 * totalN;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) < 0) lo = mid; else hi = mid;
  }
  const no2eq  = (lo + hi) / 2;
  const n2o4eq = (totalN - no2eq) / 2;
  return { n2o4: Math.max(0.5, n2o4eq), no2: Math.max(0.5, no2eq) };
}

function gasColor(f: number): string {
  const p = Math.max(0, Math.min(1, f));
  if (p < 0.05) return `rgba(200,215,225,${(p / 0.05 * 0.07).toFixed(3)})`;
  if (p < 0.25) { const t=(p-0.05)/0.20; return `rgba(${Math.round(230+t*15)},${Math.round(210-t*50)},${Math.round(140-t*110)},${(0.18+t*0.32).toFixed(3)})`; }
  if (p < 0.55) { const t=(p-0.25)/0.30; return `rgba(${Math.round(245-t*30)},${Math.round(160-t*80)},${Math.round(30-t*20)},${(0.50+t*0.25).toFixed(3)})`; }
  const t = Math.min((p-0.55)/0.45, 1);
  return `rgba(${Math.round(215-t*60)},${Math.round(80-t*50)},10,${(0.75+t*0.20).toFixed(3)})`;
}

export default function LeChatelier({ varState, addObservation }: ApparatusProps) {
  const temperature = Number(varState.temperature ?? 25);
  const pressure    = Number(varState.pressure    ?? 1);
  const stress      = Number(varState.stress      ?? 0);
  const { setValidationError } = useLabStore();

  const [started,         setStarted]         = useState(false);
  const [molesN2O4,       setMolesN2O4]       = useState(70);
  const [molesNO2,        setMolesNO2]        = useState(30);
  const [isEquilibrating, setIsEquilibrating] = useState(false);
  const [appliedStress,   setAppliedStress]   = useState(false);
  const [shiftDir,        setShiftDir]        = useState('At equilibrium');
  const [fillColor,       setFillColor]       = useState('rgba(200,215,225,0.04)');

  const proxy      = useRef({ n2o4: 70, no2: 30 });
  const prevStress = useRef(0);
  const firstRun   = useRef(true);
  const pistonRef  = useRef<SVGGElement>(null);

  useEffect(() => {
    if (!started) return;
    if (firstRun.current) { firstRun.current = false; return; }
    setAppliedStress(true);

    const cur_n2o4 = proxy.current.n2o4;
    const cur_no2  = proxy.current.no2;
    const stressChanged = stress !== prevStress.current;
    const newStress = stress;
    if (stressChanged) prevStress.current = stress;

    gsap.killTweensOf(proxy.current);
    setIsEquilibrating(true);

    if (pistonRef.current) {
      gsap.to(pistonRef.current, { y: ((pressure - 0.5) / 4.5) * 110, duration: 0.9, ease: 'power2.out' });
    }

    if (stressChanged && (newStress === 1 || newStress === 2)) {
      // PHASE 1: animate to the raw spike state (shows the disturbance)
      // Adding N₂O₄ → ratio drops (lighter) temporarily
      // Adding NO₂  → ratio rises (darker) temporarily
      const spike_n2o4 = newStress === 1 ? cur_n2o4 + 60 : cur_n2o4;
      const spike_no2  = newStress === 2 ? cur_no2  + 60 : cur_no2;
      const spikePct   = spike_no2 / (spike_n2o4 + spike_no2);
      const curPct     = cur_no2 / (cur_n2o4 + cur_no2);
      setShiftDir(newStress === 1
        ? 'Forward shift → (more NO₂, darker)'
        : 'Backward shift ← (more N₂O₄, lighter)'
      );

      // PHASE 2 target: equilibrium from the spiked composition
      const eq = solveEquilibrium(spike_n2o4, spike_no2, temperature, pressure);

      gsap.to(proxy.current, {
        n2o4: spike_n2o4, no2: spike_no2, duration: 0.8, ease: 'power2.out',
        onUpdate: () => {
          const t = proxy.current.n2o4 + proxy.current.no2;
          setMolesN2O4(proxy.current.n2o4);
          setMolesNO2(proxy.current.no2);
          setFillColor(gasColor(proxy.current.no2 / t));
        },
        onComplete: () => {
          // PHASE 2: equilibrate back — colour shifts opposite direction (Le Chatelier)
          gsap.to(proxy.current, {
            n2o4: eq.n2o4, no2: eq.no2, duration: 2.5, ease: 'sine.inOut',
            onUpdate: () => {
              const t = proxy.current.n2o4 + proxy.current.no2;
              setMolesN2O4(proxy.current.n2o4);
              setMolesNO2(proxy.current.no2);
              setFillColor(gasColor(proxy.current.no2 / t));
            },
            onComplete: () => {
              // Show final shift direction vs original baseline
              const finalPct = proxy.current.no2 / (proxy.current.n2o4 + proxy.current.no2);
              setShiftDir(
                finalPct > curPct + 0.015 ? 'Forward shift → (more NO₂, darker)'  :
                finalPct < curPct - 0.015 ? 'Backward shift ← (more N₂O₄, lighter)' :
                'At equilibrium'
              );
              setIsEquilibrating(false);
            },
          });
        },
      });
    } else {
      // T or P change — single phase equilibration from current moles
      const eq     = solveEquilibrium(cur_n2o4, cur_no2, temperature, pressure);
      const tgtPct = eq.no2 / (eq.n2o4 + eq.no2);
      const curPct = cur_no2 / (cur_n2o4 + cur_no2);
      setShiftDir(
        tgtPct > curPct + 0.015 ? 'Forward shift → (more NO₂, darker)'  :
        tgtPct < curPct - 0.015 ? 'Backward shift ← (more N₂O₄, lighter)' :
        'At equilibrium'
      );
      gsap.to(proxy.current, {
        n2o4: eq.n2o4, no2: eq.no2, duration: 2.0, ease: 'sine.inOut',
        onUpdate: () => {
          const t = proxy.current.n2o4 + proxy.current.no2;
          setMolesN2O4(proxy.current.n2o4);
          setMolesNO2(proxy.current.no2);
          setFillColor(gasColor(proxy.current.no2 / t));
        },
        onComplete: () => setIsEquilibrating(false),
      });
    }
  }, [temperature, pressure, stress, started]);

  const handleStart = () => {
    const eq = solveEquilibrium(70, 30, temperature, pressure);
    proxy.current = { n2o4: eq.n2o4, no2: eq.no2 };
    prevStress.current = stress; firstRun.current = false;
    setMolesN2O4(eq.n2o4); setMolesNO2(eq.no2);
    setFillColor(gasColor(eq.no2 / (eq.n2o4 + eq.no2)));
    setStarted(true); setAppliedStress(false); setShiftDir('At equilibrium');
    if (pistonRef.current) gsap.set(pistonRef.current, { y: ((pressure - 0.5) / 4.5) * 110 });
  };

  const recordObservation = () => {
    if (!started)        return void setValidationError('Not Started', 'Click Start first.', 'Press Start.');
    if (!appliedStress)  return void setValidationError('No Stress', 'Adjust a variable first.', 'Move a slider.');
    if (isEquilibrating) return void setValidationError('Still Equilibrating', 'Wait for animation.', 'Wait until done.');
    const total = molesN2O4 + molesNO2;
    addObservation({
      'Temperature (°C)': temperature,
      'Pressure (atm)':   +pressure.toFixed(1),
      'Stress Applied':   stress === 0 ? 'None' : stress === 1 ? 'Added N₂O₄' : 'Added NO₂',
      'N₂O₄ (mol)':      +molesN2O4.toFixed(1),
      'NO₂ (mol)':        +molesNO2.toFixed(1),
      '% NO₂':            +((molesNO2 / total) * 100).toFixed(1),
      'Shift':            shiftDir,
    });
  };

  const total  = molesN2O4 + molesNO2;
  const pctNO2 = molesNO2 / total;

  // Cylinder — piston travels max 110px, gas rect always stays below piston face
  const CYL_X = 260, CYL_Y = 60, CYL_W = 120, CYL_H = 230;
  const PISTON_H = 18;
  const pistonTravel = ((pressure - 0.5) / 4.5) * 110;
  const gasY = CYL_Y + PISTON_H + pistonTravel;          // top of gas = piston face
  const gasH = Math.max(6, CYL_H - PISTON_H - pistonTravel); // gas fills to bottom

  // Molecule dots — evenly distributed within gas region, never outside
  const DOTS = 16, COLS = 4, ROWS = 4;
  const NO2_COUNT = Math.round(pctNO2 * DOTS);
  const cellW = (CYL_W - 16) / COLS;
  const cellH = gasH / ROWS;

  const shiftColor = shiftDir.includes('Forward') ? '#f59e0b' : shiftDir.includes('Backward') ? '#60a5fa' : '#94a3b8';
  const tempBg = temperature>60?'rgba(239,68,68,0.22)':temperature>40?'rgba(249,115,22,0.18)':temperature<10?'rgba(59,130,246,0.25)':temperature<20?'rgba(99,179,237,0.18)':'rgba(255,255,255,0.04)';
  const tempFg = temperature>60?'#ef4444':temperature>40?'#f97316':temperature<10?'#3b82f6':temperature<20?'#60a5fa':'#94a3b8';
  const tempLabel = temperature>65?'🔥 Very hot — strong forward shift':temperature>45?'🔥 Hot — forward shift':temperature>30?'♨ Warm — slight forward':temperature<8?'❄ Ice bath — strong backward':temperature<20?'❄ Cold — backward shift':'🌡 Ambient — balanced';

  return (
    <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', position:'relative', background:'#02060d', padding:24 }}>

      {/* Readout */}
      <div style={{ position:'absolute', top:16, left:16, background:'rgba(0,0,0,0.78)', border:'1px solid #374151', padding:'12px 16px', borderRadius:10, zIndex:10, pointerEvents:'none' }}>
        <div style={{ fontSize:10, color:'#9ca3af', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8 }}>Equilibrium State</div>
        <div style={{ fontFamily:'monospace', fontSize:13, display:'flex', flexDirection:'column', gap:6 }}>
          <span style={{ color:'#e2e8f0' }}>N₂O₄ (colourless): {molesN2O4.toFixed(1)} mol</span>
          <span style={{ color:'#d97706' }}>NO₂ (brown): {molesNO2.toFixed(1)} mol</span>
          <span style={{ color:'#9ca3af' }}>% NO₂: {(pctNO2*100).toFixed(1)}%</span>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:4 }}>
            <div style={{ width:52, height:26, borderRadius:6, background: started ? fillColor : 'rgba(80,80,80,0.2)', border:'1px solid rgba(255,255,255,0.12)', transition:'background 0.4s' }} />
            <span style={{ color:'#64748b', fontSize:11 }}>
              {!started?'Not started':pctNO2>0.65?'Deep reddish-brown':pctNO2>0.45?'Orange-brown':pctNO2>0.25?'Orange-yellow':pctNO2>0.10?'Pale straw':'Nearly colourless'}
            </span>
          </div>
          <span style={{ color:'#00d4ff', borderTop:'1px solid #374151', paddingTop:6, marginTop:4 }}>{temperature}°C | {pressure.toFixed(1)} atm</span>
          <span style={{ color:shiftColor, fontWeight:600 }}>{started ? shiftDir : '—'}</span>
          {isEquilibrating && <span style={{ color:'#fbbf24', fontSize:11 }}>⟳ Equilibrating…</span>}
        </div>
      </div>

      <svg width="640" height="460" viewBox="0 0 640 460" style={{ overflow:'visible' }}>
        <text x="320" y="26" fill="#475569" fontSize="13" textAnchor="middle">N₂O₄ (colourless) ⇌ 2 NO₂ (brown) — endothermic →</text>

        {/* Cylinder walls */}
        <rect x={CYL_X} y={CYL_Y} width={CYL_W} height={CYL_H}
          fill="rgba(255,255,255,0.015)" stroke="#4b5563" strokeWidth="2.5" rx="4" />

        {/* Gas fill — always between piston face and cylinder bottom */}
        <rect x={CYL_X+3} y={gasY} width={CYL_W-6} height={gasH}
          fill={started ? fillColor : 'rgba(120,120,120,0.05)'}
          rx="2" style={{ transition:'fill 0.35s ease' }} />

        {/* Molecule dots — cells divide gas region, dots never leave cylinder */}
        {started && Array.from({ length: DOTS }).map((_, i) => {
          const col = i % COLS, row = Math.floor(i / COLS);
          const isNO2 = i < NO2_COUNT;
          const cx = CYL_X + 8 + col * cellW + cellW / 2;
          const cy = gasY + row * cellH + cellH / 2;
          // Skip if cell doesn't fit (high pressure, small gasH)
          if (cy + 6 > CYL_Y + CYL_H) return null;
          return (
            <circle key={i} cx={cx} cy={cy} r={isNO2 ? 5 : 3.5}
              fill={isNO2
                ? `rgba(180,83,9,${(0.55+pctNO2*0.45).toFixed(2)})`
                : `rgba(180,200,220,${(0.15+(1-pctNO2)*0.15).toFixed(2)})`}
              style={{ transition:'all 0.35s' }} />
          );
        })}

        {!started && (
          <text x={CYL_X+CYL_W/2} y={CYL_Y+CYL_H/2} fill="rgba(255,255,255,0.18)" fontSize="12" textAnchor="middle">Press Start</text>
        )}

        {/* Piston — GSAP moves this whole group down */}
        <g ref={pistonRef}>
          {/* Handle rod above cylinder */}
          <rect x={CYL_X+CYL_W/2-5} y={CYL_Y-28} width="10" height="28" fill="#334155" rx="2" stroke="#475569" strokeWidth="1" />
          {/* Piston face */}
          <rect x={CYL_X} y={CYL_Y} width={CYL_W} height={PISTON_H} fill="#1e293b" rx="3" stroke="#60a5fa" strokeWidth="1.5" />
          <text x={CYL_X+CYL_W/2} y={CYL_Y-4} fill="#60a5fa" fontSize="10" textAnchor="middle" fontWeight="700">{pressure.toFixed(1)} atm</text>
          {pressure > 1.5 && <>
            <text x={CYL_X-20} y={CYL_Y+12} fill="#60a5fa" fontSize="20" textAnchor="middle">↓</text>
            <text x={CYL_X+CYL_W+20} y={CYL_Y+12} fill="#60a5fa" fontSize="20" textAnchor="middle">↓</text>
          </>}
        </g>

        {/* Temperature bath */}
        <rect x="160" y="390" width="300" height="50" fill={tempBg} rx="10" style={{ transition:'fill 0.5s' }} />
        <text x="310" y="418" fill={tempFg} fontSize="14" fontWeight="700" textAnchor="middle">{tempLabel}</text>
        <text x="310" y="432" fill="#475569" fontSize="10" textAnchor="middle">{temperature}°C</text>

        {/* Colour scale */}
        <g transform="translate(542, 60)">
          <text x="0" y="0" fill="#6b7280" fontSize="10" fontWeight="700">NO₂ %</text>
          {[0, 0.10, 0.25, 0.45, 0.65, 0.85].map((p, i) => (
            <g key={i} transform={`translate(0,${14+i*30})`}>
              <rect x="0" y="0" width="30" height="22" rx="3" fill={gasColor(p)} stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
              <text x="36" y="15" fill="#6b7280" fontSize="9">{Math.round(p*100)}%</text>
            </g>
          ))}
        </g>
      </svg>

      {/* Controls */}
      <div style={{ position:'absolute', top:16, right:16, background:'rgba(0,0,0,0.90)', padding:'14px 16px', border:'1px solid #374151', borderRadius:12, zIndex:20, display:'flex', flexDirection:'column', gap:10, minWidth:215 }}>
        {!started
          ? <button onClick={handleStart} style={{ padding:10, background:'rgba(34,197,94,0.18)', color:'#4ade80', border:'1px solid rgba(34,197,94,0.45)', borderRadius:6, fontWeight:700, fontSize:14, cursor:'pointer' }}>▶ Start Experiment</button>
          : <button onClick={handleStart} style={{ padding:8, background:'rgba(100,116,139,0.12)', color:'#64748b', border:'1px solid rgba(100,116,139,0.25)', borderRadius:6, fontWeight:600, fontSize:12, cursor:'pointer' }}>↺ Reset</button>
        }
        <button onClick={recordObservation} style={{ padding:10, background:'rgba(59,130,246,0.18)', color:'#60a5fa', border:'1px solid rgba(59,130,246,0.45)', borderRadius:6, fontWeight:700, fontSize:13, cursor:'pointer' }}>Log Equilibrium State</button>
        {isEquilibrating && <div style={{ fontSize:11, color:'#fbbf24', textAlign:'center' }}>⟳ Equilibrating…</div>}
        <div style={{ borderTop:'1px solid #374151', paddingTop:8, fontSize:11, color:'#9ca3af', display:'flex', flexDirection:'column', gap:5, lineHeight:1.6 }}>
          <span>🌡 ↑ Temp → <span style={{ color:'#d97706' }}>darker</span> (more NO₂)</span>
          <span>❄ ↓ Temp → <span style={{ color:'#94a3b8' }}>lighter</span> (more N₂O₄)</span>
          <span>⬆ ↑ Pressure → <span style={{ color:'#94a3b8' }}>lighter</span> (backward)</span>
          <span>+ N₂O₄ → <span style={{ color:'#d97706' }}>darker</span> (forward)</span>
          <span>+ NO₂ → <span style={{ color:'#94a3b8' }}>lighter</span> (backward)</span>
        </div>
      </div>
    </div>
  );
}