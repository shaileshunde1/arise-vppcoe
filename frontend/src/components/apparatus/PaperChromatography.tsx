import { useEffect, useState } from 'react';
import { useLabStore } from '../../store/useLabStore';

interface ApparatusProps {
  varState: Record<string, number | string>;
  setVarState: React.Dispatch<React.SetStateAction<Record<string, number | string>>>;
  addObservation: (data: any) => void;
}

const SOLVENTS = ['Water', 'Ethanol', 'Acetone', 'Hexane'];

// Solvent polarity shift: Water=most polar (shifts Rf down), Hexane=least polar (shifts Rf up)
const SOLVENT_SHIFT = [0, 0.05, 0.10, 0.18];

const mixtureProfiles = [
  {
    id: 0, name: 'Black Ink',
    components: [
      { name: 'Yellow',  color: '#fbbf24', baseRf: 0.80 },
      { name: 'Red',     color: '#ef4444', baseRf: 0.60 },
      { name: 'Blue',    color: '#3b82f6', baseRf: 0.30 },
    ],
  },
  {
    id: 1, name: 'Green Food Dye',
    components: [
      { name: 'Yellow',  color: '#facc15', baseRf: 0.75 },
      { name: 'Blue',    color: '#2563eb', baseRf: 0.40 },
    ],
  },
  {
    id: 2, name: 'Plant Extract',
    components: [
      { name: 'Carotene',      color: '#f97316', baseRf: 0.95 },
      { name: 'Xanthophyll',   color: '#fde047', baseRf: 0.70 },
      { name: 'Chlorophyll a', color: '#22c55e', baseRf: 0.50 },
      { name: 'Chlorophyll b', color: '#15803d', baseRf: 0.30 },
    ],
  },
  {
    id: 3, name: 'Marker Ink',
    components: [
      { name: 'Cyan',       color: '#06b6d4', baseRf: 0.85 },
      { name: 'Magenta',    color: '#d946ef', baseRf: 0.65 },
      { name: 'Black Base', color: '#64748b', baseRf: 0.20 },
    ],
  },
];

const BASE_Y    = 320;   // baseline Y (bottom of paper)
const TOP_Y     = 60;    // max solvent front Y (top of paper)
const RUN_PX    = BASE_Y - TOP_Y; // total pixels available = 260

export default function PaperChromatography({ varState, addObservation }: ApparatusProps) {
  const mixtureId = Number(varState.mixture ?? 0);
  const solventId = Number(varState.solvent  ?? 0);
  const runtime   = Number(varState.runtime  ?? 0); // 0–15

  const { setValidationError } = useLabStore();

  const selectedMixture = mixtureProfiles[mixtureId] ?? mixtureProfiles[0];
  const solventShift    = SOLVENT_SHIFT[solventId] ?? 0;

  // Derived from runtime — no separate state needed
  const progress      = runtime / 15;                    // 0..1
  const solventFrontY = BASE_Y - progress * RUN_PX;      // Y of solvent front
  const solventDistPx = progress * RUN_PX;               // px the solvent has traveled

  // Rf values adjusted for solvent choice
  const actualRfs = selectedMixture.components.map(c =>
    Math.max(0.05, Math.min(0.95, c.baseRf + solventShift))
  );

  // Y position of each band
  const bandYs = actualRfs.map(rf => BASE_Y - rf * solventDistPx);

  // Spread increases with runtime
  const spread  = 1 + (runtime / 15) * 4;
  const opacity = runtime > 0 ? Math.max(0.4, 1 - (runtime / 15) * 0.3) : 0;

  const recordObservation = () => {
    if (runtime < 5) {
      setValidationError(
        "Too Early",
        "The solvent front hasn't traveled far enough.",
        "Increase the Run Time slider to at least 5 minutes before recording Rf values."
      );
      return;
    }
    if (solventDistPx < 1) return;

    selectedMixture.components.forEach((comp, idx) => {
      const rf          = actualRfs[idx];
      const distComp    = rf * solventDistPx;
      addObservation({
        "Mixture":        selectedMixture.name,
        "Solvent":        SOLVENTS[solventId],
        "Component":      comp.name,
        "Distance Comp (px)": Number(distComp.toFixed(1)),
        "Distance Solvent (px)": Number(solventDistPx.toFixed(1)),
        "Rf Value":       Number(rf.toFixed(3)),
      });
    });
  };

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', background: '#02060d', padding: 32,
    }}>

      {/* Readouts */}
      <div style={{
        position: 'absolute', top: 16, left: 16,
        background: 'rgba(0,0,0,0.6)', border: '1px solid #374151',
        padding: '8px 16px', borderRadius: 8, zIndex: 10, pointerEvents: 'none',
      }}>
        <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Chromatogram</div>
        <div style={{ fontFamily: 'monospace', fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ color: '#fff' }}>Sample: {selectedMixture.name}</span>
          <span style={{ color: '#00d4ff' }}>Run Time: {runtime} / 15 min</span>
          <span style={{ color: '#9ca3af' }}>Solvent: {SOLVENTS[solventId]}</span>
          <span style={{ color: '#9ca3af' }}>Solvent front: {progress > 0 ? `${(progress * 100).toFixed(0)}%` : 'Not started'}</span>
        </div>
      </div>

      <svg width="400" height="420" viewBox="0 0 400 420"
        style={{ overflow: 'visible', border: '1px solid #1e293b', background: '#0a1128', borderRadius: 12 }}>

        {/* Beaker outline */}
        <path d="M 120 50 L 120 370 C 120 378 130 388 140 388 L 260 388 C 270 388 280 378 280 370 L 280 50 Z"
          fill="none" stroke="#64748b" strokeWidth="4" />
        <line x1="110" y1="50" x2="290" y2="50" stroke="#64748b" strokeWidth="4" strokeLinecap="round" />

        {/* Solvent pool */}
        <path d="M 122 345 L 278 345 L 278 370 C 278 378 270 386 260 386 L 140 386 C 130 386 122 378 122 370 Z"
          fill="rgba(0,212,255,0.18)" />

        {/* Filter paper background */}
        <rect x="160" y="52" width="80" height={BASE_Y - 52} fill="#f8fafc" rx="3" />

        {/* Wetted area — fills from bottom upward as solvent rises */}
        {runtime > 0 && (
          <rect
            x="161" y={solventFrontY}
            width="78" height={BASE_Y - solventFrontY}
            fill="rgba(0,150,220,0.13)"
          />
        )}

        {/* Baseline */}
        <line x1="163" y1={BASE_Y} x2="237" y2={BASE_Y}
          stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 2" />
        <text x="242" y={BASE_Y + 4} fill="#64748b" fontSize="8">Baseline</text>

        {/* Origin dot */}
        <circle cx="200" cy={BASE_Y} r="4"
          fill="#1e293b" opacity={runtime > 0 ? 0.15 : 1} />

        {/* Solvent front line */}
        {runtime > 0 && (
          <>
            <line x1="161" y1={solventFrontY} x2="239" y2={solventFrontY}
              stroke="rgba(0,212,255,0.7)" strokeWidth="1.5" strokeDasharray="4 2" />
            <text x="242" y={solventFrontY + 4} fill="rgba(0,212,255,0.7)" fontSize="8">Front</text>
          </>
        )}

        {/* Migrating bands */}
        {runtime > 0 && selectedMixture.components.map((comp, idx) => (
          <ellipse
            key={`${mixtureId}-${solventId}-${idx}`}
            cx="200"
            cy={bandYs[idx]}
            rx={6 + spread}
            ry={3 + spread * 0.5}
            fill={comp.color}
            opacity={opacity}
            style={{ filter: `blur(${(spread * 0.8).toFixed(1)}px)` }}
          />
        ))}

        {/* Rf labels — only when runtime > 8 */}
        {runtime > 8 && selectedMixture.components.map((comp, idx) => (
          <text key={`label-${idx}`}
            x="248" y={bandYs[idx] + 4}
            fill={comp.color} fontSize="9" fontWeight="bold">
            Rf={actualRfs[idx].toFixed(2)}
          </text>
        ))}

        {/* Ruler on left side of paper */}
        <g opacity="0.5">
          <line x1="152" y1={TOP_Y} x2="152" y2={BASE_Y} stroke="#cbd5e1" strokeWidth="1.5" />
          {[0, 0.25, 0.5, 0.75, 1].map((tick, i) => {
            const tickY = BASE_Y - tick * RUN_PX;
            return (
              <g key={i}>
                <line x1="147" y1={tickY} x2="157" y2={tickY} stroke="#cbd5e1" strokeWidth="1.5" />
                <text x="142" y={tickY + 4} fill="#64748b" fontSize="8" textAnchor="end">
                  {tick.toFixed(2)}
                </text>
              </g>
            );
          })}
        </g>

        {/* Solvent label at bottom */}
        <text x="200" y="408" fill="#94a3b8" fontSize="10" textAnchor="middle">
          Solvent: {SOLVENTS[solventId]}
        </text>
      </svg>

      {/* Controls panel */}
      <div style={{
        position: 'absolute', top: 16, right: 16,
        background: 'rgba(0,0,0,0.85)', padding: '12px 16px',
        border: '1px solid #374151', borderRadius: 10, zIndex: 20,
        display: 'flex', flexDirection: 'column', gap: 10, minWidth: 200,
      }}>
        <button
          onClick={recordObservation}
          disabled={runtime < 5}
          style={{
            width: '100%', padding: '8px 16px',
            background: runtime >= 5 ? 'rgba(59,130,246,0.2)' : 'transparent',
            color: runtime >= 5 ? '#60a5fa' : '#4b5563',
            border: `1px solid ${runtime >= 5 ? 'rgba(59,130,246,0.5)' : '#374151'}`,
            borderRadius: 6, fontWeight: 700, fontSize: 13,
            cursor: runtime >= 5 ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s',
          }}
        >
          {runtime < 5 ? `Run ${5 - runtime} more min…` : 'Calculate & Record Rf'}
        </button>

        <div style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.5 }}>
          Run time ≥ 5 min to enable recording.<br />
          Rf labels appear at ≥ 8 min.
        </div>

        {/* Component legend */}
        <div style={{ borderTop: '1px solid #374151', paddingTop: 8, marginTop: 2 }}>
          <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            Components
          </div>
          {selectedMixture.components.map((comp, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, marginBottom: 4 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: comp.color, flexShrink: 0 }} />
              <span style={{ color: '#d1d5db', flex: 1 }}>{comp.name}</span>
              <span style={{ color: '#6b7280', fontFamily: 'monospace' }}>
                {runtime > 0 ? `Rf ${actualRfs[i].toFixed(2)}` : `~${comp.baseRf}`}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}