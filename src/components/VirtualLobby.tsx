import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Power,
  Map,
  Cpu,
  Aperture,
  RefreshCw,
  X,
  Shield,
  Wifi,
  Hexagon,
} from "lucide-react";

import { geminiService } from "../services/geminiService";
import { VirtualRealityLayer } from "./VirtualRealityLayer";
import type { SeedCoreState, Room, Agent } from "../types";
import { useDebounced } from "../hooks/useDebounced";
import { useEventTracking } from "../hooks/useEventTracking";

import lobbyImage from "../assets/lobby.png";

/* -------------------------- Parallax Tilt Hook --------------------------- */

function useParallaxTilt(enabled: boolean) {
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!enabled || !ref.current) return;
    const el = ref.current;

    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const py = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      const rotY = px * 10;      // +/- 10deg
      const rotX = -py * 8;      // +/- 8deg
      el.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg) translateZ(0)`;
    };

    const onLeave = () => {
      el.style.transform = `rotateX(0deg) rotateY(0deg) translateZ(0)`;
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
    };
  }, [enabled]);

  return ref;
}

/* ---------------------------------- Types --------------------------------- */

interface VirtualLobbyProps {
  onExitLobby: () => void;
  coreState: SeedCoreState;
  updateCoreState: (u: Partial<SeedCoreState>) => void;
  isAiEnabled: boolean;
  setIsAiEnabled: (v: boolean) => void;
  rooms: Room[];
  agents: Agent[];
}

/* ------------------------------ Main Component ----------------------------- */

export const VirtualLobby: React.FC<VirtualLobbyProps> = ({ 
  onExitLobby, 
  coreState, 
  updateCoreState,
  isAiEnabled,
  setIsAiEnabled,
  rooms,
  agents,
}) => {
  /* ------------------------------ Local State ------------------------------ */

  const [narrative, setNarrative] = useState<string>("");
  const [choices, setChoices] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [background, setBackground] = useState<string>(lobbyImage);
  const [visualLoading, setVisualLoading] = useState(false);
  const [showRobotPanel, setShowRobotPanel] = useState(false);
  
  // Event tracking
  const events = useEventTracking();
  
  // NPC state
  const [npcSubtitle, setNpcSubtitle] = useState<string>("");
  const [npcSubtitleVisible, setNpcSubtitleVisible] = useState(false);
  const [npcSpeaking, setNpcSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const inFlightRef = useRef<AbortController | null>(null);
  const cooldownUntilRef = useRef<number>(0);
  
  // 3D parallax tilt for robot panel
  const tiltRef = useParallaxTilt(showRobotPanel);
  
  // Robot panel system vitals (simulated)
  const systemVitals = {
    neural: 92,
    security: 100,
    uplink: 88,
  };

  /* -------------------------- Keyboard Shortcut --------------------------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        events.emitKeyboardPressed({ key: e.key, action: "exit-lobby" });
        onExitLobby();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExitLobby, events]);

  /* -------------------------- Debug: Hotspot Visibility --------------------------- */

  useEffect(() => {
    if (isAiEnabled) {
      console.log("🎯 VirtualLobby: AI enabled, hotspot should be visible", {
        isAiEnabled,
        npcSpeaking,
        npcSubtitle: npcSubtitle ? "has subtitle" : "no subtitle"
      });
    }
  }, [isAiEnabled, npcSpeaking, npcSubtitle]);

  /* -------------------------- AI Initialization --------------------------- */

  useEffect(() => {
    if (!isAiEnabled) return;

    handleTurn("Initialize the lobby simulation.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAiEnabled]);

  /* ------------------------------ AI Turn -------------------------------- */

  const handleTurn = useCallback(
    async (input: string) => {
      if (!isAiEnabled) return;

      setLoading(true);
      try {
        const res = await geminiService.stepLobbySimulation([], input);

        const narrator =
          res.responses?.find((r) => r.role === "NARRATOR") ??
          res.responses?.[0];

        setNarrative(narrator?.content ?? "");
        setChoices(res.choices ?? []);

        if (res.worldStateUpdate) {
          updateCoreState({
            activeAtmosphere:
              res.worldStateUpdate.atmosphere as typeof coreState.activeAtmosphere ?? 
              coreState.activeAtmosphere,
            timeOfDay:
              coreState.timeOfDay +
              (res.worldStateUpdate.timeOffset ?? 0),
          });
        }
      } catch (err) {
        console.error("Lobby turn failed:", err);
        setNarrative("The system hesitates, recalibrating.");
      } finally {
        setLoading(false);
      }
    },
    [isAiEnabled, coreState, updateCoreState]
  );

  /* --------------------------- Visual Refresh ---------------------------- */

  const regenerateVisuals = async () => {
    if (!isAiEnabled) return;
    setVisualLoading(true);
    const img = await geminiService.generateLobbyImage(
      coreState.activeAtmosphere
    );
    if (img) setBackground(img);
    setVisualLoading(false);
  };

  /* --------------------------- NPC Robot Behavior ---------------------------- */

  const speakNPC = useCallback(async () => {
    console.log("🎤 speakNPC called", { 
      npcSpeaking, 
      cooldownUntil: cooldownUntilRef.current,
      now: Date.now() 
    });

    // Cooldown (avoid spamming on tiny mouse moves)
    const now = Date.now();
    if (now < cooldownUntilRef.current) {
      console.log("⏸️  Cooldown active, skipping");
      return;
    }
    if (npcSpeaking) {
      console.log("⏸️  Already speaking, skipping");
      return;
    }
    
    cooldownUntilRef.current = now + 4000; // 4s cooldown
    console.log("✅ Starting NPC interaction");

    // Cancel previous if any
    inFlightRef.current?.abort();
    const ac = new AbortController();
    inFlightRef.current = ac;

    try {
      setNpcSpeaking(true);
      setNpcSubtitle("…"); // thinking indicator
      setNpcSubtitleVisible(true);
      console.log("📡 Fetching NPC dialogue from /api/npc/robot");

      // 1) Ask server for NPC line (Gemini)
      const npcRes = await fetch("/api/npc/robot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ac.signal,
        body: JSON.stringify({
          scene: "Grand Atrium",
          trigger: "hover",
          atmosphere: coreState.activeAtmosphere,
          timeOfDay: coreState.timeOfDay,
        }),
      });

      console.log("📡 NPC response:", { status: npcRes.status, ok: npcRes.ok });

      if (!npcRes.ok) {
        const errorText = await npcRes.text();
        console.error("❌ NPC request failed:", errorText);
        throw new Error(`NPC request failed: ${npcRes.status} ${errorText}`);
      }
      
      const { text } = await npcRes.json();
      console.log("💬 NPC dialogue received:", text);
      setNpcSubtitle(text);
      setNpcSubtitleVisible(true);

      // 2) Convert to speech (ElevenLabs)
      console.log("🔊 Fetching TTS from /api/tts");
      const ttsRes = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ac.signal,
        body: JSON.stringify({
          text,
          voiceId: "21m00Tcm4TlvDq8ikWAM", // Rachel voice
        }),
      });

      console.log("🔊 TTS response:", { status: ttsRes.status, ok: ttsRes.ok });

      if (!ttsRes.ok) {
        const errorText = await ttsRes.text();
        console.error("❌ TTS request failed:", errorText);
        throw new Error(`TTS request failed: ${ttsRes.status} ${errorText}`);
      }

      // Audio bytes -> blob URL
      const audioBlob = await ttsRes.blob();
      console.log("🎵 Audio blob received, size:", audioBlob.size);
      const url = URL.createObjectURL(audioBlob);

      // Play audio
      if (!audioRef.current) audioRef.current = new Audio();
      audioRef.current.pause();
      audioRef.current.src = url;
      console.log("▶️  Playing audio...");
      await audioRef.current.play();
      console.log("✅ Audio playing");

      // Clear subtitle after audio finishes with fade
      audioRef.current.onended = () => {
        console.log("🏁 Audio finished");
        setNpcSubtitleVisible(false);
        setTimeout(() => {
          setNpcSubtitle("");
        }, 500); // Wait for fade animation
      };
    } catch (e: any) {
      if (e?.name === "AbortError") {
        console.log("🚫 Request aborted");
        return;
      }
      setNpcSubtitle("⚠️ The concierge is temporarily unavailable.");
      setNpcSubtitleVisible(true);
      console.error("❌ NPC error:", e);
      setTimeout(() => {
        setNpcSubtitleVisible(false);
        setTimeout(() => setNpcSubtitle(""), 500);
      }, 3000);
    } finally {
      setNpcSpeaking(false);
      console.log("🏁 speakNPC finished");
    }
  }, [npcSpeaking, coreState.activeAtmosphere, coreState.timeOfDay]);

  const debouncedSpeak = useDebounced(speakNPC, 180);

  /* -------------------------------- Render -------------------------------- */

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden">
      {/* ----------------------- Static Background ----------------------- */}
      <img
        src={background}
        alt="Lobby"
        className="fixed inset-0 z-0 w-screen h-screen object-cover object-center brightness-[0.85]"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          objectFit: 'cover',
          objectPosition: 'center',
          zIndex: 0
        }}
      />
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-black/70 to-black/90" style={{ zIndex: 0 }} />

      {/* ------------------- Virtual Reality Overlay -------------------- */}
      {/* Only show when AI is enabled to prevent covering boot screen */}
      {isAiEnabled && (
      <VirtualRealityLayer 
          enabled={isAiEnabled}
        atmosphere={coreState.activeAtmosphere} 
        rooms={rooms} 
        agents={agents} 
          backgroundImage={background}
        />
      )}

      {/* ----------------------- Robot Hotspot ----------------------- */}
      {/* Only show when AI is enabled (live hub screen) */}
      {isAiEnabled && (
        <>
          <button
            onClick={() => {
              console.log("🤖 Robot hotspot clicked!");
              events.emitButtonClick({ buttonId: "robot-hotspot", action: "open-panel" });
              setShowRobotPanel(true);
            }}
            onPointerEnter={() => {
              console.log("👆 Robot hotspot hover detected (onPointerEnter)");
              events.emitHotspotEntered({ 
                hotspotId: "robot-concierge",
                atmosphere: coreState.activeAtmosphere,
                timeOfDay: coreState.timeOfDay 
              });
              debouncedSpeak();
            }}
            onPointerLeave={() => {
              console.log("👋 Robot hotspot hover ended (onPointerLeave)");
              events.emitHotspotLeft({ hotspotId: "robot-concierge" });
              // Cancel in-flight requests and stop audio
              inFlightRef.current?.abort();
              if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
              }
              // Fade out subtitle
              setNpcSubtitleVisible(false);
              setTimeout(() => {
                setNpcSubtitle("");
              }, 500);
            }}
            aria-label="Robot Concierge"
            title="Hover to hear greeting, click to interact"
            style={{
              position: 'fixed',
              left: '50%',
              top: '52%',
              transform: 'translate(-50%, -50%)',
              width: '120px',
              height: '200px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              margin: 0,
              zIndex: 10000, // Higher than HUD to ensure it's on top
              pointerEvents: 'auto',
              outline: 'none'
            }}
          >
            {/* Holographic ring effect */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                border: '2px solid rgba(34, 211, 238, 0.8)',
                boxShadow: `
                  0 0 20px rgba(34, 211, 238, 0.8),
                  inset 0 0 20px rgba(34, 211, 238, 0.5)
                `,
                animation: 'pulse 2s infinite ease-in-out',
                pointerEvents: 'none'
              }}
            />
          </button>

          {/* NPC Subtitle Bubble */}
          {npcSubtitle && (
            <div
              className="npc-subtitle"
              style={{
                position: 'fixed',
                left: '50%',
                top: '70%',
                transform: npcSubtitleVisible ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(8px)',
                maxWidth: 'min(720px, 90vw)',
                padding: '12px 16px',
                borderRadius: '14px',
                background: 'rgba(0, 0, 0, 0.75)',
                backdropFilter: 'blur(10px)',
                color: '#fff',
                fontSize: '14px',
                lineHeight: '1.4',
                zIndex: 1000,
                pointerEvents: 'none',
                border: '1px solid rgba(34, 211, 238, 0.3)',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
                opacity: npcSubtitleVisible ? 1 : 0,
                transition: 'opacity 300ms ease, transform 300ms ease'
              }}
            >
              {npcSubtitle}
            </div>
          )}
        </>
      )}

      {/* ---------------------------- HUD ------------------------------- */}
      {!isAiEnabled ? (
        /* ------------------------ Boot Screen ------------------------ */
        <div 
          className="fixed inset-0 flex items-center justify-center pointer-events-auto"
          style={{ 
            zIndex: 9998,
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {/* Light backdrop for subtle text contrast (optional - can be removed) */}
          <div 
            className="absolute inset-0 bg-black/20"
            style={{ zIndex: 1 }}
          />
          
          {/* Boot Screen Content - Centered (Transparent Background) */}
          <div 
            className="relative text-center space-y-8 p-12"
            style={{
              zIndex: 2,
              backgroundColor: 'transparent',
              minWidth: '400px',
              maxWidth: '600px'
            }}
          >
            <Cpu size={48} className="mx-auto text-cyan-400" style={{ color: '#22d3ee' }} />
            <h1 className="text-3xl tracking-[0.4em] uppercase" style={{ color: '#ffffff', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              SeedCore
            </h1>
            <p className="text-sm uppercase tracking-widest" style={{ color: '#cbd5e1', marginBottom: '2rem' }}>
              System State: Decoupled
               </p>
               <button 
              onClick={() => {
                events.emitButtonClick({ buttonId: "initialize-intelligence", action: "enable-ai" });
                setIsAiEnabled(true);
              }}
              className="px-10 py-4 rounded-full text-xs font-bold tracking-widest uppercase shadow-xl transition-all hover:bg-cyan-400 hover:scale-105"
              style={{
                backgroundColor: '#ffffff',
                color: '#000000',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <Power size={14} className="inline mr-2" /> Initialize Intelligence
               </button>
            </div>
         </div>
      ) : (
        /* ------------------------ Live HUD --------------------------- */
        <div 
          className="fixed inset-0 pointer-events-none"
          style={{ 
            zIndex: 9998,
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh'
          }}
        >
          {/* Top Status */}
          <div 
            className="fixed top-8 left-8 flex items-center gap-4 pointer-events-auto px-4 py-3 rounded-xl backdrop-blur-md border border-white/20" 
            style={{ 
              zIndex: 9999,
              backgroundColor: 'rgba(0, 0, 0, 0.5)'
            }}
          >
            <div 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                width: '24px', 
                height: '24px',
                color: '#22d3ee'
              }}
            >
              <Aperture 
                size={20} 
                strokeWidth={2.5}
                className="animate-spin"
                color="currentColor"
              />
                 </div>
                 <div>
              <div className="text-xs uppercase tracking-widest font-semibold" style={{ color: '#ffffff' }}>
                Grand Atrium
              </div>
              <div className="text-[10px]" style={{ color: '#ffffff' }}>
                Core Live
                 </div>
              </div>
           </div>

          {/* Narrative - Top Right */}
          {!loading && narrative && (
            <div 
              className="max-w-md text-left px-6 py-4 pointer-events-auto rounded-xl backdrop-blur-md border border-white/20" 
              style={{ 
                position: 'fixed',
                top: '8px',
                right: '8px',
                zIndex: 9999,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                maxHeight: '300px',
                overflowY: 'auto',
                maxWidth: '400px'
              }}
            >
              <p className="italic text-sm leading-relaxed" style={{ color: '#ffffff' }}>
                {narrative}
              </p>
                 </div>
          )}

          {/* Loading State - Top Right */}
          {loading && (
            <div 
              className="text-left pointer-events-auto px-6 py-3 rounded-xl backdrop-blur-md border border-white/20" 
              style={{ 
                position: 'fixed',
                top: '8px',
                right: '8px',
                zIndex: 9999,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                maxWidth: '400px'
              }}
            >
              <p className="text-sm uppercase tracking-widest" style={{ color: '#ffffff' }}>
                Processing...
              </p>
              </div>
           )}

          {/* Actions - Bottom Center */}
          <div 
            className="pointer-events-auto" 
            style={{ 
              position: 'fixed',
              bottom: '80px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 9999,
              display: 'flex',
              justifyContent: 'center',
              gap: '12px',
              flexWrap: 'wrap',
              maxWidth: '90vw'
            }}
          >
            {choices.map((c, i) => (
                      <button
                key={i}
                onClick={() => {
                  events.emitButtonClick({ buttonId: "lobby-choice", choice: c, index: i });
                  handleTurn(c);
                }}
                className="px-6 py-3 rounded-xl text-xs uppercase tracking-widest backdrop-blur-md border border-white/20 transition-all hover:bg-white/30"
                style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  color: '#ffffff'
                }}
              >
                {c}
                      </button>
            ))}

                 <button 
              onClick={() => {
                events.emitButtonClick({ buttonId: "regenerate-visuals", atmosphere: coreState.activeAtmosphere });
                regenerateVisuals();
              }}
              className="p-3 rounded-xl backdrop-blur-md border border-white/20 transition-all hover:bg-white/30"
              title="Regenerate Visuals"
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                color: '#ffffff'
              }}
            >
              <RefreshCw
                size={16}
                className={visualLoading ? "animate-spin" : ""}
                color="currentColor"
                strokeWidth={2}
              />
                 </button>
          </div>

          {/* Director Mode Button - Bottom Right */}
          <button
            onClick={() => {
              events.emitButtonClick({ buttonId: "director-mode", action: "exit-lobby" });
              onExitLobby();
            }}
            className="px-6 py-3 bg-white text-black rounded-full text-xs font-bold tracking-widest uppercase shadow-xl hover:bg-cyan-50 transition-all pointer-events-auto"
            style={{ 
              position: 'fixed',
              bottom: '24px',
              right: '24px',
              zIndex: 9999
            }}
          >
            <Map size={14} className="inline mr-2" /> Director Mode
          </button>
        </div>
      )}

      {/* ----------------------- Robot Concierge Panel (3D HUD) ----------------------- */}
      {showRobotPanel && (
        <div
          className="fixed inset-0 flex items-center justify-center pointer-events-auto z-[10000]"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            overflow: 'visible', // Allow floating elements to show
          }}
          onClick={() => setShowRobotPanel(false)}
        >
          <div
            className="relative max-w-md w-full mx-4 rounded-3xl border border-white/15"
            style={{
              background: "linear-gradient(180deg, rgba(10,10,16,0.92), rgba(2,6,23,0.82))",
              boxShadow: "0 30px 90px rgba(0,0,0,0.85), 0 0 70px rgba(34,211,238,0.18)",
              transformStyle: "preserve-3d",
              perspective: "1200px",
              overflow: "visible", // Allow floating elements
              minHeight: "500px", // Ensure enough space for all content
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 3D Tilt Layer */}
            <div
              ref={tiltRef}
              className="relative p-8 min-h-[450px]"
              style={{
                transition: "transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)",
                transformStyle: "preserve-3d",
                overflow: "visible", // Allow floating data nodes to show
              }}
            >
              {/* Depth frame */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  borderRadius: 24,
                  boxShadow:
                    "inset 0 0 0 1px rgba(255,255,255,0.08), inset 0 -30px 60px rgba(0,0,0,0.55)",
                }}
              />

              {/* Holographic shimmer */}
              <div
                className="absolute -inset-40 opacity-40 pointer-events-none"
                style={{
                  background:
                    "conic-gradient(from 180deg, rgba(34,211,238,0.0), rgba(34,211,238,0.18), rgba(168,85,247,0.12), rgba(34,211,238,0.0))",
                  filter: "blur(18px)",
                  animation: "spinSlow 10s linear infinite",
                  transform: "translateZ(40px)",
                }}
              />

              {/* Scanlines */}
              <div
                className="absolute inset-0 pointer-events-none opacity-15"
                style={{
                  background:
                    "repeating-linear-gradient(to bottom, rgba(255,255,255,0.08), rgba(255,255,255,0.08) 1px, rgba(0,0,0,0) 3px, rgba(0,0,0,0) 7px)",
                  mixBlendMode: "overlay",
                  transform: "translateZ(20px)",
                }}
              />

              {/* Close Button (Foreground Layer) */}
              <button
                onClick={() => {
                  events.emitButtonClick({ buttonId: "robot-panel-close", action: "close-panel" });
                  setShowRobotPanel(false);
                }}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-all z-10"
                style={{ 
                  color: '#ffffff',
                  transform: "translateZ(50px)",
                }}
                aria-label="Close"
              >
                <X size={20} />
              </button>

              {/* Panel Content (Mid Layer) */}
              <div 
                className="relative"
                style={{ transform: "translateZ(30px)" }}
              >
                {/* Neuro-Core (Top Section) */}
                <div className="text-center mb-6 relative" style={{ zIndex: 10 }}>
                  <div className="relative w-20 h-20 mx-auto flex items-center justify-center mb-3" style={{ overflow: 'visible' }}>
                    {/* Rotating Rings */}
                    <div className="absolute inset-0 rounded-full border border-cyan-500/30" style={{ animation: 'spin 10s linear infinite' }} />
                    <div className="absolute inset-2 rounded-full border border-cyan-400/20 border-t-transparent" style={{ animation: 'spin 3s linear infinite reverse' }} />
                    <div className="absolute inset-6 rounded-full border-2 border-cyan-500/10 animate-pulse" />
                    
                    {/* Core Icon */}
                    <div className="relative z-10 p-3 bg-slate-950/50 rounded-full border border-cyan-500/20 backdrop-blur-md shadow-[0_0_20px_rgba(34,211,238,0.2)]">
                      <Hexagon size={28} className="text-cyan-400 animate-pulse" />
                    </div>
                    
                    {/* Floating Data Nodes - positioned outside container */}
                    <div className="absolute -right-8 top-0 text-[7px] font-mono text-cyan-300 whitespace-nowrap" style={{ animation: 'bounce 2s infinite' }}>CPU: 98%</div>
                    <div className="absolute -left-8 bottom-0 text-[7px] font-mono text-cyan-300 whitespace-nowrap" style={{ animation: 'bounce 2s infinite', animationDelay: '150ms' }}>NET: 40TB</div>
                  </div>
                  
                  <h2 className="text-xl font-bold uppercase tracking-widest mb-1" style={{ color: '#ffffff', textShadow: '0 0 10px rgba(34,211,238,0.5)' }}>
                    Concierge AI
                  </h2>
                  <p className="text-[9px] font-mono text-cyan-500/60 tracking-widest">
                    UNIT 734-ALPHA
                  </p>
                </div>

                {/* System Vitals (Mid Section) */}
                <div className="flex justify-between gap-2 mb-6 px-2 relative" style={{ zIndex: 10 }}>
                  {[
                    { label: 'Neural', icon: Cpu, val: systemVitals.neural, col: 'bg-cyan-500' },
                    { label: 'Security', icon: Shield, val: systemVitals.security, col: 'bg-emerald-500' },
                    { label: 'Uplink', icon: Wifi, val: systemVitals.uplink, col: 'bg-amber-500' }
                  ].map((sys, i) => {
                    const IconComponent = sys.icon;
                    return (
                      <div key={i} className="flex-1 bg-slate-900/50 border border-white/5 rounded-lg p-2 flex flex-col items-center group hover:border-cyan-500/30 transition-colors">
                        <IconComponent size={12} className="text-slate-400 mb-2 group-hover:text-white transition-colors" />
                        <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mb-1">
                          <div className={`h-full ${sys.col} transition-all duration-1000`} style={{ width: `${sys.val}%` }} />
                        </div>
                        <span className="text-[7px] font-mono uppercase text-slate-500">{sys.label}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Action Buttons (Foreground Layer) */}
                <div 
                  className="space-y-3"
                  style={{ transform: "translateZ(50px)" }}
                >
                  <button
                    onClick={() => {
                      events.emitButtonClick({ buttonId: "robot-panel-assistance", action: "request-assistance" });
                      handleTurn("Ask the Concierge for assistance");
                      setShowRobotPanel(false);
                    }}
                    className="w-full px-6 py-3 rounded-xl backdrop-blur-md border border-white/20 transition-all hover:bg-white/10 hover:border-cyan-400/40"
                    style={{
                      backgroundColor: 'rgba(0, 0, 0, 0.5)',
                      color: '#ffffff',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3), inset 0 0 20px rgba(34,211,238,0.05)',
                    }}
                  >
                    Request Assistance
                  </button>
                  <button 
                    onClick={() => {
                      events.emitButtonClick({ buttonId: "robot-panel-services", action: "inquire-services" });
                      handleTurn("Inquire about hotel services");
                      setShowRobotPanel(false);
                    }}
                    className="w-full px-6 py-3 rounded-xl backdrop-blur-md border border-white/20 transition-all hover:bg-white/10 hover:border-cyan-400/40"
                    style={{
                      backgroundColor: 'rgba(0, 0, 0, 0.5)',
                      color: '#ffffff',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3), inset 0 0 20px rgba(34,211,238,0.05)',
                    }}
                  >
                    Hotel Services
                  </button>
                </div>
              </div>
            </div>
            
            {/* Decorative Corners (HUD Elements) - Outside tilt layer */}
            <div className="absolute top-0 left-0 w-4 h-4 border-l border-t border-cyan-500/50 rounded-tl-lg pointer-events-none z-20" />
            <div className="absolute top-0 right-0 w-4 h-4 border-r border-t border-cyan-500/50 rounded-tr-lg pointer-events-none z-20" />
            <div className="absolute bottom-0 left-0 w-4 h-4 border-l border-b border-cyan-500/50 rounded-bl-lg pointer-events-none z-20" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-r border-b border-cyan-500/50 rounded-br-lg pointer-events-none z-20" />
            
            {/* Status Light - Outside tilt layer */}
            <div className="absolute -right-1 top-10 w-1 h-8 rounded-l-sm bg-cyan-500 shadow-[0_0_10px_#06b6d4] pointer-events-none z-20" />
          </div>
        </div>
      )}
    </div>
  );
};
