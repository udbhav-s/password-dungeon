export const ROOM_WIDTH = 32;
export const ROOM_HEIGHT = 32;

export type TileType = "space" | "wall" | "door" | "object" | "lava";

export interface Point {
  x: number;
  y: number;
}

export interface Tile {
  type: TileType;
  color?: string;
}

export interface Door extends Tile {
  type: "door";
  id?: string;
  locked?: boolean;
  x: number;
  y: number;
  toRoom: string;
  entry: Point;
}

export type RoomObjectType = "computer";

export interface RoomObject extends Tile {
  type: "object";
  id: string;
  name: string;
  objectType: RoomObjectType;
  programId?: string;
  color: string;
  position: Point;
}

export interface Item {
  id: string;
  name: string;
  description: string;
  color: string;
  position: Point;
}

export interface PressurePad {
  id: string;
  /// Bit position within the target value; pads sharing a pairIndex are the two
  /// plates of one on/off switch (one plate per possible bit value).
  pairIndex: number;
  value: 0 | 1;
  position: Point;
}

export interface PressureButton {
  id: string;
  position: Point;
}

/// One named region of a program's exposed memory buffer, used by the Memory
/// Legend to label which bytes belong to which struct field.
export interface MemoryField {
  name: string;
  type: string;
  offset: number;
  size: number;
}

export interface GolfBallConfig {
  position: Point;
  size: number;
  friction: number;
  acceleration: number;
  wallBounciness: number;
}

export interface GolfHoleConfig {
  position: Point;
  size: number;
}

export interface PressurePlateConfig {
  position: Point;
}

export interface CrateConfig {
  position: Point;
  size: number;
}

export interface CratePressurePlateConfig extends PressurePlateConfig {
  id: string;
  doorId: string;
}

export interface Player {
  position: Point;
  size: number;
  speed: number;
  color: string;
  inventory: Item[];
}

export type DialogMessageSequence = readonly string[];

export interface DialogChoice {
  label: string;
  onSelect: () => void;
}

export interface DialogOptions {
  choices?: readonly DialogChoice[];
  onComplete?: () => void;
  onEscape?: () => void;
}

export interface DialogState {
  messages: DialogMessageSequence;
  messageIndex: number;
  visibleCharacters: number;
  charactersPerSecond: number;
  choices?: readonly DialogChoice[];
  selectedChoiceIndex: number;
  onComplete?: () => void;
  onEscape?: () => void;
}

export interface Room {
  id: string;
  name: string;
  width: number;
  height: number;
  wallColor: string;
  tiles: string[];
  doors: Door[];
  objects: RoomObject[];
  items: Item[];
  playerStart: Point;
  floorColor?: string;
  golfBall?: GolfBallConfig;
  golfHole?: GolfHoleConfig;
  pressurePlate?: PressurePlateConfig;
  crate?: CrateConfig;
  cratePressurePlates?: CratePressurePlateConfig[];
  crateResetPlate?: PressurePlateConfig;
  pressurePads?: PressurePad[];
  pressureButton?: PressureButton;
  /// Value the pads must spell out in binary (bit N == pad pairIndex N's active
  /// value) for the button to unlock this room's doors.
  pressureTarget?: number;
  /// Presence of a mirror player spawn makes this a mirror room: a second entity
  /// that moves in lockstep with the player's input but has its own position and
  /// collisions.
  mirrorPlayerStart?: Point;
  /// Tile the mirror player must reach to clear this room.
  mirrorGoal?: Point;
  /// Overrides the normal scroll-zoom and fits the whole room on screen at once.
  fixedZoom?: boolean;
}

export interface Dungeon {
  id: string;
  name: string;
  startRoom: string;
  rooms: Record<string, Room>;
}
