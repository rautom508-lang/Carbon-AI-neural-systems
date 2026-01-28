
import React, { useState, useEffect, useMemo } from 'react';
import { databaseService } from '../services/databaseService';
import { UserRecord, UserRole } from '../types';

interface AuthLockProps {
  onAuthSuccess: (user: UserRecord) => void;
}

type AuthMode = 'GATEWAY' | 'LOGIN' | 'SIGNUP';

const AuthLock: React.FC<AuthLockProps> = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState<AuthMode>('GATEWAY');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [initializing, setInitializing] = useState(true);
  const [lockoutTimeLeft, setLockoutTimeLeft] = useState<number>(0);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const session = await databaseService.getSession();
        if (session) {
          onAuthSuccess(session);
        } else {
          setInitializing(false);
        }
      } catch (err) {
        setInitializing(false);
      }
    };
    checkSession();
  }, [onAuthSuccess]);

  useEffect(() => {
    const timer = setInterval(() => {
      const vitals = databaseService.getSecurityVitals();
      if (vitals.lockedUntil) {
        const diff = Math.max(0, Math.ceil((vitals.lockedUntil - Date.now()) / 1000));
        setLockoutTimeLeft(diff);
      } else {
        setLockoutTimeLeft(0);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const isMasterEntry = useMemo(() => {
    return databaseService.isMaster(email);
  }, [email]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutTimeLeft > 0) return;
    setLoading(true);
    setError('');

    // Local Bypass for Master Identity if Database is slow/offline
    if (isMasterEntry && password === 'OMRAUT') {
       const masterUser: UserRecord = {
         id: 'master-bypass',
         name: 'Project Master',
         email: 'rautom508@gmail.com',
         phone: 'CORE',
         role: 'OWNER',
         provider: 'EMAIL',
         createdAt: Date.now()
       };
       onAuthSuccess(masterUser);
       return;
    }

    const result = await databaseService.login(email, password);
    if (result.user) {
      onAuthSuccess(result.user);
    } else {
      setError(result.error || 'Identity Access Refused.');
      setLoading(false);
    }
  };

  const handleMasterBypass = async () => {
    if (!isMasterEntry) return;
    setLoading(true);
    
    // Immediate Authority Fallback
    const masterUser: UserRecord = {
      id: 'master-bypass',
      name: 'Project Master',
      email: 'rautom508@gmail.com',
      phone: 'CORE',
      role: 'OWNER',
      provider: 'EMAIL',
      createdAt: Date.now()
    };
    
    setTimeout(() => {
      onAuthSuccess(masterUser);
    }, 500);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const result = await databaseService.register(name, email, phone, password, 'USER');
    if (result.success) {
      setMode('LOGIN');
      setError(`Node ${name} initialized. Authorize to sync.`);
    } else {
      setError(result.message);
    }
    setLoading(false);
  };

  if (initializing) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center space-y-8">
        <div className="relative">
          <div className="w-20 h-20 border-t-2 border-emerald-500 border-r-2 border-transparent rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl animate-pulse"></div>
          </div>
        </div>
        <div className="text-center space-y-2">
          <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.6em] animate-pulse">Neural Handshake</p>
          <p className="text-slate-600 font-mono text-[8px] uppercase tracking-widest">Protocol: AES-512-SYNC</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 selection:bg-emerald-500/30 overflow-hidden relative">
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-30">
        <div className={`absolute top-0 left-0 w-full h-full transition-all duration-1000 ${isMasterEntry ? 'bg-radial-gradient from-amber-500/10' : 'bg-radial-gradient from-emerald-500/5'} to-transparent`}></div>
      </div>

      <div className="w-full max-w-[480px] relative z-10 transition-all duration-700">
        <div className={`glass-panel rounded-[3.5rem] p-12 lg:p-16 border ${isMasterEntry ? 'border-amber-500/30 shadow-[0_50px_100px_rgba(217,119,6,0.2)]' : 'border-white/5 shadow-[0_50px_100px_rgba(0,0,0,0.6)]'} transition-all duration-1000`}>
          
          <div className="text-center mb-16">
            <div className={`w-24 h-24 transition-all duration-1000 rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 border shadow-2xl ${isMasterEntry ? 'bg-amber-500/10 border-amber-500/30' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
              <svg viewBox="0 0 100 100" className={`w-14 h-14 transition-all duration-700 ${isMasterEntry ? 'drop-shadow-[0_0_10px_#f59e0b]' : 'neon-brain-logo'}`}>
                <path d="M50 15 C30 15 15 30 15 50 C15 65 25 75 35 80 C40 85 45 85 50 85 C55 85 60 85 65 80 C75 75 85 65 85 50 C85 30 70 15 50 15 Z" fill="none" stroke={isMasterEntry ? '#f59e0b' : '#10b981'} strokeWidth="4" />
                <circle cx="50" cy="50" r="12" fill={isMasterEntry ? '#f59e0b' : '#10b981'} opacity="0.3" />
                {isMasterEntry && <path d="M50 35 L50 65 M35 50 L65 50" stroke="#f59e0b" strokeWidth="2" />}
              </svg>
            </div>
            <h1 className="text-white text-4xl font-black uppercase tracking-tighter mb-2">Authority</h1>
            <p className={`${isMasterEntry ? 'text-amber-500' : 'text-emerald-500'} text-[10px] font-black uppercase tracking-[0.5em] transition-colors`}>
              {mode === 'GATEWAY' ? 'Neural Infrastructure Gateway' : (isMasterEntry ? 'Master Node Detected' : 'Identity Access Terminal')}
            </p>
          </div>

          {mode === 'GATEWAY' ? (
            <div className="space-y-4 animate-fadeIn">
              <button onClick={() => setMode('LOGIN')} className="w-full py-6 bg-emerald-600 text-white font-black rounded-[2rem] uppercase tracking-[0.3em] text-[12px] shadow-[0_20px_40px_rgba(16,185,129,0.3)] hover:bg-emerald-500 transition-all active:scale-95">Enter Terminal</button>
              <button onClick={() => setMode('SIGNUP')} className="w-full py-6 bg-white/5 text-white border border-white/10 font-black rounded-[2rem] uppercase tracking-[0.3em] text-[12px] hover:bg-white/10 transition-all active:scale-95">Initialize Node</button>
            </div>
          ) : (
            <form onSubmit={mode === 'LOGIN' ? handleLogin : handleSignup} className="space-y-8 animate-in slide-in-from-bottom-4">
              {error && <div className={`p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-center border ${error.includes('Node') ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-rose-500/10 border-rose-500/20 text-rose-500'}`}>{error}</div>}
              
              <div className="space-y-6">
                {mode === 'SIGNUP' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Identity Name</label>
                    <input required type="text" placeholder="OM RAUT" value={name} onChange={e => setName(e.target.value)} className="w-full px-8 py-5 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-emerald-500 text-white font-bold transition-all" />
                  </div>
                )}
                <div className="space-y-2">
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Identity Link (Email)</label>
                    {isMasterEntry && <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest animate-pulse">Master Signature Match</span>}
                  </div>
                  <input required type="email" placeholder="IDENTITY@NODE.INT" value={email} onChange={e => setEmail(e.target.value)} className={`w-full px-8 py-5 bg-white/5 border rounded-2xl outline-none text-white font-bold transition-all ${isMasterEntry ? 'border-amber-500/50 shadow-[0_0_15px_rgba(217,119,6,0.1)]' : 'border-white/10 focus:border-emerald-500'}`} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Access Signature</label>
                  <input required type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className={`w-full px-8 py-5 bg-white/5 border rounded-2xl outline-none text-white font-bold transition-all ${isMasterEntry ? 'border-amber-500/20 focus:border-amber-500' : 'border-white/10 focus:border-emerald-500'}`} />
                </div>
              </div>

              <div className="space-y-4">
                <button type="submit" disabled={loading} className={`w-full py-6 font-black rounded-[2rem] uppercase tracking-[0.4em] text-[11px] shadow-2xl transition-all active:scale-95 ${isMasterEntry ? 'bg-amber-600 text-white' : 'bg-emerald-600 text-white'}`}>
                  {loading ? 'Authenticating...' : 'Authorize Access'}
                </button>
                {isMasterEntry && mode === 'LOGIN' && (
                  <button type="button" onClick={handleMasterBypass} className="w-full py-4 border border-amber-500/30 text-amber-500 font-black uppercase text-[10px] tracking-widest rounded-[2rem] hover:bg-amber-500/10 transition-all">
                    Neural Key Bypass
                  </button>
                )}
              </div>

              <div className="text-center pt-8 border-t border-white/5">
                <button type="button" onClick={() => { setMode(mode === 'LOGIN' ? 'SIGNUP' : 'LOGIN'); setError(''); }} className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-emerald-500 transition-colors">
                  {mode === 'LOGIN' ? "Require Registry Access?" : "Already Authorized?"} <span className={`${isMasterEntry ? 'text-amber-500' : 'text-emerald-500'}`}>Click Here</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthLock;
