
import React, { useState, useEffect, useRef } from 'react';
import { GlobalConfig, CarbonPrediction, UserRecord } from '../types';
import { databaseService } from '../services/databaseService';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';

interface AdminConsoleProps {
  config: GlobalConfig;
  setConfig: (c: GlobalConfig) => void;
  history: CarbonPrediction[];
  isOwner: boolean;
  applications: any[]; // Deprecated, users are now in databaseService
}

// Helper functions for audio encoding/decoding as per guidelines
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const AdminConsole: React.FC<AdminConsoleProps> = ({ config, setConfig, history, isOwner }) => {
  const [logs, setLogs] = useState<{msg: string, time: string, type: 'AI' | 'SYS' | 'SEC'}[]>([]);
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [users, setUsers] = useState<UserRecord[]>([]);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);

  // Fix: Await async data fetch in useEffect
  useEffect(() => {
    const fetchUsers = async () => {
      const data = await databaseService.getAllUsers();
      setUsers(data);
    };
    fetchUsers();
  }, []);

  const addLog = (msg: string, type: 'AI' | 'SYS' | 'SEC' = 'SYS') => {
    setLogs(prev => [{ msg, time: new Date().toLocaleTimeString(), type }, ...prev].slice(0, 50));
  };

  const downloadCSV = (data: string[][], filename: string) => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + data.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addLog(`Registry Export Triggered: ${filename}`, 'SEC');
  };

  const exportRegistry = () => {
    const headers = ["ID", "Name", "Email", "Phone", "Role", "Created At"];
    const rows = users.map(u => [u.id, u.name, u.email, u.phone, u.role, new Date(u.createdAt).toLocaleString()]);
    downloadCSV([headers, ...rows], "CarbonSense_UserRegistry.csv");
  };

  const exportEmissions = () => {
    const headers = ["User ID", "Timestamp", "Scope 1", "Scope 2", "Scope 3", "Total"];
    const rows = history.map(item => [
      item.userId,
      new Date(item.timestamp).toLocaleString(),
      item.scope1.toString(),
      item.scope2.toString(),
      item.scope3.toString(),
      item.total.toString()
    ]);
    downloadCSV([headers, ...rows], "CarbonSense_EmissionsDB.csv");
  };

  const startLiveBriefing = async () => {
    if (isLiveActive) {
      if (sessionRef.current) sessionRef.current.close();
      setIsLiveActive(false);
      return;
    }
    addLog("Initializing Neural Live Link...", "AI");
    setIsLiveActive(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = outputCtx;
      
      let nextStartTime = 0;
      const sources = new Set<AudioBufferSourceNode>();

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } } },
          systemInstruction: `You are the CarbonSense Authority Support Intelligence. You have access to user history and emission trends.`,
        },
        callbacks: {
          onopen: () => {
            addLog("Voice Authority Handshake: SUCCESS", "SEC");
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const input = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(input.length);
              for (let i = 0; i < input.length; i++) int16[i] = input[i] * 32768;
              const pcmBlob = {
                data: encode(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };
              sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64EncodedAudioString = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64EncodedAudioString) {
              nextStartTime = Math.max(nextStartTime, outputCtx.currentTime);
              const audioBuffer = await decodeAudioData(
                decode(base64EncodedAudioString),
                outputCtx,
                24000,
                1,
              );
              const source = outputCtx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputCtx.destination);
              source.addEventListener('ended', () => {
                sources.delete(source);
              });

              source.start(nextStartTime);
              nextStartTime = nextStartTime + audioBuffer.duration;
              sources.add(source);
            }

            const interrupted = message.serverContent?.interrupted;
            if (interrupted) {
              for (const source of sources.values()) {
                source.stop();
                sources.delete(source);
              }
              nextStartTime = 0;
            }
          },
          onclose: () => {
            setIsLiveActive(false);
            addLog("Authority Link Closed", "SYS");
          },
          onerror: (e) => addLog(`Authority Signal Failure: ${e}`, "SEC")
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err) { 
      setIsLiveActive(false); 
      addLog(`Failed to connect: ${err}`, "SEC");
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-white text-3xl font-black tracking-tighter">
            {isOwner ? "Owner Master Terminal" : "Authority Profile Console"}
          </h2>
          <div className="flex items-center gap-4 mt-2">
            <p className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.4em]">SQLite Persistence Core</p>
            <div className="flex items-center gap-4">
              <div className={`w-1.5 h-1.5 rounded-full ${isLiveActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`}></div>
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Database Linked</span>
            </div>
          </div>
        </div>
        <div className="flex gap-4 relative z-10 mt-6 md:mt-0">
          <button onClick={startLiveBriefing} className={`px-6 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] ${isLiveActive ? 'bg-rose-500 text-white animate-pulse' : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'}`}>
            <i className={`fas ${isLiveActive ? 'fa-volume-high' : 'fa-microphone'} mr-2`}></i>
            {isLiveActive ? 'Neural Briefing Active' : 'Authority Briefing'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {isOwner && (
            <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100">
               <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
                      <i className="fas fa-database"></i>
                    </div>
                    <h3 className="text-xl font-black text-slate-800">Master Data Export</h3>
                  </div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Persistence Mode: ON</span>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <button onClick={exportRegistry} className="p-6 bg-slate-50 border border-slate-100 rounded-3xl hover:border-amber-500 transition-all text-center group">
                    <i className="fas fa-users-viewfinder text-2xl text-slate-300 group-hover:text-amber-500 mb-3 block"></i>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">User Registry</p>
                    <p className="text-[8px] text-slate-400 mt-1 uppercase">Permanent Records</p>
                 </button>
                 <button onClick={exportEmissions} className="p-6 bg-slate-50 border border-slate-100 rounded-3xl hover:border-emerald-500 transition-all text-center group">
                    <i className="fas fa-file-invoice-dollar text-2xl text-slate-300 group-hover:text-emerald-500 mb-3 block"></i>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Emissions DB</p>
                    <p className="text-[8px] text-slate-400 mt-1 uppercase">Historical Inputs</p>
                 </button>
                 <button onClick={() => downloadCSV([["Time", "Msg"], ...logs.map(l => [l.time, l.msg])], "Audit_Log.csv")} className="p-6 bg-slate-50 border border-slate-100 rounded-3xl hover:border-blue-500 transition-all text-center group">
                    <i className="fas fa-shoe-prints text-2xl text-slate-300 group-hover:text-blue-500 mb-3 block"></i>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Audit Logs</p>
                    <p className="text-[8px] text-slate-400 mt-1 uppercase">Terminal Activity</p>
                 </button>
               </div>
            </div>
          )}

          {isOwner && users.length > 0 && (
            <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100">
              <h3 className="text-xl font-black text-slate-800 mb-6">Database: Secure Registry ({users.length})</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-50">
                      <th className="pb-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Identity</th>
                      <th className="pb-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Role</th>
                      <th className="pb-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {users.map((u, i) => (
                      <tr key={i} className="group">
                        <td className="py-4 font-bold text-slate-700">
                           <p>{u.name}</p>
                           <p className="text-[10px] text-slate-400 font-medium">{u.email}</p>
                        </td>
                        <td className="py-4">
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${u.role === 'OWNER' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="py-4 text-right text-[10px] text-slate-400 font-mono">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white flex flex-col h-[600px] shadow-2xl overflow-hidden border border-white/5">
           <div className="flex items-center justify-between mb-6 shrink-0">
             <div className="flex items-center gap-3">
               <i className="fas fa-terminal text-emerald-500"></i>
               <h4 className="text-[10px] font-black uppercase tracking-widest">System Blackbox Audit</h4>
             </div>
           </div>
           <div className="flex-grow overflow-y-auto space-y-4 font-mono text-[9px] scrollbar-hide">
             {logs.map((log, i) => (
               <div key={i} className="flex gap-4 border-l border-white/10 pl-4 py-1">
                 <span className="text-slate-500">[{log.time}]</span>
                 <span className={`font-black ${log.type === 'SEC' ? 'text-rose-400' : 'text-emerald-400'}`}>{log.type}:</span>
                 <span className="text-slate-300">{log.msg}</span>
               </div>
             ))}
           </div>
           <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-between shrink-0">
              <span className="text-[8px] font-black text-slate-500 uppercase">SQLite Core Terminal v2.0</span>
              <button onClick={() => setLogs([])} className="text-[8px] font-black text-slate-500 hover:text-white uppercase transition-colors">Wipe Buffer</button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default AdminConsole;
