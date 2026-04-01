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

export type WallReference = {
  type: "perimeter";
  index: number;
} | {
  type: "internal";
  id: string;
};

export interface Inset {
  wall: number;
  wallRef?: WallReference;
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
  wallRef?: WallReference;
  kneeWallHeight: number;
  roofAngle: number;
}

export interface InternalWall {
  id: string;
  start: Point;
  end: Point;
  thickness?: number;
  connectedTo?: {
    start?: WallReference;
    end?: WallReference;
  };
}

export type CeilingLightType = "pendant" | "spotlight";

export interface CeilingLight {
  id: string;
  type: CeilingLightType;
  /** Position in mm from origin */
  x: number;
  y: number;
  /** For pendant: cable length in mm */
  cableLength?: number;
  /** Light color temperature in Kelvin (default 2700 for warm) - ignored if rgb is set */
  colorTemp?: number;
  /** RGB color values (0-255 each) - overrides colorTemp if set */
  rgb?: { r: number; g: number; b: number };
  /** Light intensity (0-1, default 1) */
  intensity?: number;
  /** For spotlight: beam angle in degrees (default 40) */
  beamAngle?: number;
}

export interface FloorPlan {
  /** External walls defining the building perimeter */
  perimeter: Point[];
  /** @deprecated Use perimeter instead */
  path?: Point[];
  /** Internal wall segments */
  internalWalls: InternalWall[];
  /** Sloped ceiling sections */
  slopes: Slope[];
  /** Default wall thickness in mm */
  wallThickness: number;
  /** Ceiling height in mm */
  ceilingHeight: number;
  /** @deprecated Use ceilingHeight instead */
  roomHeight?: number;
  /** Doors and windows */
  insets: Inset[];
  /** Ceiling lights */
  lights?: CeilingLight[];
  /** Per-wall interior paint colours, keyed by wall index (hex string e.g. "#f1e1cc") */
  wallColors?: Record<number, string>;
}

/** @deprecated Use FloorPlan instead */
export type RoomShape = FloorPlan;

/** Helper to get perimeter from FloorPlan (handles old 'path' property) */
export function getPerimeter(plan: FloorPlan): Point[] {
  return plan.perimeter ?? plan.path ?? [];
}

/** Helper to get ceiling height from FloorPlan (handles old 'roomHeight' property) */
export function getCeilingHeight(plan: FloorPlan): number {
  return plan.ceilingHeight ?? plan.roomHeight ?? 2400;
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
