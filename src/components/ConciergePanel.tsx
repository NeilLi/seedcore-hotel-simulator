import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Cpu, Shield, Wifi, Hexagon } from 'lucide-react';

interface Ticket { id: string; room: string; type: string; status: 'PENDING' | 'ACTIVE' | 'RESOLVED'; time: string; }

interface ConciergePanelProps {
  active: boolean;
}

export const ConciergePanel: React.FC<ConciergePanelProps> = ({ active }) => {
  // Always render - don't conditionally hide
  const [tickets, setTickets] = useState<Ticket[]>([
    { id: 'T-101', room: '104', type: 'High Noise Alert', status: 'ACTIVE', time: '08:02' },
    { id: 'T-102', room: 'Lobby', type: 'Spill Detected', status: 'PENDING', time: '08:05' },
  ]);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // --- 1. MOUSE PARALLAX EFFECT ---
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setMouse({ x, y });
  };

  const handleMouseLeave = () => setMouse({ x: 0, y: 0 });

  // --- 2. SIMULATION LOGIC ---
  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      if (Math.random() > 0.7) {
        const types = ['Room Service', 'HVAC Maint', 'Guest Request', 'Bio-Filter'];
        const statuses: ('PENDING' | 'ACTIVE')[] = ['PENDING', 'ACTIVE'];
        const newTicket: Ticket = {
          id: `T-${Math.floor(Math.random() * 1000)}`,
          room: `${100 + Math.floor(Math.random() * 20)}`,
          type: types[Math.floor(Math.random() * types.length)],
          status: statuses[Math.floor(Math.random() * statuses.length)],
          time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
        };
        setTickets(prev => [newTicket, ...prev].slice(0, 4));
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [active]);

  // CSS Transforms for 2.5D effect - increased tilt for more dramatic 3D feel
  const rotateX = active ? mouse.y * -14 : 0; // Invert Y for natural tilt
  const rotateY = active ? mouse.x * 14 : 0;
  const translateZ = active ? 12 : 0;
  const scale = active ? 1 : 0.95;
  
  return (
    <div 
      className="fixed top-24 right-8 w-80 h-[500px] z-[1000000] custom-perspective pointer-events-auto"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      ref={containerRef}
      style={{
        transformOrigin: "50% 40%", // Pivot slightly higher for better VR HUD feel
        perspective: "1000px", // Inline style to ensure it works
      }}
    >
      {/* --- 3D CONTAINER --- */}
      <div 
        className={`
          relative w-full h-full transition-all duration-300 ease-out custom-transform-3d
          ${active ? 'opacity-100' : 'opacity-80 grayscale'}
        `}
        style={{
          transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(${translateZ}px) scale(${scale})`,
          transition: 'transform 0.08s ease-out, opacity 0.5s',
          visibility: 'visible',
          display: 'block',
        }}
      >
        
        {/* --- LAYER 0: BACKPLANE (Glass & Glow) --- */}
        <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl border-2 border-cyan-500/30 rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.6),0_0_30px_rgba(34,211,238,0.2)] overflow-hidden">
          {/* Internal gradient mesh */}
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/10 via-transparent to-slate-900/50" />
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
          <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
          
          {/* Scanline texture */}
          <div className="absolute inset-0 opacity-10 pointer-events-none" 
               style={{ backgroundImage: 'linear-gradient(0deg, transparent 24%, rgba(34, 211, 238, .3) 25%, rgba(34, 211, 238, .3) 26%, transparent 27%, transparent 74%, rgba(34, 211, 238, .3) 75%, rgba(34, 211, 238, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(34, 211, 238, .3) 25%, rgba(34, 211, 238, .3) 26%, transparent 27%, transparent 74%, rgba(34, 211, 238, .3) 75%, rgba(34, 211, 238, .3) 76%, transparent 77%, transparent)', backgroundSize: '30px 30px' }} 
          />
        </div>

        {/* --- LAYER 1: NEURO-CORE (The "Face") --- */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 custom-transform-3d translate-z-20">
           <div className="relative w-24 h-24 flex items-center justify-center">
              {/* Rotating Rings */}
              <div className={`absolute inset-0 rounded-full border border-cyan-500/30 ${active ? 'spinSlow' : ''}`} />
              <div className={`absolute inset-2 rounded-full border border-cyan-400/20 border-t-transparent ${active ? 'spinFastRev' : ''}`} />
              <div className={`absolute inset-6 rounded-full border-2 border-cyan-500/10 ${active ? 'animate-pulse' : ''}`} />
              
              {/* Core Icon */}
              <div className="relative z-10 p-4 bg-slate-950/50 rounded-full border border-cyan-500/20 backdrop-blur-md shadow-[0_0_20px_rgba(34,211,238,0.2)]">
                <Hexagon 
                  size={32} 
                  className={`text-cyan-400 ${active ? 'animate-pulse' : 'opacity-50'}`}
                  style={{ animationDuration: active ? "900ms" : "2200ms" }}
                />
              </div>
              
              {/* Floating Data Nodes */}
              {active && (
                <>
                  <div className="absolute -right-8 top-0 text-[8px] font-mono text-cyan-300 animate-bounce">CPU: 98%</div>
                  <div 
                    className="absolute -left-8 bottom-0 text-[8px] font-mono text-cyan-300 animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  >
                    NET: 40TB
                  </div>
                </>
              )}
           </div>
           
           <div className="text-center mt-3">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white text-shadow-glow">
                 Concierge AI
              </h3>
              <div className="text-[8px] font-mono text-cyan-500/60 tracking-widest mt-1">
                 UNIT 734-ALPHA
              </div>
              {/* State Label */}
              <div className="text-[7px] font-mono text-cyan-300/70 tracking-[0.25em] mt-2">
                STATE: {active ? "PROCESSING" : "IDLE"}
              </div>
           </div>
        </div>

        {/* --- LAYER 2: SYSTEM VITALS (Mid-section) --- */}
        <div className="absolute top-40 inset-x-4 custom-transform-3d translate-z-10 flex justify-between gap-2">
            {[
              { label: 'Neural', icon: Cpu, val: 92, col: 'bg-cyan-500' },
              { label: 'Security', icon: Shield, val: 100, col: 'bg-emerald-500' },
              { label: 'Uplink', icon: Wifi, val: 88, col: 'bg-amber-500' }
            ].map((sys, i) => (
              <div key={i} className="flex-1 bg-slate-900/50 border border-white/5 rounded-lg p-2 flex flex-col items-center group hover:border-cyan-500/30 transition-colors">
                 <sys.icon size={12} className="text-slate-400 mb-2 group-hover:text-white transition-colors" />
                 <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mb-1">
                    <div className={`h-full ${active ? sys.col : 'bg-slate-700'} transition-all duration-1000`} style={{ width: active ? `${sys.val}%` : '0%' }} />
                 </div>
                 <span className="text-[7px] font-mono uppercase text-slate-500">{sys.label}</span>
              </div>
            ))}
        </div>

        {/* --- LAYER 3: TASK QUEUE (Bottom List) --- */}
        <div className="absolute top-64 inset-x-4 bottom-4 custom-transform-3d translate-z-30 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/10">
               <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-400 flex items-center gap-2">
                 <Terminal size={10} /> Active Tasks
               </span>
               <span className="text-[8px] font-mono text-slate-500">{tickets.length} PENDING</span>
            </div>

            <div className="flex-1 space-y-2 overflow-hidden relative">
               {tickets.map((t) => (
                 <div 
                    key={t.id}
                    className="group relative p-3 bg-slate-900/80 border-l-2 border-l-slate-700 hover:border-l-cyan-400 hover:bg-slate-800 transition-all cursor-pointer transform hover:translate-x-1"
                 >
                    <div className="flex justify-between items-start">
                       <span className="text-[10px] font-bold text-slate-200 group-hover:text-cyan-200 uppercase tracking-wider">{t.type}</span>
                       <span className="text-[8px] font-mono text-slate-500">{t.time}</span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                       <span className="text-[9px] font-mono text-cyan-600 uppercase">RM {t.room}</span>
                       <div className="flex items-center gap-1">
                          <div className={`w-1.5 h-1.5 rounded-full ${t.status === 'ACTIVE' ? 'bg-amber-500 animate-pulse' : 'bg-slate-600'}`} />
                          <span className="text-[8px] font-bold text-slate-400">{t.status}</span>
                       </div>
                    </div>
                 </div>
               ))}
               
               {/* Fade out bottom */}
               <div className="absolute bottom-0 inset-x-0 h-12 bg-gradient-to-t from-slate-950/90 to-transparent pointer-events-none" />
            </div>
        </div>

        {/* --- DECORATIVE CORNERS (HUD Elements) --- */}
        <div className="absolute top-0 left-0 w-4 h-4 border-l border-t border-cyan-500/50 rounded-tl-lg" />
        <div className="absolute top-0 right-0 w-4 h-4 border-r border-t border-cyan-500/50 rounded-tr-lg" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-l border-b border-cyan-500/50 rounded-bl-lg" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-r border-b border-cyan-500/50 rounded-br-lg" />
        
        {/* Status Light */}
        <div className={`absolute -right-1 top-10 w-1 h-8 rounded-l-sm ${active ? 'bg-cyan-500 shadow-[0_0_10px_#06b6d4]' : 'bg-red-900'}`} />
      </div>
      
      {/* --- GLOBAL STYLES INJECTION (for 3D preserve) --- */}
      <style>{`
        .custom-perspective { 
          perspective: 1000px !important; 
        }
        .custom-transform-3d { 
          transform-style: preserve-3d !important; 
        }
        .translate-z-10 { 
          transform: translateZ(10px) !important; 
          will-change: transform; 
        }
        .translate-z-20 { 
          transform: translateZ(20px) !important; 
          will-change: transform; 
        }
        .translate-z-30 { 
          transform: translateZ(30px) !important; 
          will-change: transform; 
        }
        .text-shadow-glow { 
          text-shadow: 0 0 10px rgba(34,211,238,0.5); 
        }
        @keyframes spin { 
          to { transform: rotate(360deg); } 
        }
        @keyframes spinReverse { 
          to { transform: rotate(-360deg); } 
        }
        .spinSlow { 
          animation: spin 10s linear infinite; 
        }
        .spinFastRev { 
          animation: spinReverse 3s linear infinite; 
        }
      `}</style>
    </div>
  );
};
