
import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from 'recharts';
import { getWhatIfSimulation } from '../services/geminiService';
import { CarbonPrediction } from '../types';

// Updated Slider to support theme
const Slider = ({ label, value, onChange, color, theme }: any) => (
  <div className={`space-y-4 p-6 rounded-3xl border shadow-sm ${theme === 'dark' ? 'bg-slate-900 border-white/5' : 'bg-white border-slate-100'}`}>
    <div className="flex justify-between items-center">
      <span className="text-xs font-black text-slate-500 uppercase tracking-widest">{label}</span>
      <span className={`text-lg font-black text-${color}-600`}>{value}%</span>
    </div>
    <input 
      type="range" 
      min="0" 
      max="100" 
      value={value} 
      onChange={(e) => onChange(parseInt(e.target.value))}
      className={`w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-${color}-600`}
    />
  </div>
);

// Added theme to props type and destructuring to fix TypeScript error in App.tsx
const WhatIfSandbox: React.FC<{ history: CarbonPrediction[]; theme?: 'dark' | 'light' }> = ({ history, theme = 'dark' }) => {
  const [vars, setVars] = useState({ evTransition: 20, renewableEnergy: 15, remoteWork: 30 });
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runSim = async () => {
    if (history.length === 0) return;
    setLoading(true);
    const result = await getWhatIfSimulation(history[history.length - 1], vars);
    setData(result);
    setLoading(false);
  };

  useEffect(() => { runSim(); }, []);

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className={`text-3xl font-black tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>Strategic Sandbox</h2>
          <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mt-1">Simulate Neural Pathways to Net Zero</p>
        </div>
        <button onClick={runSim} className="px-8 py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-xl shadow-emerald-600/20 hover:scale-105 transition-all uppercase tracking-widest text-xs">
          {loading ? <i className="fas fa-sync fa-spin"></i> : "Recalculate Future"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Slider label="EV Transition" value={vars.evTransition} onChange={(v:any) => setVars({...vars, evTransition: v})} color="blue" theme={theme} />
        <Slider label="Renewable Adoption" value={vars.renewableEnergy} onChange={(v:any) => setVars({...vars, renewableEnergy: v})} color="emerald" theme={theme} />
        <Slider label="Remote Work Policy" value={vars.remoteWork} onChange={(v:any) => setVars({...vars, remoteWork: v})} color="purple" theme={theme} />
      </div>

      <div className={`p-10 rounded-[3rem] shadow-sm border min-h-[500px] ${theme === 'dark' ? 'bg-slate-900 border-white/5' : 'bg-white border-slate-100'}`}>
        {data ? (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-12">
            <div className="xl:col-span-2 h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.projectedPath}>
                  <defs>
                    <linearGradient id="opti" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? "#1e293b" : "#f1f5f9"} />
                  <XAxis dataKey="year" axisLine={false} tick={{fontSize: 10, fontWeight: 800, fill: theme === 'dark' ? '#64748b' : '#94a3b8'}} />
                  <YAxis axisLine={false} tick={{fontSize: 10, fontWeight: 800, fill: theme === 'dark' ? '#64748b' : '#94a3b8'}} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', backgroundColor: theme === 'dark' ? '#0f172a' : '#fff' }} 
                    itemStyle={{ color: theme === 'dark' ? '#fff' : '#000' }}
                  />
                  <Area type="monotone" dataKey="currentTrajectory" stroke="#64748b" fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
                  <Area type="monotone" dataKey="optimizedTrajectory" stroke="#10b981" fill="url(#opti)" strokeWidth={4} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-6">
              <div className={`p-6 rounded-3xl ${theme === 'dark' ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
                <h4 className={`font-black uppercase text-[10px] tracking-widest mb-4 ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-900'}`}>Neural Impact Summary</h4>
                <p className={`text-sm font-medium leading-relaxed ${theme === 'dark' ? 'text-emerald-300' : 'text-emerald-700'}`}>{data.summary}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className={`p-6 rounded-3xl ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-50'}`}>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Savings</p>
                  <p className={`text-2xl font-black tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>14.2%</p>
                </div>
                <div className={`p-6 rounded-3xl ${theme === 'dark' ? 'bg-white/5' : 'bg-slate-50'}`}>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">ROI Score</p>
                  <p className={`text-2xl font-black tracking-tighter ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>High</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-[400px] flex items-center justify-center text-slate-300">
             <div className="text-center space-y-4">
                <i className="fas fa-brain-circuit text-5xl animate-pulse"></i>
                <p className="text-xs font-black uppercase tracking-[0.2em]">Ready for simulation</p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WhatIfSandbox;
