import { useEffect, useRef, useState, useCallback } from 'react';
import { useLabStore } from '../../store/useLabStore';

interface ApparatusProps {
  varState: Record<string, number | string>;
  setVarState: React.Dispatch<React.SetStateAction<Record<string, number | string>>>;
  addObservation: (data: any) => void;
}

// Newton's Rings: wavelength λ = (Dm² - Dn²) / (4(m-n)R)
// Ring diameters: Dm = 2√(m·λ·R)  →  Dm² = 4·m·λ·R
// We simulate microscope readings: left & right vernier positions for each ring

export default function NewtonsRings({ varState, addObservation }: ApparatusProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const [selectedRing, setSelectedRing] = useState<number>(1);
  const [microscope, setMicroscope] = useState({ left: 0, right: 0, measured: false });
  const [readingsCount, setReadingsCount] = useState(0);
  const [calculatedLambda, setCalculatedLambda] = useState<number | null>(null);
  const [observations, setObservations] = useState<any[]>([]);

  const { setValidationError, hasAdjustedSlider } = useLabStore();

  // Sliders: radius of curvature R (50–200 cm), wavelength source (sodium ~589nm fixed for now)
  const R = Number(varState.radius || 100); // cm
  const sourceColor = String(varState.source || 'sodium'); // sodium | mercury-green | mercury-violet

  // Actual λ per source (nm)
  const SOURCE_LAMBDA: Record<string, number> = {
    sodium: 589.3,
    'mercury-green': 546.1,
    'mercury-violet': 404.7,
  };
  const trueλ = SOURCE_LAMBDA[sourceColor] ?? 589.3;

  // Ring diameter squared: Dn² = 4·n·λ·R  (λ in cm = trueλ/1e7, R in cm)
  const λCm = trueλ / 1e7;
  const ringDiamSq = (n: number) => 4 * n * λCm * R; // cm²

  // Source glow color for canvas
  const SOURCE_HUE: Record<string, string> = {
    sodium: '#f5c842',
    'mercury-green': '#7cfc00',
    'mercury-violet': '#9b59ff',
  };
  const ringColor = SOURCE_HUE[sourceColor] ?? '#f5c842';

  // ── Canvas rendering ─────────────────────────────────────────
  const drawRings = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    const cx = W / 2, cy = H / 2;

    ctx.clearRect(0, 0, W, H);

    // Dark background — simulates darkfield microscope view
    const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.52);
    bg.addColorStop(0, '#0a0c0e');
    bg.addColorStop(1, '#000');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Lens circle vignette
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, W * 0.46, 0, Math.PI * 2);
    ctx.clip();

    // Scale: 1 cm = 80px (for R~100cm, ~15 rings visible)
    const scale = 80;
    const MAX_RINGS = 15;

    for (let n = MAX_RINGS; n >= 0; n--) {
      const dSq = ringDiamSq(n); // cm²
      const r = Math.sqrt(dSq) / 2 * scale; // px radius = Dn/2 * scale
      if (r > W * 0.48) continue;

      const isDark = n % 2 === 0; // dark rings at even n (0,2,4…) incl. central dark spot
      const isSelected = n === selectedRing;

      if (isDark) {
        // Dark fringe — draw as dark ring with thin annulus
        const inner = Math.max(0, r - 2);
        const grad = ctx.createRadialGradient(cx, cy, inner, cx, cy, r + 2);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(0.4, 'rgba(0,0,0,0.85)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 4;
        ctx.stroke();
      } else {
        // Bright fringe
        const hex = ringColor;
        const alpha = isSelected ? 0.95 : 0.55 - n * 0.025;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = hex + Math.round(Math.max(alpha, 0.1) * 255).toString(16).padStart(2, '0');
        ctx.lineWidth = isSelected ? 3 : 1.5;
        ctx.shadowColor = isSelected ? hex : 'transparent';
        ctx.shadowBlur = isSelected ? 10 : 0;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }

    // Selected ring highlight with crosshair diameter line
    if (selectedRing > 0) {
      const dSq = ringDiamSq(selectedRing);
      const r = Math.sqrt(dSq) / 2 * scale;
      // Horizontal diameter marker
      ctx.beginPath();
      ctx.moveTo(cx - r, cy);
      ctx.lineTo(cx + r, cy);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Left & right crosshair ticks
      [-1, 1].forEach(side => {
        ctx.beginPath();
        ctx.moveTo(cx + side * r, cy - 8);
        ctx.lineTo(cx + side * r, cy + 8);
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });

      // Ring label
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '11px monospace';
      ctx.fillText(`n=${selectedRing}`, cx + r + 6, cy - 4);
    }

    // Central dark spot label
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('n=0', cx, cy + 14);
    ctx.textAlign = 'left';

    ctx.restore();

    // Microscope crosshair overlay
    ctx.strokeStyle = 'rgba(255,80,80,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.stroke();
  }, [selectedRing, ringColor, R, ringDiamSq]);

  useEffect(() => {
    drawRings();
  }, [drawRings]);

  // ── Simulated microscope measurement ────────────────────────
  const measureRing = () => {
    if (!hasAdjustedSlider?.['newtons-rings']) {
      setValidationError(
        'Setup Incomplete',
        'Adjust the apparatus before taking measurements.',
        'Move at least one slider before measuring.'
      );
      return;
    }
    // Simulate vernier readings with ±0.002 cm noise
    const dSq = ringDiamSq(selectedRing);
    const D = Math.sqrt(dSq); // true diameter in cm
    const noise = () => (Math.random() - 0.5) * 0.004;
    const halfD = D / 2;
    const leftPos  = +((-halfD) + noise()).toFixed(4);
    const rightPos = +((halfD)  + noise()).toFixed(4);
    const measuredD = +(rightPos - leftPos).toFixed(4);
    setMicroscope({ left: leftPos, right: rightPos, measured: true });
    return { leftPos, rightPos, measuredD };
  };

  const recordObservation = () => {
    const result = measureRing();
    if (!result) return;
    const { leftPos, rightPos, measuredD } = result;
    const D2 = +(measuredD * measuredD).toFixed(6);

    const obs = {
      'Ring No. (n)': selectedRing,
      'Left Reading (cm)': leftPos,
      'Right Reading (cm)': rightPos,
      'Diameter Dn (cm)': measuredD,
      'Dn² (cm²)': D2,
    };
    addObservation(obs);
    setObservations(prev => [...prev, { n: selectedRing, D2 }]);
    setReadingsCount(r => r + 1);
    setMicroscope({ left: 0, right: 0, measured: false });
    // Auto-advance ring
    setSelectedRing(prev => Math.min(prev + 1, 15));
  };

  const calculateLambda = () => {
    if (observations.length < 4) return;
    // Use linear regression on Dn² vs n: slope = 4λR → λ = slope/(4R)
    const n = observations.map(o => o.n);
    const d2 = observations.map(o => o.D2);
    const meanN = n.reduce((a, b) => a + b, 0) / n.length;
    const meanD2 = d2.reduce((a, b) => a + b, 0) / d2.length;
    const slope = n.reduce((sum, ni, i) => sum + (ni - meanN) * (d2[i] - meanD2), 0)
                / n.reduce((sum, ni) => sum + (ni - meanN) ** 2, 0);
    const λCalc = slope / (4 * R); // in cm
    const λNm = +(λCalc * 1e7).toFixed(1);
    setCalculatedLambda(λNm);
  };

  const percentError = calculatedLambda
    ? Math.abs((calculatedLambda - trueλ) / trueλ * 100).toFixed(2)
    : null;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center relative">
      {/* Microscope view canvas */}
      <canvas
        ref={canvasRef}
        width={480}
        height={480}
        className="rounded-full"
        style={{ width: '75%', maxWidth: 420, aspectRatio: '1/1', border: '2px solid #1e293b' }}
      />

      {/* Left panel — controls */}
      <div className="absolute top-4 left-4 flex flex-col gap-3 min-w-[210px]"
        style={{ background: 'rgba(10,12,16,0.82)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '14px 16px' }}>

        {/* Ring selector */}
        <div>
          <div className="font-label text-[10px] tracking-[0.15em] uppercase mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Select Ring
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[1,2,3,4,5,6,7,8,9,10].map(n => (
              <button key={n} onClick={() => { setSelectedRing(n); setMicroscope({ left:0, right:0, measured:false }); }}
                className="w-7 h-7 rounded font-mono text-xs font-bold transition-all"
                style={{
                  background: selectedRing === n ? ringColor + '33' : 'rgba(255,255,255,0.05)',
                  color: selectedRing === n ? ringColor : 'rgba(255,255,255,0.5)',
                  border: `1px solid ${selectedRing === n ? ringColor + '88' : 'rgba(255,255,255,0.1)'}`,
                }}>
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Vernier readings display */}
        {microscope.measured && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10 }}>
            <div className="font-label text-[10px] tracking-[0.15em] uppercase mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Microscope Reading
            </div>
            {[['Left', microscope.left], ['Right', microscope.right]].map(([lbl, val]) => (
              <div key={lbl as string} className="flex justify-between items-center py-0.5">
                <span className="font-label text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{lbl}</span>
                <span className="font-mono text-xs font-bold" style={{ color: '#e2e8f0' }}>{(val as number).toFixed(4)} cm</span>
              </div>
            ))}
            <div className="flex justify-between items-center pt-1 mt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="font-label text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>D<sub>{selectedRing}</sub></span>
              <span className="font-mono text-xs font-bold" style={{ color: ringColor }}>
                {(microscope.right - microscope.left).toFixed(4)} cm
              </span>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <button onClick={recordObservation}
          className="w-full py-2 rounded font-label text-xs font-bold tracking-wide transition-all"
          style={{ background: 'rgba(135,160,192,0.15)', color: '#87a0c0', border: '1px solid rgba(135,160,192,0.35)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(135,160,192,0.25)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(135,160,192,0.15)')}>
          Measure & Record Ring {selectedRing}
        </button>

        {readingsCount >= 4 && (
          <button onClick={calculateLambda}
            className="w-full py-2 rounded font-label text-xs font-bold tracking-wide transition-all"
            style={{ background: `${ringColor}22`, color: ringColor, border: `1px solid ${ringColor}55` }}
            onMouseEnter={e => (e.currentTarget.style.background = ringColor + '33')}
            onMouseLeave={e => (e.currentTarget.style.background = ringColor + '22')}>
            Calculate λ
          </button>
        )}

        {calculatedLambda && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10 }}>
            <div className="font-label text-[10px] tracking-[0.15em] uppercase mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>Result</div>
            <div className="font-mono text-xl font-bold text-center" style={{ color: ringColor }}>
              λ = {calculatedLambda} nm
            </div>
            <div className="font-label text-[10px] text-center mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Error: {percentError}% (true: {trueλ} nm)
            </div>
          </div>
        )}
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-4 right-4 font-label text-[10px] tracking-wide px-3 py-1.5 rounded"
        style={{ background: 'rgba(10,12,16,0.7)', color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}>
        R = {R} cm &nbsp;|&nbsp; Source: {sourceColor} ({trueλ} nm) &nbsp;|&nbsp; Readings: {readingsCount}
      </div>
    </div>
  );
}