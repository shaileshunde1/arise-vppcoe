import { useEffect, useRef, useState } from 'react';
import { useLabStore } from '../../store/useLabStore';
import gsap from 'gsap';

interface ApparatusProps {
  varState: Record<string, number | string>;
  setVarState: React.Dispatch<React.SetStateAction<Record<string, number | string>>>;
  addObservation: (data: any) => void;
}

// N₂O₄ (colourless) ⇌ 2 NO₂ (brown/reddish-brown) — endothermic forward

const TOTAL_MOLES_BASE = 100;

function calcEquilibrium(tempC: number, pressureAtm: number): { n2o4: number; no2: number } {
  // Kc increases with temperature (endothermic forward)
  const Kc = 0.14 * Math.exp(0.022 * (tempC - 25));
  const V  = 1.0 / pressureAtm; // effective volume

  const N = TOTAL_MOLES_BASE;
  const a = 4 * N;
  const b = Kc * V;
  const c = -Kc * V;
  const disc = b * b - 4 * a * c;
  let alpha = (-b + Math.sqrt(disc)) / (2 * a);
  alpha = Math.max(0.01, Math.min(0.98, alpha));

  return { n2o4: (1 - alpha) * N, no2: 2 * alpha * N };
}

export default function LeChatelier({ varState, addObservation }: ApparatusProps) {
  const temperature = Number(varState.temperature ?? 25);
  const pressure    = Number(varState.pressure    ?? 1);
  const stress      = Number(varState.stress      ?? 0);

  const { setValidationError } = useLabStore();

  const [molesN2O4,       setMolesN2O4]       = useState(70);
  const [molesNO2,        setMolesNO2]        = useState(30);
  const [isEquilibrating, setIsEquilibrating] = useState(false);
  const [appliedStress,   setAppliedStress]   = useState(false);
  const [shiftDir,        setShiftDir]        = useState('At equilibrium');

  const gasColorRef  = useRef<SVGRectElement>(null);
  const prevStress   = useRef(0);
  const animProxy    = useRef({ n2o4: 70, no2: 30 });
  const isMounted    = useRef(false);

  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }

    setAppliedStress(true);

    let baseN2O4 = animProxy.current.n2o4;
    let baseNO2  = animProxy.current.no2;

    // Apply concentration stress
    if (stress !== prevStress.current) {
      if (stress === 1) baseN2O4 += 25; // add N₂O₄
      if (stress === 2) baseNO2  += 25; // add NO₂
      prevStress.current = stress;
    }

    const { n2o4: eqN2O4, no2: eqNO2 } = calcEquilibrium(temperature, pressure);
    const currentTotal = baseN2O4 + baseNO2;
    const eqTotal      = eqN2O4 + eqNO2;
    const scale        = currentTotal / eqTotal;

    const targetN2O4   = eqN2O4 * scale;
    const targetNO2    = eqNO2  * scale;
    const targetPctNO2 = targetNO2 / (targetN2O4 + targetNO2);

    // Determine shift direction
    const currentPct = animProxy.current.no2 / (animProxy.current.n2o4 + animProxy.current.no2);
    if (targetPctNO2 > currentPct + 0.02)      setShiftDir('Forward shift → (more NO₂, darker)');
    else if (targetPctNO2 < currentPct - 0.02) setShiftDir('Backward shift ← (more N₂O₄, lighter)');
    else                                         setShiftDir('At equilibrium');

    setIsEquilibrating(true);
    gsap.killTweensOf(animProxy.current);
    gsap.killTweensOf('.lc-piston');

    // Piston compression: 1 atm = piston at 0 offset, 5 atm = piston down 120px
    const pistonOffset = ((pressure - 0.5) / 4.5) * 120;
    gsap.to('.lc-piston', { y: pistonOffset, duration: 0.8, ease: 'power2.out' });

    // Gas colour animation — deeper brown = more NO₂
    if (gasColorRef.current) {
      const r = Math.round(80 + targetPctNO2 * 130);
      const g = Math.round(50 - targetPctNO2 * 30);
      const b = 10;
      const a = (0.15 + targetPctNO2 * 0.7).toFixed(2);
      gsap.to(gasColorRef.current, {
        attr: { fill: `rgba(${r},${g},${b},${a})` },
        duration: 1.5, ease: 'sine.inOut',
      });
    }

    gsap.to(animProxy.current, {
      n2o4: targetN2O4,
      no2:  targetNO2,
      duration: 1.6,
      ease: 'sine.inOut',
      onUpdate: () => {
        setMolesN2O4(animProxy.current.n2o4);
        setMolesNO2(animProxy.current.no2);
      },
      onComplete: () => setIsEquilibrating(false),
    });
  }, [temperature, pressure, stress]);

  const recordObservation = () => {
    if (!appliedStress) {
      setValidationError('No Stress Applied', 'Adjust temperature, pressure, or concentration.', 'Change a variable using the left panel sliders first.');
      return;
    }
    if (isEquilibrating) {
      setValidationError('Still Equilibrating', 'Wait for the system to reach new equilibrium.', 'The animation must finish before recording.');
      return;
    }
    const total  = molesN2O4 + molesNO2;
    const pctNO2 = (molesNO2 / total) * 100;
    addObservation({
      'Temperature (°C)': temperature,
      'Pressure (atm)':   +pressure.toFixed(1),
      'Stress Applied':   stress === 0 ? 'None' : stress === 1 ? 'Added N₂O₄' : 'Added NO₂',
      'N₂O₄ (mol)':      +molesN2O4.toFixed(1),
      'NO₂ (mol)':        +molesNO2.toFixed(1),
      '% NO₂':            +pctNO2.toFixed(1),
      'Shift':            shiftDir,
    });
  };

  const total   = molesN2O4 + molesNO2;
  const pctNO2  = molesNO2 / total;

  // Colour swatch for current NO₂ concentration
  const r = Math.round(80 + pctNO2 * 130);
  const g = Math.round(50 - pctNO2 * 30);
  const currentColor = `rgba(${r},${g},10,${(0.15 + pctNO2 * 0.7).toFixed(2)})`;
  const shiftColor   = shiftDir.includes('Forward') ? '#f59e0b'
    : shiftDir.includes('Backward') ? '#60a5fa' : '#94a3b8';

  // Piston compression visualization
  const syringeGasHeight = 200 - ((pressure - 0.5) / 4.5) * 120;

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', background: '#02060d', padding: 24,
    }}>

      {/* Readouts */}
      <div style={{
        position: 'absolute', top: 16, left: 16,
        background: 'rgba(0,0,0,0.7)', border: '1px solid #374151',
        padding: '10px 16px', borderRadius: 8, zIndex: 10, pointerEvents: 'none',
      }}>
        <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
          Equilibrium State
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: 13, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ color: '#e2e8f0' }}>N₂O₄ (colourless): {molesN2O4.toFixed(1)} mol</span>
          <span style={{ color: '#b45309' }}>NO₂ (brown): {molesNO2.toFixed(1)} mol</span>
          <span style={{ color: '#9ca3af' }}>% NO₂: {(pctNO2 * 100).toFixed(1)}%</span>

          {/* Visual colour swatch */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <div style={{
              width: 48, height: 24, borderRadius: 4,
              background: currentColor,
              border: '1px solid rgba(255,255,255,0.15)',
              transition: 'background 1.5s ease',
            }} />
            <span style={{ color: '#64748b', fontSize: 11 }}>
              {pctNO2 > 0.5 ? 'Dark brown' : pctNO2 > 0.3 ? 'Orange-brown' : 'Light straw'}
            </span>
          </div>

          <span style={{ color: '#00d4ff', borderTop: '1px solid #374151', paddingTop: 6, marginTop: 4 }}>
            {temperature}°C | {pressure.toFixed(1)} atm
          </span>
          <span style={{ color: shiftColor, fontWeight: 600 }}>{shiftDir}</span>
          {isEquilibrating && (
            <span style={{ color: '#fbbf24', fontSize: 11, animation: 'pulse 1s infinite' }}>⟳ Equilibrating…</span>
          )}
        </div>
      </div>

      <svg width="640" height="460" viewBox="0 0 640 460" style={{ overflow: 'visible' }}>

        {/* Reaction equation */}
        <text x="320" y="26" fill="#475569" fontSize="13" textAnchor="middle">
          N₂O₄ (colourless) ⇌ 2 NO₂ (brown) — endothermic →
        </text>

        {/* ── Syringe / sealed vessel ── */}
        <g transform="translate(320, 390)">
          {/* Piston handle — moves down when pressure increases */}
          <g className="lc-piston" transform="translate(0,0)">
            <rect x="-50" y={-syringeGasHeight - 30} width="100" height="20"
              fill="#1e293b" rx="4" stroke="#475569" strokeWidth="1" />
            <rect x="-8" y={-syringeGasHeight - 10} width="16" height={syringeGasHeight + 10}
              fill="#e2e8f0" rx="2" opacity="0.7" />
            <text x="0" y={-syringeGasHeight - 38} fill="#64748b" fontSize="10" textAnchor="middle">
              {pressure.toFixed(1)} atm
            </text>
          </g>

          {/* Glass tube */}
          <rect x="-55" y={-syringeGasHeight - 8} width="110" height={syringeGasHeight + 50}
            fill="rgba(255,255,255,0.03)" stroke="#64748b" strokeWidth="3" rx="4" />

          {/* Gas inside — colour represents NO₂ concentration */}
          <rect ref={gasColorRef}
            x="-52" y={-syringeGasHeight - 4}
            width="104" height={syringeGasHeight + 2}
            fill={currentColor}
            rx="2"
            style={{ transition: 'fill 1.5s ease' }}
          />

          {/* NO₂ molecule dots — more visible when more NO₂ */}
          {Array.from({ length: 12 }).map((_, i) => {
            const col = i % 4;
            const row = Math.floor(i / 4);
            const isNO2 = i < Math.round(pctNO2 * 12);
            return (
              <circle key={i}
                cx={-35 + col * 24}
                cy={-syringeGasHeight + 20 + row * 30}
                r={isNO2 ? 5 : 3.5}
                fill={isNO2 ? `rgba(180,83,9,${0.7 + pctNO2 * 0.3})` : 'rgba(200,200,200,0.12)'}
                style={{ transition: 'all 1.5s ease' }}
              />
            );
          })}

          {/* Volume scale on side */}
          <text x="62" y={-syringeGasHeight + 10} fill="#475569" fontSize="9" textAnchor="start">←gas</text>
          <text x="62" y="40" fill="#475569" fontSize="9" textAnchor="start">sealed</text>

          {/* Pressure arrows when compressed */}
          {pressure > 1.5 && (
            <g>
              <text x="-80" y={-syringeGasHeight / 2} fill="#60a5fa" fontSize="20" textAnchor="middle">↓</text>
              <text x="80"  y={-syringeGasHeight / 2} fill="#60a5fa" fontSize="20" textAnchor="middle">↓</text>
            </g>
          )}
        </g>

        {/* ── Temperature bath ── */}
        <rect x="160" y="380" width="300" height="50"
          fill={
            temperature > 55  ? 'rgba(239,68,68,0.2)'  :
            temperature > 35  ? 'rgba(249,115,22,0.15)' :
            temperature < 15  ? 'rgba(59,130,246,0.2)'  :
            'rgba(255,255,255,0.04)'
          }
          rx="8" />
        <text x="310" y="411"
          fill={
            temperature > 55  ? '#ef4444' :
            temperature > 35  ? '#f97316' :
            temperature < 15  ? '#60a5fa' : '#94a3b8'
          }
          fontSize="14" fontWeight="700" textAnchor="middle">
          {temperature > 55  ? '🔥 Hot bath — forward shift'  :
           temperature > 35  ? '♨ Warm — slight forward shift' :
           temperature < 15  ? '❄ Ice bath — backward shift'   :
           '🌡 Ambient (~25°C)'}
        </text>
        <text x="310" y="425" fill="#475569" fontSize="10" textAnchor="middle">
          {temperature}°C
        </text>

        {/* ── Colour reference scale ── */}
        <g transform="translate(540, 60)">
          <text x="0" y="0" fill="#64748b" fontSize="10" fontWeight="700">NO₂ %</text>
          {[0.1, 0.3, 0.5, 0.7, 0.9].map((p, i) => {
            const yr = Math.round(80 + p * 130);
            const yg = Math.round(50 - p * 30);
            return (
              <g key={i} transform={`translate(0, ${16 + i * 28})`}>
                <rect x="0" y="0" width="30" height="22" rx="3"
                  fill={`rgba(${yr},${yg},10,${(0.15 + p * 0.7).toFixed(2)})`}
                  stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
                <text x="36" y="15" fill="#64748b" fontSize="9">
                  {Math.round(p * 100)}%
                </text>
              </g>
            );
          })}
          <text x="0" y="165" fill="#374151" fontSize="8">colour scale</text>
        </g>
      </svg>

      {/* Control panel */}
      <div style={{
        position: 'absolute', top: 16, right: 16,
        background: 'rgba(0,0,0,0.88)', padding: '12px 16px',
        border: '1px solid #374151', borderRadius: 10, zIndex: 20,
        display: 'flex', flexDirection: 'column', gap: 10, minWidth: 215,
      }}>
        <button onClick={recordObservation} style={{
          width: '100%', padding: 9,
          background: 'rgba(59,130,246,0.2)', color: '#60a5fa',
          border: '1px solid rgba(59,130,246,0.5)',
          borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: 'pointer',
        }}>
          Log Equilibrium State
        </button>

        {isEquilibrating && (
          <div style={{ fontSize: 11, color: '#fbbf24', textAlign: 'center' }}>⟳ Equilibrating…</div>
        )}
        {!appliedStress && (
          <div style={{ fontSize: 11, color: '#6b7280', textAlign: 'center', lineHeight: 1.6 }}>
            Adjust temperature, pressure, or add a concentration stress to apply Le Chatelier's principle.
          </div>
        )}

        <div style={{ borderTop: '1px solid #374151', paddingTop: 8 }}>
          <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            Le Chatelier Rules
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', display: 'flex', flexDirection: 'column', gap: 5, lineHeight: 1.6 }}>
            <span>🌡 ↑ Temp → forward → more NO₂ (darker)</span>
            <span>⬆ ↑ Pressure → backward → more N₂O₄ (lighter)</span>
            <span>+ N₂O₄ → shifts forward → darker</span>
            <span>+ NO₂ → shifts backward → then lighter</span>
          </div>
        </div>
      </div>
    </div>
  );
}