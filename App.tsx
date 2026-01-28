
import React, { useState, useEffect } from 'react';
import { AppView, CarbonPrediction, GlobalConfig, UserRecord } from './types';
import Dashboard from './components/Dashboard';
import ScopeForms from './components/ScopeForms';
import AIReport from './components/AIReport';
import AuthLock from './components/AuthLock';
import WhatIfSandbox from './components/WhatIfSandbox';
import MapsView from './components/MapsView';
import VisionScanner from './components/VisionScanner';
import AuthorityConsole from './components/AuthorityConsole';
import ProfileView from './components/ProfileView';
import { databaseService, supabase } from './services/databaseService';

const MASTER_EMAIL = 'rautom508@gmail.com';
const PROJECT_NUMBER = '1084459329478';

const NeonBrainIcon = ({ className = "w-8 h-8" }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={`neon-brain-logo ${className}`} xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="neonGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{ stopColor: '#10b981', stopOpacity: 1 }} />
        <stop offset="100%" style={{ stopColor: '#3b82f6', stopOpacity: 1 }} />
      </linearGradient>
    </defs>
    <path 
      d="M50 15 C30 15 15 30 15 50 C15 65 25 75 35 80 C40 85 45 85 50 85 C55 85 60 85 65 80 C75 75 85 65 85 50 C85 30 70 15 50 15 Z" 
      fill="none" 
      stroke="url(#neonGradient)" 
      strokeWidth="4" 
    />
    <path d="M50 25 V75 M30 50 H70 M35 35 L65 65 M35 65 L65 35" stroke="url(#neonGradient)" strokeWidth="3" opacity="0.8" />
    <circle cx="50" cy="50" r="8" fill="url(#neonGradient)" />
  </svg>
);

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>('LOCKED');
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(null);
  const [history, setHistory] = useState<CarbonPrediction[]>([]);
  const [activePrediction, setActivePrediction] = useState<CarbonPrediction | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [isSystemOverridden, setIsSystemOverridden] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [globalConfig, setGlobalConfig] = useState<GlobalConfig>({
    s1_factor: 2.31,
    s2_factor: 0.82,
    s3_factor: 0.15,
    projectNumber: PROJECT_NUMBER
  });

  const fetchHistory = async (userId?: string) => {
    try {
      const data = await databaseService.getHistory(userId);
      setHistory(data);
    } catch (err) {
      console.warn("History fetch failed, using local fallback");
    }
  };

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      // Safety timeout: If DB doesn't respond in 3s, force unlock to Gateway
      const timeout = setTimeout(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      }, 3000);

      try {
        const user = await databaseService.getSession();
        if (user && isMounted) {
          setCurrentUser(user);
          setCurrentView('DASHBOARD');
          // Fetch history in background
          fetchHistory(user.id);
        }
      } catch (err) {
        console.error("Initialization error:", err);
      } finally {
        if (isMounted) {
          clearTimeout(timeout);
          setIsLoading(false);
        }
      }
    };

    initialize();
    const timer = setInterval(() => {
      if (isMounted) setCurrentTime(new Date());
    }, 1000);

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session && isMounted) {
        const user = await databaseService.getSession();
        if (user) {
          setCurrentUser(user);
          setCurrentView('DASHBOARD');
          fetchHistory(user.id);
        }
      } else if (event === 'SIGNED_OUT' && isMounted) {
        setCurrentUser(null);
        setCurrentView('LOCKED');
        setHistory([]);
      }
    });

    return () => {
      isMounted = false;
      clearInterval(timer);
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Handlers for authentication and navigation
  const handleAuthSuccess = (user: UserRecord) => {
    setCurrentUser(user);
    setCurrentView('DASHBOARD');
    fetchHistory(user.id);
  };

  const handleLogout = async () => {
    await databaseService.logout();
    setCurrentUser(null);
    setCurrentView('LOCKED');
    setHistory([]);
  };

  const handleCompleteAudit = async (prediction: CarbonPrediction) => {
    setActivePrediction(prediction);
    await databaseService.saveHistory(prediction);
    await fetchHistory(currentUser?.id);
    setCurrentView('AI_REPORT');
  };

  const handleScanComplete = async (prediction: CarbonPrediction) => {
    await databaseService.saveHistory(prediction);
    await fetchHistory(currentUser?.id);
    setActivePrediction(prediction);
    setCurrentView('AI_REPORT');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="text-center space-y-4">
          <NeonBrainIcon className="w-20 h-20 animate-pulse mx-auto" />
          <p className="text-emerald-500 font-black uppercase tracking-[0.5em] text-[10px] animate-pulse">Syncing Hub...</p>
        </div>
      </div>
    );
  }

  if (currentView === 'LOCKED') {
    return <AuthLock onAuthSuccess={handleAuthSuccess} />;
  }

  const isOwner = currentUser?.role === 'OWNER';

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-emerald-500/30">
      {/* Sidebar Navigation */}
      <aside className={`fixed top-0 left-0 h-full w-80 bg-[#0f172a] border-r border-white/5 z-[200] transform transition-transform duration-500 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="flex flex-col h-full p-10">
          <div className="flex items-center gap-4 mb-16 px-2">
            <NeonBrainIcon className="w-10 h-10" />
            <div>
              <h1 className="text-xl font-black text-white tracking-tighter uppercase leading-none">CarbonSense</h1>
              <p className="text-[8px] font-black text-emerald-500 uppercase tracking-[0.3em] mt-1">Neural Core V2.0</p>
            </div>
          </div>

          <nav className="flex-grow space-y-2">
            {[
              { id: 'DASHBOARD', icon: 'fa-chart-pie', label: 'Impact Grid' },
              { id: 'SCOPE_INPUT', icon: 'fa-fingerprint', label: 'Profiler' },
              { id: 'VISION', icon: 'fa-eye', label: 'Audit Vision' },
              { id: 'SANDBOX', icon: 'fa-brain-circuit', label: 'Sandbox' },
              { id: 'MAPS', icon: 'fa-earth-asia', label: 'Geospatial' },
              { id: 'AI_REPORT', icon: 'fa-microchip-ai', label: 'Neural Report', disabled: !activePrediction && history.length === 0 },
              { id: 'PROFILE', icon: 'fa-user-gear', label: 'Registry' }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => { setCurrentView(item.id as AppView); setIsSidebarOpen(false); }}
                disabled={item.disabled}
                className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${currentView === item.id ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'text-slate-500 hover:bg-white/5 hover:text-white disabled:opacity-30'}`}
              >
                <i className={`fas ${item.icon} w-5`}></i>
                {item.label}
              </button>
            ))}
            
            {isOwner && (
              <button
                onClick={() => { setCurrentView('AUTHORITY'); setIsSidebarOpen(false); }}
                className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all mt-8 ${currentView === 'AUTHORITY' ? 'bg-amber-600 text-white shadow-lg' : 'text-amber-500/60 hover:bg-amber-500/10 hover:text-amber-500'}`}
              >
                <i className="fas fa-crown w-5"></i>
                Authority
              </button>
            )}
          </nav>

          <div className="pt-10 border-t border-white/5 space-y-6">
            <div className="px-6 py-4 bg-white/5 rounded-2xl border border-white/5">
              <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Active Identity</p>
              <p className="text-[10px] font-black text-white uppercase truncate">{currentUser?.name}</p>
            </div>
            <button onClick={handleLogout} className="w-full flex items-center gap-4 px-6 py-4 text-slate-500 hover:text-rose-500 text-[10px] font-black uppercase tracking-widest transition-all">
              <i className="fas fa-power-off w-5"></i>
              Terminate
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="lg:pl-80 min-h-screen">
        <header className="sticky top-0 z-[100] bg-[#020617]/80 backdrop-blur-xl border-b border-white/5 px-6 lg:px-12 py-6">
          <div className="flex justify-between items-center max-w-7xl mx-auto">
            <div className="flex items-center gap-6">
              <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden text-slate-400 p-2"><i className="fas fa-bars-staggered text-xl"></i></button>
              <div className="hidden sm:block">
                <p className="text-[9px] font-black text-emerald-500 uppercase tracking-[0.4em] mb-1">Terminal Status: Online</p>
                <h2 className="text-white text-xs font-black uppercase tracking-widest">{currentView.replace('_', ' ')}</h2>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right hidden md:block">
                <p className="text-white text-[10px] font-black tabular-nums">{currentTime.toLocaleTimeString()}</p>
                <p className="text-slate-500 text-[8px] font-black uppercase tracking-widest">{currentTime.toLocaleDateString()}</p>
              </div>
              <div className="h-10 w-[1px] bg-white/5 hidden md:block"></div>
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-emerald-500">
                <i className="fas fa-signal-stream animate-pulse"></i>
              </div>
            </div>
          </div>
        </header>

        <div className="p-6 lg:p-12 max-w-7xl mx-auto h-[calc(100vh-80px)] overflow-y-auto scrollbar-hide">
          {currentView === 'DASHBOARD' && <Dashboard history={history} config={globalConfig} />}
          {currentView === 'SCOPE_INPUT' && <ScopeForms userId={currentUser?.id || ''} factors={globalConfig} onComplete={handleCompleteAudit} />}
          {currentView === 'AI_REPORT' && (activePrediction || history.length > 0) && <AIReport prediction={activePrediction || history[history.length-1]} history={history} />}
          {currentView === 'SANDBOX' && <WhatIfSandbox history={history} />}
          {currentView === 'MAPS' && <MapsView />}
          {currentView === 'VISION' && <VisionScanner userId={currentUser?.id || ''} onScanComplete={handleScanComplete} userEmail={currentUser?.email || ''} isOverridden={isSystemOverridden} setIsOverridden={setIsSystemOverridden} />}
          {currentView === 'AUTHORITY' && isOwner && <AuthorityConsole config={globalConfig} setConfig={setGlobalConfig} history={history} isOwner={isOwner} isOverridden={isSystemOverridden} setIsOverridden={setIsSystemOverridden} />}
          {currentView === 'PROFILE' && <ProfileView user={currentUser!} history={history} onUpdate={setCurrentUser} config={globalConfig} setConfig={setGlobalConfig} />}
        </div>
      </main>
    </div>
  );
};

export default App;
