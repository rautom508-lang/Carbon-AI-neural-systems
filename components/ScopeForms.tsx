
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { CarbonPrediction, GlobalConfig } from '../types';
import { processUtilityBill, processPUCCertificate } from '../services/geminiService';

interface ScopeFormsProps {
  onComplete: (prediction: CarbonPrediction) => void;
  userId: string;
  factors: GlobalConfig;
  theme?: 'dark' | 'light';
}

interface VehicleDetails {
  avg: number;
  distance: number;
  puc: string;
  certNo: string;
  isProcessing?: boolean;
  pucError?: string | null;
  pucSuccess?: boolean;
}

const LiveCameraModal = ({ onCapture, onClose }: { onCapture: (base64: string) => void, onClose: () => void }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDesiredActiveRef = useRef(true);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let activeStream: MediaStream | null = null;
    isDesiredActiveRef.current = true;

    async function startCamera() {
      try {
        setError(null);
        const mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' }, 
          audio: false 
        });
        
        if (!isDesiredActiveRef.current) {
          mediaStream.getTracks().forEach(t => t.stop());
          return;
        }

        activeStream = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          setIsReady(true);
        }
      } catch (err: any) {
        console.error("Camera access failure:", err);
        if (isDesiredActiveRef.current) {
          setError("Optical sensor connection refused.");
        }
      }
    }

    startCamera();

    return () => {
      isDesiredActiveRef.current = false;
      if (activeStream) {
        activeStream.getTracks().forEach(t => {
          t.stop();
          t.enabled = false;
        });
      }
    };
  }, []);

  const capture = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0);
      const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
      onCapture(base64);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6">
      <div className="relative w-full max-w-2xl aspect-[3/4] bg-[#020617] rounded-[3rem] overflow-hidden border border-white/10 shadow-2xl">
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center space-y-6">
             <div className="w-20 h-20 bg-rose-500/10 border border-rose-500/20 rounded-full flex items-center justify-center text-rose-500 text-3xl">
                <i className="fas fa-exclamation-triangle"></i>
             </div>
             <button onClick={onClose} className="px-8 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-black uppercase text-[10px] tracking-widest">Dismiss</button>
          </div>
        ) : (
          <>
            <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover transition-opacity duration-1000 ${isReady ? 'opacity-100' : 'opacity-0'}`} />
            <div className="absolute top-10 left-10 flex items-center gap-4 bg-black/60 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10">
               <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
               <span className="text-[9px] font-black text-white uppercase tracking-[0.4em]">Optical Link: Online</span>
            </div>
            <div className="absolute bottom-12 left-0 right-0 flex justify-center items-center gap-10 px-12">
               <button onClick={onClose} className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 hover:bg-rose-500 hover:text-white transition-all">
                 <i className="fas fa-times text-xl"></i>
               </button>
               <button onClick={capture} className="w-20 h-20 rounded-full bg-emerald-500 text-[#020617] flex items-center justify-center text-3xl shadow-[0_0_40px_rgba(16,185,129,0.5)] active:scale-95 transition-all">
                 <i className="fas fa-camera"></i>
               </button>
            </div>
          </>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

const ScopeForms: React.FC<ScopeFormsProps> = ({ onComplete, userId, factors }) => {
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pucFileInputRef = useRef<HTMLInputElement>(null);
  const [activePucContext, setActivePucContext] = useState<{ category: 'twoWheeler' | 'fourWheeler', index: number } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [scope1, setScope1] = useState({
    twoWheeler: { count: 1, vehicles: [{ avg: 45, distance: 0, puc: '', certNo: '', isProcessing: false, pucError: null, pucSuccess: false }] as VehicleDetails[] },
    fourWheeler: { type: 'Petrol' as 'Petrol' | 'Diesel' | 'CNG' | 'EV', count: 1, vehicles: [{ avg: 15, distance: 0, puc: '', certNo: '', isProcessing: false, pucError: null, pucSuccess: false }] as VehicleDetails[] },
    cooking: { type: 'LPG' as 'LPG' | 'PNG' | 'Kerosene', kgPerMonth: 0 }
  });

  const [scope2, setScope2] = useState({ kwh: 0, solarOffset: 0 });
  const [scope3, setScope3] = useState({
    domesticKm: 0, domesticClass: 'Economy', internationalKm: 0, internationalClass: 'Economy', taxiKm: 0, waterLiters: 0, paperKg: 0, electronicsUnits: 0, dairyUnits: 0, lifestyle: 'None'
  });

  useEffect(() => {
    setIsSyncing(true);
    const timer = setTimeout(() => setIsSyncing(false), 300);
    return () => clearTimeout(timer);
  }, [scope1, scope2, scope3]);

  const handleVehicleCountChange = (category: 'twoWheeler' | 'fourWheeler', count: number) => {
    const val = Math.max(0, count);
    setScope1(prev => {
      const currentVehicles = prev[category].vehicles;
      const newVehicles = [...currentVehicles];
      if (val > currentVehicles.length) {
        for (let i = currentVehicles.length; i < val; i++) {
          newVehicles.push({ avg: category === 'twoWheeler' ? 45 : 15, distance: 0, puc: '', certNo: '', isProcessing: false, pucError: null, pucSuccess: false });
        }
      } else {
        newVehicles.splice(val);
      }
      return { ...prev, [category]: { ...prev[category], count: val, vehicles: newVehicles } };
    });
  };

  const processData = async (base64Data: string) => {
    setIsExtracting(true);
    try {
      const result = await processUtilityBill(base64Data);
      if (result && result.units) {
        if (step === 2) setScope2(prev => ({ ...prev, kwh: result.units }));
      }
    } catch (err) {
      console.error("Extraction failed", err);
    } finally {
      setIsExtracting(false);
    }
  };

  const processPucFile = async (base64Data: string) => {
    if (!activePucContext) return;
    const { category, index } = activePucContext;

    setScope1(prev => {
      const updated = { ...prev };
      updated[category].vehicles[index].isProcessing = true;
      updated[category].vehicles[index].pucError = null;
      updated[category].vehicles[index].pucSuccess = false;
      return { ...updated };
    });

    try {
      const result = await processPUCCertificate(base64Data);
      if (result && (result.pucNumber || result.certificateNo)) {
        setScope1(prev => {
          const updated = { ...prev };
          const v = updated[category].vehicles[index];
          v.puc = result.pucNumber || '';
          v.certNo = result.certificateNo || '';
          v.isProcessing = false;
          v.pucSuccess = true;
          return { ...updated };
        });
        setTimeout(() => {
          setScope1(prev => {
             const updated = { ...prev };
             updated[category].vehicles[index].pucSuccess = false;
             return updated;
          });
        }, 5000);
      } else {
        throw new Error("Neural Scan failed to extract valid certificate telemetry.");
      }
    } catch (err: any) {
      console.error("PUC Extraction failed", err);
      setScope1(prev => {
        const updated = { ...prev };
        updated[category].vehicles[index].isProcessing = false;
        updated[category].vehicles[index].pucError = err.message || "Extraction Failed.";
        return { ...updated };
      });
    } finally {
      setActivePucContext(null);
    }
  };

  const handlePucUploadTrigger = (category: 'twoWheeler' | 'fourWheeler', index: number) => {
    setActivePucContext({ category, index });
    pucFileInputRef.current?.click();
  };

  const handlePucFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => processPucFile((reader.result as string).split(',')[1]);
      reader.readAsDataURL(file);
    }
    e.target.value = ''; 
  };

  const results = useMemo(() => {
    let s1 = 0;
    scope1.twoWheeler.vehicles.forEach(v => {
      s1 += (v.distance / Math.max(0.1, v.avg)) * 2.31;
    });
    const f1_factor = scope1.fourWheeler.type === 'Diesel' ? 2.68 : scope1.fourWheeler.type === 'Petrol' ? 2.31 : scope1.fourWheeler.type === 'CNG' ? 1.8 : 0.45;
    scope1.fourWheeler.vehicles.forEach(v => {
      s1 += (v.distance / Math.max(0.1, v.avg)) * f1_factor;
    });
    s1 += scope1.cooking.kgPerMonth * (scope1.cooking.type === 'LPG' ? 2.98 : (scope1.cooking.type === 'PNG' ? 2.05 : 2.5));
    const s2 = Math.max(0, (scope2.kwh - scope2.solarOffset) * factors.s2_factor);
    const dietImpact = scope3.lifestyle === 'Veg' ? 150 : 
                      scope3.lifestyle === 'Non-Veg' ? 300 : 
                      scope3.lifestyle === 'Vegan' ? 100 : 
                      scope3.lifestyle === 'Pescatarian' ? 220 : 0;
    const s3 = (scope3.domesticKm * (scope3.domesticClass === 'Business' ? 0.22 : 0.11)) + 
               (scope3.internationalKm * (scope3.internationalClass === 'Business' ? 0.35 : 0.18)) + 
               (scope3.taxiKm * 0.21) + 
               (scope3.waterLiters * 0.0003) + 
               (scope3.paperKg * 1.25) + 
               (scope3.electronicsUnits * 45) + 
               (scope3.dairyUnits * 1.4) + 
               dietImpact;
    return { scope1: Math.round(s1), scope2: Math.round(s2), scope3: Math.round(s3), total: Math.round(s1 + s2 + s3) };
  }, [scope1, scope2, scope3, factors]);

  return (
    <div className="flex flex-col lg:flex-row gap-6 md:gap-10 items-start animate-fadeIn px-2 md:px-0 pb-24">
      {showCamera && <LiveCameraModal onCapture={processData} onClose={() => setShowCamera(false)} />}
      <input type="file" ref={pucFileInputRef} className="hidden" accept="image/*,application/pdf" onChange={handlePucFileChange} />
      
      <div className="flex-grow w-full lg:max-w-[68%] space-y-6 md:space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center w-full gap-5 md:gap-6">
          <h2 className="text-3xl md:text-5xl font-black tracking-tighter uppercase text-white leading-none">Profiler</h2>
          
          <div className="bg-[#0f172a] p-1.5 rounded-full flex gap-1 border border-white/5 shadow-inner w-full md:w-[420px] shrink-0">
            {[1, 2, 3].map(s => (
              <button 
                key={s} 
                onClick={() => setStep(s)} 
                className={`flex-1 py-2.5 md:py-3 rounded-full text-[10px] md:text-[11px] font-black uppercase tracking-widest transition-all duration-300 ${
                  step === s 
                    ? 'bg-[#1e293b] text-white shadow-xl border border-white/10' 
                    : 'text-slate-500 hover:text-white hover:bg-white/5'
                }`}
              >
                Scope {s}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-[#0f172a]/60 backdrop-blur-md rounded-[2rem] md:rounded-[2.5rem] p-5 md:p-10 border border-white/5 shadow-2xl min-h-[500px] flex flex-col justify-between">
          {step === 1 && (
            <div className="space-y-8 md:space-y-12 animate-fadeIn">
              <div className="flex items-center gap-4 md:gap-6">
                <div className="w-12 h-12 md:w-14 md:h-14 bg-blue-600 rounded-xl md:rounded-2xl flex items-center justify-center text-white text-xl md:text-2xl shadow-lg"><i className="fas fa-gas-pump"></i></div>
                <div><h3 className="text-xl md:text-2xl font-black uppercase text-white tracking-tighter leading-tight">Kinetic Assets</h3><p className="text-[8px] md:text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Scope 1: Direct Combustion</p></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                {/* Two-Wheeler Node */}
                <div className="bg-[#1e293b]/20 rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-8 border border-white/5 space-y-6">
                  <div className="flex items-center gap-4"><i className="fas fa-motorcycle text-blue-500 text-lg"></i><h4 className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.3em] text-blue-400">Two-Wheeler</h4></div>
                  <input type="number" value={scope1.twoWheeler.count} onChange={e => handleVehicleCountChange('twoWheeler', parseInt(e.target.value) || 0)} className="w-full bg-[#1e293b]/40 border border-white/5 rounded-xl md:rounded-2xl px-5 py-3 md:py-4 text-white font-black text-lg outline-none" />
                  {scope1.twoWheeler.vehicles.map((v, i) => (
                    <div key={i} className="bg-[#1e293b]/30 p-4 md:p-6 rounded-2xl border border-white/5 space-y-4 relative overflow-hidden">
                      {v.isProcessing && (
                        <div className="absolute inset-0 bg-[#0f172a]/95 backdrop-blur-md z-10 flex flex-col items-center justify-center space-y-3">
                           <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                           <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest animate-pulse">Neural Sync...</span>
                        </div>
                      )}
                      {v.pucSuccess && (
                        <div className="absolute inset-0 bg-emerald-500/10 backdrop-blur-sm z-20 flex flex-col items-center justify-center animate-fadeIn">
                           <div className="w-10 h-10 bg-emerald-500 text-[#020617] rounded-full flex items-center justify-center text-lg shadow-lg">
                              <i className="fas fa-check"></i>
                           </div>
                           <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mt-2">Verified</span>
                        </div>
                      )}
                      {v.pucError && (
                        <div className="absolute inset-0 bg-rose-500/10 backdrop-blur-md z-20 flex flex-col items-center justify-center p-4 text-center">
                           <i className="fas fa-exclamation-circle text-rose-500 text-xl mb-2"></i>
                           <p className="text-[7px] text-white font-black uppercase">{v.pucError}</p>
                           <button onClick={() => setScope1(prev => {
                             const updated = {...prev};
                             updated.twoWheeler.vehicles[i].pucError = null;
                             return updated;
                           })} className="mt-2 text-[7px] font-black text-slate-400 uppercase underline">Dismiss</button>
                        </div>
                      )}
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Node #{i+1}</span>
                        <button onClick={() => handlePucUploadTrigger('twoWheeler', i)} className="text-[8px] font-black uppercase text-emerald-500 bg-emerald-500/10 px-2 py-1.5 rounded-lg border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-all">
                          <i className="fas fa-file-shield mr-1"></i> Sync PUC
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3 md:gap-4">
                        <div className="space-y-1"><label className="text-[7px] md:text-[8px] font-black text-slate-500 uppercase">Avg (KM/L)</label><input type="number" value={v.avg} onChange={e => {const n = [...scope1.twoWheeler.vehicles]; n[i].avg = parseFloat(e.target.value) || 0; setScope1({...scope1, twoWheeler: {...scope1.twoWheeler, vehicles: n}})}} className="w-full bg-[#1e293b]/50 border border-white/5 rounded-lg px-2 py-2 text-white text-center font-black" /></div>
                        <div className="space-y-1"><label className="text-[7px] md:text-[8px] font-black text-slate-500 uppercase">Distance (KM)</label><input type="number" value={v.distance} onChange={e => {const n = [...scope1.twoWheeler.vehicles]; n[i].distance = parseFloat(e.target.value) || 0; setScope1({...scope1, twoWheeler: {...scope1.twoWheeler, vehicles: n}})}} className="w-full bg-[#1e293b]/50 border border-white/5 rounded-lg px-2 py-2 text-white text-center font-black" /></div>
                      </div>
                      {(v.puc || v.certNo) && (
                        <div className="pt-3 border-t border-white/5 flex flex-col gap-1">
                          <div className="flex justify-between items-center"><span className="text-[6px] text-slate-500 font-black uppercase">PUC ID</span><span className="text-[7px] text-emerald-400 font-mono">{v.puc}</span></div>
                          <div className="flex justify-between items-center"><span className="text-[6px] text-slate-500 font-black uppercase">Cert No</span><span className="text-[7px] text-emerald-400 font-mono">{v.certNo}</span></div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {/* Four-Wheeler Node */}
                <div className="bg-[#1e293b]/20 rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-8 border border-white/5 space-y-6">
                  <div className="flex items-center justify-between"><div className="flex items-center gap-4"><i className="fas fa-car-side text-emerald-500 text-lg"></i><h4 className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.3em] text-emerald-400">Four-Wheeler</h4></div><select value={scope1.fourWheeler.type} onChange={e => setScope1({...scope1, fourWheeler: {...scope1.fourWheeler, type: e.target.value as any}})} className="bg-[#1e293b]/50 border border-white/5 rounded-lg px-2 py-1 text-[8px] md:text-[10px] font-black text-white uppercase"><option>Petrol</option><option>Diesel</option><option>CNG</option><option>EV</option></select></div>
                  <input type="number" value={scope1.fourWheeler.count} onChange={e => handleVehicleCountChange('fourWheeler', parseInt(e.target.value) || 0)} className="w-full bg-[#1e293b]/40 border border-white/5 rounded-xl md:rounded-2xl px-5 py-3 md:py-4 text-white font-black text-lg outline-none" />
                  {scope1.fourWheeler.vehicles.map((v, i) => (
                    <div key={i} className="bg-[#1e293b]/30 p-4 md:p-6 rounded-2xl border border-white/5 space-y-4 relative overflow-hidden">
                      {v.isProcessing && (
                        <div className="absolute inset-0 bg-[#0f172a]/95 backdrop-blur-md z-10 flex flex-col items-center justify-center space-y-3">
                           <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                           <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest animate-pulse">Neural Sync...</span>
                        </div>
                      )}
                      {v.pucSuccess && (
                        <div className="absolute inset-0 bg-emerald-500/10 backdrop-blur-sm z-20 flex flex-col items-center justify-center animate-fadeIn">
                           <div className="w-10 h-10 bg-emerald-500 text-[#020617] rounded-full flex items-center justify-center text-lg shadow-lg">
                              <i className="fas fa-check"></i>
                           </div>
                           <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mt-2">Verified</span>
                        </div>
                      )}
                      {v.pucError && (
                        <div className="absolute inset-0 bg-rose-500/10 backdrop-blur-md z-20 flex flex-col items-center justify-center p-4 text-center">
                           <i className="fas fa-exclamation-circle text-rose-500 text-xl mb-2"></i>
                           <p className="text-[7px] text-white font-black uppercase">{v.pucError}</p>
                           <button onClick={() => setScope1(prev => {
                             const updated = {...prev};
                             updated.fourWheeler.vehicles[i].pucError = null;
                             return updated;
                           })} className="mt-2 text-[7px] font-black text-slate-400 uppercase underline">Dismiss</button>
                        </div>
                      )}
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Node #{i+1}</span>
                        <button onClick={() => handlePucUploadTrigger('fourWheeler', i)} className="text-[8px] font-black uppercase text-emerald-500 bg-emerald-500/10 px-2 py-1.5 rounded-lg border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-all">
                          <i className="fas fa-file-shield mr-1"></i> Sync PUC
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3 md:gap-4">
                        <div className="space-y-1"><label className="text-[7px] md:text-[8px] font-black text-slate-500 uppercase">Avg (KM/L)</label><input type="number" value={v.avg} onChange={e => {const n = [...scope1.fourWheeler.vehicles]; n[i].avg = parseFloat(e.target.value) || 0; setScope1({...scope1, fourWheeler: {...scope1.fourWheeler, vehicles: n}})}} className="w-full bg-[#1e293b]/50 border border-white/5 rounded-lg px-2 py-2 text-white text-center font-black" /></div>
                        <div className="space-y-1"><label className="text-[7px] md:text-[8px] font-black text-slate-500 uppercase">Distance (KM)</label><input type="number" value={v.distance} onChange={e => {const n = [...scope1.fourWheeler.vehicles]; n[i].distance = parseFloat(e.target.value) || 0; setScope1({...scope1, fourWheeler: {...scope1.fourWheeler, vehicles: n}})}} className="w-full bg-[#1e293b]/50 border border-white/5 rounded-lg px-2 py-2 text-white text-center font-black" /></div>
                      </div>
                      {(v.puc || v.certNo) && (
                        <div className="pt-3 border-t border-white/5 flex flex-col gap-1">
                          <div className="flex justify-between items-center"><span className="text-[6px] text-slate-500 font-black uppercase">PUC ID</span><span className="text-[7px] text-emerald-400 font-mono">{v.puc}</span></div>
                          <div className="flex justify-between items-center"><span className="text-[6px] text-slate-500 font-black uppercase">Cert No</span><span className="text-[7px] text-emerald-400 font-mono">{v.certNo}</span></div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-8 md:space-y-12 animate-fadeIn">
              <div className="flex items-center gap-4 md:gap-6"><div className="w-12 h-12 md:w-14 md:h-14 bg-amber-500 rounded-xl md:rounded-2xl flex items-center justify-center text-white text-xl md:text-2xl shadow-lg"><i className="fas fa-bolt"></i></div><div><h3 className="text-xl md:text-2xl font-black uppercase text-white tracking-tighter">Energy Intake</h3><p className="text-[8px] md:text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Scope 2: Purchased Electricity</p></div></div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-10">
                <div className="bg-[#1e293b]/20 rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-10 border border-white/5 space-y-6 md:space-y-10">
                  <h4 className="text-[10px] md:text-[11px] font-black text-emerald-400 uppercase tracking-[0.4em]">Neural Extraction</h4>
                  <div className="grid grid-cols-2 gap-4 md:gap-6">
                    <button onClick={() => setShowCamera(true)} className="flex flex-col items-center justify-center gap-3 md:gap-5 bg-[#1e293b]/40 border border-white/10 rounded-2xl p-4 md:p-8 hover:border-emerald-500/50 transition-all shadow-inner"><div className="w-10 h-10 md:w-14 md:h-14 bg-white/5 rounded-xl flex items-center justify-center text-slate-500"><i className="fas fa-camera text-base md:text-xl"></i></div><span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-slate-500">Live Scan</span></button>
                    <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center gap-3 md:gap-5 bg-[#1e293b]/40 border border-white/10 rounded-2xl p-4 md:p-8 hover:border-blue-500/50 transition-all shadow-inner"><div className="w-10 h-10 md:w-14 md:h-14 bg-white/5 rounded-xl flex items-center justify-center text-slate-500"><i className="fas fa-upload text-base md:text-xl"></i></div><span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-slate-500">Upload</span></button>
                  </div>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => processData((reader.result as string).split(',')[1]);
                      reader.readAsDataURL(file);
                    }
                  }} />
                  {/* Solar Offset UI persists as requested */}
                  <div className="space-y-4 pt-4 border-t border-white/5">
                    <div className="flex justify-between items-center"><span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Solar Offset (kWh)</span><span className="text-emerald-500 font-black">{scope2.solarOffset}</span></div>
                    <input type="number" value={scope2.solarOffset || ''} onChange={e => setScope2({...scope2, solarOffset: parseFloat(e.target.value) || 0})} className="w-full bg-[#1e293b]/50 border border-white/5 rounded-xl px-4 py-3 text-white font-black" placeholder="Manual Override..." />
                  </div>
                </div>
                <div className="bg-[#1e293b]/30 rounded-[1.5rem] md:rounded-[2.5rem] p-8 md:p-10 border border-blue-500/40 flex flex-col items-center justify-center relative shadow-2xl min-h-[300px]">
                  <p className="text-[10px] md:text-[12px] font-black text-amber-500 uppercase tracking-[0.4em] mb-6 md:mb-10">TOTAL (KWH)</p>
                  <input type="number" value={scope2.kwh || ''} onChange={e => setScope2({...scope2, kwh: parseFloat(e.target.value) || 0})} className="w-full bg-transparent text-5xl md:text-7xl font-black text-white text-center outline-none" placeholder="0" />
                  <div className="absolute bottom-10 md:bottom-20 w-[70%] h-1.5 bg-amber-500 rounded-full"></div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 md:space-y-10 animate-fadeIn">
              <div className="flex items-center gap-4 md:gap-6"><div className="w-12 h-12 md:w-16 md:h-16 bg-[#a855f7] rounded-xl md:rounded-2xl flex items-center justify-center text-white text-2xl md:text-3xl shadow-xl"><i className="fas fa-network-wired"></i></div><div><h3 className="text-xl md:text-3xl font-black uppercase text-white tracking-tighter leading-none">Ecosystem Load</h3><p className="text-[8px] md:text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Scope 3: Value Chain</p></div></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                <div className="bg-[#1e293b]/30 rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-10 border border-white/5 space-y-6 flex flex-col h-full">
                  <h4 className="text-[11px] md:text-[13px] font-black text-purple-400 uppercase tracking-[0.4em]">Kinetic Chain (KM)</h4>
                  <div className="space-y-4 flex-grow">
                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Domestic Air</label><input type="number" value={scope3.domesticKm || ''} onChange={e => setScope3({...scope3, domesticKm: parseFloat(e.target.value) || 0})} className="w-full bg-[#1e293b]/50 border border-white/10 rounded-xl px-4 py-3 text-white font-black text-xl md:text-2xl" placeholder="0" /></div>
                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Intl Air</label><input type="number" value={scope3.internationalKm || ''} onChange={e => setScope3({...scope3, internationalKm: parseFloat(e.target.value) || 0})} className="w-full bg-[#1e293b]/50 border border-white/10 rounded-xl px-4 py-3 text-white font-black text-xl md:text-2xl" placeholder="0" /></div>
                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Taxi / Rideshare</label><input type="number" value={scope3.taxiKm || ''} onChange={e => setScope3({...scope3, taxiKm: parseFloat(e.target.value) || 0})} className="w-full bg-[#1e293b]/50 border border-white/10 rounded-xl px-4 py-3 text-white font-black text-xl md:text-2xl" placeholder="0" /></div>
                  </div>
                </div>
                <div className="bg-[#1e293b]/30 rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-10 border border-white/5 space-y-6 flex flex-col h-full">
                  <h4 className="text-[11px] md:text-[13px] font-black text-emerald-400 uppercase tracking-[0.4em]">Material Flow</h4>
                  <div className="space-y-4 flex-grow">
                    <div className="grid grid-cols-2 gap-3"><div className="space-y-1"><label className="text-[8px] font-black text-slate-500 uppercase">Water (L)</label><input type="number" value={scope3.waterLiters || ''} onChange={e => setScope3({...scope3, waterLiters: parseFloat(e.target.value) || 0})} className="w-full bg-[#1e293b]/50 border border-emerald-500/20 rounded-lg px-2 py-2 text-white font-black text-center text-lg" /></div><div className="space-y-1"><label className="text-[8px] font-black text-slate-500 uppercase">Paper (Kg)</label><input type="number" value={scope3.paperKg || ''} onChange={e => setScope3({...scope3, paperKg: parseFloat(e.target.value) || 0})} className="w-full bg-[#1e293b]/50 border border-emerald-500/20 rounded-lg px-2 py-2 text-white font-black text-center text-lg" /></div></div>
                    <div className="grid grid-cols-2 gap-3"><div className="space-y-1"><label className="text-[8px] font-black text-slate-500 uppercase">Electronics</label><input type="number" value={scope3.electronicsUnits || ''} onChange={e => setScope3({...scope3, electronicsUnits: parseFloat(e.target.value) || 0})} className="w-full bg-[#1e293b]/50 border border-white/10 rounded-lg px-2 py-2 text-white font-black text-center text-lg" /></div><div className="space-y-1"><label className="text-[8px] font-black text-slate-500 uppercase">Dairy (U/M)</label><input type="number" value={scope3.dairyUnits || ''} onChange={e => setScope3({...scope3, dairyUnits: parseFloat(e.target.value) || 0})} className="w-full bg-[#1e293b]/50 border border-white/10 rounded-lg px-2 py-2 text-white font-black text-center text-lg" /></div></div>
                    <div className="space-y-1"><label className="text-[9px] font-black text-slate-500 uppercase px-1">Dietary Protocol</label><select value={scope3.lifestyle} onChange={e => setScope3({...scope3, lifestyle: e.target.value})} className="w-full bg-[#1e293b]/50 border border-white/10 rounded-xl px-4 py-2 text-white font-black text-xs md:text-sm uppercase"><option value="None">None</option><option value="Veg">Vegetarian</option><option value="Non-Veg">Non-Veg</option><option value="Vegan">Vegan</option></select></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center pt-6 md:pt-10 border-t border-white/5 mt-auto gap-3">
            <button onClick={() => step > 1 && setStep(step - 1 as any)} className={`px-4 py-2 text-slate-500 font-black uppercase text-[10px] md:text-[12px] tracking-widest ${step === 1 ? 'opacity-0 pointer-events-none' : ''}`}>Back</button>
            <div className="flex gap-2 md:gap-6 items-center">
              {step < 3 ? (
                <button onClick={() => setStep(step + 1 as any)} className="px-6 md:px-10 py-3 md:py-5 bg-[#1e293b] text-white font-black rounded-xl md:rounded-2xl uppercase text-[10px] md:text-[11px] tracking-widest border border-white/10 shadow-xl transition-all">Next Step</button>
              ) : (
                <button onClick={() => { setIsProcessing(true); setTimeout(() => { onComplete({...results, timestamp: Date.now(), userId}); setIsProcessing(false); }, 1500); }} className="px-6 md:px-16 py-3.5 md:py-6 bg-[#10b981] text-[#020617] font-black rounded-xl md:rounded-[2.5rem] uppercase text-[10px] md:text-[14px] tracking-widest shadow-2xl transition-all active:scale-95">Complete Audit</button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="w-full lg:w-[32%] lg:sticky lg:top-32 space-y-6 md:space-y-8">
        <div className="bg-[#0f172a] rounded-[2rem] md:rounded-[3.5rem] p-6 md:p-10 border border-white/5 shadow-2xl space-y-8 relative overflow-hidden">
          <div className="flex justify-between items-center relative z-10"><h4 className="text-[10px] md:text-[12px] font-black uppercase tracking-[0.3em] text-emerald-400">Total Projection</h4><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div></div>
          <div className="space-y-2 relative z-10 text-center md:text-left"><h1 className="text-5xl md:text-8xl font-black text-white tracking-tighter tabular-nums leading-none">{results.total.toLocaleString()}</h1><p className="text-[12px] md:text-[18px] font-black text-slate-500 uppercase tracking-widest ml-1">KG CO2E</p></div>
          <div className="space-y-6 pt-6 border-t border-white/5 relative z-10">
            {[ { label: 'Scope 1', val: results.scope1 }, { label: 'Scope 2', val: results.scope2 }, { label: 'Scope 3', val: results.scope3 } ].map(s => (
              <div key={s.label} className="flex justify-between items-center"><span className="text-[10px] md:text-[12px] font-black text-slate-500 uppercase tracking-widest">{s.label}</span><span className="text-xl md:text-2xl font-black text-white tabular-nums tracking-tighter">{s.val.toLocaleString()} <span className="text-[8px] md:text-[10px] opacity-30 tracking-normal ml-1">KG</span></span></div>
            ))}
          </div>
        </div>
      </div>
      {isProcessing && <div className="fixed inset-0 z-[500] bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center animate-fadeIn text-center px-6"><div className="w-12 h-12 border-4 border-emerald-500/10 border-t-emerald-500 rounded-full animate-spin mb-6"></div><p className="text-emerald-500 font-black uppercase tracking-widest text-[10px]">Synchronizing Terminal...</p></div>}
    </div>
  );
};

export default ScopeForms;
