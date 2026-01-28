
import React, { useState, useEffect } from 'react';
import { getLocationSustainability } from '../services/geminiService';

const MapsView: React.FC<{ theme?: 'dark' | 'light' }> = ({ theme = 'dark' }) => {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState<{lat: number, lng: number} | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.warn("Geolocation denied", err)
      );
    }
  }, []);

  const analyze = async () => {
    if (!query) return;
    setLoading(true);
    try {
      const res = await getLocationSustainability(query, coords || undefined);
      setResult(res);
    } catch (err) {
      console.error("Geospatial analysis failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-24">
      <div className={`p-10 rounded-[3rem] shadow-2xl relative overflow-hidden transition-all duration-700 ${theme === 'dark' ? 'bg-slate-900 border border-white/5 shadow-black/60' : 'bg-slate-900 shadow-emerald-950/20'}`}>
        <div className="absolute top-0 right-0 p-12 opacity-10">
          <i className="fas fa-satellite-dish text-9xl text-emerald-400"></i>
        </div>
        
        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-3 mb-4">
             <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_#10b981]"></div>
             <p className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.4em]">Grounding Protocol: Maps-Linked</p>
          </div>
          <h2 className="text-white text-3xl font-black tracking-tight uppercase">Geospatial Intelligence</h2>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mt-2 mb-10">Facility Contact & Neural Impact Audit</p>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <input 
              type="text" 
              placeholder="Enter City, State, or Facility Name..." 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && analyze()}
              className="flex-grow bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-slate-600 outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all font-bold"
            />
            <button 
              onClick={analyze} 
              disabled={loading || !query}
              className={`px-10 py-4 bg-emerald-600 text-white font-black rounded-2xl transition-all shadow-xl shadow-emerald-950/20 uppercase tracking-widest text-xs disabled:opacity-50 active:scale-95`}
            >
              {loading ? <i className="fas fa-satellite fa-spin mr-2"></i> : <i className="fas fa-magnifying-glass-location mr-2"></i>}
              {loading ? "Querying..." : "Scan Environment"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className={`lg:col-span-8 p-10 rounded-[3rem] shadow-2xl border min-h-[500px] transition-all duration-700 ${theme === 'dark' ? 'bg-slate-900 border-white/5 shadow-black/40' : 'bg-white border-slate-100'}`}>
           {result ? (
             <div className="animate-fadeIn">
                <div className="flex items-center justify-between mb-10 border-b border-white/5 pb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500 text-xl">
                      <i className="fas fa-map-marked-alt"></i>
                    </div>
                    <div>
                      <h4 className={`text-2xl font-black uppercase tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>
                        Grounding Matrix
                      </h4>
                      <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Verified Spatial Records</p>
                    </div>
                  </div>
                </div>
                
                <div className={`prose prose-sm prose-invert max-w-none leading-relaxed whitespace-pre-wrap font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>
                  {result.text}
                </div>
             </div>
           ) : (
             <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-slate-500 opacity-20 text-center space-y-6">
                <i className="fas fa-earth-asia text-8xl"></i>
                <p className="text-sm font-black uppercase tracking-[0.5em]">Neural Link Standby...</p>
             </div>
           )}
        </div>

        <div className={`lg:col-span-4 space-y-8`}>
          <div className={`p-8 rounded-[2.5rem] shadow-2xl border transition-all duration-700 ${theme === 'dark' ? 'bg-slate-900 border-white/5' : 'bg-white border-slate-100'}`}>
            <div className="flex items-center gap-3 mb-8">
                <i className="fas fa-link text-emerald-500"></i>
                <h4 className={`text-xs font-black uppercase tracking-widest ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>Place Telemetry</h4>
            </div>
            
            {result?.groundingChunks ? (
              <div className="space-y-4">
                  {result.groundingChunks.map((chunk: any, i: number) => {
                    const title = chunk.maps?.title || chunk.web?.title || 'Location Data';
                    const uri = chunk.maps?.uri || chunk.web?.uri;
                    if (!uri) return null;
                    
                    return (
                      <a key={i} href={uri} target="_blank" rel="noreferrer" className={`block p-5 border rounded-2xl transition-all group ${theme === 'dark' ? 'bg-white/5 border-white/10 hover:border-emerald-500/30' : 'bg-slate-50 border-slate-100 hover:border-emerald-300'}`}>
                        <div className="flex justify-between items-center">
                          <span className={`text-[10px] font-black group-hover:text-emerald-500 transition-colors uppercase tracking-widest truncate max-w-[85%] ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{title}</span>
                          <i className="fas fa-external-link-alt text-[8px] text-slate-600 group-hover:text-emerald-500 transition-all"></i>
                        </div>
                      </a>
                    );
                  })}
              </div>
            ) : (
              <div className="py-12 opacity-10 text-center">
                  <i className="fas fa-globe text-4xl mb-4"></i>
                  <p className="text-[9px] font-black uppercase tracking-widest">Grounding Inactive</p>
              </div>
            )}
          </div>
          
          <div className="p-8 rounded-[2.5rem] bg-emerald-500/5 border border-emerald-500/10">
             <h5 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <i className="fas fa-location-arrow"></i> Precision Link
             </h5>
             <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                The Geospatial Matrix analyzes facilities within your operational radius. Direct Map links are automatically synchronized from the Google Maps neural database.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapsView;
