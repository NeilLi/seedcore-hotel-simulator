import React, { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import {
  MeshReflectorMaterial,
  Text,
  PerspectiveCamera,
  Environment,
  Float,
} from "@react-three/drei";
import * as THREE from "three";
import { type Room, type Agent } from "../types";

const GRID_SCALE = 0.4;

/* ---------------- Room Zone ---------------- */

function RoomZone({
  room,
  color,
}: {
  room: Room;
  color: string;
}) {
  if (!room?.topLeft || !room?.bottomRight) return null;

  const w = room.bottomRight.x - room.topLeft.x + 1;
  const h = room.bottomRight.y - room.topLeft.y + 1;

  const x = room.topLeft.x * GRID_SCALE - 16 * GRID_SCALE + (w * GRID_SCALE) / 2;
  const z = room.topLeft.y * GRID_SCALE - 8 * GRID_SCALE + (h * GRID_SCALE) / 2;

  return (
    <group position={[x, 0, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w * GRID_SCALE, h * GRID_SCALE]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.15}
          emissive={color}
          emissiveIntensity={2}
          toneMapped={false}
        />
      </mesh>

      <Text
        position={[0, 1.4, 0]}
        fontSize={0.22}
        color={color}
        fillOpacity={0.8}
      >
        {room.name.toUpperCase()}
      </Text>
    </group>
  );
}

/* ---------------- Main Layer ---------------- */

export function VirtualRealityLayer({
  enabled,
  atmosphere,
  rooms,
  agents,
  backgroundImage,
}: {
  enabled: boolean;
  atmosphere: string;
  rooms: Room[];
  agents: Agent[];
  backgroundImage?: string;
}) {
  if (!enabled) return null; // 🔑 HARD EXIT

  const themeColor =
    atmosphere === "GOLDEN_HOUR" ? "#fbbf24" : "#22d3ee";

  const particles = useMemo(
    () =>
      Array.from({ length: 24 }, () => ({
        pos: [
          (Math.random() - 0.5) * 35,
          Math.random() * 8,
          (Math.random() - 0.5) * 20,
        ] as [number, number, number],
      })),
    []
  );

  return (
    <div className="absolute inset-0 z-[5] pointer-events-none">
      {/* ---------- HTML BACKGROUND ---------- */}
      <div className="absolute inset-0 z-0">
        {backgroundImage ? (
          <img
            src={backgroundImage}
            alt="Atmosphere"
            className="w-full h-full object-cover opacity-40"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        ) : (
          <div className="w-full h-full bg-slate-950/50" />
        )}
        <div className="absolute inset-0 shadow-[inset_0_0_200px_rgba(0,0,0,0.9)]" />
      </div>

      {/* ---------- WEBGL LAYER ---------- */}
      <Canvas
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 1.5]}
        onCreated={({ gl }) =>
          gl.setClearColor(new THREE.Color("#000"), 0)
        }
      >
        <PerspectiveCamera makeDefault position={[0, 10, 20]} fov={32} />
        <fog attach="fog" args={["#000", 12, 35]} />

        {/* Floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[100, 100]} />
          <MeshReflectorMaterial
            blur={[300, 100]}
            resolution={512}
            mixStrength={15}
            roughness={0.9}
            color="#050505"
            metalness={0.4}
            transparent
            opacity={0.35}
          />
        </mesh>

        {/* Rooms */}
        {rooms.map((r) => (
          <RoomZone key={r.id} room={r} color={themeColor} />
        ))}

        {/* Agents */}
        {agents.map((a) => (
          <mesh
            key={a.id}
            position={[
              a.position.x * GRID_SCALE - 16 * GRID_SCALE,
              0.5,
              a.position.y * GRID_SCALE - 8 * GRID_SCALE,
            ]}
          >
            <sphereGeometry args={[0.12, 16, 16]} />
            <meshStandardMaterial
              emissive={themeColor}
              emissiveIntensity={6}
              toneMapped={false}
            />
          </mesh>
        ))}

        {/* Particles */}
        {particles.map((p, i) => (
          <Float key={i} speed={2} floatIntensity={1}>
            <mesh position={p.pos}>
              <sphereGeometry args={[0.02, 8, 8]} />
              <meshStandardMaterial
                emissive={themeColor}
                emissiveIntensity={4}
                transparent
                opacity={0.5}
                toneMapped={false}
              />
            </mesh>
          </Float>
        ))}

        <ambientLight intensity={0.4} />
        <Environment preset="night" />
      </Canvas>
    </div>
  );
}
