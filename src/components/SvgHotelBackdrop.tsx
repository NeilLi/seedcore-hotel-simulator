import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Room, Agent } from "../types";
import { getTheme, getCoordinates } from "../utils/svgHotelMap";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const DEFAULT_GRID_W = 80;
const DEFAULT_GRID_H = 44;
const BASE_TILT_X = 25;
const MAX_TILT = 5;

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Props {
  atmosphere: string;
  enabled: boolean;
  rooms: Room[];
  agents: Agent[];
  gridW?: number;
  gridH?: number;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function SvgHotelBackdrop({
  atmosphere,
  enabled,
  rooms,
  agents,
  gridW = DEFAULT_GRID_W,
  gridH = DEFAULT_GRID_H,
}: Props) {
  /* ------------------------------ Guards ----------------------------- */

  if (!enabled) return null;
  if (!Array.isArray(rooms) || !Array.isArray(agents)) return null;

  /* ------------------------------ Theme ------------------------------ */

  const theme = useMemo(() => getTheme(atmosphere), [atmosphere]);

  /* ------------------------------ Mouse ------------------------------ */

  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const nx = (e.clientX / window.innerWidth - 0.5) * MAX_TILT;
      const ny = (e.clientY / window.innerHeight - 0.5) * MAX_TILT;
      setTilt({ x: nx, y: ny });
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  /* -------------------------- Safe Geometry -------------------------- */

  const safeRooms = useMemo(() => {
    return rooms.flatMap((room) => {
      try {
        const c = getCoordinates(room);
        if (
          !c ||
          typeof c.x !== "number" ||
          typeof c.y !== "number" ||
          typeof c.w !== "number" ||
          typeof c.h !== "number"
        ) {
          return [];
        }
        return [{ ...room, _coords: c }];
      } catch {
        return [];
      }
    });
  }, [rooms]);

  const safeAgents = useMemo(() => {
    return agents.flatMap((agent) => {
      try {
        const c = getCoordinates(agent);
        if (!c || typeof c.x !== "number" || typeof c.y !== "number") {
          return [];
        }
        return [{ ...agent, _coords: c }];
      } catch {
        return [];
      }
    });
  }, [agents]);

  /* ------------------------------ Render ----------------------------- */

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* -------------------- Single Transform Owner -------------------- */}
      <div
        className="w-full h-full will-change-transform"
        style={{
          transform: `perspective(1200px)
            rotateX(${BASE_TILT_X + tilt.y}deg)
            rotateY(${tilt.x}deg)
            scale(0.9)`,
          transformStyle: "preserve-3d",
        }}
      >
        <svg
          viewBox={`0 0 ${gridW} ${gridH}`}
          className="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
          style={{ mixBlendMode: "screen" }}
        >
          {/* ------------------------- Grid ------------------------- */}
          {Array.from({ length: Math.floor(gridH / 2) }).map((_, i) => (
            <line
              key={`h-${i}`}
              x1={0}
              y1={i * 2}
              x2={gridW}
              y2={i * 2}
              stroke={theme.grid}
              strokeWidth={0.05}
              opacity={0.4}
            />
          ))}

          {Array.from({ length: Math.floor(gridW / 2) }).map((_, i) => (
            <line
              key={`v-${i}`}
              x1={i * 2}
              y1={0}
              x2={i * 2}
              y2={gridH}
              stroke={theme.grid}
              strokeWidth={0.05}
              opacity={0.4}
            />
          ))}

          {/* ------------------------- Rooms ------------------------- */}
          {safeRooms.map((room) => {
            const { x, y, w, h } = room._coords;
            return (
              <g key={room.id}>
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  fill={theme.roomFill}
                  opacity={0.6}
                />
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  fill="none"
                  stroke={theme.roomBorder}
                  strokeWidth={0.1}
                />
              </g>
            );
          })}

          {/* ------------------------- Agents ------------------------- */}
          {safeAgents.map((agent) => {
            const { x, y } = agent._coords;
            const isRobot = String(agent.role).includes("ROBOT");
            const color = isRobot
              ? theme.agentRobot
              : theme.agentHuman;

            return (
              <g key={agent.id}>
                <circle cx={x + 0.5} cy={y + 0.5} r={0.25} fill={color} />
              </g>
            );
          })}
        </svg>
      </div>

      {/* ------------------------- Vignette ------------------------- */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
    </div>
  );
}
