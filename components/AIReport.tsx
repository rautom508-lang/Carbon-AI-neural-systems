
import React, { useState, useEffect } from 'react';
import { CarbonPrediction } from '../types';
import { getCarbonInsights } from '../services/geminiService';

// Added theme to AIReportProps to fix TypeScript error in App.tsx
interface AIReportProps {
  prediction: CarbonPrediction;
  history: CarbonPrediction[];
  theme?: 'dark' | 'light';
}

// Added theme to destructuring and set default value
const AIReport: React.FC<AIReportProps> = ({ prediction, history, theme = 'dark' }) => {
  const [insights, setInsights] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInsights = async () => {
      setLoading(true);
      const res = await getCarbonInsights(prediction, history);
      setInsights(res);
      setLoading(false);
    };
    fetchInsights();
  }, [prediction, history]);

  const handleExportData = () => {
    const exportPayload = {
      reportDate: new Date().toISOString(),
      prediction: {
        timestamp: new Date(prediction.timestamp).toISOString(),
        scope1_kgCO2e: prediction.scope1,
        scope2_kgCO2e: prediction.scope2,
        scope3_kgCO2e: prediction.scope3,
        total_kgCO2e: prediction.total,
      },
      aiInsights: insights,
      historicalContextSize: history.length
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `CarbonSense_Report_${prediction.timestamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto animate-fadeIn pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase rounded">Verified Analytics</span>
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-black uppercase rounded">N= {history.length} Data Points</span>
          </div>
          <h2 className={`text-3xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>AI Strategy Terminal</h2>
          <p className="text-slate-500 mt-1 font-medium">Comparative longitudinal analysis via Gemini Engine</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button 
            className={`px-6 py-3 border rounded-2xl font-bold transition flex items-center justify-center gap-3 shadow-sm active:scale-95 ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}
            onClick={handleExportData}
            title="Download structured JSON data"
          >
            <i className="fas fa-file-code text-emerald-600"></i> Export Data
          </button>
          <button 
            className={`px-6 py-3 border rounded-2xl font-bold transition flex items-center justify-center gap-3 shadow-sm active:scale-95 ${theme === 'dark' ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}
            onClick={() => window.print()}
          >
            <i className="fas fa-file-pdf text-rose-500"></i> Export Audit
          </button>
        </div>
      </div>

      <div className="space-y-8">
        <div className={`rounded-[2.5rem] p-10 shadow-2xl border overflow-hidden relative ${theme === 'dark' ? 'bg-slate-900 border-white/5 shadow-slate-900/50' : 'bg-white border-slate-100 shadow-slate-200/50'}`}>
          <div className={`flex items-center gap-6 mb-10 border-b pb-8 ${theme === 'dark' ? 'border-white/5' : 'border-slate-50'}`}>
            <div className="w-16 h-16 bg-emerald-600 rounded-3xl flex items-center justify-center text-white text-2xl shadow-lg shadow-emerald-200">
              <i className="fas fa-chart-line-up"></i>
            </div>
            <div>
              <h3 className={`text-2xl font-black ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>Intelligence Briefing</h3>
              <p className="text-sm text-slate-400 font-medium">Session Timestamp: {new Date(prediction.timestamp).toLocaleString()}</p>
            </div>
          </div>

          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-emerald-50 border-t-emerald-600 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <i className="fas fa-brain text-emerald-600 text-xs animate-pulse"></i>
                </div>
              </div>
              <p className={`mt-6 font-bold text-lg ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>Synthesizing Historical Trends...</p>
              <p className="text-slate-400 text-sm mt-1">Comparing {history.length} snapshots for predictive modeling</p>
            </div>
          ) : (
            <div className={`prose max-w-none prose-headings:font-black prose-p:text-slate-600 prose-strong:text-emerald-700 ${theme === 'dark' ? 'prose-invert prose-slate' : 'prose-slate'}`}>
              <div className={`whitespace-pre-wrap leading-relaxed font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                {insights}
              </div>
            </div>
          )}
        </div>

        {!loading && (
          <div className={`rounded-[2.5rem] p-10 shadow-2xl border ${theme === 'dark' ? 'bg-slate-900 border-white/5 shadow-slate-900/50' : 'bg-white border-slate-100 shadow-slate-200/50'}`}>
            <div className="flex items-center gap-3 mb-6">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${theme === 'dark' ? 'bg-white/5 text-amber-500' : 'bg-amber-50 text-amber-600'}`}>
                <i className="fas fa-bolt-lightning"></i>
              </div>
              <h4 className={`font-black text-lg ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>Immediate Mitigation Roadmap</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className={`p-6 rounded-[2rem] border transition-colors group ${theme === 'dark' ? 'bg-white/5 border-white/10 hover:border-emerald-500/30' : 'bg-slate-50 border-slate-100 hover:border-emerald-200'}`}>
                <div className="flex justify-between items-start mb-4">
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full">Low Complexity</p>
                  <i className="fas fa-circle-check text-slate-200 group-hover:text-emerald-500 transition-colors"></i>
                </div>
                <p className={`font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>Scope 2 Optimization</p>
                <p className={`text-sm leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Immediately procure I-RECs (International Renewable Energy Certificates) to offset electricity-based emissions.</p>
              </div>
              <div className={`p-6 rounded-[2rem] border transition-colors group ${theme === 'dark' ? 'bg-white/5 border-white/10 hover:border-blue-500/30' : 'bg-slate-50 border-slate-100 hover:border-blue-200'}`}>
                <div className="flex justify-between items-start mb-4">
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full">Strategic Priority</p>
                  <i className="fas fa-circle-check text-slate-200 group-hover:text-blue-500 transition-colors"></i>
                </div>
                <p className={`font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>Supply Chain Vetting</p>
                <p className={`text-sm leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Implement mandatory emission reporting for Tier 1 suppliers to address the Scope 3 trends analyzed.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIReport;
