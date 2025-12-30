import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Power,
  Map,
  Cpu,
  Aperture,
  RefreshCw,
  X,
  Bot,
} from "lucide-react";

import { geminiService } from "../services/geminiService";
import { VirtualRealityLayer } from "./VirtualRealityLayer";
import type { SeedCoreState, Room, Agent } from "../types";
import { useDebounced } from "../hooks/useDebounced";

import lobbyImage from "../assets/lobby.png";

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
  
  // NPC state
  const [npcSubtitle, setNpcSubtitle] = useState<string>("");
  const [npcSubtitleVisible, setNpcSubtitleVisible] = useState(false);
  const [npcSpeaking, setNpcSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const inFlightRef = useRef<AbortController | null>(null);
  const cooldownUntilRef = useRef<number>(0);

  /* -------------------------- Keyboard Shortcut --------------------------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") onExitLobby();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExitLobby]);

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
              setShowRobotPanel(true);
            }}
            onPointerEnter={() => {
              console.log("👆 Robot hotspot hover detected (onPointerEnter)");
              console.log("📞 Calling debouncedSpeak...");
              debouncedSpeak();
            }}
            onPointerLeave={() => {
              console.log("👋 Robot hotspot hover ended (onPointerLeave)");
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
                 onClick={() => setIsAiEnabled(true)}
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
                onClick={() => handleTurn(c)}
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
              onClick={regenerateVisuals}
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
                   onClick={onExitLobby}
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

      {/* ----------------------- Robot Concierge Panel ----------------------- */}
      {showRobotPanel && (
        <div
          className="fixed inset-0 flex items-center justify-center pointer-events-auto z-[10000]"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)'
          }}
          onClick={() => setShowRobotPanel(false)}
        >
          <div
            className="relative max-w-md w-full mx-4 p-8 rounded-2xl backdrop-blur-md border border-white/20"
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.85)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(34, 211, 238, 0.2)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setShowRobotPanel(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-all"
              style={{ color: '#ffffff' }}
              aria-label="Close"
            >
              <X size={20} />
            </button>

            {/* Panel Content */}
            <div className="text-center space-y-6">
              <div className="flex justify-center">
                <Bot size={48} style={{ color: '#22d3ee' }} />
              </div>
              <h2 className="text-2xl font-bold uppercase tracking-widest" style={{ color: '#ffffff' }}>
                Core Concierge
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: '#cbd5e1' }}>
                How may I assist you today?
              </p>
              <div className="pt-4 space-y-3">
                <button
                  onClick={() => {
                    handleTurn("Ask the Concierge for assistance");
                    setShowRobotPanel(false);
                  }}
                  className="w-full px-6 py-3 rounded-xl backdrop-blur-md border border-white/20 transition-all hover:bg-white/10"
                  style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    color: '#ffffff'
                  }}
                >
                  Request Assistance
                </button>
                <button
                  onClick={() => {
                    handleTurn("Inquire about hotel services");
                    setShowRobotPanel(false);
                  }}
                  className="w-full px-6 py-3 rounded-xl backdrop-blur-md border border-white/20 transition-all hover:bg-white/10"
                  style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    color: '#ffffff'
                  }}
                >
                  Hotel Services
                 </button>
              </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
