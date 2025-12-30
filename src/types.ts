
export const EntityType = {
  EMPTY: 'EMPTY',
  WALL: 'WALL',
  LOBBY_FLOOR: 'LOBBY_FLOOR',
  RECEPTION_DESK: 'RECEPTION_DESK',
  GARDEN_PATH: 'GARDEN_PATH',
  GARDEN_PLANT: 'GARDEN_PLANT',
  GARDEN_WATER: 'GARDEN_WATER',
  ROOM_FLOOR: 'ROOM_FLOOR',
  ROOM_WALL: 'ROOM_WALL',
  ROOM_DOOR: 'ROOM_DOOR',
  ROOM_FURNITURE: 'ROOM_FURNITURE',
  SERVICE_HUB: 'SERVICE_HUB', // New: Robotic docking/prep area
} as const;

export type EntityType = typeof EntityType[keyof typeof EntityType];

export const AgentRole = {
  GUEST: 'GUEST',
  STAFF_HUMAN: 'STAFF_HUMAN',
  ROBOT_WAITER: 'ROBOT_WAITER',
  ROBOT_CONCIERGE: 'ROBOT_CONCIERGE',
  ROBOT_GARDENER: 'ROBOT_GARDENER',
} as const;

export type AgentRole = typeof AgentRole[keyof typeof AgentRole];

export interface Coordinates {
  x: number;
  y: number;
}

export interface Agent {
  id: string;
  role: AgentRole;
  position: Coordinates;
  previousPosition?: Coordinates; // New: For calculating facing direction
  target: Coordinates | null;
  state: 'SOCIALIZING' | 'WALKING' | 'PAUSING' | 'OBSERVING' | 'SERVICING' | 'CHARGING';
  mood: string;
}

export interface Room {
  id: string;
  name: string;
  type: 'SUITE' | 'LOBBY' | 'GARDEN' | 'SERVICE';
  topLeft: Coordinates;
  bottomRight: Coordinates;
}

export const SeedCorePlane = {
  NARRATIVE: 'NARRATIVE',
  DIRECTOR: 'DIRECTOR',
  ACTORS: 'ACTORS',
  SET: 'SET'
} as const;

export type SeedCorePlane = typeof SeedCorePlane[keyof typeof SeedCorePlane];

export interface SeedCoreLog {
  id: string;
  timestamp: number;
  plane: SeedCorePlane;
  message: string;
  mood: 'NEUTRAL' | 'WARM' | 'TENSE';
}

export interface SeedCoreState {
  activeAtmosphere: 'MORNING_LIGHT' | 'GOLDEN_HOUR' | 'EVENING_CHIC' | 'MIDNIGHT_LOUNGE';
  logs: SeedCoreLog[];
  timeOfDay: number;
}
