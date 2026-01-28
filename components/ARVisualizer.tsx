
import React, { useRef, useEffect, useState } from 'react';
import { CarbonPrediction } from '../types';

interface ARVisualizerProps {
  prediction: CarbonPrediction;
  onClose: () => void;
}

const ARVisualizer: React.FC<ARVisualizerProps> = ({ prediction, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // High-frequency transform state held in a ref to bypass React's render loop
  const transformRef = useRef({
    rotateX: 0,
    rotateY: 0,
    zoom: 1,
    targetX: 0,
    targetY: 0,
    targetZoom: 1
  });
  
  const [isDragging, setIsDragging] = useState(false);
  const [camError, setCamError] = useState(false);
  const lastPointerPos = useRef({ x: 0, y: 0 });
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    // 1. Initialize Camera Feed
    async function startCamera() {
      try {
        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' }, 
            audio: false 
          });
        } catch (e) {
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: false 
          });
        }
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCamError(false);
      } catch (err) {
        console.error("AR Camera access denied:", err);
        setCamError(true);
      }
    }
    startCamera();

    // 2. Optimized Animation Loop for Hardware-Accelerated Transforms
    const updateLoop = () => {
      const t = transformRef.current;
      
      // Interpolate values for smooth movement (Lerp)
      t.rotateX += (t.targetX - t.rotateX) * 0.12;
      t.rotateY += (t.targetY - t.rotateY) * 0.12;
      t.zoom += (t.targetZoom - t.zoom) * 0.12;

      if (containerRef.current) {
        // Direct manipulation of CSS variables to avoid React Reconciliation overhead
        containerRef.current.style.setProperty('--rx', `${t.rotateX}deg`);
        containerRef.current.style.setProperty('--ry', `${t.rotateY}deg`);
        containerRef.current.style.setProperty('--zm', `${t.zoom}`);
      }
      
      rafId.current = requestAnimationFrame(updateLoop);
    };
    
    rafId.current = requestAnimationFrame(updateLoop);

    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []);

  // Interaction Handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    lastPointerPos.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - lastPointerPos.current.x;
    const deltaY = e.clientY - lastPointerPos.current.y;

    transformRef.current.targetX -= deltaY * 0.45;
    transformRef.current.targetY += deltaX * 0.45;

    lastPointerPos.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const handleWheel = (e: React.WheelEvent) => {
    const delta = e.deltaY * -0.0008;
    transformRef.current.targetZoom = Math.min(Math.max(transformRef.current.targetZoom + delta, 0.4), 2.5);
  };

  const resetTransform = () => {
    transformRef.current.targetX = 0;
    transformRef.current.targetY = 0;
    transformRef.current.targetZoom = 1;
  };

  // Performance-oriented scaling algorithm (Logarithmic)
  const getScale = (val: number) => {
    if (val <= 0) return 40;
    return 35 + (Math.log10(val + 1) * 45);
  };

  const total = prediction.total;

  return (
    <div 
      className="fixed inset-0 z-[100] bg-black overflow-hidden flex items-center justify-center font-sans select-none touch-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
    >
      {/* Background: Camera Stream */}
      {camError ? (
         <div className="absolute inset-0 bg-slate-900 flex items-center justify-center">
            <div className="text-center opacity-20">
               <i className="fas fa-camera-slash text-6xl mb-4 text-white"></i>
               <p className="text-white font-black uppercase tracking-widest text-[10px]">Camera Access Offline</p>
            </div>
         </div>
      ) : (
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted
          className="absolute inset-0 w-full h-full object-cover opacity-30 contrast-[1.2] brightness-[0.7] pointer-events-none"
        />
      )}

      {/* AR HUD Overlay */}
      <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6 md:p-10 z-50">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <h4 className="text-white font-black uppercase tracking-[0.4em] text-[9px]">CarbonSense Visual Link</h4>
            </div>
            <div className="font-mono text-[8px] text-emerald-400/50 uppercase tracking-[0.1em]">
              <p>Authority: Authorized_Admin</p>
              <p>Layer: ESG_Volumetric_Overlay</p>
            </div>
          </div>
          <div className="flex gap-3 pointer-events-auto">
            <button onClick={resetTransform} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md flex items-center justify-center text-white active:scale-90"><i className="fas fa-crosshairs"></i></button>
            <button onClick={onClose} className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 backdrop-blur-md flex items-center justify-center text-rose-500 active:scale-90"><i className="fas fa-times"></i></button>
          </div>
        </div>

        <div className="flex justify-between items-end gap-10">
          <div className="bg-black/40 backdrop-blur-xl border border-white/5 p-6 rounded-[2rem] min-w-[280px]">
             <div className="space-y-4">
              {[
                { label: 'Direct', val: prediction.scope1, color: 'blue', tag: 'S1' },
                { label: 'Energy', val: prediction.scope2, color: 'yellow', tag: 'S2' },
                { label: 'Value Chain', val: prediction.scope3, color: 'purple', tag: 'S3' }
              ].map(scope => (
                <div key={scope.label} className="space-y-1">
                  <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-tighter">
                    <span className={`text-${scope.color}-400`}>{scope.tag} {scope.label}</span>
                    <span className="text-white/60">{scope.val.toLocaleString()} kg</span>
                  </div>
                  <div className="h-0.5 w-full bg-white/5 rounded-full">
                    <div className={`h-full bg-${scope.color}-500/80 rounded-full`} style={{ width: `${(scope.val/Math.max(1, total))*100}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="text-right">
            <h1 className="text-white text-7xl font-black tracking-tighter tabular-nums leading-none">{total.toLocaleString()}</h1>
            <p className="text-emerald-400 font-black uppercase text-[10px] tracking-[0.4em] mt-2">Aggregated Impact</p>
          </div>
        </div>
      </div>

      {/* 3D Model Visualization */}
      <div 
        ref={containerRef}
        className="relative will-change-transform"
        style={{ 
          perspective: '1200px',
          transform: 'scale(var(--zm)) rotateX(var(--rx)) rotateY(var(--ry))',
          transformStyle: 'preserve-3d'
        } as React.CSSProperties}
      >
        <div className="relative" style={{ transformStyle: 'preserve-3d' }}>
          
          {/* Central Origin Node */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 backdrop-blur-xl flex items-center justify-center z-10">
            <i className="fas fa-leaf text-emerald-400 text-lg animate-pulse"></i>
          </div>

          {/* Scope 1: Direct Operations (Blue - Solid/Dense) */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-[spin_8s_linear_infinite]" style={{ transformStyle: 'preserve-3d' }}>
             <div 
               className="rounded-full border-2 border-blue-500/40 relative flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.2)]"
               style={{ 
                 width: getScale(prediction.scope1), 
                 height: getScale(prediction.scope1), 
                 transform: 'translateZ(40px)',
               }}
             >
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-[7px] font-black px-1.5 py-0.5 rounded-sm whitespace-nowrap tracking-widest shadow-lg">S1 DIRECT</div>
                <div className="absolute inset-2 border border-blue-400/10 rounded-full animate-pulse"></div>
             </div>
          </div>

          {/* Scope 2: Energy Consumption (Yellow - Flow/Active) */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-[spin_15s_linear_infinite_reverse]" style={{ transformStyle: 'preserve-3d' }}>
             <div 
               className="rounded-full border-[3px] border-yellow-500/30 border-dotted relative flex items-center justify-center"
               style={{ 
                 width: getScale(prediction.scope2) * 1.35, 
                 height: getScale(prediction.scope2) * 1.35, 
                 transform: 'rotateX(80deg) translateZ(10px)',
               }}
             >
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-[7px] font-black px-1.5 py-0.5 rounded-sm whitespace-nowrap tracking-widest shadow-lg" style={{ transform: 'rotateX(-80deg)' }}>S2 ENERGY</div>
                {/* Flowing node on the ring */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-yellow-400 rounded-full shadow-[0_0_10px_#eab308]"></div>
             </div>
          </div>

          {/* Scope 3: Value Chain (Purple - Network/Constellation) */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-[spin_25s_linear_infinite]" style={{ transformStyle: 'preserve-3d' }}>
             <div 
               className="rounded-full border border-purple-500/20 border-dashed relative flex items-center justify-center"
               style={{ 
                 width: getScale(prediction.scope3) * 1.7, 
                 height: getScale(prediction.scope3) * 1.7, 
                 transform: 'rotateY(45deg) translateZ(-60px)',
               }}
             >
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-purple-500 text-white text-[7px] font-black px-1.5 py-0.5 rounded-sm whitespace-nowrap tracking-widest shadow-lg" style={{ transform: 'rotateY(-45deg)' }}>S3 VALUE CHAIN</div>
                {/* Node cluster representing supply chain points */}
                <div className="absolute top-0 left-0 w-1.5 h-1.5 bg-purple-400/50 rounded-full"></div>
                <div className="absolute bottom-10 right-0 w-1.5 h-1.5 bg-purple-400/50 rounded-full"></div>
                <div className="absolute top-20 left-5 w-1.5 h-1.5 bg-purple-400/50 rounded-full"></div>
             </div>
          </div>
        </div>
      </div>

      {/* Atmospheric Scanning Interference */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.03]">
        <div className="w-full h-1 bg-emerald-400 animate-scan-v"></div>
      </div>

      <style>{`
        :root { --rx: 0deg; --ry: 0deg; --zm: 1; }
        @keyframes scan-v { 0% { transform: translateY(-100vh); } 100% { transform: translateY(100vh); } }
        .animate-scan-v { animation: scan-v 12s linear infinite; }
      `}</style>
    </div>
  );
};

export default ARVisualizer;
