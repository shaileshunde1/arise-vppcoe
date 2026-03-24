import { useEffect, useRef, useState } from 'react';
import { useLabStore } from '../../store/useLabStore';

interface ApparatusProps {
  varState: Record<string, number | string>;
  setVarState: React.Dispatch<React.SetStateAction<Record<string, number | string>>>;
  addObservation: (data: any) => void;
}

export default function ProjectileMotion({ varState, addObservation }: ApparatusProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const angleDeg = Number(varState.angle || 45); // 0 to 90
  const v0 = Number(varState.velocity || 15);    // 5 to 30
  const h0 = Number(varState.height || 0);       // 0 to 10
  
  const { setValidationError, hasAdjustedSlider } = useLabStore();
  
  const g = 9.81;
  const angleRad = (angleDeg * Math.PI) / 180;
  
  const [isFlying, setIsFlying] = useState(false);
  const [liveData, setLiveData] = useState({ x: 0, y: h0, time: 0 });
  const [flightResult, setFlightResult] = useState<{ R: number, H: number, T: number } | null>(null);

  // Math for exact values
  // y(t) = h0 + v0*sin(θ)*t - 0.5*g*t^2
  // x(t) = v0*cos(θ)*t
  const T_flight = (v0 * Math.sin(angleRad) + Math.sqrt(Math.pow(v0 * Math.sin(angleRad), 2) + 2 * g * h0)) / g;
  const Max_H = h0 + Math.pow(v0 * Math.sin(angleRad), 2) / (2 * g);
  const Range_R = v0 * Math.cos(angleRad) * T_flight;

  const animationRef = useRef<number | null>(null);
  const trailRef = useRef<{x: number, y: number}[]>([]);

  const drawScene = (ctx: CanvasRenderingContext2D, width: number, height: number, projX: number, projY: number, trail: {x: number, y: number}[]) => {
    ctx.clearRect(0, 0, width, height);
    
    // Scale: let's say width represents 100 meters, height represents 60 meters
    const scaleX = width / 100;
    const scaleY = height / 60;
    
    const groundY = height - 40;
    
    // Draw Ground
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, groundY, width, 40);
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(width, groundY);
    ctx.stroke();

    // Draw Launcher Base
    const launcherX = 40;
    const launcherY = groundY - (h0 * scaleY);
    
    ctx.fillStyle = "#475569";
    ctx.fillRect(launcherX - 10, launcherY, 20, (h0 * scaleY));

    // Draw Cannon Barrel
    ctx.save();
    ctx.translate(launcherX, launcherY);
    ctx.rotate(-angleRad);
    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(0, -5, 30, 10);
    ctx.restore();

    // Draw Trail
    if (trail.length > 0) {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(0, 212, 255, 0.5)";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.moveTo(launcherX + trail[0].x * scaleX, groundY - trail[0].y * scaleY);
      for (let i = 1; i < trail.length; i++) {
        ctx.lineTo(launcherX + trail[i].x * scaleX, groundY - trail[i].y * scaleY);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw Projectile
    const renderX = launcherX + projX * scaleX;
    const renderY = groundY - projY * scaleY;
    
    ctx.beginPath();
    ctx.arc(renderX, renderY, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#00d4ff";
    ctx.fill();
    ctx.shadowBlur = 15;
    ctx.shadowColor = "#00d4ff";
    ctx.stroke();
    ctx.shadowBlur = 0;

    // If landed, draw X
    if (flightResult && !isFlying) {
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(renderX - 10, renderY - 10);
      ctx.lineTo(renderX + 10, renderY + 10);
      ctx.moveTo(renderX + 10, renderY - 10);
      ctx.lineTo(renderX - 10, renderY + 10);
      ctx.stroke();
    }
  };

  useEffect(() => {
    // Initial static draw
    if (!canvasRef.current || isFlying) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    drawScene(ctx, canvasRef.current.width, canvasRef.current.height, 0, h0, []);
  }, [angleDeg, v0, h0, isFlying]);

  const handleLaunch = () => {
    if (!hasAdjustedSlider['projectile-motion']) {
      setValidationError("Setup Incomplete", "You cannot launch the projectile before adjusting the apparatus.", "Adjust the launch angle, velocity, or height before launching.");
      return;
    }
    if (angleDeg === 0 || angleDeg === 90) {
      setValidationError("Zero Range Trajectory", `An angle of ${angleDeg}° will result in zero horizontal range because all velocity is directed either perfectly horizontally or vertically to the ground.`, "Set the launch angle between 15° and 75° to observe a parabolic arc.");
      return;
    }
    if (isFlying || !canvasRef.current) return;
    setIsFlying(true);
    setFlightResult(null);
    trailRef.current = [];
    
    const startTime = performance.now();
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Timescale: 1 real second = 1 simulation second
    const animate = (time: number) => {
      const elapsed = (time - startTime) / 1000; 
      
      let currentX = v0 * Math.cos(angleRad) * elapsed;
      let currentY = h0 + v0 * Math.sin(angleRad) * elapsed - 0.5 * g * elapsed * elapsed;

      if (currentY <= 0) {
        // Hit ground
        currentY = 0;
        currentX = Range_R;
        trailRef.current.push({ x: currentX, y: currentY });
        drawScene(ctx, canvasRef.current!.width, canvasRef.current!.height, currentX, currentY, trailRef.current);
        
        setIsFlying(false);
        setLiveData({ x: currentX, y: currentY, time: T_flight });
        setFlightResult({ R: Range_R, H: Max_H, T: T_flight });
        
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        return;
      }

      trailRef.current.push({ x: currentX, y: currentY });
      setLiveData({ x: currentX, y: currentY, time: elapsed });
      drawScene(ctx, canvasRef.current!.width, canvasRef.current!.height, currentX, currentY, trailRef.current);

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const recordObservation = () => {
    if (!flightResult) return;
    addObservation({
      "Angle (°)": angleDeg,
      "Range (m)": flightResult.R,
      "Max Height (m)": flightResult.H,
      "Time (s)": flightResult.T
    });
  };

  return (
    <div className="w-full h-full flex flex-col pt-6 relative">
      {/* Readouts Header */}
      <div className="absolute top-4 left-4 flex gap-4 z-10">
         <div className="bg-black/60 border border-gray-700 px-4 py-2 rounded">
            <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Live Telemetry</div>
            <div className="font-mono text-sm text-accent-cyan flex flex-col gap-1">
               <span>X: {liveData.x.toFixed(2)} m</span>
               <span>Y: {liveData.y.toFixed(2)} m</span>
               <span>T: {liveData.time.toFixed(2)} s</span>
            </div>
         </div>
      </div>

      <canvas 
        ref={canvasRef} 
        width={800} 
        height={500} 
        className="w-full h-full object-contain"
      />

      <div className="absolute top-4 right-4 bg-black/80 px-4 py-3 border border-gray-700 rounded flex flex-col gap-3 min-w-[200px]">
         <button 
           onClick={handleLaunch}
           disabled={isFlying}
           className="w-full py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/30 rounded font-bold disabled:opacity-50 transition-colors"
         >
           {isFlying ? 'Projectile in motion...' : 'Launch Projectile 🚀'}
         </button>

         {flightResult && (
           <button 
             onClick={recordObservation}
             className="w-full py-2 bg-blue-500/20 text-blue-400 border border-blue-500/50 hover:bg-blue-500/30 rounded font-bold transition-colors"
           >
             Record Trajectory
           </button>
         )}
      </div>

    </div>
  );
}
