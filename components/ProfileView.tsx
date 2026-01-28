
import React, { useState, useRef, useEffect } from 'react';
import { UserRecord, CarbonPrediction, GlobalConfig } from '../types';
import { databaseService, ActivityLog } from '../services/databaseService';

interface ProfileViewProps {
  user: UserRecord;
  history: CarbonPrediction[];
  onUpdate: (user: UserRecord) => void;
  config: GlobalConfig;
  setConfig: (c: GlobalConfig) => void;
}

const MASTER_EMAIL = 'rautom508@gmail.com';

const ProfileView: React.FC<ProfileViewProps> = ({ user, history, onUpdate, config, setConfig }) => {
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [isCalibrating, setIsCalibrating] = useState(false);

  useEffect(() => {
    const fetchLogs = async () => {
      // Users see their own logs; Master sees all relevant logs
      const logs = await databaseService.getActivityLogs(user.id);
      setActivityLogs(logs);
    };
    fetchLogs();
    const interval = setInterval(fetchLogs, 15000);
    return () => clearInterval(interval);
  }, [user.id]);

  const isActuallyMaster = user.email.toLowerCase() === MASTER_EMAIL.toLowerCase();

  const handleCalibration = (key: keyof GlobalConfig, val: number) => {
    const newConfig = { ...config, [key]: val };
    setConfig(newConfig);
    databaseService.logActivity(user.id, user.name, "NEURAL_CALIBRATION", `Updated ${key} to ${val}`);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10 animate-fadeIn pb-24">
      {/* Identity Header */}
      <header className="glass-panel border-white/5 p-16 rounded-[4rem] flex flex-col lg:flex-row justify-between items-center gap-10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-24 opacity-[0.03] pointer-events-none">
           <i className="fas fa-user-astronaut text-[250px] text-emerald-500"></i>
        </div>
        
        <div className="flex items-center gap-10 relative z-10">
          <div className={`w-24 h-24 lg:w-32 lg:h-32 rounded-[2.5rem] flex items-center justify-center text-4xl lg:text-5xl shadow-2xl border transition-all duration-700 ${isActuallyMaster ? 'bg-amber-600 border-amber-500/30' : 'bg-emerald-600 border-emerald-500/20'}`}>
            <span className="text-white font-black">{user.name.charAt(0)}</span>
          </div>
          <div>
            <div className="flex items-center gap-4 mb-3">
              <span className={`px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.3em] border ${isActuallyMaster ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'}`}>
                {isActuallyMaster ? 'Master Authority' : 'Registry Synchronized'}
              </span>
              <span className="text-slate-500 text-[9px] font-black uppercase tracking-widest">Node_ID: {user.id.slice(0, 8)}</span>
            </div>
            <h2 className="text-5xl font-black tracking-tighter uppercase text-white leading-none">{user.name}</h2>
            <p className="text-slate-500 font-mono text-sm mt-4">{user.email}</p>
          </div>
        </div>

        <div className="flex gap-4 relative z-10">
          <div className="bg-white/5 border border-white/10 px-8 py-6 rounded-3xl text-center">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Audits</p>
            <p className="text-3xl font-black text-white">{history.length}</p>
          </div>
          <div className="bg-white/5 border border-white/10 px-8 py-6 rounded-3xl text-center">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Rank</p>
            <p className="text-3xl font-black text-emerald-500">{user.role}</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left Col: Master Controls or User Info */}
        <div className="lg:col-span-7 space-y-10">
          {isActuallyMaster ? (
            <section className="glass-panel p-16 rounded-[4rem] space-y-16 border-white/5 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-3xl font-black uppercase tracking-tight text-white">Neural Calibration</h3>
                <i className="fas fa-sliders text-amber-500 text-2xl"></i>
              </div>
              <div className="space-y-16">
                {[
                  { key: 's1_factor', label: 'Scope 1 Factor (Direct)', color: 'blue' },
                  { key: 's2_factor', label: 'Scope 2 Factor (Energy)', color: 'amber' },
                  { key: 's3_factor', label: 'Scope 3 Factor (Chain)', color: 'purple' }
                ].map(f => (
                  <div key={f.key} className="space-y-6">
                    <div className="flex justify-between items-end">
                      <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{f.label}</span>
                      <span className="text-amber-500 text-4xl font-black text-neural">{(config as any)[f.key]}x</span>
                    </div>
                    <input 
                      type="range" min="0" max="5" step="0.01" value={(config as any)[f.key]} 
                      onChange={(e) => handleCalibration(f.key as any, parseFloat(e.target.value))}
                      className="w-full h-2 bg-white/5 rounded-full appearance-none cursor-pointer accent-amber-500"
                    />
                  </div>
                ))}
              </div>
              <div className="p-8 bg-amber-500/5 border border-amber-500/10 rounded-[2.5rem] flex items-center gap-6">
                <i className="fas fa-triangle-exclamation text-amber-500 text-xl"></i>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                  Calibrated weights propagate globally to all node Hubs during synchronization.
                </p>
              </div>
            </section>
          ) : (
            <section className="glass-panel p-16 rounded-[4rem] space-y-12 border-white/5 shadow-2xl">
              <h3 className="text-3xl font-black uppercase tracking-tight text-white">Registry Telemetry</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <div className="p-8 bg-white/5 rounded-[2.5rem] border border-white/5 space-y-2">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Registry Date</p>
                    <p className="text-xl font-bold text-white">{new Date(user.createdAt).toLocaleDateString()}</p>
                 </div>
                 <div className="p-8 bg-white/5 rounded-[2.5rem] border border-white/5 space-y-2">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Identity Status</p>
                    <p className="text-xl font-bold text-emerald-500">ACTIVE</p>
                 </div>
                 <div className="p-8 bg-white/5 rounded-[2.5rem] border border-white/5 space-y-2">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Access Provider</p>
                    <p className="text-xl font-bold text-white uppercase">{user.provider}</p>
                 </div>
                 <div className="p-8 bg-white/5 rounded-[2.5rem] border border-white/5 space-y-2">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Phone Link</p>
                    <p className="text-xl font-bold text-white">{user.phone || 'NOT_SYNCED'}</p>
                 </div>
              </div>
            </section>
          )}
        </div>

        {/* Right Col: Personal Activity Stream */}
        <div className="lg:col-span-5 flex flex-col gap-10">
          <section className="glass-panel bg-[#050a14] border-white/5 rounded-[4rem] p-12 flex flex-col h-full shadow-2xl">
             <div className="flex items-center justify-between mb-10 shrink-0">
               <div className="flex items-center gap-4">
                 <i className="fas fa-terminal text-emerald-500"></i>
                 <h4 className="text-[12px] font-black uppercase tracking-[0.4em] text-white">Personal Stream</h4>
               </div>
               <span className="text-[9px] font-black text-slate-600 uppercase">Audit Persistence Active</span>
             </div>
             
             <div className="flex-grow overflow-y-auto space-y-6 pr-4 custom-scrollbar">
               {activityLogs.length > 0 ? activityLogs.map(log => (
                 <div key={log.id} className="p-6 bg-white/5 border border-white/5 rounded-3xl hover:border-emerald-500/20 transition-all group">
                   <div className="flex justify-between items-center mb-3">
                     <span className="text-emerald-500 text-[10px] font-black uppercase tracking-widest">{log.action}</span>
                     <span className="text-slate-600 font-mono text-[9px]">{new Date(log.timestamp).toLocaleTimeString()}</span>
                   </div>
                   <p className="text-slate-300 text-sm font-bold leading-relaxed">{log.details || 'Standard node operation detected.'}</p>
                 </div>
               )) : (
                 <div className="h-full flex flex-col items-center justify-center opacity-20 space-y-4">
                   <i className="fas fa-inbox text-5xl"></i>
                   <p className="text-[10px] font-black uppercase tracking-[0.3em]">No Telemetry Available</p>
                 </div>
               )}
             </div>
             
             <div className="mt-10 pt-8 border-t border-white/5 flex items-center justify-between opacity-30">
                <span className="text-[9px] font-black uppercase tracking-widest">Sync Loop: 15s</span>
                <span className="text-[9px] font-black uppercase tracking-widest">Cipher: AES-GCM</span>
             </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default ProfileView;
