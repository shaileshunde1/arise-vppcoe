import { useEffect, useRef, useState, useCallback } from 'react';
import { useLabStore } from '../../store/useLabStore';

interface ApparatusProps {
  varState: Record<string, number | string>;
  setVarState: React.Dispatch<React.SetStateAction<Record<string, number | string>>>;
  addObservation: (data: any) => void;
}

const G = 9.81;

export default function ProjectileMotion({ varState, addObservation }: ApparatusProps) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const trailRef     = useRef<{ x: number; y: number }[]>([]);

  // Keep latest values accessible inside rAF without stale closure
  const physRef = useRef({ angleDeg: 45, v0: 15, h0: 0, angleRad: Math.PI / 4 });

  const angleDeg = Number(varState.angle    || 45);
  const v0       = Number(varState.velocity || 15);
  const h0       = Number(varState.height   || 0);
  const angleRad = (angleDeg * Math.PI) / 180;

  physRef.current = { angleDeg, v0, h0, angleRad };

  const { setValidationError, hasAdjustedSlider } = useLabStore();

  const [isFlying,     setIsFlying]     = useState(false);
  const [liveData,     setLiveData]     = useState({ x: 0, y: 0, vx: 0, vy: 0, time: 0 });
  const [flightResult, setFlightResult] = useState<{ R: number; H: number; T: number } | null>(null);
  const isFlyingRef   = useRef(false);
  // Stores the exact slider values that were snapshotted at launch — used by recordObservation
  const launchSnapRef = useRef({ angleDeg: 45, v0: 15, h0: 0 });

  // ── Physics helpers ───────────────────────────────────────────────────
  const calcFlight = (a: number, speed: number, height: number) => {
    const rad = (a * Math.PI) / 180;
    const vy0 = speed * Math.sin(rad);
    const vx0 = speed * Math.cos(rad);
    const T   = (vy0 + Math.sqrt(vy0 * vy0 + 2 * G * height)) / G;
    const H   = height + (vy0 * vy0) / (2 * G);
    const R   = vx0 * T;
    return { T, H, R, vx0, vy0 };
  };

  // ── Canvas draw ────────────────────────────────────────────────────────
  const drawScene = useCallback((
    ctx: CanvasRenderingContext2D,
    W: number,
    H_canvas: number,
    projX: number,   // metres
    projY: number,   // metres
    trail: { x: number; y: number }[],
    state: 'idle' | 'flying' | 'landed',
    params: { angleDeg: number; v0: number; h0: number; angleRad: number },
  ) => {
    ctx.clearRect(0, 0, W, H_canvas);

    const { angleDeg: aD, v0: speed, h0: baseH, angleRad: aR } = params;
    const flight = calcFlight(aD, speed, baseH);

    // Dynamic world scale: always fit the predicted range + 20% margin
    const worldW  = Math.max(flight.R * 1.25, 20);   // metres
    const worldH  = Math.max(flight.H * 2.2,  15);   // metres
    const MARGIN  = { left: 52, right: 20, top: 28, bottom: 36 };
    const plotW   = W - MARGIN.left - MARGIN.right;
    const plotH   = H_canvas - MARGIN.top - MARGIN.bottom;
    const scaleX  = plotW / worldW;
    const scaleY  = plotH / worldH;

    const toCanvasX = (mx: number) => MARGIN.left + mx * scaleX;
    const toCanvasY = (my: number) => MARGIN.top  + plotH - my * scaleY;

    const groundCY = toCanvasY(0);

    // ── Background ──────────────────────────────────────────────────────
    const skyGrad = ctx.createLinearGradient(0, 0, 0, groundCY);
    skyGrad.addColorStop(0,   '#020a18');
    skyGrad.addColorStop(1,   '#0a1a30');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, groundCY);

    // ── Grid lines ──────────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(255,255,255,0.045)';
    ctx.lineWidth   = 1;
    // Vertical grid (every ~10m or nice interval)
    const gridStepX = niceStep(worldW, 6);
    for (let mx = 0; mx <= worldW; mx += gridStepX) {
      const cx = toCanvasX(mx);
      ctx.beginPath(); ctx.moveTo(cx, MARGIN.top); ctx.lineTo(cx, groundCY); ctx.stroke();
    }
    // Horizontal grid
    const gridStepY = niceStep(worldH, 5);
    for (let my = 0; my <= worldH; my += gridStepY) {
      const cy = toCanvasY(my);
      ctx.beginPath(); ctx.moveTo(MARGIN.left, cy); ctx.lineTo(W - MARGIN.right, cy); ctx.stroke();
    }

    // ── Axis labels ─────────────────────────────────────────────────────
    ctx.fillStyle = 'rgba(148,163,184,0.7)';
    ctx.font      = `${Math.max(9, Math.min(11, W / 80))}px monospace`;
    ctx.textAlign = 'center';
    for (let mx = 0; mx <= worldW; mx += gridStepX) {
      ctx.fillText(`${mx.toFixed(0)}m`, toCanvasX(mx), groundCY + 14);
    }
    ctx.textAlign = 'right';
    for (let my = gridStepY; my <= worldH; my += gridStepY) {
      ctx.fillText(`${my.toFixed(0)}`, MARGIN.left - 4, toCanvasY(my) + 3);
    }

    // ── Ground ──────────────────────────────────────────────────────────
    const groundGrad = ctx.createLinearGradient(0, groundCY, 0, H_canvas);
    groundGrad.addColorStop(0, '#1e3a2f');
    groundGrad.addColorStop(1, '#0d1f18');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, groundCY, W, H_canvas - groundCY);
    ctx.strokeStyle = '#2d6a4f';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundCY); ctx.lineTo(W, groundCY);
    ctx.stroke();

    // ── Launcher pedestal ───────────────────────────────────────────────
    const lx = toCanvasX(0);
    const ly = toCanvasY(baseH);
    if (baseH > 0) {
      const pedGrad = ctx.createLinearGradient(lx - 10, 0, lx + 10, 0);
      pedGrad.addColorStop(0, '#334155');
      pedGrad.addColorStop(1, '#1e293b');
      ctx.fillStyle = pedGrad;
      ctx.fillRect(lx - 10, ly, 20, groundCY - ly);
      // Pedestal height label
      ctx.fillStyle = 'rgba(251,191,36,0.8)';
      ctx.font      = `${Math.max(9, Math.min(10, W / 90))}px monospace`;
      ctx.textAlign = 'right';
      ctx.fillText(`h=${baseH}m`, lx - 13, ly + (groundCY - ly) / 2 + 3);
    }

    // ── Cannon barrel ───────────────────────────────────────────────────
    // Barrel length scales with v0 so you can see speed change
    const barrelLen = 18 + speed * 0.8;
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(-aR);
    const barrelGrad = ctx.createLinearGradient(0, -6, 0, 6);
    barrelGrad.addColorStop(0, '#94a3b8');
    barrelGrad.addColorStop(1, '#475569');
    ctx.fillStyle = barrelGrad;
    ctx.beginPath();
    ctx.roundRect(0, -6, barrelLen, 12, 3);
    ctx.fill();
    // Muzzle flash ring
    ctx.strokeStyle = 'rgba(251,191,36,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(barrelLen, 0, 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Cannon base wheel
    ctx.beginPath();
    ctx.arc(lx, ly, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#475569';
    ctx.fill();
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.stroke();

    // ── Predicted trajectory arc (dashed, shown in idle/landed state) ───
    if (state !== 'flying') {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(100,116,139,0.35)';
      ctx.lineWidth   = 1.5;
      ctx.setLineDash([6, 6]);
      let first = true;
      const steps = 80;
      for (let i = 0; i <= steps; i++) {
        const t  = (flight.T / steps) * i;
        const px = flight.vx0 * t;
        const py = baseH + flight.vy0 * t - 0.5 * G * t * t;
        if (py < 0) break;
        const cx = toCanvasX(px);
        const cy = toCanvasY(py);
        if (first) { ctx.moveTo(cx, cy); first = false; } else ctx.lineTo(cx, cy);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // ── Velocity vector arrow (idle only) ───────────────────────────────
    if (state === 'idle') {
      const arrowLen = 14 + speed * 1.4;   // longer = faster
      const ax = lx + Math.cos(-aR) * (18 + speed * 0.8 + 8);
      const ay = ly + Math.sin(-aR) * (18 + speed * 0.8 + 8);
      const ex = ax + Math.cos(-aR) * arrowLen;
      const ey = ay + Math.sin(-aR) * arrowLen;

      ctx.save();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth   = 2.5;
      ctx.shadowBlur  = 8;
      ctx.shadowColor = '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(ax, ay); ctx.lineTo(ex, ey);
      ctx.stroke();
      // Arrowhead
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.translate(ex, ey);
      ctx.rotate(-aR);
      ctx.moveTo(0, 0); ctx.lineTo(-8, -4); ctx.lineTo(-8, 4);
      ctx.closePath(); ctx.fill();
      ctx.restore();

      // v0 label next to arrow
      ctx.fillStyle = '#f59e0b';
      ctx.font      = `bold ${Math.max(9, Math.min(11, W / 80))}px monospace`;
      ctx.textAlign = 'left';
      const midX    = (ax + ex) / 2 + Math.cos(-aR + Math.PI / 2) * 10;
      const midY    = (ay + ey) / 2 + Math.sin(-aR + Math.PI / 2) * 10;
      ctx.fillText(`v₀=${speed}m/s`, midX, midY);
    }

    // ── Angle arc ───────────────────────────────────────────────────────
    if (state === 'idle' || state === 'landed') {
      ctx.strokeStyle = 'rgba(99,179,237,0.6)';
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.arc(lx, ly, 28, -aR, 0);
      ctx.stroke();
      // Angle label
      ctx.fillStyle = 'rgba(147,210,237,0.9)';
      ctx.font      = `${Math.max(9, Math.min(11, W / 80))}px monospace`;
      ctx.textAlign = 'left';
      ctx.fillText(`${aD}°`, lx + 32, ly + 4);
    }

    // ── Active trail ─────────────────────────────────────────────────────
    if (trail.length > 1) {
      // Glowing cyan trail
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(0,212,255,0.6)';
      ctx.lineWidth   = 2.5;
      ctx.shadowBlur  = 6;
      ctx.shadowColor = '#00d4ff';
      ctx.moveTo(toCanvasX(trail[0].x), toCanvasY(trail[0].y));
      for (let i = 1; i < trail.length; i++) {
        ctx.lineTo(toCanvasX(trail[i].x), toCanvasY(trail[i].y));
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Fading dots along trail
      for (let i = 0; i < trail.length; i += Math.max(1, Math.floor(trail.length / 20))) {
        const alpha = 0.15 + 0.6 * (i / trail.length);
        ctx.beginPath();
        ctx.arc(toCanvasX(trail[i].x), toCanvasY(trail[i].y), 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,212,255,${alpha})`;
        ctx.fill();
      }
    }

    // ── Projectile ball ──────────────────────────────────────────────────
    const ballCX = toCanvasX(projX);
    const ballCY = toCanvasY(projY);
    if (state === 'flying' || state === 'landed') {
      // Outer glow ring
      const glowGrad = ctx.createRadialGradient(ballCX, ballCY, 4, ballCX, ballCY, 16);
      glowGrad.addColorStop(0, 'rgba(0,212,255,0.4)');
      glowGrad.addColorStop(1, 'rgba(0,212,255,0)');
      ctx.beginPath();
      ctx.arc(ballCX, ballCY, 16, 0, Math.PI * 2);
      ctx.fillStyle = glowGrad;
      ctx.fill();

      // Ball
      const ballGrad = ctx.createRadialGradient(ballCX - 2, ballCY - 2, 1, ballCX, ballCY, 7);
      ballGrad.addColorStop(0, '#ffffff');
      ballGrad.addColorStop(0.4, '#00d4ff');
      ballGrad.addColorStop(1, '#0369a1');
      ctx.beginPath();
      ctx.arc(ballCX, ballCY, 7, 0, Math.PI * 2);
      ctx.fillStyle   = ballGrad;
      ctx.shadowBlur  = 20;
      ctx.shadowColor = '#00d4ff';
      ctx.fill();
      ctx.shadowBlur  = 0;
    }

    // ── Landing marker + stats overlay ──────────────────────────────────
    if (state === 'landed') {
      // X marker
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth   = 3;
      ctx.shadowBlur  = 8; ctx.shadowColor = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(ballCX - 10, groundCY - 10); ctx.lineTo(ballCX + 10, groundCY + 10);
      ctx.moveTo(ballCX + 10, groundCY - 10); ctx.lineTo(ballCX - 10, groundCY + 10);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Range annotation line
      ctx.strokeStyle = 'rgba(251,191,36,0.5)';
      ctx.lineWidth   = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(lx, groundCY - 18); ctx.lineTo(ballCX, groundCY - 18);
      ctx.stroke();
      ctx.setLineDash([]);
      // Range label
      ctx.fillStyle  = '#fbbf24';
      ctx.font       = `bold ${Math.max(9, Math.min(11, W / 80))}px monospace`;
      ctx.textAlign  = 'center';
      ctx.fillText(`R = ${flight.R.toFixed(1)} m`, (lx + ballCX) / 2, groundCY - 22);

      // Max height annotation
      const apexX = toCanvasX(flight.vx0 * flight.vy0 / G);
      const apexY = toCanvasY(flight.H);
      ctx.strokeStyle = 'rgba(167,139,250,0.5)';
      ctx.lineWidth   = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(apexX, apexY); ctx.lineTo(apexX, groundCY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#a78bfa';
      ctx.textAlign = 'left';
      ctx.fillText(`H = ${flight.H.toFixed(1)} m`, apexX + 5, apexY - 4);
    }

    // ── Axis titles ─────────────────────────────────────────────────────
    ctx.fillStyle = 'rgba(148,163,184,0.5)';
    ctx.font      = `${Math.max(9, Math.min(10, W / 90))}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('Horizontal Distance (m)', MARGIN.left + plotW / 2, H_canvas - 4);
    ctx.save();
    ctx.translate(11, MARGIN.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Height (m)', 0, 0);
    ctx.restore();
  }, []);

  // ── Utility: nice round step for grid ────────────────────────────────
  function niceStep(range: number, targetDivs: number): number {
    const raw = range / targetDivs;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    if (norm < 1.5) return mag;
    if (norm < 3.5) return 2 * mag;
    if (norm < 7.5) return 5 * mag;
    return 10 * mag;
  }

  // ── Sync canvas bitmap to layout size ────────────────────────────────
  const syncSize = (): { w: number; h: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { w: 800, h: 400 };
    const w = canvas.offsetWidth  || 800;
    const h = canvas.offsetHeight || 400;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width  = w;
      canvas.height = h;
    }
    return { w, h };
  };

  const redrawIdle = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || isFlyingRef.current) return;
    const { w, h } = syncSize();
    const ctx = canvas.getContext('2d');
    if (ctx) drawScene(ctx, w, h, 0, physRef.current.h0, [], 'idle', physRef.current);
  }, [drawScene]);

  // Mount + ResizeObserver
  useEffect(() => {
    redrawIdle();
    const ro = new ResizeObserver(redrawIdle);
    if (canvasRef.current) ro.observe(canvasRef.current);
    return () => ro.disconnect();
  }, [redrawIdle]);

  // Slider changes → redraw
  useEffect(() => {
    redrawIdle();
  }, [angleDeg, v0, h0, redrawIdle]);

  // ── Launch ────────────────────────────────────────────────────────────
  const handleLaunch = () => {
    if (!hasAdjustedSlider['projectile-motion']) {
      setValidationError('Setup Incomplete', 'Adjust the launch angle, velocity, or height before launching.', 'Move at least one slider first.');
      return;
    }
    if (angleDeg === 0 || angleDeg === 90) {
      setValidationError('Zero Range Trajectory', `An angle of ${angleDeg}° produces zero horizontal range.`, 'Set the launch angle between 15° and 75°.');
      return;
    }
    if (isFlyingRef.current || !canvasRef.current) return;

    isFlyingRef.current = true;
    setIsFlying(true);
    setFlightResult(null);
    trailRef.current = [];

    const canvas    = canvasRef.current;
    const ctx       = canvas.getContext('2d');
    if (!ctx) return;
    const startTime = performance.now();
    const snap      = { ...physRef.current };
    const flight    = calcFlight(snap.angleDeg, snap.v0, snap.h0);
    // Persist the exact launched values — recordObservation reads from here, never from current slider state
    launchSnapRef.current = { angleDeg: snap.angleDeg, v0: snap.v0, h0: snap.h0 };

    const animate = (time: number) => {
      const elapsed = (time - startTime) / 1000;
      const cx      = flight.vx0 * elapsed;
      const cy      = snap.h0 + flight.vy0 * elapsed - 0.5 * G * elapsed * elapsed;
      const vx      = flight.vx0;
      const vy      = flight.vy0 - G * elapsed;
      const { w, h } = syncSize();

      if (cy <= 0) {
        trailRef.current.push({ x: flight.R, y: 0 });
        drawScene(ctx, w, h, flight.R, 0, trailRef.current, 'landed', snap);
        isFlyingRef.current = false;
        setIsFlying(false);
        setLiveData({ x: flight.R, y: 0, vx, vy: 0, time: flight.T });
        setFlightResult({ R: flight.R, H: flight.H, T: flight.T });
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        return;
      }

      trailRef.current.push({ x: cx, y: cy });
      setLiveData({ x: cx, y: cy, vx, vy, time: elapsed });
      drawScene(ctx, w, h, cx, cy, trailRef.current, 'flying', snap);
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
  }, []);

  const recordObservation = () => {
    if (!flightResult) return;
    // Always read from launchSnapRef — these are the values actually used for THIS flight,
    // not the current slider position which may have changed since landing.
    const { angleDeg: launchedAngle, v0: launchedV0 } = launchSnapRef.current;
    addObservation({
      x: Number(launchedAngle),                   // chart x-axis: angle
      y: Number(flightResult.R.toFixed(2)),        // chart y-axis: range
      'Angle (deg)':    launchedAngle,
      'v0 (m/s)':       launchedV0,
      'Range R (m)':    Number(flightResult.R.toFixed(2)),
      'Max H (m)':      Number(flightResult.H.toFixed(2)),
      'Flight T (s)':   Number(flightResult.T.toFixed(2)),
    });
    // Clear so the same flight can't be recorded twice; user must launch again
    setFlightResult(null);
    // Redraw canvas in idle state (shows predicted arc for current slider values)
    setTimeout(() => redrawIdle(), 0);
  };

  // Predicted values for the HUD (updated live from sliders)
  const predicted = calcFlight(angleDeg, v0, h0);

  return (
    <div className="w-full h-full flex flex-col" style={{ minHeight: 0 }}>

      {/* ── Canvas ───────────────────────────────────────────────────────── */}
      <div className="flex-1 w-full bg-[#020a18]" style={{ minHeight: 200 }}>
        <canvas
          ref={canvasRef}
          width={800}
          height={420}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      </div>

      {/* ── Controls bar ─────────────────────────────────────────────────── */}
      <div className="w-full shrink-0 bg-[#050d1a] border-t border-gray-800 px-3 py-2">

        {/* Row 1: telemetry + predicted + buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2">

          {/* Live / predicted telemetry */}
          <div className="flex flex-wrap gap-1.5 text-[10px] font-mono">
            {isFlying ? (
              <>
                <span className="px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/40 text-cyan-400">X: {liveData.x.toFixed(1)} m</span>
                <span className="px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/40 text-cyan-400">Y: {liveData.y.toFixed(1)} m</span>
                <span className="px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/40 text-cyan-400">Vx: {liveData.vx.toFixed(1)} m/s</span>
                <span className="px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/40 text-cyan-300">Vy: {liveData.vy.toFixed(1)} m/s</span>
                <span className="px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/40 text-slate-400">T: {liveData.time.toFixed(2)} s</span>
              </>
            ) : flightResult ? (
              <>
                <span className="px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/40 text-amber-400">R = {flightResult.R.toFixed(2)} m</span>
                <span className="px-2 py-0.5 rounded bg-purple-950/60 border border-purple-800/40 text-purple-400">H = {flightResult.H.toFixed(2)} m</span>
                <span className="px-2 py-0.5 rounded bg-slate-900/60 border border-slate-700/40 text-slate-400">T = {flightResult.T.toFixed(2)} s</span>
              </>
            ) : (
              <>
                <span className="px-2 py-0.5 rounded bg-slate-900/60 border border-slate-700/40 text-slate-500">R̂ = {predicted.R.toFixed(1)} m</span>
                <span className="px-2 py-0.5 rounded bg-slate-900/60 border border-slate-700/40 text-slate-500">Ĥ = {predicted.H.toFixed(1)} m</span>
                <span className="px-2 py-0.5 rounded bg-slate-900/60 border border-slate-700/40 text-slate-500">T̂ = {predicted.T.toFixed(1)} s</span>
              </>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-2 shrink-0">
            <button
              onClick={handleLaunch}
              disabled={isFlying}
              className="px-4 py-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/30 rounded font-bold text-xs disabled:opacity-40 transition-colors"
            >
              {isFlying ? '🕐 In flight…' : '🚀 Launch'}
            </button>

            {flightResult && !isFlying && (
              <button
                onClick={recordObservation}
                className="px-4 py-1.5 bg-blue-500/20 text-blue-400 border border-blue-500/50 hover:bg-blue-500/30 rounded font-bold text-xs transition-colors"
              >
                ✓ Record
              </button>
            )}
          </div>
        </div>

        {/* Row 2: hint when idle */}
        {!isFlying && !flightResult && (
          <p className="text-[9px] text-slate-600 mt-1 text-center tracking-wide">
            Predicted values shown above — adjust sliders then launch
          </p>
        )}

      </div>
    </div>
  );
}