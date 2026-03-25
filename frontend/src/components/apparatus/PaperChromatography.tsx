import { useState } from 'react';
import { useLabStore } from '../../store/useLabStore';

interface ApparatusProps {
  varState: Record<string, number | string>;
  setVarState: React.Dispatch<React.SetStateAction<Record<string, number | string>>>;
  addObservation: (data: any) => void;
}

const SOLVENTS = ['Water', 'Ethanol', 'Acetone', 'Hexane'];
const SOLVENT_SHIFT = [0, 0.06, 0.12, 0.20];

const mixtureProfiles = [
  {
    id: 0, name: 'Black Ink',
    components: [
      { name: 'Yellow dye',  color: '#d97706', baseRf: 0.80 },
      { name: 'Red dye',     color: '#dc2626', baseRf: 0.58 },
      { name: 'Blue dye',    color: '#2563eb', baseRf: 0.28 },
    ],
  },
  {
    id: 1, name: 'Green Food Dye',
    components: [
      { name: 'Yellow',  color: '#ca8a04', baseRf: 0.75 },
      { name: 'Blue',    color: '#1d4ed8', baseRf: 0.38 },
    ],
  },
  {
    id: 2, name: 'Plant Extract',
    components: [
      { name: 'Carotene',      color: '#ea580c', baseRf: 0.92 },
      { name: 'Xanthophyll',   color: '#ca8a04', baseRf: 0.68 },
      { name: 'Chlorophyll a', color: '#16a34a', baseRf: 0.48 },
      { name: 'Chlorophyll b', color: '#15803d', baseRf: 0.28 },
    ],
  },
  {
    id: 3, name: 'Marker Ink',
    components: [
      { name: 'Cyan',       color: '#0e7490', baseRf: 0.82 },
      { name: 'Magenta',    color: '#a21caf', baseRf: 0.62 },
      { name: 'Black base', color: '#475569', baseRf: 0.18 },
    ],
  },
];

const PAPER_X      = 170;
const PAPER_WIDTH  = 90;
const PAPER_TOP    = 55;
const PAPER_BOTTOM = 340;
const PAPER_RUN    = PAPER_BOTTOM - PAPER_TOP;
const BASELINE_Y   = PAPER_BOTTOM - 20;

export default function PaperChromatography({ varState, addObservation }: ApparatusProps) {
  const mixtureId = Number(varState.mixture ?? 0);
  const solventId = Number(varState.solvent  ?? 0);
  const runtime   = Number(varState.runtime  ?? 0);

  const { setValidationError } = useLabStore();

  const selectedMixture = mixtureProfiles[mixtureId] ?? mixtureProfiles[0];
  const solventShift    = SOLVENT_SHIFT[solventId]   ?? 0;

  const progress = Math.min(1, runtime / 15);
  const solventFrontY  = BASELINE_Y - progress * (BASELINE_Y - PAPER_TOP);
  const solventDistPx  = BASELINE_Y - solventFrontY;

  const actualRfs = selectedMixture.components.map(c =>
    Math.max(0.05, Math.min(0.95, c.baseRf + solventShift))
  );

  const bandCentreYs = actualRfs.map(rf => BASELINE_Y - rf * solventDistPx);
  const halfWidthX   = 8  + progress * 10;
  const halfWidthY   = 4  + progress * 5;
  const bandVisible  = actualRfs.map(rf => progress > rf * 0.15);

  const recordObservation = () => {
    if (runtime < 5) {
      setValidationError('Too Early', 'The solvent front has not traveled far enough.', 'Increase the Run Time slider to at least 5 minutes.');
      return;
    }
    selectedMixture.components.forEach((comp, idx) => {
      const rf       = actualRfs[idx];
      const distComp = rf * solventDistPx;
      addObservation({
        'Mixture':               selectedMixture.name,
        'Solvent':               SOLVENTS[solventId],
        'Component':             comp.name,
        'Distance comp (px)':    +distComp.toFixed(1),
        'Distance solvent (px)': +solventDistPx.toFixed(1),
        'Rf Value':              +rf.toFixed(3),
      });
    });
  };

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'row',
      alignItems: 'center', justifyContent: 'center',
      gap: 20, background: '#02060d', padding: '16px 24px', boxSizing: 'border-box',
    }}>

      {/* ── Left: Readout panel ── */}
      <div style={{
        background: 'rgba(0,0,0,0.7)', border: '1px solid #374151',
        padding: '12px 14px', borderRadius: 8, flexShrink: 0, width: 180,
        alignSelf: 'flex-start', marginTop: 8,
      }}>
        <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
          Chromatogram
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ color: '#fff' }}>Sample: {selectedMixture.name}</span>
          <span style={{ color: '#00d4ff' }}>Run Time: {runtime} / 15 min</span>
          <span style={{ color: '#9ca3af' }}>Solvent: {SOLVENTS[solventId]}</span>
          <span style={{ color: '#9ca3af' }}>
            Front: {progress > 0 ? `${(progress * 100).toFixed(0)}%` : 'Not started'}
          </span>
          {runtime >= 8 && (
            <span style={{ color: '#4ade80', marginTop: 4, fontSize: 10 }}>Rf labels visible ✓</span>
          )}
        </div>
      </div>

      {/* ── Centre: SVG experiment ── */}
      <svg width="430" height="460" viewBox="0 0 430 460"
        style={{ overflow: 'visible', border: '1px solid #1e293b', background: '#060f26', borderRadius: 12, flexShrink: 0 }}>

        {/* Beaker outline */}
        <path d="M 130 60 L 130 390 C 130 400 140 410 152 410 L 278 410 C 290 410 300 400 300 390 L 300 60 Z"
          fill="none" stroke="#334155" strokeWidth="3" />
        <line x1="120" y1="60" x2="310" y2="60" stroke="#334155" strokeWidth="3" strokeLinecap="round" />

        {/* Solvent pool */}
        <path d="M 132 355 L 298 355 L 298 390 C 298 400 290 408 278 408 L 152 408 C 140 408 132 400 132 390 Z"
          fill="rgba(0,212,255,0.15)" stroke="rgba(0,212,255,0.25)" strokeWidth="1" />
        <text x="215" y="388" fill="rgba(0,212,255,0.4)" fontSize="9" textAnchor="middle">
          {SOLVENTS[solventId]}
        </text>

        {/* Filter paper */}
        <rect x={PAPER_X} y={PAPER_TOP} width={PAPER_WIDTH} height={PAPER_BOTTOM - PAPER_TOP}
          fill="#f5f0e8" rx="2" />

        {/* Wetted zone */}
        {runtime > 0 && (
          <rect x={PAPER_X + 1} y={solventFrontY}
            width={PAPER_WIDTH - 2} height={BASELINE_Y - solventFrontY + 18}
            fill="rgba(14,116,144,0.12)" rx="1"
            style={{ transition: 'all 0.6s ease' }}
          />
        )}

        {/* Baseline */}
        <line x1={PAPER_X + 5} y1={BASELINE_Y} x2={PAPER_X + PAPER_WIDTH - 5} y2={BASELINE_Y}
          stroke="#64748b" strokeWidth="1" strokeDasharray="4 3" />
        <text x={PAPER_X + PAPER_WIDTH + 6} y={BASELINE_Y + 4} fill="#64748b" fontSize="8">Baseline</text>

        {/* Origin spot */}
        <circle cx={PAPER_X + PAPER_WIDTH / 2} cy={BASELINE_Y} r="4"
          fill={runtime > 0 ? '#94a3b8' : '#1e293b'} stroke="#94a3b8" strokeWidth="1" />

        {/* Solvent front */}
        {runtime > 0 && (
          <>
            <line x1={PAPER_X + 3} y1={solventFrontY} x2={PAPER_X + PAPER_WIDTH - 3} y2={solventFrontY}
              stroke="rgba(0,212,255,0.7)" strokeWidth="1.5" strokeDasharray="5 3" />
            <text x={PAPER_X + PAPER_WIDTH + 6} y={solventFrontY + 4}
              fill="rgba(0,212,255,0.8)" fontSize="8">Front</text>
          </>
        )}

        {/* Migrating spots */}
        {runtime > 0 && selectedMixture.components.map((comp, idx) => {
          if (!bandVisible[idx]) return null;
          const cx = PAPER_X + PAPER_WIDTH / 2;
          const cy = bandCentreYs[idx];
          const opacity = Math.min(0.95, 0.5 + progress * 0.45);
          return (
            <g key={`${mixtureId}-${solventId}-${idx}`}>
              <ellipse cx={cx} cy={cy} rx={halfWidthX + 4} ry={halfWidthY + 3}
                fill={comp.color} opacity={opacity * 0.25} />
              <ellipse cx={cx} cy={cy} rx={halfWidthX} ry={halfWidthY}
                fill={comp.color} opacity={opacity} />
              <ellipse cx={cx} cy={cy} rx={halfWidthX * 0.45} ry={halfWidthY * 0.5}
                fill={comp.color} opacity={Math.min(1, opacity + 0.15)} />
              {runtime >= 8 && (
                <text x={PAPER_X + PAPER_WIDTH + 6} y={cy + 4}
                  fill={comp.color} fontSize="9" fontWeight="700">
                  Rf={actualRfs[idx].toFixed(2)}
                </text>
              )}
            </g>
          );
        })}

        {/* Ruler */}
        <g opacity="0.45">
          <line x1={PAPER_X - 4} y1={PAPER_TOP} x2={PAPER_X - 4} y2={BASELINE_Y}
            stroke="#64748b" strokeWidth="1" />
          {[0, 0.25, 0.5, 0.75, 1].map((tick, i) => {
            const tickY = BASELINE_Y - tick * (BASELINE_Y - PAPER_TOP);
            return (
              <g key={i}>
                <line x1={PAPER_X - 8} y1={tickY} x2={PAPER_X - 2} y2={tickY}
                  stroke="#64748b" strokeWidth="1.5" />
                <text x={PAPER_X - 10} y={tickY + 4} fill="#64748b" fontSize="7" textAnchor="end">
                  {tick.toFixed(2)}
                </text>
              </g>
            );
          })}
        </g>

        {/* Paper clip */}
        <rect x={PAPER_X + PAPER_WIDTH / 2 - 6} y={PAPER_TOP - 18} width="12" height="22" rx="3" fill="#64748b" />
        <line x1={PAPER_X + PAPER_WIDTH / 2} y1={PAPER_TOP - 18}
              x2={PAPER_X + PAPER_WIDTH / 2} y2={PAPER_TOP - 40}
          stroke="#475569" strokeWidth="2.5" strokeLinecap="round" />
        <line x1={PAPER_X - 10} y1={PAPER_TOP - 40} x2={PAPER_X + PAPER_WIDTH + 10} y2={PAPER_TOP - 40}
          stroke="#334155" strokeWidth="4" strokeLinecap="round" />

        {runtime >= 5 && (
          <text x="215" y="430" fill="#475569" fontSize="9" textAnchor="middle">
            {selectedMixture.components.length} components · {SOLVENTS[solventId]}
          </text>
        )}
      </svg>

      {/* ── Right: Controls panel ── */}
      <div style={{
        background: 'rgba(0,0,0,0.88)', padding: '12px 14px',
        border: '1px solid #374151', borderRadius: 10,
        display: 'flex', flexDirection: 'column', gap: 10,
        width: 190, flexShrink: 0, alignSelf: 'flex-start', marginTop: 8,
      }}>
        <button
          onClick={recordObservation}
          disabled={runtime < 5}
          style={{
            width: '100%', padding: '8px 10px',
            background: runtime >= 5 ? 'rgba(59,130,246,0.2)' : 'transparent',
            color: runtime >= 5 ? '#60a5fa' : '#4b5563',
            border: `1px solid ${runtime >= 5 ? 'rgba(59,130,246,0.5)' : '#374151'}`,
            borderRadius: 6, fontWeight: 700, fontSize: 12,
            cursor: runtime >= 5 ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s',
          }}
        >
          {runtime < 5 ? `Run ${5 - runtime} more min…` : 'Calculate & Record Rf'}
        </button>

        <div style={{ fontSize: 10, color: '#6b7280', lineHeight: 1.6 }}>
          Rf = distance by component ÷ distance by solvent front.
          Higher Rf = less polar compound.
        </div>

        {/* Component legend */}
        <div style={{ borderTop: '1px solid #374151', paddingTop: 8 }}>
          <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            Components
          </div>
          {selectedMixture.components.map((comp, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, marginBottom: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: comp.color, flexShrink: 0, border: '1px solid rgba(255,255,255,0.2)' }} />
              <span style={{ color: '#d1d5db', flex: 1 }}>{comp.name}</span>
              <span style={{ color: '#6b7280', fontFamily: 'monospace', fontSize: 10 }}>
                {runtime > 0 ? `Rf ${actualRfs[i].toFixed(2)}` : `~${comp.baseRf}`}
              </span>
            </div>
          ))}
        </div>

        <div style={{ borderTop: '1px solid #374151', paddingTop: 8, fontSize: 10, color: '#4b5563', lineHeight: 1.6 }}>
          Spots travel up with solvent.<br />
          Higher Rf = travels further.<br />
          Polarity of solvent affects separation.
        </div>
      </div>
    </div>
  );
}