export interface Point {
  x: number;
  y: number;
}

export interface Opening {
  identity: string;
  open: "inwards" | "outwards";
  hanging: "left" | "right" | "top" | "bottom";
  displacement: number;
  degreesOpen: number;
  minDegree: number;
  maxDegree: number;
  width: number;
  height?: number;
  state: "open" | "closed" | "opening" | "closing";
  _targetDegree?: number;
}

export type DoorStyle = "internal" | "fire" | "accessible" | "double";

export interface DoorPreset {
  label: string;
  width: number;
  height: number;
  thickness: number;
  openings: number;
}

export const DOOR_PRESETS: Record<DoorStyle, DoorPreset> = {
  internal:   { label: "Internal Door",    width: 762,  height: 1981, thickness: 35, openings: 1 },
  fire:       { label: "Fire Door",        width: 762,  height: 1981, thickness: 44, openings: 1 },
  accessible: { label: "Accessible Door",  width: 840,  height: 1981, thickness: 35, openings: 1 },
  double:     { label: "Double Doors",     width: 1524, height: 1981, thickness: 35, openings: 2 },
};

export interface Inset {
  wall: number;
  locked: boolean;
  type: "window" | "door";
  doorStyle?: DoorStyle;
  hasHandle?: boolean;
  openings: Opening[];
  positionLeft: number;
  positionGround: number;
  width: number;
  height: number;
}

export interface Slope {
  wall: number;
  kneeWallHeight: number;
  roofAngle: number;
}

export interface RoomShape {
  path: Point[];
  slopes: Slope[];
  wallThickness: number;
  roomHeight: number;
  insets: Inset[];
}

export interface Wall {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  length: number;
  angle?: number;
}

export interface ActiveItem {
  type: string;
  id: number;
  poly: Point[];
  wall: number;
  identity: string | number;
  inset?: Inset;
}

export interface ItemDefinition {
  type: string;
  identity?: string | number;
  id: number;
  wall: number;
  poly: Point[];
  inset?: Inset;
  origin?: { x?: number; y?: number; left?: number };
}

export type InteractionMode = "all" | "insets" | "walls" | "slopes";

export interface GridSizeOption {
  label: string;
  value: number;
}
