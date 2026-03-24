import { useEffect, useRef, useState } from 'react';
import { useLabStore } from '../../store/useLabStore';
import gsap from 'gsap';

interface ApparatusProps {
  varState: Record<string, number | string>;
  setVarState: React.Dispatch<React.SetStateAction<Record<string, number | string>>>;
  addObservation: (data: any) => void;
}

const metals = [
  { id: 0, name: 'Lithium (Li⁺)',    symbol: 'Li',  color: '#DC143C', wavelength: 671,  colorName: 'Crimson Red'   },
  { id: 1, name: 'Sodium (Na⁺)',     symbol: 'Na',  color: '#FFD700', wavelength: 589,  colorName: 'Bright Yellow' },
  { id: 2, name: 'Potassium (K⁺)',   symbol: 'K',   color: '#9370DB', wavelength: 404,  colorName: 'Lilac/Violet'  },
  { id: 3, name: 'Calcium (Ca²⁺)',   symbol: 'Ca',  color: '#FF7F00', wavelength: 622,  colorName: 'Brick Orange'  },
  { id: 4, name: 'Strontium (Sr²⁺)', symbol: 'Sr',  color: '#FF2400', wavelength: 605,  colorName: 'Crimson'       },
  { id: 5, name: 'Copper (Cu²⁺)',    symbol: 'Cu',  color: '#00CED1', wavelength: 510,  colorName: 'Blue-Green'    },
  { id: 6, name: 'Barium (Ba²⁺)',    symbol: 'Ba',  color: '#8DB600', wavelength: 554,  colorName: 'Apple Green'   },
];

export default function FlameTest({ varState, addObservation }: ApparatusProps) {
  const metalId  = Number(varState.metal  ?? 0);
  const filterId = Number(varState.filter ?? 0);

  const { setValidationError } = useLabStore();

  const loopRef       = useRef<SVGGElement>(null);
  const outerFlameRef = useRef<SVGPathElement>(null);
  const glowRef       = useRef<SVGEllipseElement>(null);

  const [isAnimating,    setIsAnimating]    = useState(false);
  const [testedMetalId,  setTestedMetalId]  = useState<number | null>(null);

  const selectedMetal = metals[metalId] ?? metals[0];

  // Cobalt blue glass blocks sodium's 589 nm yellow line
  const blockedByCobalt = metalId === 1 && filterId === 1;
  const visibleColor    = blockedByCobalt ? '#0a0a2e' : selectedMetal.color;

  const flameBgColor = filterId === 1 ? 'rgba(20,40,120,0.4)' : '#02060d';

  // Base flicker — restarts when component mounts
  useEffect(() => {
    const flickers = gsap.utils.toArray('.ft-flicker');
    gsap.to(flickers, {
      scaleY: 1.07, scaleX: 0.93,
      duration: 0.16, yoyo: true, repeat: -1,
      ease: 'sine.inOut',
      stagger: 0.05,
      transformOrigin: 'bottom center',
    });
    return () => gsap.killTweensOf(flickers);
  }, []);

  // When metal changes: reset tested state + snap flame back to base blue
  useEffect(() => {
    setTestedMetalId(null);

    // Kill any running timeline and snap flame back immediately
    gsap.killTweensOf(outerFlameRef.current);
    gsap.killTweensOf(glowRef.current);
    gsap.killTweensOf(loopRef.current);

    if (outerFlameRef.current) {
      gsap.set(outerFlameRef.current, { fill: 'rgba(59,130,246,0.2)', opacity: 0.4 });
    }
    if (glowRef.current) {
      gsap.set(glowRef.current, { fill: 'rgba(59,130,246,0)', opacity: 0 });
    }
    if (loopRef.current) {
      gsap.set(loopRef.current, { x: 0, y: 0 });
    }
    setIsAnimating(false);
  }, [metalId]);

  const handleTestCall = () => {
    if (isAnimating) return;
    setIsAnimating(true);

    if (!loopRef.current || !outerFlameRef.current) return;

    // Capture the color for THIS specific metal RIGHT NOW
    // so the timeline closure always has the correct value
    const flameColor    = visibleColor;
    const metalForTest  = metalId;

    const tl = gsap.timeline({
      onComplete: () => setIsAnimating(false),
    });

    // 1. Dip wire into sample dish
    tl.to(loopRef.current, {
        x: -20, y: 95, duration: 0.45, ease: 'power2.out',
      })
      .to(loopRef.current, { y: 108, duration: 0.2 })
      .to(loopRef.current, { y: 95,  duration: 0.2 })

      // 2. Move wire into flame
      .to(loopRef.current, {
        x: 198, y: -48, duration: 0.65, ease: 'power2.inOut',
      })

      // 3. At the moment the wire enters the flame — set color directly
      .call(() => {
        // Set testedMetalId NOW so it reflects which metal was actually tested
        setTestedMetalId(metalForTest);

        // Animate outer flame to THIS metal's color
        gsap.to(outerFlameRef.current!, {
          fill: flameColor,
          opacity: 0.9,
          duration: 0.3,
          ease: 'power2.out',
        });

        // Animate background glow
        if (glowRef.current) {
          gsap.to(glowRef.current, {
            fill: flameColor,
            opacity: 0.25,
            duration: 0.3,
          });
        }
      })

      // 4. Hold in flame for 2.5 s
      .to(loopRef.current, { x: 198, duration: 2.5 })

      // 5. Withdraw — fade flame back to blue as wire leaves
      .to(loopRef.current, {
        x: 0, y: 0, duration: 0.55, ease: 'power2.in',
        onStart: () => {
          gsap.to(outerFlameRef.current!, {
            fill: 'rgba(59,130,246,0.2)',
            opacity: 0.4,
            duration: 0.6,
          });
          if (glowRef.current) {
            gsap.to(glowRef.current, { opacity: 0, duration: 0.6 });
          }
        },
      });
  };

  const recordObservation = () => {
    if (testedMetalId === null) {
      setValidationError(
        "No Test Performed",
        "You haven't performed the flame test for this metal yet.",
        "Click 'Perform Flame Test' to heat the wire loop in the flame, then log the result."
      );
      return;
    }
    if (testedMetalId !== metalId) {
      setValidationError(
        "Metal Changed",
        "You switched the metal after the last test.",
        "Perform the flame test again for the currently selected metal before logging."
      );
      return;
    }

    const metal     = metals[testedMetalId];
    const isBlocked = testedMetalId === 1 && filterId === 1;

    addObservation({
      "Metal Ion":       metal.name,
      "Wavelength (nm)": metal.wavelength,
      "Flame Color":     isBlocked ? 'Blocked by cobalt glass' : metal.colorName,
      "Color (hex)":     isBlocked ? 'N/A' : metal.color,
      "Filter Used":     filterId === 1 ? 'Cobalt Blue Glass' : 'None',
    });
  };

  const hasTestedCurrentMetal = testedMetalId === metalId;

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', padding: 32,
      backgroundColor: flameBgColor,
      transition: 'background-color 0.5s',
    }}>

      {/* Readouts */}
      <div style={{
        position: 'absolute', top: 16, left: 16,
        background: 'rgba(0,0,0,0.65)', border: '1px solid #374151',
        padding: '8px 16px', borderRadius: 8, zIndex: 10, pointerEvents: 'none',
      }}>
        <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
          Flame Test State
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ color: selectedMetal.color }}>{selectedMetal.name}</span>
          <span style={{ color: '#60a5fa' }}>Filter: {filterId === 1 ? 'Cobalt Blue Glass' : 'None'}</span>
          <span style={{ color: '#fbbf24' }}>Status: {isAnimating ? '🔥 Testing…' : 'Idle'}</span>
          <span style={{ color: '#94a3b8' }}>λ = {selectedMetal.wavelength} nm</span>
          <span style={{
            color: hasTestedCurrentMetal ? '#4ade80' : '#f87171',
            marginTop: 4, paddingTop: 4, borderTop: '1px solid #374151',
          }}>
            {hasTestedCurrentMetal ? '✓ Tested — ready to log' : '⚠ Test not done for this metal'}
          </span>
        </div>
      </div>

      <svg width="600" height="420" viewBox="0 0 600 420" style={{ overflow: 'visible' }}>

        {/* Bench */}
        <line x1="50" y1="375" x2="550" y2="375"
          stroke="#334155" strokeWidth="8" strokeLinecap="round" />

        {/* Sample dish */}
        <ellipse cx="82" cy="370" rx="36" ry="12" fill="#cbd5e1" />
        <ellipse cx="82" cy="363" rx="28" ry="6"
          fill={selectedMetal.color} opacity="0.7" />
        <text x="82" y="392" fill="#94a3b8" fontSize="11" textAnchor="middle">
          {selectedMetal.symbol} salt
        </text>

        {/* Bunsen burner */}
        <g transform="translate(300, 375)">
          <path d="M -20 0 L 20 0 L 15 -22 L -15 -22 Z" fill="#94a3b8" />
          <rect x="-11" y="-122" width="22" height="100" fill="#475569" />
          <rect x="-13" y="-42" width="26" height="16" fill="#f59e0b" rx="2" />
        </g>

        {/* Background glow — fills behind flame with metal color */}
        <ellipse ref={glowRef}
          cx="300" cy="220" rx="60" ry="100"
          fill="rgba(59,130,246,0)"
          opacity="0"
          style={{ filter: 'blur(24px)' }}
        />

        {/* Flame group */}
        <g transform="translate(300, 253)">
          {/* Outer flame — this is what changes color */}
          <path
            ref={outerFlameRef}
            className="ft-flicker"
            d="M 0 -150 Q 36 -88 24 0 L -24 0 Q -36 -88 0 -150 Z"
            fill="rgba(59,130,246,0.2)"
            opacity="0.4"
            style={{ filter: 'blur(7px)' }}
          />
          {/* Inner hot cone — always sky blue */}
          <path
            className="ft-flicker"
            d="M 0 -66 Q 17 -30 11 0 L -11 0 Q -17 -30 0 -66 Z"
            fill="rgba(56,189,248,0.85)"
            style={{ filter: 'blur(2px)' }}
          />
          {/* Bright core */}
          <path
            d="M 0 -30 Q 7 -12 5 0 L -5 0 Q -7 -12 0 -30 Z"
            fill="rgba(255,255,255,0.75)"
            style={{ filter: 'blur(1px)' }}
          />
        </g>

        {/* Nichrome wire loop — starts at left resting position */}
        <g ref={loopRef} transform="translate(0, 0)">
          {/* Handle */}
          <line x1="30" y1="308" x2="130" y2="308"
            stroke="#e2e8f0" strokeWidth="6" strokeLinecap="round" />
          {/* Wire */}
          <line x1="130" y1="308" x2="156" y2="308"
            stroke="#94a3b8" strokeWidth="2" />
          {/* Loop tip */}
          <circle cx="159" cy="308" r="4"
            fill="none" stroke="#94a3b8" strokeWidth="1.5" />
          {/* Sample dot — visible when wire is dipped */}
          <circle cx="159" cy="308" r="4"
            fill={selectedMetal.color}
            opacity="0"
            className="ft-sample-dot"
          />
        </g>

        {/* Cobalt glass blue overlay */}
        {filterId === 1 && (
          <rect x="0" y="0" width="600" height="420"
            fill="rgba(30,58,138,0.25)"
            style={{ pointerEvents: 'none' }}
          />
        )}

        {/* Wavelength annotation — shown when tested */}
        {hasTestedCurrentMetal && (
          <text x="300" y="26"
            fill={visibleColor}
            fontSize="13" textAnchor="middle" fontWeight="bold"
            style={{ filter: `drop-shadow(0 0 6px ${visibleColor})` }}>
            {blockedByCobalt
              ? 'Na⁺ yellow (589 nm) blocked by cobalt glass'
              : `${selectedMetal.colorName} — λ = ${selectedMetal.wavelength} nm`}
          </text>
        )}
      </svg>

      {/* Control panel */}
      <div style={{
        position: 'absolute', top: 16, right: 16,
        background: 'rgba(0,0,0,0.88)', padding: '12px 16px',
        border: '1px solid #374151', borderRadius: 10, zIndex: 20,
        display: 'flex', flexDirection: 'column', gap: 10, minWidth: 210,
      }}>
        <button
          onClick={handleTestCall}
          disabled={isAnimating}
          style={{
            width: '100%', padding: '9px',
            background: isAnimating ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.2)',
            color: isAnimating ? '#6ee7b7' : '#34d399',
            border: '1px solid rgba(16,185,129,0.5)',
            borderRadius: 6, fontWeight: 700, fontSize: 13,
            cursor: isAnimating ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {isAnimating ? '🔥 Testing…' : '▶ Perform Flame Test'}
        </button>

        <button
          onClick={recordObservation}
          disabled={!hasTestedCurrentMetal}
          style={{
            width: '100%', padding: '9px',
            background: hasTestedCurrentMetal ? 'rgba(59,130,246,0.2)' : 'transparent',
            color: hasTestedCurrentMetal ? '#60a5fa' : '#4b5563',
            border: `1px solid ${hasTestedCurrentMetal ? 'rgba(59,130,246,0.5)' : '#374151'}`,
            borderRadius: 6, fontWeight: 700, fontSize: 13,
            cursor: hasTestedCurrentMetal ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s',
          }}
        >
          Log Spectral Data
        </button>

        {!hasTestedCurrentMetal && (
          <div style={{ fontSize: 11, color: '#ef4444', textAlign: 'center', lineHeight: 1.4 }}>
            Perform the test for this metal before logging.
          </div>
        )}

        {/* Color preview */}
        <div style={{ borderTop: '1px solid #374151', paddingTop: 10, marginTop: 2 }}>
          <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Expected Flame
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8, flexShrink: 0,
              background: blockedByCobalt ? '#0a0a2e' : selectedMetal.color,
              border: '1px solid #374151',
              boxShadow: blockedByCobalt ? 'none' : `0 0 12px ${selectedMetal.color}66`,
            }} />
            <div>
              <div style={{ fontSize: 13, color: '#d1d5db', fontWeight: 600 }}>
                {blockedByCobalt ? 'Blocked' : selectedMetal.colorName}
              </div>
              <div style={{ fontSize: 11, color: '#6b7280', fontFamily: 'monospace' }}>
                λ = {selectedMetal.wavelength} nm
              </div>
            </div>
          </div>
        </div>

        {/* All metals reference */}
        <div style={{ borderTop: '1px solid #374151', paddingTop: 10, marginTop: 2 }}>
          <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            All Metals
          </div>
          {metals.map(m => (
            <div key={m.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 11, marginBottom: 4,
              opacity: m.id === metalId ? 1 : 0.45,
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: m.color, flexShrink: 0,
                boxShadow: m.id === metalId ? `0 0 6px ${m.color}` : 'none',
              }} />
              <span style={{ color: '#9ca3af', flex: 1 }}>{m.symbol}</span>
              <span style={{ color: m.id === metalId ? m.color : '#4b5563' }}>{m.colorName}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 