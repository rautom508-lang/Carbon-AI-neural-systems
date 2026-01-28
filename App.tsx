
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
    const initialize = async () => {
      // Safety timeout: If DB doesn't respond in 4s, force unlock to Gateway
      const timeout = setTimeout(() => {
        if (isLoading) {
          console.warn("Neural sync timeout. Forcing gateway access.");
          setIsLoading(false);
        }
      }, 4000);

      try {
        const user = await databaseService.getSession();
        if (user) {
          setCurrentUser(user);
          setCurrentView('DASHBOARD');
          await fetchHistory(user.id);
        }
      } catch (err) {
        console.error("Initialization error:", err);
      } finally {
        clearTimeout(timeout);
        setIsLoading(false);
      }
    };

    initialize();
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        const user = await databaseService.getSession();
        if (user) {
          setCurrentUser(user);
          setCurrentView('DASHBOARD');
          await fetchHistory(user.id);
        }
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setCurrentView('LOCKED');
        setHistory([]);
      }
    });

    return () => {
      clearInterval(timer);
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase
      .channel('emissions_sync')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'emissions',
        filter: `user_id=eq.${currentUser.id}`
      }, () => {
        fetchHistory(currentUser.id);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id]);

  const handleLogout = async () => {
    await databaseService.logout();
    setCurrentUser(null);
    setCurrentView('LOCKED');
    setIsSidebarOpen(false);
  };

  const handleAuthSuccess = async (user: UserRecord) => {
    setCurrentUser(user);
    setCurrentView('DASHBOARD');
    await fetchHistory(user.id);
  };

  const handleNewPrediction = async (p: CarbonPrediction) => {
    const userId = currentUser?.id || 'anonymous';
    const updated = { ...p, userId: userId };
    
    setHistory(prev => [...prev, updated]);
    setActivePrediction(updated);
    setCurrentView('AI_REPORT');
    
    try {
      await databaseService.saveHistory(updated);
      if (currentUser) {
        await databaseService.logActivity(
          currentUser.id, 
          currentUser.name, 
          "EMISSION_SYNCED", 
          `Impact updated: ${p.total}kg CO2e detected.`
        );
      }
    } catch (err) {
      console.error("Database sync failed", err);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-10 text-center">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-emerald-500/10 border-t-emerald-500 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
             <i className="fas fa-brain text-emerald-500 text-xs animate-pulse"></i>
          </div>
        </div>
        <p className="text-emerald-500 font-black tracking-[0.5em] uppercase text-[11px] mt-10 animate-pulse">Syncing Neural Terminal...</p>
        <p className="text-slate-600 font-mono text-[8px] mt-4 uppercase tracking-widest">Protocol: AES-512-V2 | Project: {PROJECT_NUMBER}</p>
      </div>
    );
  }

  if (currentView === 'LOCKED') {
    return <AuthLock onAuthSuccess={handleAuthSuccess} />;
  }

  const isMaster = databaseService.isMaster(currentUser?.email);

  const navItems = [
    { view: 'DASHBOARD' as AppView, label: 'Neural Hub', icon: 'fa-brain-circuit', isBrain: true }, 
    { view: 'SCOPE_INPUT' as AppView, label: 'Profiler', icon: 'fa-calculator' },
    { view: 'VISION' as AppView, label: 'Audit Vision', icon: 'fa-eye' },
    { view: 'SANDBOX' as AppView, label: 'Strategic Lab', icon: 'fa-leaf' },
    { view: 'MAPS' as AppView, label: 'Geospatial', icon: 'fa-globe-americas' },
    { view: 'PROFILE' as AppView, label: 'Identity Node', icon: 'fa-user' },
    { view: 'AUTHORITY' as AppView, label: 'Command Center', icon: 'fa-shield-halved', restricted: true },
  ];

  const handleNavClick = (view: AppView) => {
    setCurrentView(view);
    setIsSidebarOpen(false);
  };

  return (
    <div className={`min-h-screen flex flex-col lg:flex-row bg-[#020617] font-sans selection:bg-emerald-500/30 ${isSystemOverridden ? 'border-4 border-amber-500/20' : ''}`}>
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[190] lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside className={`
        fixed inset-y-0 left-0 w-80 bg-[#020617] border-r border-white/5 flex flex-col h-screen z-[200] transition-transform duration-500 ease-in-out
        lg:sticky lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-10 lg:p-12 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className={`w-12 h-12 lg:w-14 lg:h-14 ${isSystemOverridden ? 'bg-amber-600' : 'bg-emerald-600'} rounded-[1.25rem] flex items-center justify-center text-white text-2xl lg:text-3xl shadow-[0_20px_40px_rgba(16,185,129,0.3)]`}>
              <i className={`fas ${isSystemOverridden ? 'fa-bolt' : 'fa-leaf'}`}></i>
            </div>
            <div>
              <span className="text-2xl lg:text-3xl font-black text-white tracking-tighter uppercase leading-none">CarbonAI</span>
              <p className={`text-[9px] lg:text-[10px] ${isSystemOverridden ? 'text-amber-500' : 'text-emerald-500'} font-black tracking-[0.4em] uppercase mt-1`}>Terminal</p>
            </div>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden text-slate-500 hover:text-white transition-colors"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>
        
        <nav className="flex-grow mt-6 lg:mt-10 px-6 space-y-2 lg:space-y-3 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            if (item.restricted && !isMaster) return null;
            const isActive = currentView === item.view;
            return (
              <button 
                key={item.view}
                onClick={() => handleNavClick(item.view)}
                className={`w-full flex items-center gap-5 p-4 lg:p-5 rounded-2xl transition-all group border ${
                  isActive ? 'nav-active-box text-white' : 'border-transparent text-slate-500 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="w-8 flex justify-center items-center">
                  {item.isBrain ? (
                    <NeonBrainIcon className="w-7 h-7" />
                  ) : (
                    <i className={`fas ${item.icon} text-lg lg:text-xl ${isActive ? (isSystemOverridden ? 'text-amber-400' : 'text-emerald-400') : 'text-slate-500 group-hover:text-white'}`}></i>
                  )}
                </div>
                <span className={`font-black text-[11px] lg:text-[12px] tracking-widest uppercase ${isActive ? 'text-white' : 'text-slate-500'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="p-8 lg:p-10 border-t border-white/5">
          <div className="mb-6 lg:mb-8 p-5 lg:p-6 glass-panel rounded-3xl border border-white/5">
             <div className="flex items-center gap-3 mb-4">
                <div className={`w-2.5 h-2.5 lg:w-3 lg:h-3 rounded-full ${isMaster ? 'bg-amber-500 shadow-[0_0_10px_#f59e0b]' : 'bg-emerald-500 shadow-[0_0_10px_#10b981]'}`}></div>
                <p className="text-[9px] lg:text-[10px] font-black text-slate-500 uppercase tracking-widest">{isMaster ? 'Master Node' : 'Registry Status'}</p>
             </div>
             <p className="text-xs lg:text-sm font-black text-white truncate mb-1 lg:mb-2">{isMaster ? 'NODE_PRIME' : currentUser?.name}</p>
             <p className="text-[9px] lg:text-[10px] font-mono text-slate-500 truncate mb-4">{isMaster ? 'AUTH_VERIFIED' : 'SESSION_ACTIVE'}</p>
             <span className={`text-[8px] lg:text-[9px] font-black ${isSystemOverridden ? 'text-amber-500 border-amber-500/20 bg-amber-500/10' : 'text-emerald-500 border-emerald-500/20 bg-emerald-500/10'} uppercase tracking-[0.2em] px-3 py-1 rounded-full border`}>{isMaster ? 'OWNER' : currentUser?.role}</span>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-4 py-4 lg:py-5 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-[1.5rem] transition-all font-black uppercase tracking-[0.3em] text-[10px] lg:text-[11px] shadow-2xl active:scale-95">
            <i className="fas fa-power-off"></i>
            Purge Session
          </button>
        </div>
      </aside>

      <main className="flex-grow flex flex-col min-h-screen">
        <header className="h-24 lg:h-32 bg-[#020617] border-b border-white/5 flex items-center justify-between px-6 lg:px-16 sticky top-0 z-[150] backdrop-blur-3xl">
          <div className="flex items-center gap-6 lg:gap-10">
             <button 
               onClick={() => setIsSidebarOpen(true)}
               className="lg:hidden w-12 h-12 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-white"
             >
               <i className="fas fa-bars"></i>
             </button>

             <div className="hidden sm:flex w-12 h-12 lg:w-16 lg:h-16 header-icon-box rounded-[1.25rem] lg:rounded-[1.5rem] shadow-2xl items-center justify-center">
               <NeonBrainIcon className="w-8 h-8 lg:w-10 lg:h-10" />
             </div>
             <div>
                <div className="flex items-center gap-3 mb-1">
                   <div className={`w-1.5 h-1.5 lg:w-2 lg:h-2 ${isSystemOverridden ? 'bg-amber-500 shadow-[0_0_8px_#f59e0b]' : 'bg-emerald-500 shadow-[0_0_8px_#10b981]'} rounded-full animate-pulse`}></div>
                   <h2 className={`text-[9px] lg:text-[11px] font-black ${isSystemOverridden ? 'text-amber-500' : 'text-emerald-500'} uppercase tracking-[0.4em]`}>Terminal Sync: {isSystemOverridden ? 'OVERRIDDEN' : 'Nominal'}</h2>
                </div>
                <p className="text-white font-black text-2xl lg:text-4xl tracking-tighter uppercase leading-none">
                   {currentView.replace('_', ' ')}
                </p>
             </div>
          </div>

          <div className="hidden md:flex items-center gap-16">
            <div className="text-right">
              <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.4em] mb-2">Neural Link Synchronization</p>
              <div className="flex items-center gap-6 text-white font-black">
                 <span className="text-lg tracking-tighter">{currentTime.toLocaleDateString()}</span>
                 <div className="w-px h-6 bg-white/10"></div>
                 <span className={`${isSystemOverridden ? 'text-amber-500' : 'text-emerald-500'} text-lg tracking-tighter text-neural`}>{currentTime.toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
        </header>

        <section className="flex-grow p-6 lg:p-16 overflow-y-auto custom-scrollbar">
          <div className="max-w-7xl mx-auto h-full">
            {currentView === 'DASHBOARD' && <Dashboard history={history} config={globalConfig} isMaster={isMaster} />}
            {currentView === 'SCOPE_INPUT' && <ScopeForms onComplete={handleNewPrediction} userId={currentUser?.id || 'anonymous'} factors={globalConfig} />}
            {currentView === 'AI_REPORT' && activePrediction && <AIReport prediction={activePrediction} history={history} />}
            {currentView === 'SANDBOX' && <WhatIfSandbox history={history} />}
            {currentView === 'MAPS' && <MapsView />}
            {currentView === 'VISION' && (
              <VisionScanner 
                onScanComplete={handleNewPrediction} 
                userId={currentUser?.id || 'anonymous'} 
                isOverridden={isSystemOverridden}
                setIsOverridden={setIsSystemOverridden}
                userEmail={currentUser?.email || ''}
              />
            )}
            {currentView === 'AUTHORITY' && isMaster && (
              <AuthorityConsole 
                config={globalConfig} 
                setConfig={setGlobalConfig} 
                history={history} 
                isOwner={isMaster} 
                isOverridden={isSystemOverridden}
                setIsOverridden={setIsSystemOverridden}
              />
            )}
            {currentView === 'PROFILE' && currentUser && (
              <ProfileView 
                user={currentUser} 
                history={history} 
                onUpdate={setCurrentUser}
                config={globalConfig}
                setConfig={setGlobalConfig}
              />
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;
