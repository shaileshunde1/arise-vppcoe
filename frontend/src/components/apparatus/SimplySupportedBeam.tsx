import { useState, useCallback } from "react";

const E_STEEL = 200e9;

const getI = (b: number, d: number) =>
  ((b / 1000) * Math.pow(d / 1000, 3)) / 12;

const deflAtX = (x: number, P: number, a: number, L: number, I: number): number => {
  if (!I || !L) return 0;
  const b = L - a;
  const d =
    x <= a
      ? (P * b * x) / (6 * L * E_STEEL * I) * (L * L - b * b - x * x)
      : (P * a * (L - x)) / (6 * L * E_STEEL * I) * (2 * L * x - a * a - x * x);
  return Math.abs(d) * 1000;
};

const getMaxDefl = (P: number, a: number, L: number, I: number): number => {
  const b = L - a;
  const xc = Math.sqrt(Math.max(0, (L * L - b * b) / 3));
  return deflAtX(xc, P, a, L, I);
};

const getReactions = (P: number, a: number, L: number) => ({
  RA: (P * (L - a)) / L,
  RB: (P * a) / L,
});

const getMaxMoment = (P: number, a: number, L: number) =>
  (P * a * (L - a)) / L;

/* ── Types ── */
interface Reading {
  id: number;
  n: number;
  span: number;
  load: number;
  a: number;
  defl: number;
  moment: number;
}

/* ── Lab Apparatus SVG ── */
interface LabApparatusProps {
  span: number;
  load: number;
  posRatio: number;
  b_mm: number;
  d_mm: number;
}

function LabApparatus({ span, load, posRatio, b_mm, d_mm }: LabApparatusProps) {
  const a = posRatio * span;
  const I = getI(b_mm, d_mm);
  const { RA, RB } = getReactions(load, a, span);
  const maxD = getMaxDefl(load, a, span, I);

  const W = 360, H = 260;
  const TABLE_Y = 195;
  const PAD_X = 44;
  const beamStartX = PAD_X;
  const beamEndX = W - PAD_X;
  const beamLen = beamEndX - beamStartX;
  const beamH = Math.max(9, Math.min(24, (d_mm / 150) * 24));
  const supportKnifeY = TABLE_Y - 50;
  const beamY = supportKnifeY - beamH;
  const toX = (v: number) => beamStartX + (v / span) * beamLen;
  const loadX = toX(a);

  const maxSagPx = Math.min(18, Math.max(2, maxD * 2.2));
  const nPts = 60;
  const deflPts = Array.from({ length: nPts + 1 }, (_, i) => {
    const x = (i / nPts) * span;
    const d = deflAtX(x, load, a, span, I);
    const sag = (d / (maxD || 1)) * maxSagPx;
    return `${toX(x).toFixed(1)},${(beamY + beamH / 2 + sag).toFixed(1)}`;
  }).join(" ");

  const MAX_LOAD = 2000;
  const plateCount = Math.max(1, Math.round((load / MAX_LOAD) * 6));
  const plateW = 46;
  const plateH = Math.max(8, Math.round(7 + (load / MAX_LOAD) * 9));
  const hangerH = 26;
  const hangerW = 7;
  const hangerTop = beamY + beamH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="la-roomBg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0a1220" />
          <stop offset="100%" stopColor="#060c15" />
        </linearGradient>
        <linearGradient id="la-tableTop" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8b5e3c" />
          <stop offset="25%" stopColor="#a0724a" />
          <stop offset="100%" stopColor="#4a2e10" />
        </linearGradient>
        <linearGradient id="la-tableLeg" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#3d2008" />
          <stop offset="50%" stopColor="#5a3015" />
          <stop offset="100%" stopColor="#2e1806" />
        </linearGradient>
        <linearGradient id="la-supBody" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#5a6878" />
          <stop offset="30%" stopColor="#9aaabb" />
          <stop offset="70%" stopColor="#7a8a98" />
          <stop offset="100%" stopColor="#4a5868" />
        </linearGradient>
        <linearGradient id="la-beamFace" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d0d8e4" />
          <stop offset="15%" stopColor="#eef2f8" />
          <stop offset="50%" stopColor="#b8c4d0" />
          <stop offset="85%" stopColor="#8898a8" />
          <stop offset="100%" stopColor="#607080" />
        </linearGradient>
        <linearGradient id="la-beamBottom" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7a8a98" />
          <stop offset="100%" stopColor="#4a5868" />
        </linearGradient>
        <linearGradient id="la-plateMetal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b8c4d0" />
          <stop offset="30%" stopColor="#8898a8" />
          <stop offset="70%" stopColor="#607080" />
          <stop offset="100%" stopColor="#485868" />
        </linearGradient>
        <linearGradient id="la-hangerRod" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#606870" />
          <stop offset="45%" stopColor="#a0aab8" />
          <stop offset="100%" stopColor="#586068" />
        </linearGradient>
        <linearGradient id="la-dialGauge" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e8eeee" />
          <stop offset="100%" stopColor="#c0cacc" />
        </linearGradient>
        <filter id="la-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="1" dy="3" stdDeviation="4" floodColor="#000" floodOpacity="0.6" />
        </filter>
        <filter id="la-lightShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.4" />
        </filter>
      </defs>

      <rect width={W} height={H} fill="url(#la-roomBg)" />
      {[40, 80, 120, 160].map((y) => (
        <line key={y} x1={0} y1={y} x2={W} y2={y} stroke="rgba(255,255,255,0.012)" strokeWidth="0.5" />
      ))}

      {/* Table legs */}
      {[40, W - 40].map((lx, i) => (
        <g key={i}>
          <rect x={lx - 8} y={TABLE_Y + 16} width={16} height={H - TABLE_Y - 16} fill="url(#la-tableLeg)" rx="1" />
          <rect x={lx - 7} y={TABLE_Y + 16} width={4} height={H - TABLE_Y - 16} fill="rgba(255,255,255,0.06)" rx="1" />
        </g>
      ))}
      <rect x={48} y={TABLE_Y + 50} width={W - 96} height={8} fill="url(#la-tableLeg)" rx="1" />
      <rect x={12} y={TABLE_Y} width={W - 24} height={20} rx="2" fill="url(#la-tableTop)" filter="url(#la-shadow)" />
      {[0.15, 0.35, 0.55, 0.72, 0.85, 0.93].map((t, i) => (
        <line key={i} x1={12} y1={TABLE_Y + t * 20} x2={W - 24} y2={TABLE_Y + t * 20}
          stroke="rgba(0,0,0,0.15)" strokeWidth={i % 2 === 0 ? "0.8" : "0.4"} />
      ))}
      <rect x={12} y={TABLE_Y} width={W - 24} height={2} rx="1" fill="rgba(255,255,255,0.18)" />
      <rect x={12} y={TABLE_Y + 17} width={W - 24} height={4} rx="1" fill="#3a1e08" />

      {/* Supports */}
      {[{ xv: 0, label: "A", val: RA }, { xv: span, label: "B", val: RB }].map(({ xv, label, val }) => {
        const sx = toX(xv);
        const sBaseY = TABLE_Y;
        const sH = 48, sW = 24, kH = 6;
        return (
          <g key={label} filter="url(#la-lightShadow)">
            <rect x={sx - sW / 2 - 2} y={sBaseY - 4} width={sW + 4} height={5} rx="1" fill="#384858" />
            <polygon points={`${sx - sW / 2},${sBaseY - 4} ${sx + sW / 2},${sBaseY - 4} ${sx + 7},${sBaseY - sH} ${sx - 7},${sBaseY - sH}`} fill="url(#la-supBody)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
            <polygon points={`${sx - 7},${sBaseY - sH} ${sx + 7},${sBaseY - sH} ${sx + 2},${sBaseY - sH - kH} ${sx - 2},${sBaseY - sH - kH}`} fill="#d8e0e8" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
            <text x={sx} y={sBaseY + 13} textAnchor="middle" fill="#f0a030" fontSize="11" fontWeight="bold" fontFamily="monospace">{label}</text>
            <text x={sx} y={sBaseY + 24} textAnchor="middle" fill="#7a6040" fontSize="8" fontFamily="monospace">{val.toFixed(0)} N</text>
          </g>
        );
      })}

      {/* Dial gauge */}
      {(() => {
        const dgx = loadX, dgy = TABLE_Y - 8;
        const stemH = 14;
        const r1 = 9, r2 = 11;
        return (
          <g filter="url(#la-lightShadow)">
            <rect x={dgx - 2} y={dgy - stemH} width={4} height={stemH} fill="#607080" rx="1" />
            <circle cx={dgx} cy={dgy - stemH - 13} r={13} fill="url(#la-dialGauge)" stroke="#8090a0" strokeWidth="1" />
            <circle cx={dgx} cy={dgy - stemH - 13} r={11} fill="none" stroke="#a0aaaa" strokeWidth="0.5" />
            {Array.from({ length: 12 }, (_, i) => {
              const ang = (i / 12) * Math.PI * 2 - Math.PI / 2;
              return (
                <line key={i}
                  x1={dgx + Math.cos(ang) * r1} y1={dgy - stemH - 13 + Math.sin(ang) * r1}
                  x2={dgx + Math.cos(ang) * r2} y2={dgy - stemH - 13 + Math.sin(ang) * r2}
                  stroke="#607080" strokeWidth="0.7" />
              );
            })}
            {(() => {
              const needleAng = -Math.PI / 2 + (maxD / 5) * Math.PI * 1.5;
              return (
                <line x1={dgx} y1={dgy - stemH - 13}
                  x2={dgx + Math.cos(needleAng) * 8} y2={dgy - stemH - 13 + Math.sin(needleAng) * 8}
                  stroke="#e05020" strokeWidth="1.2" strokeLinecap="round" />
              );
            })()}
            <circle cx={dgx} cy={dgy - stemH - 13} r={1.5} fill="#607080" />
          </g>
        );
      })()}

      {/* Deflected shape */}
      <polyline points={deflPts} fill="none" stroke="rgba(96,165,250,0.4)" strokeWidth="1.8" strokeDasharray="5,4" />

      {/* Beam */}
      <g filter="url(#la-shadow)">
        <rect x={beamStartX} y={beamY + beamH} width={beamLen} height={5} fill="url(#la-beamBottom)" />
        <rect x={beamStartX} y={beamY} width={beamLen} height={beamH} fill="url(#la-beamFace)" stroke="rgba(0,0,0,0.15)" strokeWidth="0.5" />
        <rect x={beamStartX + 4} y={beamY + 2} width={beamLen - 8} height={2.5} fill="rgba(255,255,255,0.4)" rx="1" />
        <rect x={beamStartX} y={beamY - 1} width={4} height={beamH + 6} fill="#506070" />
        <rect x={beamEndX - 4} y={beamY - 1} width={4} height={beamH + 6} fill="#405060" />
      </g>

      {/* Span label */}
      <line x1={beamStartX} y1={beamY - 16} x2={beamEndX} y2={beamY - 16} stroke="rgba(240,160,48,0.25)" strokeWidth="0.8" strokeDasharray="3,2" />
      <text x={(beamStartX + beamEndX) / 2} y={beamY - 20} textAnchor="middle" fill="rgba(240,160,48,0.4)" fontSize="8" fontFamily="monospace">
        L = {span.toFixed(1)} m · {b_mm}×{d_mm} mm
      </text>

      {/* Load hanger */}
      <g filter="url(#la-lightShadow)">
        <rect x={loadX - 5} y={beamY + beamH - 1} width={10} height={5} rx="1" fill="#a0aab8" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
        <rect x={loadX - hangerW / 2} y={hangerTop + 4} width={hangerW} height={hangerH} fill="url(#la-hangerRod)" rx="1" />
        <ellipse cx={loadX} cy={hangerTop + hangerH + 5} rx={5} ry={4} fill="none" stroke="#8090a0" strokeWidth="2" />
        {Array.from({ length: plateCount }, (_, i) => {
          const py = hangerTop + hangerH + 9 + i * (plateH + 2);
          return (
            <g key={i}>
              <rect x={loadX - plateW / 2} y={py} width={plateW} height={plateH} rx="3" fill="url(#la-plateMetal)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.6" />
              <rect x={loadX - plateW / 2 + 4} y={py + 1} width={plateW - 8} height={2} rx="1" fill="rgba(255,255,255,0.28)" />
              <circle cx={loadX} cy={py + plateH / 2} r={3} fill="#2a3040" stroke="rgba(100,110,120,0.4)" strokeWidth="0.5" />
            </g>
          );
        })}
      </g>
      <text x={loadX + plateW / 2 + 6} y={hangerTop + hangerH + 14} fill="#f0a030" fontSize="10" fontFamily="monospace" fontWeight="bold">
        {load} N
      </text>

      {a > 0.1 * span && (
        <>
          <line x1={beamStartX} y1={TABLE_Y + 30} x2={loadX} y2={TABLE_Y + 30} stroke="rgba(251,191,36,0.18)" strokeWidth="0.7" strokeDasharray="2,2" />
          <text x={(beamStartX + loadX) / 2} y={TABLE_Y + 27} textAnchor="middle" fill="rgba(251,191,36,0.3)" fontSize="8" fontFamily="monospace">
            a = {a.toFixed(2)} m
          </text>
        </>
      )}

      <text x={W / 2} y={H - 4} textAnchor="middle" fill="rgba(96,165,250,0.45)" fontSize="9" fontFamily="monospace">
        δ_max = {maxD.toFixed(3)} mm
      </text>
    </svg>
  );
}

/* ── Slider ── */
interface LabSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}

function LabSlider({ label, value, min, max, step, display, onChange }: LabSliderProps) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
        <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "monospace", color: "#e2e8f0", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, padding: "2px 10px", minWidth: 72, textAlign: "center" }}>{display}</span>
      </div>
      <div style={{ position: "relative", height: 40, display: "flex", alignItems: "center" }}>
        <div style={{ position: "absolute", inset: 0, margin: "auto", height: 6, borderRadius: 3, background: "#0a1220", boxShadow: "inset 0 1px 4px rgba(0,0,0,0.7)", overflow: "hidden" }}>
          <div style={{ height: "100%", borderRadius: 3, width: `${pct}%`, background: "linear-gradient(90deg, #1d4ed8, #0ea5e9)", transition: "width 0.02s linear" }} />
        </div>
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ position: "relative", zIndex: 1, width: "100%", height: 40, WebkitAppearance: "none", appearance: "none", background: "transparent", outline: "none", cursor: "pointer", margin: 0, padding: 0, touchAction: "manipulation" }} />
      </div>
    </div>
  );
}

/* ── Stat Bar — 2×2 on narrow, 4-in-row on wide ── */
interface StatBoxProps { label: string; value: string; unit: string; color: string; }
function StatBox({ label, value, unit, color }: StatBoxProps) {
  return (
    <div style={{ flex: 1, minWidth: 0, padding: "7px 6px", background: "#06101c", border: "1px solid rgba(255,255,255,0.04)", borderTop: `2px solid ${color}`, borderRadius: 8 }}>
      <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#334155", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
      <span style={{ fontSize: 13, fontWeight: 700, color, fontFamily: "monospace" }}>{value}</span>
      <span style={{ fontSize: 8, color: "#1e3344", marginLeft: 2, fontWeight: 600 }}>{unit}</span>
    </div>
  );
}

/* ── Mini Chart ── */
function MiniChart({ readings }: { readings: Reading[] }) {
  if (readings.length < 2)
    return (
      <div style={{ textAlign: "center", padding: "18px", color: "#1e3344", fontSize: 11 }}>
        Record 2+ readings to see the load–deflection plot
      </div>
    );

  const W = 300, H = 110;
  const PAD = { t: 14, r: 16, b: 28, l: 40 };
  const cW = W - PAD.l - PAD.r, cH = H - PAD.t - PAD.b;
  const sorted = [...readings].sort((a, b) => a.load - b.load);
  const maxLoad = Math.max(...sorted.map((r) => r.load));
  const maxDefl = Math.max(...sorted.map((r) => r.defl)) || 1;
  const toXY = (r: Reading) => ({
    x: PAD.l + (r.load / maxLoad) * cW,
    y: PAD.t + cH - (r.defl / maxDefl) * cH,
  });
  const pts = sorted.map(toXY);
  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaPath = linePath + ` L ${pts[pts.length - 1].x} ${PAD.t + cH} L ${pts[0].x} ${PAD.t + cH} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
      <defs>
        <linearGradient id="la-chartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="#06101c" rx="10" />
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <line key={t} x1={PAD.l} y1={PAD.t + cH * (1 - t)} x2={PAD.l + cW} y2={PAD.t + cH * (1 - t)} stroke="rgba(255,255,255,0.04)" strokeWidth="0.8" />
      ))}
      <path d={areaPath} fill="url(#la-chartFill)" />
      <path d={linePath} fill="none" stroke="#0ea5e9" strokeWidth="2" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#0ea5e9" stroke="#06101c" strokeWidth="1.5" />
      ))}
      <text x={PAD.l + cW / 2} y={H - 4} textAnchor="middle" fill="#334155" fontSize="9" fontFamily="monospace">Load P (N)</text>
      <text x={10} y={PAD.t + cH / 2 + 3} textAnchor="middle" fill="#334155" fontSize="9" fontFamily="monospace" transform={`rotate(-90, 10, ${PAD.t + cH / 2})`}>δ (mm)</text>
      {[0, 0.5, 1].map((t) => (
        <text key={t} x={PAD.l + cW * t} y={H - 14} textAnchor="middle" fill="#1e3344" fontSize="7" fontFamily="monospace">
          {(maxLoad * t).toFixed(0)}
        </text>
      ))}
    </svg>
  );
}

/* ── Procedure Steps ── */
const STEPS = [
  { n: 1, title: "Set Up Supports", body: "Place support A and support B on the bench. Measure the distance between them — this is your span L." },
  { n: 2, title: "Lay the Beam", body: "Rest the steel beam on both knife-edge supports. Make sure it sits flat and doesn't slip." },
  { n: 3, title: "Mark Load Point", body: "Decide where to hang the weights. Mark point 'a' — measured from support A. This is your load position." },
  { n: 4, title: "Attach Dial Gauge", body: "Fix the dial gauge below the beam at the load point. Zero it before adding any weights." },
  { n: 5, title: "Add Weights", body: "Hang weights on the hanger at the marked point. Start small (50–100 N) and increase gradually." },
  { n: 6, title: "Read Deflection", body: "After each load is added, read the dial gauge. This is your measured deflection δ in mm." },
  { n: 7, title: "Record & Repeat", body: "Tap 'Record Reading' to save each result. Repeat for at least 4 different loads." },
];

/* ── Tab Bar ── */
const TABS = [
  { id: "steps", icon: "📋", label: "Procedure" },
  { id: "apparatus", icon: "🔬", label: "Lab" },
  { id: "readings", icon: "📈", label: "Readings" },
];

function TabBar({ active, onChange }: { active: string; onChange: (t: string) => void }) {
  return (
    <div style={{ flexShrink: 0, display: "flex", background: "#040a12", borderTop: "1px solid rgba(255,255,255,0.07)", paddingBottom: "env(safe-area-inset-bottom, 4px)" }}>
      {TABS.map((t) => {
        const on = active === t.id;
        return (
          <button key={t.id} onClick={() => onChange(t.id)} style={{ flex: 1, padding: "10px 0 8px", border: "none", cursor: "pointer", background: on ? "rgba(14,165,233,0.07)" : "transparent", borderTop: on ? "2px solid #0ea5e9" : "2px solid transparent", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, transition: "all 0.12s", WebkitTapHighlightColor: "transparent" }}>
            <span style={{ fontSize: 18, lineHeight: 1 }}>{t.icon}</span>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: on ? "#0ea5e9" : "#283848" }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Collapsible Section ── */
function CollapsibleSection({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 4 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 0", background: "none", border: "none", cursor: "pointer",
          borderBottom: `1px solid rgba(255,255,255,${open ? "0.06" : "0.03"})`,
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: open ? "#0ea5e9" : "#334155" }}>{title}</span>
        <span style={{ fontSize: 14, color: open ? "#0ea5e9" : "#283848", lineHeight: 1, transition: "transform 0.2s", display: "inline-block", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>⌄</span>
      </button>
      {open && <div style={{ paddingTop: 10 }}>{children}</div>}
    </div>
  );
}

/* ── Main Export ── */
export default function SimplySupportedBeam() {
  const [tab, setTab] = useState("apparatus");
  const [span, setSpan] = useState(2.0);
  const [load, setLoad] = useState(500);
  const [posRatio, setPosRatio] = useState(0.5);
  const [b_mm, setBmm] = useState(50);
  const [d_mm, setDmm] = useState(80);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [doneSteps, setDone] = useState<Set<number>>(new Set([1]));
  // Apparatus diagram collapsed by default on mobile (narrow screens)
  const [apparatusOpen, setApparatusOpen] = useState(true);

  const a = posRatio * span;
  const I = getI(b_mm, d_mm);
  const { RA, RB } = getReactions(load, a, span);
  const maxD = getMaxDefl(load, a, span, I);
  const maxM = getMaxMoment(load, a, span);

  const logReading = useCallback(() => {
    const entry: Reading = {
      id: Date.now(),
      n: readings.length + 1,
      span,
      load,
      a: parseFloat(a.toFixed(2)),
      defl: parseFloat(maxD.toFixed(3)),
      moment: parseFloat(maxM.toFixed(1)),
    };
    setReadings((p) => [entry, ...p]);
    setDone((s) => new Set([...s, 5, 6, 7]));
    setTab("readings");
  }, [readings.length, span, load, a, maxD, maxM]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#060c14", color: "#cbd5e1", fontFamily: "'Inter', system-ui, sans-serif", overflow: "hidden" }}>

      {/* ── Header ── */}
      <div style={{ flexShrink: 0, background: "#070d16", borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 9, color: "#1a3050", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>Mechanics · M-01</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0", marginTop: 1 }}>Simply Supported Beam</div>
        </div>
        <div style={{ display: "flex", gap: 5 }}>
          <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 9px", background: "rgba(14,165,233,0.07)", border: "1px solid rgba(14,165,233,0.13)", borderRadius: 5, color: "#0ea5e9", letterSpacing: "0.08em", textTransform: "uppercase" }}>Steel</span>
          {readings.length > 0 && (
            <span style={{ fontSize: 9, fontWeight: 700, padding: "3px 9px", background: "rgba(52,211,153,0.07)", border: "1px solid rgba(52,211,153,0.13)", borderRadius: 5, color: "#34d399" }}>{readings.length} ✓</span>
          )}
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", overflowX: "hidden" }}>

        {/* ════ PROCEDURE TAB ════ */}
        {tab === "steps" && (
          <div style={{ padding: "14px 14px 28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 10, color: "#283848", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>{doneSteps.size} / {STEPS.length} Steps</span>
              <span style={{ fontSize: 10, color: doneSteps.size === STEPS.length ? "#34d399" : "#283848", fontWeight: 700 }}>
                {doneSteps.size === STEPS.length ? "✓ Complete" : `${Math.round((doneSteps.size / STEPS.length) * 100)}%`}
              </span>
            </div>
            <div style={{ height: 4, background: "#0a1220", borderRadius: 3, marginBottom: 14, overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 3, width: `${(doneSteps.size / STEPS.length) * 100}%`, background: "linear-gradient(90deg, #0ea5e9, #34d399)", transition: "width 0.3s" }} />
            </div>
            {STEPS.map((s) => {
              const done = doneSteps.has(s.n);
              return (
                <div key={s.n} onClick={() => setDone((d) => new Set([...d, s.n]))}
                  style={{ display: "flex", gap: 12, padding: "12px", background: done ? "rgba(52,211,153,0.04)" : "#07111e", border: `1px solid ${done ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.04)"}`, borderLeft: `3px solid ${done ? "#34d399" : "#152030"}`, borderRadius: 10, marginBottom: 8, cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: done ? "#34d399" : "#0a1a28", border: `1px solid ${done ? "#34d399" : "#152030"}`, fontSize: 11, fontWeight: 700, color: done ? "#064e3b" : "#283848", fontFamily: "monospace" }}>
                    {done ? "✓" : s.n}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: done ? "#34d399" : "#94a3b8", marginBottom: 3 }}>{s.title}</div>
                    <div style={{ fontSize: 12, color: "#283848", lineHeight: 1.65 }}>{s.body}</div>
                  </div>
                </div>
              );
            })}
            <button onClick={() => setTab("apparatus")} style={{ width: "100%", marginTop: 4, padding: "14px", background: "linear-gradient(135deg, rgba(14,165,233,0.1), rgba(29,78,216,0.07))", border: "1px solid rgba(14,165,233,0.18)", borderRadius: 12, color: "#0ea5e9", fontWeight: 700, fontSize: 14, fontFamily: "inherit", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
              Open Lab →
            </button>
          </div>
        )}

        {/* ════ LAB TAB ════ */}
        {tab === "apparatus" && (
          <div style={{ paddingBottom: 90 /* reserve space for sticky Record button */ }}>

            {/* ── Apparatus diagram (collapsible) ── */}
            <div style={{ background: "#050b14", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              {/* Toggle header */}
              <button
                onClick={() => setApparatusOpen(o => !o)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 14px", background: "none", border: "none", cursor: "pointer",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase", color: apparatusOpen ? "#0ea5e9" : "#283848" }}>
                  {apparatusOpen ? "▲ Hide Diagram" : "▼ Show Diagram"}
                </span>
                {/* Live δ chip always visible even when collapsed */}
                <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "monospace", color: "#0ea5e9", background: "rgba(14,165,233,0.08)", border: "1px solid rgba(14,165,233,0.18)", borderRadius: 6, padding: "2px 8px" }}>
                  δ = {maxD.toFixed(3)} mm
                </span>
              </button>

              {/* Diagram — hidden when collapsed; max-height keeps it from eating the whole screen */}
              {apparatusOpen && (
                <div style={{ maxHeight: 220, overflow: "hidden" }}>
                  <LabApparatus span={span} load={load} posRatio={posRatio} b_mm={b_mm} d_mm={d_mm} />
                </div>
              )}
            </div>

            {/* ── Live stat strip — 2×2 grid ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <StatBox label="Max δ" value={maxD.toFixed(3)} unit="mm" color="#0ea5e9" />
              <StatBox label="Moment" value={maxM.toFixed(1)} unit="N·m" color="#34d399" />
              <StatBox label="R_A" value={RA.toFixed(0)} unit="N" color="#f59e0b" />
              <StatBox label="R_B" value={RB.toFixed(0)} unit="N" color="#f59e0b" />
            </div>

            {/* ── Primary sliders (always visible) ── */}
            <div style={{ padding: "14px 14px 0" }}>
              <LabSlider label="Span L" value={span} min={0.5} max={3.0} step={0.1} display={`${span.toFixed(1)} m`} onChange={(v) => { setSpan(v); setDone((d) => new Set([...d, 1])); }} />
              <LabSlider label="Load P" value={load} min={50} max={2000} step={50} display={`${load} N`} onChange={(v) => { setLoad(v); setDone((d) => new Set([...d, 5])); }} />
              <LabSlider
                label="Position a (from A)"
                value={parseFloat(a.toFixed(2))}
                min={parseFloat((0.1 * span).toFixed(2))}
                max={parseFloat((0.9 * span).toFixed(2))}
                step={0.05}
                display={`${a.toFixed(2)} m`}
                onChange={(v) => { setPosRatio(v / span); setDone((d) => new Set([...d, 3])); }}
              />
            </div>

            {/* ── Beam section (collapsible secondary sliders) ── */}
            <div style={{ padding: "2px 14px 8px" }}>
              <CollapsibleSection title="Beam Cross-section" defaultOpen={false}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <LabSlider label="Width b" value={b_mm} min={20} max={120} step={5} display={`${b_mm} mm`} onChange={setBmm} />
                  <LabSlider label="Depth d" value={d_mm} min={20} max={150} step={5} display={`${d_mm} mm`} onChange={setDmm} />
                </div>
              </CollapsibleSection>
            </div>

            {/* ── Sticky Record button ── */}
            <div style={{
              position: "fixed", bottom: 58 /* tab bar height */, left: 0, right: 0,
              padding: "10px 14px",
              background: "linear-gradient(to top, #060c14 60%, transparent)",
              pointerEvents: "none",
            }}>
              <button
                onClick={logReading}
                style={{
                  width: "100%", padding: "15px",
                  background: "linear-gradient(135deg, rgba(14,165,233,0.18), rgba(52,211,153,0.10))",
                  border: "1px solid rgba(14,165,233,0.3)",
                  borderRadius: 12, color: "#0ea5e9", fontWeight: 700, fontSize: 14,
                  fontFamily: "inherit", letterSpacing: "0.03em",
                  cursor: "pointer", WebkitTapHighlightColor: "transparent",
                  pointerEvents: "all",
                  boxShadow: "0 4px 20px rgba(14,165,233,0.12)",
                }}
              >
                📋 &nbsp;Record This Reading
              </button>
            </div>
          </div>
        )}

        {/* ════ READINGS TAB ════ */}
        {tab === "readings" && (
          <div style={{ padding: "14px 14px 32px" }}>
            {readings.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 24px", color: "#1e3344" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📈</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#334155", marginBottom: 8 }}>No readings yet</div>
                <div style={{ fontSize: 12, lineHeight: 1.7, marginBottom: 22, color: "#283848" }}>Go to the Lab tab, adjust your parameters, and tap Record to save readings.</div>
                <button onClick={() => setTab("apparatus")} style={{ padding: "12px 28px", background: "rgba(14,165,233,0.08)", border: "1px solid rgba(14,165,233,0.18)", borderRadius: 10, color: "#0ea5e9", fontWeight: 700, fontSize: 13, fontFamily: "inherit", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>Open Lab →</button>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#1e3344" }}>{readings.length} Reading{readings.length !== 1 ? "s" : ""}</span>
                  <button onClick={() => setReadings([])} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 11, fontWeight: 600, fontFamily: "inherit", padding: "4px 8px", WebkitTapHighlightColor: "transparent" }}>Clear all</button>
                </div>
                <div style={{ marginBottom: 14, borderRadius: 10, overflow: "hidden" }}>
                  <MiniChart readings={[...readings].reverse()} />
                </div>
                {readings.map((r) => (
                  <div key={r.id} style={{ background: "#07111e", border: "1px solid rgba(255,255,255,0.04)", borderLeft: "3px solid rgba(14,165,233,0.25)", borderRadius: 10, padding: "12px", marginBottom: 9 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#1e3344", marginBottom: 8 }}>Trial #{r.n}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 5, marginBottom: 8 }}>
                      {([["Span", `${r.span} m`], ["Load", `${r.load} N`], ["Pos a", `${r.a} m`]] as [string, string][]).map(([k, v]) => (
                        <div key={k} style={{ background: "#040c18", borderRadius: 6, padding: "5px 7px" }}>
                          <div style={{ fontSize: 8, color: "#1e3344", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>{k}</div>
                          <div style={{ fontSize: 11, color: "#475569", fontFamily: "monospace", marginTop: 1 }}>{v}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 7 }}>
                      <div style={{ flex: 1, background: "rgba(14,165,233,0.05)", border: "1px solid rgba(14,165,233,0.1)", borderRadius: 7, padding: "8px 9px" }}>
                        <div style={{ fontSize: 8, color: "#1e3344", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>Deflection δ</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#0ea5e9", fontFamily: "monospace", marginTop: 2 }}>{r.defl} <span style={{ fontSize: 9, color: "#1e3344" }}>mm</span></div>
                      </div>
                      <div style={{ flex: 1, background: "rgba(52,211,153,0.05)", border: "1px solid rgba(52,211,153,0.1)", borderRadius: 7, padding: "8px 9px" }}>
                        <div style={{ fontSize: 8, color: "#1e3344", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>Moment</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#34d399", fontFamily: "monospace", marginTop: 2 }}>{r.moment} <span style={{ fontSize: 9, color: "#1e3344" }}>N·m</span></div>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}