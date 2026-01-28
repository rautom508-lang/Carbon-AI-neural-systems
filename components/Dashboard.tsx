
import React, { useMemo, useEffect, useState } from 'react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { CarbonPrediction, GlobalConfig } from '../types';
import { getNeuralForecast, MLForecast } from '../services/geminiService';

interface DashboardProps {
  history: CarbonPrediction[];
  config: GlobalConfig;
  isMaster?: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ history, config }) => {
  const [forecast, setForecast] = useState<MLForecast | null>(null);
  const [isPredicting, setIsPredicting] = useState(false);

  useEffect(() => {
    if (history.length > 0) {
      const runML = async () => {
        setIsPredicting(true);
        try {
          const res = await getNeuralForecast(history[history.length - 1], history.slice(0, -1));
          setForecast(res);
        } catch (e) {
          console.error("ML Forecast failed", e);
        }
        setIsPredicting(false);
      }
      runML();
    }
  }, [history.length]);

  // Priority: Display the most recent calculation. If none exists, display zeros.
  const latest = useMemo(() => {
    if (history.length > 0) {
      // Return the absolute latest prediction from the history array
      return history[history.length - 1];
    }
    return { scope1: 0, scope2: 0, scope3: 0, total: 0 };
  }, [history]);

  const chartData = useMemo(() => {
    return history.map(item => ({
      name: new Date(item.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      Total: item.total,
      fullTimestamp: item.timestamp
    })).sort((a, b) => a.fullTimestamp - b.fullTimestamp);
  }, [history]);

  const metrics = [
    { 
      label: 'AGGREGATED IMPACT', 
      val: latest.total, 
      color: 'emerald', 
      subLabel: 'KG CO2E', 
      icon: 'fa-earth-americas',
      accent: '#10b981'
    },
    { 
      label: 'DIRECT OPERATIONS', 
      val: latest.scope1, 
      color: 'blue', 
      subLabel: `X${config.s1_factor.toFixed(2)}`, 
      icon: 'fa-fire',
      accent: '#3b82f6'
    },
    { 
      label: 'ENERGY CONSUMPTION', 
      val: latest.scope2, 
      color: 'amber', 
      subLabel: `X${config.s2_factor.toFixed(2)}`, 
      icon: 'fa-bolt',
      accent: '#f59e0b'
    },
    { 
      label: 'VALUE CHAIN LOAD', 
      val: latest.scope3, 
      color: 'purple', 
      subLabel: `X${config.s3_factor.toFixed(2)}`, 
      icon: 'fa-link',
      accent: '#a855f7'
    }
  ];

  return (
    <div className="space-y-12 animate-fadeIn pb-24">
      {/* Neural Impact Grid - Exact Screenshot Replication */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((m, idx) => (
          <div key={idx} className="bg-[#0f172a]/60 backdrop-blur-2xl border border-white/5 p-10 rounded-[3rem] shadow-[0_40px_80px_rgba(0,0,0,0.4)] flex flex-col justify-between h-[420px] relative overflow-hidden group">
            
            {/* Top Label & Multiplier Section */}
            <div className="relative z-10">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <p className="text-[12px] font-black text-slate-500 uppercase tracking-[0.2em]">{m.label}</p>
                  <p className="text-[11px] font-black uppercase tracking-[0.3em]" style={{ color: m.accent }}>{m.subLabel}</p>
                </div>
                {/* Floating Translucent Icon Box */}
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-md shadow-inner transition-transform group-hover:scale-110">
                  <i className={`fas ${m.icon} text-lg`} style={{ color: m.accent }}></i>
                </div>
              </div>
            </div>

            {/* Large Real-time Value */}
            <div className="relative z-10 mb-6">
              <h3 className="text-8xl font-black text-white tabular-nums tracking-tighter leading-none">
                {m.val.toLocaleString()}
              </h3>
            </div>

            {/* Bottom Accent Progress Bar */}
            <div className="absolute bottom-10 left-10 right-10">
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(255,255,255,0.2)]" 
                  style={{ 
                    width: m.val > 0 ? '70%' : '10%',
                    backgroundColor: m.accent,
                    boxShadow: `0 0 20px ${m.accent}60`
                  }}
                ></div>
              </div>
            </div>

            {/* Background Branding Watermark */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03] group-hover:opacity-[0.06] transition-opacity duration-500">
               <i className={`fas ${m.icon} text-[220px] absolute -bottom-12 -right-12 rotate-12`}></i>
            </div>
          </div>
        ))}
      </div>

      {/* Trajectory & System Diagnostics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 bg-[#0f172a]/80 border border-white/5 p-12 md:p-16 rounded-[4rem] h-[600px] shadow-2xl relative overflow-hidden">
           <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-16 gap-6">
              <div>
                <h4 className="text-3xl font-black text-white tracking-tighter uppercase leading-none">Longitudinal Trajectory</h4>
                <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.5em] mt-3">Neural Persistence Protocol: SYNCED</p>
              </div>
              <div className="px-6 py-3 bg-white/5 rounded-2xl border border-white/10 flex items-center gap-4">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Active Link</span>
              </div>
           </div>
           
           <div className="w-full h-2/3">
             <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                     <linearGradient id="colorImpact" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                     </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="name" axisLine={false} tick={{fontSize: 10, fontWeight: 900, fill: '#475569', letterSpacing: '0.1em'}} dy={10} />
                  <YAxis hide />
                  <Tooltip 
                    contentStyle={{backgroundColor: '#020617', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '2rem', padding: '1.5rem', boxShadow: '0 25px 50px rgba(0,0,0,0.8)'}} 
                    itemStyle={{color: '#10b981', fontWeight: '900', textTransform: 'uppercase', fontSize: '11px'}}
                  />
                  <Area type="monotone" dataKey="Total" stroke="#10b981" fill="url(#colorImpact)" strokeWidth={4} />
                </AreaChart>
             </ResponsiveContainer>
           </div>
        </div>

        <div className="lg:col-span-4 bg-[#0f172a]/80 border border-white/5 p-12 rounded-[4rem] shadow-2xl flex flex-col justify-between">
            <div>
              <h4 className="text-2xl font-black text-white uppercase tracking-tight mb-12">Calibration Node</h4>
              <div className="space-y-6">
                {[
                  { label: 'S1 Multiplier', val: `${config.s1_factor.toFixed(2)}x`, color: 'blue' },
                  { label: 'S2 Grid Coeff', val: `${config.s2_factor.toFixed(2)}x`, color: 'amber' },
                  { label: 'S3 Value Link', val: `${config.s3_factor.toFixed(2)}x`, color: 'purple' },
                  { label: 'Total Samples', val: history.length, color: 'emerald' },
                  { label: 'Neural Status', val: 'HEALTHY', color: 'emerald' }
                ].map((d, i) => (
                  <div key={i} className="flex justify-between items-center border-b border-white/5 pb-4">
                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{d.label}</span>
                    <span className={`text-[11px] font-black text-${d.color}-500 uppercase tracking-widest`}>{d.val}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="mt-16 p-8 bg-white/5 border border-white/10 rounded-[2.5rem] relative group overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10"><i className="fas fa-microchip text-4xl"></i></div>
              <p className="text-[12px] text-slate-400 leading-relaxed font-bold italic mb-4">
                "Instant synchronization protocol is active. Data generated in the Profiler is automatically locked to your unique Node ID."
              </p>
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500"><i className="fas fa-cloud-check text-xs"></i></div>
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Supabase Persistence: Locked</span>
              </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
