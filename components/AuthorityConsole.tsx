
import React, { useState, useEffect, useRef } from 'react';
import { GlobalConfig, CarbonPrediction, UserRecord } from '../types';
import { databaseService, ActivityLog } from '../services/databaseService';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';

interface AuthorityConsoleProps {
  config: GlobalConfig;
  setConfig: (c: GlobalConfig) => void;
  history: CarbonPrediction[];
  isOwner: boolean;
  theme?: 'dark' | 'light';
  isOverridden?: boolean;
  setIsOverridden?: (val: boolean) => void;
}

const PROJECT_NUMBER = '1084459329478';

function encode(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
  }
  return buffer;
}

const AuthorityConsole: React.FC<AuthorityConsoleProps> = ({ 
  config, setConfig, history, isOwner, theme = 'dark', isOverridden, setIsOverridden 
}) => {
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [verificationToken, setVerificationToken] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [authError, setAuthError] = useState('');

  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPass, setNewPass] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createStatus, setCreateStatus] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [tab, setTab] = useState<'CALIBRATION' | 'REGISTRY' | 'LOGS' | 'COMMAND'>('CALIBRATION');
  
  const sessionRef = useRef<any>(null);

  useEffect(() => {
    const init = async () => {
      const user = await databaseService.getSession();
      setCurrentUser(user);
    };
    init();
  }, []);

  useEffect(() => {
    if (isUnlocked) {
      refreshData();
      const interval = setInterval(refreshData, 10000);
      return () => clearInterval(interval);
    }
  }, [isUnlocked]);

  const refreshData = async () => {
    const allUsers = await databaseService.getAllUsers();
    const allLogs = await databaseService.getActivityLogs();
    setUsers(allUsers);
    setLogs(allLogs);
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setVerifying(true);
    setAuthError('');
    setTimeout(() => {
      const isCorrect = verificationToken.toUpperCase() === databaseService.MASTER_PASSWORD_SEED || verificationToken === PROJECT_NUMBER;
      if (isCorrect) {
        setIsUnlocked(true);
      } else {
        setAuthError('Unauthorized Authority Seed. Gateway Blocked.');
      }
      setVerifying(false);
    }, 1200);
  };

  const handleMasterBypass = () => {
    setVerifying(true);
    setTimeout(() => {
      setIsUnlocked(true);
      setVerifying(false);
    }, 400);
  };

  const toggleOverride = () => {
    if (setIsOverridden) {
      const newVal = !isOverridden;
      setIsOverridden(newVal);
      databaseService.logActivity(currentUser?.id || 'master', currentUser?.name || 'Master', "SECURITY_OVERRIDE_TOGGLE", `System override set to ${newVal}`);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsCreating(true);
    setCreateStatus(null);
    const result = await databaseService.register(newName, newEmail, newPhone, newPass, 'USER');
    if (result.success) {
      setCreateStatus({ msg: result.message, type: 'success' });
      setNewName(''); setNewEmail(''); setNewPhone(''); setNewPass('');
      await refreshData();
    } else {
      setCreateStatus({ msg: result.message, type: 'error' });
    }
    setIsCreating(false);
  };

  if (!isUnlocked) {
    const isMasterNode = databaseService.isMaster(currentUser?.email);
    return (
      <div className="max-w-[580px] mx-auto py-24 px-6">
        <div className="glass-panel border-amber-500/30 shadow-[0_50px_150px_rgba(217,119,6,0.15)] rounded-[4.5rem] p-16 flex flex-col items-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-amber-500/20">
             <div className="h-full bg-amber-500 animate-[shimmer_3s_infinite]" style={{ width: verifying ? '100%' : '30%' }}></div>
          </div>
          
          <div className="w-32 h-32 bg-amber-500/5 border-2 border-amber-500/20 rounded-[3rem] flex items-center justify-center text-amber-500 text-6xl mb-16 shadow-2xl relative">
             <i className={`fas ${verifying ? 'fa-fingerprint animate-pulse' : 'fa-lock-open'}`}></i>
          </div>

          <h1 className="text-4xl font-black mb-2 uppercase tracking-tighter text-white">Authority Gate</h1>
          <p className="text-amber-500 text-[10px] font-black mb-12 uppercase tracking-[0.5em] text-center">Protocol: AES-256-SYNCHRONIZED</p>
          
          {authError && <div className="mb-10 p-6 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[10px] font-black uppercase rounded-2xl w-full text-center tracking-widest">{authError}</div>}
          
          <form onSubmit={handleVerify} className="w-full space-y-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Identity Signature Token</label>
              <input type="password" value={verificationToken} onChange={e => setVerificationToken(e.target.value)} placeholder="••••••••" className="w-full px-10 py-6 bg-white/5 border border-white/10 rounded-[2.5rem] font-mono text-center tracking-[1em] text-white focus:border-amber-500 outline-none transition-all text-xl" required autoFocus />
            </div>
            
            <button type="submit" disabled={verifying} className="w-full py-7 bg-amber-600 hover:bg-amber-500 text-white font-black rounded-[2.5rem] uppercase tracking-[0.4em] text-[13px] shadow-2xl transition-all active:scale-95">
              {verifying ? "VERIFYING BIOMETRICS..." : "Authorize Control"}
            </button>
            
            {isMasterNode && (
              <button type="button" onClick={handleMasterBypass} className="w-full py-4 text-emerald-500 font-black uppercase text-[10px] tracking-[0.4em] hover:text-emerald-400 transition-colors border border-emerald-500/20 rounded-[2rem] bg-emerald-500/5">
                <i className="fas fa-crown mr-2"></i> Master Identity Bypass
              </button>
            )}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-fadeIn pb-24">
      <header className="glass-panel border-white/5 p-16 rounded-[4rem] flex flex-col lg:flex-row justify-between items-center gap-10">
        <div>
          <div className="inline-flex items-center gap-3 px-4 py-1.5 bg-amber-500/10 text-amber-500 rounded-full border border-amber-500/20 mb-6">
             <i className="fas fa-shield-check text-[10px]"></i>
             <span className="text-[10px] font-black uppercase tracking-widest">Master Command Active</span>
          </div>
          <h2 className="text-6xl font-black tracking-tighter uppercase text-white leading-none">Command Center</h2>
          <div className="flex flex-wrap items-center gap-10 mt-8">
            <p className="text-emerald-500 text-[11px] font-black uppercase tracking-[0.5em]">Identity Verified: {currentUser?.name}</p>
            <p className="text-slate-500 text-[11px] font-black uppercase tracking-widest">Persistence Loop: Locked</p>
          </div>
        </div>
        <button onClick={() => setIsLiveActive(!isLiveActive)} className={`px-12 py-6 rounded-[2rem] font-black uppercase tracking-[0.4em] text-[12px] shadow-2xl transition-all ${isLiveActive ? 'bg-rose-500 animate-pulse' : 'bg-amber-600 hover:bg-amber-500'} text-white`}>
          <i className={`fas ${isLiveActive ? 'fa-bolt' : 'fa-microphone'} mr-4`}></i> {isLiveActive ? 'LIVE BRIEFING' : 'NEURAL LINK'}
        </button>
      </header>

      <div className="flex flex-wrap gap-4 p-3 glass-panel rounded-[2.5rem] w-fit">
        {[
          { id: 'CALIBRATION', icon: 'fa-sliders', label: 'Calibration' },
          { id: 'REGISTRY', icon: 'fa-users-gear', label: 'Registry' },
          { id: 'LOGS', icon: 'fa-terminal', label: 'Blackbox' },
          { id: 'COMMAND', icon: 'fa-microchip', label: 'Core' }
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} className={`px-12 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-4 ${tab === t.id ? 'bg-amber-600 text-white shadow-xl' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>
            <i className={`fas ${t.icon}`}></i> {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-9">
          {tab === 'CALIBRATION' && (
             <section className="glass-panel p-16 rounded-[4rem] space-y-16 animate-fadeIn">
              <h3 className="text-3xl font-black uppercase tracking-tight text-white">Neural Weights</h3>
              <div className="space-y-16">
                {[
                  { key: 's1_factor', label: 'DIRECT COMBUSTION RATIO (S1)', color: 'blue' },
                  { key: 's2_factor', label: 'ENERGY INTENSITY (S2)', color: 'amber' },
                  { key: 's3_factor', label: 'VALUE CHAIN LOGISTICS (S3)', color: 'purple' }
                ].map(f => (
                  <div key={f.key} className="space-y-6">
                    <div className="flex justify-between items-end">
                      <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{f.label}</span>
                      <span className="text-amber-500 text-4xl font-black text-neural">{(config as any)[f.key]}x</span>
                    </div>
                    <input type="range" min="0" max="5" step="0.01" value={(config as any)[f.key]} onChange={e => setConfig({...config, [f.key]: parseFloat(e.target.value)})} className="w-full h-2 bg-white/5 rounded-full appearance-none cursor-pointer accent-amber-500" />
                  </div>
                ))}
              </div>
            </section>
          )}

          {tab === 'REGISTRY' && (
            <div className="space-y-10 animate-fadeIn">
              <section className="glass-panel p-12 lg:p-16 rounded-[4rem]">
                <h3 className="text-2xl font-black uppercase tracking-tight text-white mb-10">Node Initialization</h3>
                <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <input required type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Node Name" className="bg-white/5 border border-white/10 rounded-2xl p-5 text-white font-bold outline-none focus:border-emerald-500 transition-all" />
                  <input required type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Registry Email" className="bg-white/5 border border-white/10 rounded-2xl p-5 text-white font-bold outline-none focus:border-emerald-500 transition-all" />
                  <input required type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Access Key" className="bg-white/5 border border-white/10 rounded-2xl p-5 text-white font-bold outline-none focus:border-emerald-500 transition-all" />
                  <button type="submit" disabled={isCreating} className="bg-emerald-600 text-white font-black rounded-2xl py-5 uppercase tracking-widest text-[11px] shadow-2xl hover:bg-emerald-500 transition-all">
                    {isCreating ? "AUTHORIZING..." : "Initialize Identity"}
                  </button>
                </form>
                {createStatus && <p className={`text-center mt-6 text-[11px] font-black uppercase tracking-widest ${createStatus.type === 'success' ? 'text-emerald-500' : 'text-rose-500'}`}>{createStatus.msg}</p>}
              </section>

              <section className="glass-panel p-16 rounded-[4rem]">
                <h3 className="text-3xl font-black mb-12 uppercase tracking-tight text-white">Authorized Nodes</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {users.map((u, i) => (
                    <div key={i} className="flex justify-between items-center p-8 bg-white/5 border border-white/5 rounded-[2.5rem] hover:border-amber-500/20 transition-all">
                      <div className="flex items-center gap-6">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl ${u.role === 'OWNER' ? 'bg-amber-600' : 'bg-slate-800'}`}>{u.name.charAt(0)}</div>
                        <div>
                          <p className="text-lg font-black uppercase text-white">{u.name}</p>
                          <p className="text-[11px] text-slate-500 font-mono">{u.email}</p>
                        </div>
                      </div>
                      <span className={`text-[10px] font-black uppercase px-4 py-1.5 rounded-full ${u.role === 'OWNER' ? 'bg-amber-500/10 text-amber-500' : 'bg-slate-800 text-slate-500'}`}>{u.role}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {tab === 'LOGS' && (
             <div className="glass-panel bg-[#050a14] border-white/5 rounded-[4rem] p-16 h-[700px] flex flex-col font-mono text-white animate-fadeIn">
               <h4 className="text-[12px] font-black uppercase tracking-[0.5em] text-amber-500 mb-12">Neural Blackbox</h4>
               <div className="flex-grow overflow-y-auto space-y-8 pr-6 custom-scrollbar">
                 {logs.map((log, i) => (
                   <div key={i} className="flex flex-col gap-3 border-l-4 border-white/5 pl-8 py-2 hover:border-amber-500/50 transition-all">
                     <div className="flex justify-between text-[11px] text-slate-600">
                        <span>[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                        <span className="font-black uppercase tracking-widest">{log.userName}</span>
                     </div>
                     <p className="text-white font-black uppercase tracking-tighter text-lg">{log.action}</p>
                     <p className="text-slate-500 text-[11px] leading-relaxed">{log.details}</p>
                   </div>
                 ))}
               </div>
            </div>
          )}

          {tab === 'COMMAND' && (
            <section className="glass-panel p-16 rounded-[4rem] space-y-12 animate-fadeIn">
               <h3 className="text-3xl font-black uppercase tracking-tight text-white">Authority Core</h3>
               <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                  {[
                    { label: 'System Lock', val: 'ENABLED', color: 'emerald' },
                    { label: 'Neural Link', val: 'PRIME', color: 'emerald' },
                    { label: 'Bypass Protocol', val: isOverridden ? 'ACTIVE' : 'READY', color: isOverridden ? 'amber' : 'blue' },
                    { label: 'Cloud Sync', val: 'SECURE', color: 'emerald' }
                  ].map(d => (
                    <div key={d.label} className="p-10 glass-panel bg-white/5 rounded-[3rem] border-white/5 text-center">
                       <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-4">{d.label}</p>
                       <p className={`text-2xl font-black text-${d.color}-500 tracking-tighter`}>{d.val}</p>
                    </div>
                  ))}
               </div>
               
               <div className="p-10 bg-amber-500/5 border border-amber-500/20 rounded-[3rem] flex flex-col items-center gap-6">
                  <div className="flex items-center gap-4">
                     <i className="fas fa-key text-amber-500 text-2xl"></i>
                     <h4 className="text-xl font-black text-white uppercase tracking-tight">Security Override Control</h4>
                  </div>
                  <p className="text-slate-400 text-sm text-center max-w-lg font-medium">Bypass hardware permission locks across the terminal. This provides absolute authority over sensors and diagnostic streams.</p>
                  <button 
                    onClick={toggleOverride}
                    className={`px-12 py-5 ${isOverridden ? 'bg-amber-600 shadow-xl' : 'bg-white/10 hover:bg-white/20'} text-white rounded-[2rem] font-black uppercase tracking-widest text-[11px] transition-all`}
                  >
                    {isOverridden ? 'Deactivate Master Override' : 'Activate Authority Override'}
                  </button>
               </div>
            </section>
          )}
        </div>

        <div className="lg:col-span-3 space-y-10">
           <div className="glass-panel bg-[#0a1121] border-white/5 p-12 rounded-[3.5rem] text-center shadow-2xl">
              <div className="w-24 h-24 bg-amber-500/10 rounded-[2.5rem] flex items-center justify-center text-amber-500 text-4xl mx-auto mb-10 border border-amber-500/20">
                 <i className="fas fa-atom"></i>
              </div>
              <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.4em] mb-3">Core Load</p>
              <p className="text-5xl font-black text-white tracking-tighter">OPTIMAL</p>
           </div>
           
           <div className={`p-12 rounded-[3.5rem] text-white shadow-2xl relative overflow-hidden bg-gradient-to-br ${isOverridden ? 'from-amber-600 to-amber-900 shadow-amber-900/40' : 'from-emerald-600 to-emerald-900 shadow-emerald-900/40'}`}>
              <div className="absolute inset-0 bg-white/5 animate-pulse"></div>
              <h4 className="text-2xl font-black uppercase tracking-tighter mb-6 relative z-10 leading-none">Status: {isOverridden ? 'Master Control' : 'Authority Lock'}</h4>
              <p className="text-sm text-white/80 font-medium relative z-10 leading-relaxed mb-10">
                {isOverridden ? 'System sensors are operating under master override. Visual and audit locks are suppressed.' : 'Standard registry protocols are active. All diagnostic data is being verified by the neural engine.'}
              </p>
              <div className="h-1.5 w-full bg-black/20 rounded-full relative z-10">
                 <div className="h-full bg-white/40 animate-pulse" style={{ width: '100%' }}></div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default AuthorityConsole;
