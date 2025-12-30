import { type Room, type Agent, AgentRole, EntityType, type Coordinates } from "../types";
import { GRID_WIDTH, GRID_HEIGHT } from "../constants";

// --- GLOBAL LAYOUT CONSTANTS (Shared for generation and logic) ---
const ATRIUM_W = 20;
const ATRIUM_H = 12;
const ATRIUM_X = Math.floor(GRID_WIDTH / 2) - Math.floor(ATRIUM_W / 2);
const ATRIUM_Y = GRID_HEIGHT - ATRIUM_H - 4;

// Semantic Zones for AI Logic
const ZONES = {
  LOBBY: { x: ATRIUM_X, y: ATRIUM_Y, w: ATRIUM_W, h: ATRIUM_H },
  RECEPTION: { x: ATRIUM_X + Math.floor(ATRIUM_W / 2), y: ATRIUM_Y + 2 },
};

// Define explicitly what agents can walk on
const WALKABLE = new Set<EntityType>([
  EntityType.LOBBY_FLOOR,
  EntityType.ROOM_FLOOR,
  EntityType.GARDEN_PATH,
  EntityType.ROOM_DOOR,
  EntityType.RECEPTION_DESK, // Staff can be behind/at desk
  EntityType.SERVICE_HUB
]);

// Helper to clamp values within bounds
const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

const isWalkable = (grid: EntityType[][], x: number, y: number) => {
  // CRITICAL: Check grid exists and bounds before accessing
  if (
    !grid ||
    y < 0 || y >= grid.length ||
    x < 0 || x >= (grid[0]?.length ?? 0)
  ) return false;

  return WALKABLE.has(grid[y][x]);
};

export const generateMap = (width: number, height: number) => {
  const grid: EntityType[][] = Array(height).fill(null).map(() => Array(width).fill(EntityType.EMPTY));
  const rooms: Room[] = [];

  const safeSet = (x: number, y: number, type: EntityType) => {
    if (x >= 0 && x < width && y >= 0 && y < height) {
      grid[y][x] = type;
    }
  };

  // 1. GRAND ATRIUM (Lobby)
  for (let y = ATRIUM_Y; y < ATRIUM_Y + ATRIUM_H; y++) {
    for (let x = ATRIUM_X; x < ATRIUM_X + ATRIUM_W; x++) {
      safeSet(x, y, EntityType.LOBBY_FLOOR);
    }
  }
  // Reception Desk
  const deskY = ZONES.RECEPTION.y;
  const deskX = ZONES.RECEPTION.x;
  safeSet(deskX, deskY, EntityType.RECEPTION_DESK);
  safeSet(deskX - 1, deskY, EntityType.RECEPTION_DESK);
  safeSet(deskX + 1, deskY, EntityType.RECEPTION_DESK);

  rooms.push({
    id: "LOBBY-MAIN",
    name: "Grand Atrium",
    type: 'LOBBY',
    topLeft: { x: ATRIUM_X, y: ATRIUM_Y },
    bottomRight: { x: ATRIUM_X + ATRIUM_W - 1, y: ATRIUM_Y + ATRIUM_H - 1 }
  });

  // 2. WINGS GENERATION
  const createRoom = (id: string, x: number, y: number, w: number, h: number) => {
    // Walls
    for (let ry = y; ry < y + h; ry++) {
      for (let rx = x; rx < x + w; rx++) {
        if (rx === x || rx === x + w - 1 || ry === y || ry === y + h - 1) {
           // Door logic: Bottom center of room if above hall, Top center if below
           const isDoor = (ry === y + h - 1 || ry === y) && rx === x + Math.floor(w/2);
           if (isDoor) safeSet(rx, ry, EntityType.ROOM_DOOR);
           else safeSet(rx, ry, EntityType.ROOM_WALL);
        } else {
           safeSet(rx, ry, EntityType.ROOM_FLOOR);
        }
      }
    }
    // Furniture
    safeSet(x + 1, y + 1, EntityType.ROOM_FURNITURE);
    rooms.push({ id, name: `Room ${id}`, type: 'SUITE', topLeft: {x,y}, bottomRight: {x:x+w-1, y:y+h-1} });
  };

  // Vertical Wings extending UP from the Atrium sides
  const westWingX = ATRIUM_X - 2;
  const eastWingX = ATRIUM_X + ATRIUM_W + 1;
  const wingHeight = 26; // Adjusted to fit GRID_HEIGHT
  
  // West Wing Hallway
  for(let y = ATRIUM_Y - wingHeight; y < ATRIUM_Y; y++) {
      safeSet(westWingX, y, EntityType.LOBBY_FLOOR); 
      safeSet(westWingX - 1, y, EntityType.LOBBY_FLOOR); 
  }

  // East Wing Hallway
  for(let y = ATRIUM_Y - wingHeight; y < ATRIUM_Y; y++) {
      safeSet(eastWingX, y, EntityType.LOBBY_FLOOR); 
      safeSet(eastWingX + 1, y, EntityType.LOBBY_FLOOR); 
  }

  // Generate Rooms along West Wing
  for(let i=0; i<6; i++) {
     createRoom(`1${i}A`, westWingX - 6, ATRIUM_Y - 4 - (i*4), 5, 4);
     createRoom(`1${i}B`, westWingX + 1, ATRIUM_Y - 4 - (i*4), 5, 4);
  }

  // Generate Rooms along East Wing
  for(let i=0; i<6; i++) {
     createRoom(`2${i}A`, eastWingX - 5, ATRIUM_Y - 4 - (i*4), 5, 4);
     createRoom(`2${i}B`, eastWingX + 2, ATRIUM_Y - 4 - (i*4), 5, 4);
  }

  // 3. TOP CONNECTING CORRIDOR
  const bridgeY = Math.max(0, ATRIUM_Y - wingHeight);
  for(let x = westWingX; x <= eastWingX; x++) {
      safeSet(x, bridgeY, EntityType.LOBBY_FLOOR);
      safeSet(x, bridgeY + 1, EntityType.LOBBY_FLOOR);
  }
  // Rooms along the top bridge
  for(let i=0; i<6; i++) {
     createRoom(`30${i}`, westWingX + 2 + (i*6), bridgeY - 4, 5, 4);
  }

  // 4. GARDEN
  const gardenX = westWingX + 4;
  const gardenY = bridgeY + 4;
  const gardenW = (eastWingX - westWingX) - 6;
  const gardenH = (ATRIUM_Y - bridgeY) - 6;

  for(let y=gardenY; y<gardenY+gardenH; y++) {
    for(let x=gardenX; x<gardenX+gardenW; x++) {
       const r = Math.random();
       if (r > 0.8) safeSet(x, y, EntityType.GARDEN_PLANT);
       else if (r > 0.6) safeSet(x, y, EntityType.GARDEN_WATER);
       else safeSet(x, y, EntityType.GARDEN_PATH);
    }
  }
  rooms.push({
      id: "GARDEN-MAIN", name: "Central Zen Court", type: 'GARDEN', 
      topLeft: {x: gardenX, y: gardenY}, bottomRight: {x: gardenX+gardenW, y: gardenY+gardenH}
  });

  return { grid, rooms };
};

export const generateAgents = (count: number, width: number, height: number): Agent[] => {
  const agents: Agent[] = [];
  
  // Center of Atrium for spawn calculations
  const startX = ZONES.RECEPTION.x;
  const startY = ATRIUM_Y + Math.floor(ATRIUM_H / 2);

  const guestCount = 12;
  const robotCount = 6;

  // Fix 4: Spread Spawn Positions (with bounds clamping)
  for (let i = 0; i < guestCount; i++) {
    // Spread random spawn in lobby area
    const offsetX = Math.floor((Math.random() * (ATRIUM_W - 4)) - (ATRIUM_W/2 - 2));
    const offsetY = Math.floor((Math.random() * (ATRIUM_H - 4)) - (ATRIUM_H/2 - 2));
    
    // CRITICAL: Clamp positions to grid bounds
    const x = clamp(startX + offsetX, 0, width - 1);
    const y = clamp(startY + offsetY, 0, height - 1);
    
    agents.push({
      id: `G-${i}`,
      role: AgentRole.GUEST,
      position: { x, y },
      previousPosition: { x, y }, // Initialize previousPosition
      target: null,
      state: 'WALKING',
      mood: 'Neutral'
    });
  }

  for (let i = 0; i < robotCount; i++) {
    // Robots spawn near service points
    const isConcierge = i % 3 === 0;
    const spawnX = isConcierge ? ZONES.RECEPTION.x : startX + (Math.random() > 0.5 ? 5 : -5);
    const spawnY = isConcierge ? ZONES.RECEPTION.y : startY;

    // CRITICAL: Clamp positions to grid bounds
    const x = clamp(spawnX, 0, width - 1);
    const y = clamp(spawnY, 0, height - 1);

    agents.push({
      id: `R-${i}`,
      role: isConcierge ? AgentRole.ROBOT_CONCIERGE : AgentRole.ROBOT_WAITER,
      position: { x, y },
      previousPosition: { x, y }, // Initialize previousPosition
      target: null,
      state: 'SERVICING',
      mood: 'Operational'
    });
  }

  return agents;
};

export const updateAgentsLogic = (agents: Agent[], grid: EntityType[][]): Agent[] => {
  // Safety: Validate grid before processing
  if (!grid || !Array.isArray(grid) || grid.length === 0) {
    console.warn("Invalid grid in updateAgentsLogic");
    return agents; // Return agents unchanged if grid is invalid
  }

  return agents.map(agent => {
    // Safety: Ensure agent has valid position
    if (!agent.position || typeof agent.position.x !== 'number' || typeof agent.position.y !== 'number') {
      console.warn(`Invalid agent position for agent ${agent.id}`);
      return agent; // Return agent unchanged
    }

    let { position, target, state } = agent;
    // Use existing previousPosition if available, otherwise use current position
    const previousPosition = agent.previousPosition ? { ...agent.previousPosition } : { ...position };

    // Fix 1: Explicit Walkability
    const isValid = (x: number, y: number) => isWalkable(grid, x, y);

    // TARGET SELECTION LOGIC
    if (!target || (position.x === target.x && position.y === target.y)) {
       let attempts = 0;
       let found = false;
       
       // Small chance to pause
       if (Math.random() > 0.8) {
           return { ...agent, state: 'PAUSING', target: position }; 
       }

       state = 'WALKING';

       while(!found && attempts < 15) {
          let tx, ty;

          // Fix 2: Role-Aware Semantic Targets
          if (agent.role === AgentRole.ROBOT_CONCIERGE) {
             // Stay very close to reception
             tx = ZONES.RECEPTION.x + Math.floor(Math.random() * 6) - 3;
             ty = ZONES.RECEPTION.y + Math.floor(Math.random() * 4) - 2;
          } 
          else if (agent.role === AgentRole.GUEST) {
             // Guests stick to Lobby or wander to Garden
             if (Math.random() > 0.2) {
                 // Lobby Area
                 tx = ATRIUM_X + 2 + Math.floor(Math.random() * (ATRIUM_W - 4));
                 ty = ATRIUM_Y + 2 + Math.floor(Math.random() * (ATRIUM_H - 4));
             } else {
                 // Garden / Wing Hallways - Pick random point on map and check if walkable
                 tx = Math.floor(Math.random() * GRID_WIDTH);
                 ty = Math.floor(Math.random() * GRID_HEIGHT);
             }
          } 
          else {
             // Waiters/Staff go anywhere walkable
             tx = Math.floor(Math.random() * GRID_WIDTH);
             ty = Math.floor(Math.random() * GRID_HEIGHT);
          }

          if (isValid(tx, ty)) {
              target = { x: tx, y: ty };
              found = true;
          }
          attempts++;
       }
       
       // Fallback: stay put if no valid target found
       if (!found) target = position;
    }

    // MOVEMENT LOGIC
    if (target && (target.x !== position.x || target.y !== position.y)) {
       const dx = Math.sign(target.x - position.x);
       const dy = Math.sign(target.y - position.y);
       
       // Fix 3: Unbiased Axis Movement (Try X then Y, or Y then X randomly)
       const moves = [];
       if (dx !== 0) moves.push({ x: position.x + dx, y: position.y });
       if (dy !== 0) moves.push({ x: position.x, y: position.y + dy });

       // Filter blocked moves
       const validMoves = moves.filter(m => isValid(m.x, m.y));

       if (validMoves.length > 0) {
           // Randomly pick one of the valid moves to prevent "sliding" artifacts
           position = validMoves[Math.floor(Math.random() * validMoves.length)];
       } else {
           // Path blocked completely? Reset target to find a new path next tick
           target = null;
       }
    }

    return { ...agent, position, previousPosition, target, state };
  });
};
