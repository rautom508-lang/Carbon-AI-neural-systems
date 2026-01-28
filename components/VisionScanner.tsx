
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { processReceiptImage, transformImage } from '../services/geminiService';
import { CarbonPrediction } from '../types';
import { databaseService } from '../services/databaseService';

interface VisionScannerProps {
  onScanComplete: (p: CarbonPrediction) => void;
  userId: string;
  theme?: 'dark' | 'light';
  isOverridden?: boolean;
  setIsOverridden?: (val: boolean) => void;
  userEmail: string;
}

const VisionScanner: React.FC<VisionScannerProps> = ({ onScanComplete, userId, theme = 'dark', isOverridden = false, setIsOverridden, userEmail }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isDesiredActiveRef = useRef(false);
  
  const [mode, setMode] = useState<'AUDIT' | 'TRANSFORM'>('AUDIT');
  const [isScanning, setIsScanning] = useState(false);
  const [isSystemActive, setIsSystemActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<any>(null);
  
  const [editPrompt, setEditPrompt] = useState('');
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [transformedImage, setTransformedImage] = useState<string | null>(null);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    setError(null);
    setIsSystemActive(true);
    isDesiredActiveRef.current = true;
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError("NOT_SUPPORTED");
      return;
    }

    try {
      const constraints = {
        video: { 
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      if (!isDesiredActiveRef.current) {
        mediaStream.getTracks().forEach(t => t.stop());
        return;
      }

      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        try { await videoRef.current.play(); } catch (playErr) { console.warn("Autoplay blocked", playErr); }
      }
    } catch (err: any) {
      console.error("Camera access failure:", err);
      if (isDesiredActiveRef.current) setError("Hardware access denied.");
    }
  };

  const stopCamera = useCallback(() => {
    isDesiredActiveRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => { track.stop(); track.enabled = false; });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    setIsSystemActive(false);
    setError(null);
  }, []);

  const handleCapture = async () => {
    if (isScanning || !videoRef.current || !canvasRef.current) return;
    setIsScanning(true);

    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64Data = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
    setOriginalImage(`data:image/jpeg;base64,${base64Data}`);

    if (mode === 'AUDIT') {
      try {
        const result = await processReceiptImage(base64Data);
        setScanResult(result);
        const score = (result.amount * 0.1); 
        onScanComplete({
          scope1: result.category.toLowerCase() === 'fuel' ? score : 0,
          scope2: result.category.toLowerCase() === 'energy' ? score : 0,
          scope3: !['fuel', 'energy'].includes(result.category.toLowerCase()) ? score : 0,
          total: Math.round(score),
          timestamp: Date.now(),
          aiInsights: `Extracted from ${result.vendor}.`,
          userId: userId
        });
      } catch (err) {
        setError("EXTRACTION_FAILED");
      } finally {
        setIsScanning(false);
      }
    } else {
      // For TRANSFORM mode, we wait for the prompt to be submitted
      setIsScanning(false);
      stopCamera();
    }
  };

  const executeTransform = async () => {
    if (!originalImage || !editPrompt || isScanning) return;
    setIsScanning(true);
    try {
      const base64Only = originalImage.split(',')[1];
      const result = await transformImage(base64Only, editPrompt);
      if (result) setTransformedImage(result);
    } catch (err) {
      setError("TRANSFORMATION_FAILED");
    } finally {
      setIsScanning(false);
    }
  };

  const isLocked = error && !isOverridden;
  const isStandby = !isSystemActive && !isOverridden && !originalImage;
  const isMaster = databaseService.isMaster(userEmail);

  return (
    <div className="space-y-6 lg:space-y-8 animate-fadeIn h-full pb-24">
      {/* Mode Header */}
      <div className={`p-6 lg:p-10 rounded-[2rem] shadow-2xl relative overflow-hidden transition-all duration-700 ${isOverridden ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-[#0f172a] text-white border border-white/5'}`}>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-6 self-start md:self-center">
            <div className={`w-14 h-14 md:w-16 md:h-16 transition-transform duration-500 ${mode === 'TRANSFORM' ? 'bg-purple-600 rotate-12' : 'bg-[#10b981]'} rounded-2xl flex items-center justify-center text-white text-2xl md:text-3xl shadow-lg`}>
              <i className={`fas ${mode === 'TRANSFORM' ? 'fa-wand-magic-sparkles' : 'fa-eye'}`}></i>
            </div>
            <div>
              <h2 className="text-white text-2xl md:text-3xl font-black tracking-tighter uppercase leading-none">
                {mode === 'AUDIT' ? 'Audit Vision' : 'Neural Image Lab'}
              </h2>
              <div className="flex gap-4 mt-2">
                <button onClick={() => { setMode('AUDIT'); setOriginalImage(null); }} className={`text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] transition-all ${mode === 'AUDIT' ? 'text-emerald-500 border-b border-emerald-500' : 'text-slate-500 hover:text-white'}`}>Audit Scan</button>
                <button onClick={() => { setMode('TRANSFORM'); setOriginalImage(null); }} className={`text-[8px] md:text-[10px] font-black uppercase tracking-[0.2em] transition-all ${mode === 'TRANSFORM' ? 'text-purple-500 border-b border-purple-500' : 'text-slate-500 hover:text-white'}`}>Image Lab</button>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4 md:gap-8 w-full md:w-auto">
            <button 
              onClick={isSystemActive ? stopCamera : startCamera}
              className={`flex-grow md:flex-none px-6 md:px-10 py-3.5 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all border shadow-lg ${isSystemActive ? 'bg-rose-500/10 border-rose-500/30 text-rose-500 hover:bg-rose-500 hover:text-white' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500 hover:text-white'}`}
            >
              <i className={`fas ${isSystemActive ? 'fa-video-slash' : 'fa-video'} mr-2`}></i>
              {isSystemActive ? 'Stop Sensor' : 'Start Sensor'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch min-h-[400px] md:min-h-[500px]">
        {/* Left Col: Primary Viewer */}
        <div className={`relative rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col items-center justify-center border transition-all duration-700 ${isOverridden ? 'bg-[#0a0a0a] border-amber-500/20 shadow-amber-900/10' : 'bg-[#0f172a] border-white/5'}`}>
          {isStandby ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 md:p-12 text-center space-y-8 md:space-y-10 z-20">
               <div className="w-20 h-20 md:w-24 md:h-24 rounded-[2.5rem] bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-center text-emerald-500/40 text-4xl md:text-5xl">
                  <i className="fas fa-power-off"></i>
               </div>
               <button onClick={startCamera} className="px-10 md:px-14 py-4 md:py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-2xl">Initialize Link</button>
            </div>
          ) : isLocked ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-slate-900/60 backdrop-blur-md z-20">
               <i className="fas fa-lock text-rose-500 text-4xl mb-6"></i>
               <h3 className="text-white font-black text-xl uppercase tracking-tight">Access Restricted</h3>
            </div>
          ) : originalImage && mode === 'TRANSFORM' ? (
            <div className="absolute inset-0 p-6 flex flex-col gap-6">
                <div className="flex-1 rounded-2xl overflow-hidden border border-white/5 relative bg-black/40">
                  <img src={originalImage} className="w-full h-full object-contain" />
                  <div className="absolute top-4 left-4 bg-black/60 px-3 py-1.5 rounded-lg border border-white/10 text-[8px] font-black uppercase tracking-widest text-white">Source Input</div>
                </div>
                {transformedImage && (
                  <div className="flex-1 rounded-2xl overflow-hidden border border-purple-500/30 relative bg-black/40 animate-fadeIn">
                    <img src={transformedImage} className="w-full h-full object-contain" />
                    <div className="absolute top-4 left-4 bg-purple-600 px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest text-white">AI Result</div>
                  </div>
                )}
            </div>
          ) : (
            <>
              <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover transition-opacity duration-1000 ${isScanning ? 'opacity-30' : 'opacity-100'}`} />
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute bottom-8 left-0 right-0 px-6 z-20 flex gap-4 justify-center">
                <button 
                  onClick={handleCapture}
                  disabled={isScanning}
                  className="px-12 py-5 bg-white text-[#0f172a] hover:bg-[#10b981] hover:text-white transition-all font-black rounded-full uppercase tracking-widest text-[11px] shadow-2xl active:scale-95 border border-white/10"
                >
                  {isScanning ? 'Syncing...' : 'Capture Image'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Right Col: Controls & Results */}
        <div className={`p-6 md:p-10 rounded-[2.5rem] border shadow-2xl flex flex-col h-full transition-all duration-700 ${theme === 'dark' ? 'bg-[#0f172a] border-white/5 shadow-black/60' : 'bg-white border-slate-100'}`}>
          <div className="flex justify-between items-center mb-8">
             <h3 className={`text-lg font-black uppercase tracking-tight ${theme === 'dark' ? 'text-white' : 'text-[#0f172a]'}`}>
               {mode === 'AUDIT' ? 'Scan Analysis' : 'Transformation Console'}
             </h3>
             <button onClick={() => {setOriginalImage(null); setTransformedImage(null); setEditPrompt(''); if(!isSystemActive) startCamera();}} className="text-[8px] font-black uppercase text-slate-500 hover:text-white transition-colors">Reset Terminal</button>
          </div>
          
          <div className="flex-grow flex flex-col">
            {mode === 'AUDIT' ? (
              <div className="flex-grow flex flex-col items-center justify-center text-center space-y-8">
                {scanResult ? (
                  <div className="w-full space-y-6 animate-fadeIn">
                    <div className="p-8 bg-slate-900 border border-white/10 rounded-[2.5rem]">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Entity</p>
                      <p className="text-3xl font-black text-white truncate">{scanResult.vendor}</p>
                      <div className="grid grid-cols-2 gap-6 mt-8">
                        <div><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Amount</p><p className="text-4xl font-black text-white">{scanResult.amount}</p></div>
                        <div className="text-right"><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Confidence</p><p className="text-4xl font-black text-emerald-500">{(scanResult.confidence * 100).toFixed(0)}%</p></div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="opacity-20 text-center space-y-6">
                    <i className="fas fa-microchip text-7xl"></i>
                    <p className="text-[10px] font-black uppercase tracking-[0.4em]">Audit Link Standby</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-grow flex flex-col space-y-8">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Transformation Command</label>
                  <textarea 
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    placeholder="e.g. 'Add a retro Polaroid filter and make it look vintage' or 'Remove the background'"
                    className="w-full h-32 bg-white/5 border border-white/10 rounded-2xl p-6 text-white font-bold outline-none focus:border-purple-500 transition-all resize-none placeholder:text-slate-700"
                  />
                  <div className="flex flex-wrap gap-2">
                    {['Add retro filter', 'Pencil sketch style', 'Remove person', 'Make it neon'].map(p => (
                      <button key={p} onClick={() => setEditPrompt(p)} className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[8px] font-black uppercase tracking-widest text-slate-500 hover:text-white hover:border-purple-500 transition-all">{p}</button>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={executeTransform}
                  disabled={!originalImage || !editPrompt || isScanning}
                  className={`w-full py-6 rounded-[2rem] font-black uppercase tracking-[0.4em] text-[11px] shadow-2xl transition-all ${isScanning ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-purple-600 text-white hover:bg-purple-500 active:scale-95 disabled:opacity-30'}`}
                >
                  {isScanning ? 'Executing Neural Logic...' : 'Process Transformation'}
                </button>

                {error && <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[9px] font-black uppercase rounded-xl text-center tracking-widest">{error}</div>}
              </div>
            )}
          </div>
          
          <div className="pt-8 border-t border-white/5 flex justify-between items-center text-[10px] font-black text-slate-500 uppercase tracking-widest">
            <span>Terminal Core Sync</span>
            <span className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isSystemActive || transformedImage ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`}></span>
              {isScanning ? 'ACTIVE' : 'READY'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VisionScanner;
