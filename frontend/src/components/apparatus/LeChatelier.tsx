import { useEffect, useRef, useState } from 'react';
import { useLabStore } from '../../store/useLabStore';
import gsap from 'gsap';

interface ApparatusProps {
  varState: Record<string, number | string>;
  setVarState: React.Dispatch<React.SetStateAction<Record<string, number | string>>>;
  addObservation: (data: any) => void;
}

// N₂O₄ ⇌ 2 NO₂   (endothermic forward reaction)
//
// Kc at 25°C ≈ 0.14 mol/L  → ~30% NO₂ at baseline
// Higher temp → Kc increases → more NO₂
// Higher pressure → shifts backward → more N₂O₄
// Adding N₂O₄ → shifts forward → more NO₂ until new eq
// Adding NO₂ → shifts backward → more N₂O₄ until new eq

const TOTAL_MOLES_BASE = 100;
const CONTAINER_VOL    = 1.0; // litre

function calcEquilibrium(tempC: number, pressureAtm: number): { n2o4: number; no2: number } {
  // Kc varies with temperature — endothermic, so Kc increases with T
  // At 25°C: Kc ≈ 0.14  At 100°C: Kc ≈ 0.9
  const Kc = 0.14 * Math.exp(0.022 * (tempC - 25));

  // At higher pressure, moles compress into smaller effective volume
  // We keep total moles fixed but scale volume inversely with pressure
  const V = CONTAINER_VOL / pressureAtm;

  // Kc = [NO₂]² / [N₂O₄]
  // Let x = moles of N₂O₄ that dissociate
  // n2o4 = (1 - alpha)*N  no2 = 2*alpha*N  where alpha = degree of dissociation
  // Solve: Kc = (2*alpha*N/V)² / ((1-alpha)*N/V)
  //      = 4*alpha²*N / ((1-alpha)*V)
  // 4*alpha²*N / ((1-alpha)*V) = Kc
  // => 4*alpha²*N = Kc*(1-alpha)*V
  const N = TOTAL_MOLES_BASE;
  // Quadratic: 4N*alpha² + Kc*V*alpha - Kc*V = 0
  const a = 4 * N;
  const b = Kc * V;
  const c = -Kc * V;
  const disc = b * b - 4 * a * c;
  let alpha = (-b + Math.sqrt(disc)) / (2 * a);
  alpha = Math.max(0.01, Math.min(0.98, alpha));

  const no2  = 2 * alpha * N;
  const n2o4 = (1 - alpha) * N;
  return { n2o4, no2 };
}

export default function LeChatelier({ varState, addObservation }: ApparatusProps) {
  const temperature = Number(varState.temperature ?? 25);
  const pressure    = Number(varState.pressure    ?? 1);
  const stress      = Number(varState.stress      ?? 0); // 0=none, 1=add N₂O₄, 2=add NO₂

  const { setValidationError } = useLabStore();

  // Track initial/baseline conditions to detect real stress application
  const initialConditions = useRef({ temperature: 25, pressure: 1, stress: 0 });
  const hasChangedFromBaseline = useRef(false);

  const [molesN2O4,     setMolesN2O4]     = useState(70);
  const [molesNO2,      setMolesNO2]      = useState(30);
  const [isEquilibrating, setIsEquilibrating] = useState(false);
  const [appliedStressOnce, setAppliedStressOnce] = useState(false);

  const gasColorRef   = useRef<SVGPathElement>(null);
  const prevStress    = useRef(0);
  const animProxy     = useRef({ n2o4: 70, no2: 30 });
  const isMounted     = useRef(false);

  // Detect whether conditions have actually changed from baseline
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return; // skip first render — don't treat initial values as stress
    }

    const changed =
      temperature !== initialConditions.current.temperature ||
      pressure    !== initialConditions.current.pressure    ||
      stress      !== initialConditions.current.stress;

    if (changed) {
      hasChangedFromBaseline.current = true;
      setAppliedStressOnce(true);
    }

    // --- Compute target equilibrium ---
    let baseN2O4 = animProxy.current.n2o4;
    let baseNO2  = animProxy.current.no2;

    // Apply concentration stress — add extra moles before computing new equilibrium
    if (stress !== prevStress.current) {
      if (stress === 1) { baseN2O4 += 20; } // add N₂O₄ → shifts forward
      if (stress === 2) { baseNO2  += 20; } // add NO₂  → shifts backward
      prevStress.current = stress;
    }

    // Compute new equilibrium from thermodynamics
    const { n2o4: eqN2O4, no2: eqNO2 } = calcEquilibrium(temperature, pressure);

    // Scale to current total moles (which may have grown if concentration stress was added)
    const currentTotal = baseN2O4 + baseNO2;
    const eqTotal      = eqN2O4 + eqNO2;
    const scale        = currentTotal / eqTotal;

    const targetN2O4 = eqN2O4 * scale;
    const targetNO2  = eqNO2  * scale;
    const targetPctNO2 = targetNO2 / (targetN2O4 + targetNO2);

    setIsEquilibrating(true);

    // Kill any running animations
    gsap.killTweensOf(animProxy.current);
    gsap.killTweensOf('.lc-piston');

    // Piston position: higher pressure → piston moves down (compresses)
    // pressure range 0.5–5 atm, piston Y range -80 to -220 (in syringe coords)
    const pistonY = -80 - ((pressure - 0.5) / 4.5) * 140;
    gsap.to('.lc-piston', { y: pistonY, duration: 0.7, ease: 'power2.out' });

    // Gas color: deeper brown = more NO₂
    if (gasColorRef.current) {
      gsap.to(gasColorRef.current, {
        fill: `rgba(139, 69, 19, ${(targetPctNO2 * 0.85).toFixed(3)})`,
        duration: 1.4, ease: 'sine.inOut',
      });
    }

    // Animate mole counts
    gsap.to(animProxy.current, {
      n2o4: targetN2O4,
      no2:  targetNO2,
      duration: 1.5,
      ease: 'sine.inOut',
      onUpdate: () => {
        setMolesN2O4(animProxy.current.n2o4);
        setMolesNO2(animProxy.current.no2);
      },
      onComplete: () => setIsEquilibrating(false),
    });

  }, [temperature, pressure, stress]);

  const recordObservation = () => {
    if (!appliedStressOnce) {
      setValidationError(
        "No Stress Applied",
        "You haven't changed any conditions from the baseline yet.",
        "Adjust the temperature, pressure, or add a concentration stress to apply Le Chatelier's principle."
      );
      return;
    }
    if (isEquilibrating) {
      setValidationError(
        "System Equilibrating",
        "The system is still shifting to a new equilibrium.",
        "Wait for the animation to finish before recording observations."
      );
      return;
    }

    const total   = molesN2O4 + molesNO2;
    const pctNO2  = (molesNO2 / total) * 100;

    const stressLabels: Record<number, string> = {
      0: 'None',
      1: 'Added N₂O₄',
      2: 'Added NO₂',
    };

    addObservation({
      "Temperature (°C)":  temperature,
      "Pressure (atm)":    Number(pressure.toFixed(1)),
      "Stress Applied":    stressLabels[stress] ?? 'None',
      "N₂O₄ (mol)":       Number(molesN2O4.toFixed(1)),
      "NO₂ (mol)":         Number(molesNO2.toFixed(1)),
      "% NO₂":             Number(pctNO2.toFixed(1)),
      "Shift Direction":   getShiftText(pctNO2),
    });
  };

  function getShiftText(pctNO2: number): string {
    if (pctNO2 > 36) return 'Forward (→ more NO₂)';
    if (pctNO2 < 24) return 'Backward (← more N₂O₄)';
    return 'At Equilibrium';
  }

  const total       = molesN2O4 + molesNO2;
  const pctNO2      = molesNO2 / total;
  const shiftText   = getShiftText(pctNO2 * 100);
  const shiftColor  = pctNO2 > 0.36 ? '#f59e0b' : pctNO2 < 0.24 ? '#60a5fa' : '#94a3b8';

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', background: '#02060d', padding: 32,
    }}>

      {/* Readouts */}
      <div style={{
        position: 'absolute', top: 16, left: 16,
        background: 'rgba(0,0,0,0.65)', border: '1px solid #374151',
        padding: '8px 16px', borderRadius: 8, zIndex: 10, pointerEvents: 'none',
      }}>
        <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Equilibrium State</div>
        <div style={{ fontFamily: 'monospace', fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ color: '#e2e8f0' }}>N₂O₄ (colourless): {molesN2O4.toFixed(1)} mol</span>
          <span style={{ color: '#b45309' }}>NO₂ (brown): {molesNO2.toFixed(1)} mol</span>
          <span style={{ color: '#9ca3af' }}>% NO₂: {(pctNO2 * 100).toFixed(1)}%</span>
          <span style={{ color: '#00d4ff', borderTop: '1px solid #374151', paddingTop: 4, marginTop: 2 }}>
            {temperature}°C | {pressure.toFixed(1)} atm
          </span>
          <span style={{ color: shiftColor }}>{shiftText}</span>
          {isEquilibrating && (
            <span style={{ color: '#fbbf24', fontSize: 11 }}>⟳ Equilibrating…</span>
          )}
        </div>
      </div>

      <svg width="600" height="420" viewBox="0 0 600 420"
        style={{ overflow: 'visible' }}>

        {/* Reaction equation */}
        <text x="300" y="28" fill="#64748b" fontSize="13" textAnchor="middle">
          N₂O₄ (colourless) ⇌ 2 NO₂ (brown) — endothermic forward
        </text>

        {/* Temperature bath indicator */}
        <rect x="140" y="335" width="320" height="44"
          fill={
            temperature > 50  ? 'rgba(239,68,68,0.18)' :
            temperature > 35  ? 'rgba(249,115,22,0.12)' :
            temperature < 15  ? 'rgba(59,130,246,0.18)' :
            'rgba(255,255,255,0.04)'
          }
          rx="10" />
        <text x="300" y="362"
          fill={
            temperature > 50  ? '#ef4444' :
            temperature > 35  ? '#f97316' :
            temperature < 15  ? '#60a5fa' :
            '#94a3b8'
          }
          fontSize="14" fontWeight="bold" textAnchor="middle">
          {temperature > 50  ? '🔥 Hot Water Bath' :
           temperature > 35  ? '♨️ Warm Bath' :
           temperature < 15  ? '❄️ Ice Bath' :
           '🌡 Ambient (~25°C)'}
        </text>

        {/* Syringe body */}
        <g transform="translate(300, 310)">
          {/* Syringe flange */}
          <rect x="-65" y="-4" width="130" height="12" fill="#334155" rx="3" />
          {/* Glass tube */}
          <path d="M -42 0 L -42 -270 L 42 -270 L 42 0 Z"
            fill="rgba(255,255,255,0.04)" stroke="#64748b" strokeWidth="4" />

          {/* Gas fill — color driven by NO₂ concentration */}
          <path ref={gasColorRef}
            d="M -40 -2 L 40 -2 L 40 -215 L -40 -215 Z"
            fill="rgba(139,69,19,0.3)"
          />

          {/* Molecule dots for visual richness */}
          {[...Array(8)].map((_, i) => {
            const row = Math.floor(i / 4);
            const col = i % 4;
            return (
              <circle key={i}
                cx={-25 + col * 17}
                cy={-40 - row * 50}
                r="4"
                fill={i % 3 === 0 ? `rgba(139,69,19,${(pctNO2 * 0.9).toFixed(2)})` : 'rgba(200,200,200,0.15)'}
              />
            );
          })}

          {/* Piston — starts at y=-180 (1 atm), moves down with pressure */}
          <g className="lc-piston" transform="translate(0, -180)">
            <rect x="-40" y="-8" width="80" height="18" fill="#1e293b" rx="3" />
            <rect x="-8" y="10" width="16" height="180" fill="#e2e8f0" rx="2" />
            <rect x="-42" y="190" width="84" height="16" fill="#334155" rx="5" />
          </g>

          {/* Syringe tip */}
          <path d="M -8 0 L 8 0 L 5 36 L -5 36 Z" fill="#64748b" />
        </g>

        {/* Pressure arrows — appear when pressure > 1.5 */}
        {pressure > 1.5 && (
          <g>
            <text x="440" y="200" fill="#60a5fa" fontSize="22" textAnchor="middle">↓</text>
            <text x="440" y="220" fill="#60a5fa" fontSize="10" textAnchor="middle">{pressure.toFixed(1)} atm</text>
          </g>
        )}

        {/* Temperature arrow */}
        {temperature !== 25 && (
          <g>
            <text x="160" y="200"
              fill={temperature > 25 ? '#ef4444' : '#60a5fa'}
              fontSize="22" textAnchor="middle">
              {temperature > 25 ? '↑' : '↓'}
            </text>
            <text x="160" y="218"
              fill={temperature > 25 ? '#ef4444' : '#60a5fa'}
              fontSize="10" textAnchor="middle">
              {temperature}°C
            </text>
          </g>
        )}
      </svg>

      {/* Control panel */}
      <div style={{
        position: 'absolute', top: 16, right: 16,
        background: 'rgba(0,0,0,0.85)', padding: '12px 16px',
        border: '1px solid #374151', borderRadius: 10, zIndex: 20,
        display: 'flex', flexDirection: 'column', gap: 10, minWidth: 210,
      }}>
        <button
          onClick={recordObservation}
          style={{
            width: '100%', padding: '9px',
            background: 'rgba(59,130,246,0.2)', color: '#60a5fa',
            border: '1px solid rgba(59,130,246,0.5)',
            borderRadius: 6, fontWeight: 700, fontSize: 13,
            cursor: 'pointer', transition: 'all 0.2s',
          }}
        >
          Log Equilibrium State
        </button>

        {isEquilibrating && (
          <div style={{ fontSize: 11, color: '#fbbf24', textAlign: 'center' }}>
            ⟳ System equilibrating…
          </div>
        )}

        {!appliedStressOnce && (
          <div style={{ fontSize: 11, color: '#6b7280', textAlign: 'center', lineHeight: 1.5 }}>
            Adjust temperature, pressure, or add a concentration stress to begin.
          </div>
        )}

        {/* Legend */}
        <div style={{ borderTop: '1px solid #374151', paddingTop: 8, marginTop: 2 }}>
          <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Le Chatelier Rules</div>
          <div style={{ fontSize: 11, color: '#9ca3af', display: 'flex', flexDirection: 'column', gap: 4, lineHeight: 1.5 }}>
            <span>🌡 ↑ Temp → more NO₂ (forward)</span>
            <span>⬆ ↑ Pressure → more N₂O₄ (back)</span>
            <span>+ N₂O₄ → forward shift</span>
            <span>+ NO₂ → backward shift</span>
          </div>
        </div>
      </div>
    </div>
  );
}