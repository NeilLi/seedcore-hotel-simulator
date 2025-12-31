import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Layers,
  Power,
  X,
  Loader2,
} from "lucide-react";

import { geminiService } from "./services/geminiService";
import {
  generateMap,
  generateAgents,
  updateAgentsLogic,
} from "./utils/simulationUtils";

import { EntityType, type Room, type Agent, type SeedCoreState } from "./types";
import { GRID_WIDTH, GRID_HEIGHT, TICK_RATE_MS } from "./constants";

import { SvgHotelBackdrop } from "./components/SvgHotelBackdrop";
import { VirtualLobby } from "./components/VirtualLobby";
import { ConciergePanel } from "./components/ConciergePanel";
import { useEventTracking } from "./hooks/useEventTracking";
import { kafkaPublisher } from "./services/kafkaPublisher";


/* ------------------ MAIN APP ------------------ */

const App: React.FC = () => {
  const [initialized, setInitialized] = useState(false);
  const [inLobby, setInLobby] = useState(true);
  const [aiEnabled, setAiEnabled] = useState(false);

  const [grid, setGrid] = useState<EntityType[][]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  
  // Event tracking
  const events = useEventTracking();

  // Sync AI enabled state with Kafka publisher (for boot screen safety net)
  useEffect(() => {
    kafkaPublisher.setAiEnabled(aiEnabled);
  }, [aiEnabled]);

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loadingVideo, setLoadingVideo] = useState(false);

  const [coreState, setCoreState] = useState<SeedCoreState>({
    activeAtmosphere: "MORNING_LIGHT",
    logs: [],
    timeOfDay: 8,
  });

  useEffect(() => {
    const { grid, rooms } = generateMap(GRID_WIDTH, GRID_HEIGHT);
    setGrid(grid);
    setRooms(rooms);
    setAgents(generateAgents(8, GRID_WIDTH, GRID_HEIGHT));
    setInitialized(true);
  }, []);

  const tick = useCallback(() => {
    if (!grid.length) return;
    
    setAgents((prevAgents) => {
      const updated = updateAgentsLogic(prevAgents, grid);
      
      // Track position changes
      updated.forEach((agent) => {
        const prev = prevAgents.find((a) => a.id === agent.id);
        if (prev && (prev.position.x !== agent.position.x || prev.position.y !== agent.position.y)) {
          // Position updates not in ALLOWED_EVENT_TYPES - skip for now
          // events.emitRobotPositionUpdated(...);
        }
        
        // Track state changes (throttled - only emit significant state transitions)
        if (prev && prev.state !== agent.state) {
          // Only emit for significant state changes (skip frequent WALKING/PAUSING oscillations)
          const significantStates = ['SOCIALIZING', 'SERVICING', 'CHARGING', 'OBSERVING'];
          const isSignificant = significantStates.includes(agent.state) || 
                                significantStates.includes(prev.state);
          
          if (isSignificant || Math.random() < 0.1) { // Emit 10% of minor state changes
            events.emitAgentStateChanged({
              agentId: agent.id,
              agentRole: agent.role,
              state: agent.state,
              previousState: prev.state,
            });
          }
        }
      });
      
      return updated;
    });
    
    setCoreState((s) => {
      const newTime = (s.timeOfDay + 0.05) % 24;
      // Time updates not in ALLOWED_EVENT_TYPES - skip for now
      // events.emitTimeUpdated(newTime, s.timeOfDay);
      return { ...s, timeOfDay: newTime };
    });
  }, [grid, events]);

  useEffect(() => {
    if (!initialized) return;
    if (!aiEnabled) return; // ✅ Pause simulation on boot screen
    
    const i = setInterval(tick, TICK_RATE_MS);
    return () => clearInterval(i);
  }, [initialized, aiEnabled, tick]);
  
  // Track atmosphere changes
  const prevAtmosphereRef = useRef(coreState.activeAtmosphere);
  useEffect(() => {
    if (prevAtmosphereRef.current !== coreState.activeAtmosphere) {
      // Atmosphere changes not in ALLOWED_EVENT_TYPES - skip for now
      // events.emitAtmosphereChanged(coreState.activeAtmosphere, prevAtmosphereRef.current);
      prevAtmosphereRef.current = coreState.activeAtmosphere;
    }
  }, [coreState.activeAtmosphere, events]);
  
  // Track room occupancy changes (throttled + only emit on actual changes)
  const lastOccupancyCheck = useRef(0);
  const lastOccupancyMap = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    if (!initialized || !aiEnabled) return; // ✅ Pause occupancy checks on boot screen
    if (rooms.length === 0 || agents.length === 0) return;
    
    const now = Date.now();
    if (now - lastOccupancyCheck.current < 5000) return; // Check max once per 5s (increased from 2s)
    lastOccupancyCheck.current = now;
    
    rooms.forEach((room) => {
      if (!room.topLeft || !room.bottomRight) return;
      const occupancy = agents.filter((agent) => {
        return (
          agent.position.x >= room.topLeft!.x &&
          agent.position.x <= room.bottomRight!.x &&
          agent.position.y >= room.topLeft!.y &&
          agent.position.y <= room.bottomRight!.y
        );
      }).length;
      
      // Only emit if occupancy actually changed
      const lastOccupancy = lastOccupancyMap.current.get(room.id);
      if (lastOccupancy !== occupancy) {
        lastOccupancyMap.current.set(room.id, occupancy);
        events.emitRoomOccupancyChanged({
          roomId: room.id,
          roomName: room.name,
          occupancy,
        });
      }
    });
  }, [agents, rooms, initialized, aiEnabled, events]);
  
  // Note: Pointer movements are NOT sent to Kafka (high-frequency noise)
  // They're kept local for UI interactions only

  const requestShot = async (desc: string) => {
    if (!aiEnabled) return;
    setLoadingVideo(true);
    const res = await geminiService.generateCinematicShot(
      desc,
      coreState.activeAtmosphere
    );
    if (res.url) setVideoUrl(res.url);
    setLoadingVideo(false);
  };

  return (
    <div className="relative w-screen h-screen bg-[#020617] text-slate-200 font-system overflow-hidden">
      {inLobby ? (
        <VirtualLobby
          onExitLobby={() => setInLobby(false)}
          coreState={coreState}
          updateCoreState={(u) => setCoreState((s) => ({ ...s, ...u }))}
          isAiEnabled={aiEnabled}
          setIsAiEnabled={setAiEnabled}
          rooms={rooms}
          agents={agents}
        />
      ) : (
        <>
          {rooms.length > 0 && agents.length > 0 && (
            <SvgHotelBackdrop
              atmosphere={coreState.activeAtmosphere}
              enabled
              rooms={rooms}
              agents={agents}
              gridW={GRID_WIDTH}
              gridH={GRID_HEIGHT}
            />
          )}

          <header className="absolute top-0 left-0 right-0 h-20 px-8 flex justify-between items-center z-40">
            <div className="flex items-center gap-3">
              <Layers size={18} className="text-cyan-400" />
              <span className="text-xs tracking-widest uppercase">
                SeedCore Director
              </span>
            </div>

            <button
              onClick={() => setAiEnabled((v) => !v)}
              className="px-6 py-2 rounded-full border border-cyan-500/40 text-xs uppercase"
            >
              <Power size={12} /> {aiEnabled ? "Core Live" : "Core Standby"}
            </button>
          </header>

          {/* ConciergePanel rendered last to ensure it's above all transforms/filters */}
          <ConciergePanel active={aiEnabled} />

          {videoUrl && (
            <div className="absolute inset-0 bg-black/90 z-50 flex items-center justify-center">
              {loadingVideo ? (
                <Loader2 className="animate-spin text-cyan-500" />
              ) : (
                <video src={videoUrl} autoPlay loop controls />
              )}
              <button
                onClick={() => setVideoUrl(null)}
                className="absolute top-6 right-6"
              >
                <X />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default App;
