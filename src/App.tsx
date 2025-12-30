import React, { useState, useEffect, useCallback } from "react";
import {
  Activity,
  Layers,
  Terminal,
  Power,
  Film,
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

/* ------------------ LEFT PANEL ------------------ */

const SensoryTelemetryPanel = ({ active }: { active: boolean }) => {
  const [lux, setLux] = useState(450);
  const [db, setDb] = useState(45);
  const [temp, setTemp] = useState(22);

  useEffect(() => {
    if (!active) return;
    const i = setInterval(() => {
      setLux((v) => Math.min(800, Math.max(200, v + (Math.random() - 0.5) * 50)));
      setDb((v) => Math.min(90, Math.max(30, v + (Math.random() - 0.5) * 10)));
      setTemp(22 + (Math.random() - 0.5));
    }, 1000);
    return () => clearInterval(i);
  }, [active]);

  return (
    <div className="absolute top-24 left-8 w-64 bg-slate-950/40 backdrop-blur-xl border border-cyan-500/20 p-6 rounded-xl z-30 pointer-events-none">
      <h3 className="text-[10px] font-bold text-cyan-400 uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
        <Activity size={14} />
        {active ? "Sensory Data" : "Sensors Off"}
      </h3>
      <div className="text-[9px] font-mono text-cyan-400">
        Lux: {active ? lux.toFixed(0) : "---"} lx
      </div>
      <div className="text-[9px] font-mono text-cyan-400">
        Noise: {active ? db.toFixed(0) : "---"} dB
      </div>
      <div className="text-[9px] font-mono text-cyan-400">
        Temp: {active ? temp.toFixed(1) : "---"} °C
      </div>
    </div>
  );
};

/* ------------------ MAIN APP ------------------ */

const App: React.FC = () => {
  const [initialized, setInitialized] = useState(false);
  const [inLobby, setInLobby] = useState(true);
  const [aiEnabled, setAiEnabled] = useState(false);

  const [grid, setGrid] = useState<EntityType[][]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);

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
    setAgents((a) => updateAgentsLogic(a, grid));
    setCoreState((s) => ({ ...s, timeOfDay: (s.timeOfDay + 0.05) % 24 }));
  }, [grid]);

  useEffect(() => {
    if (!initialized) return;
    const i = setInterval(tick, TICK_RATE_MS);
    return () => clearInterval(i);
  }, [initialized, tick]);

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

          <SensoryTelemetryPanel active={aiEnabled} />

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
