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
  /// Bit position within the target byte; pads sharing a pairIndex are the two
  /// plates of one on/off switch (one plate per possible bit value).
  pairIndex: number;
  value: 0 | 1;
  position: Point;
}

export interface PressureButton {
  id: string;
  position: Point;
}

export interface Player {
  position: Point;
  size: number;
  speed: number;
  color: string;
  inventory: Item[];
}

export type DialogMessageSequence = readonly string[];

export interface DialogState {
  messages: DialogMessageSequence;
  messageIndex: number;
  visibleCharacters: number;
  charactersPerSecond: number;
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
  pressurePads?: PressurePad[];
  pressureButton?: PressureButton;
  /// Bit pattern the pads must be set to (bit N == pad pairIndex N's active value) for the button to unlock doors.
  pressureTarget?: number;
  /// Presence of a mirror player spawn makes this a mirror room: a second entity that moves in
  /// lockstep with the player's input but has its own position and collisions.
  mirrorPlayerStart?: Point;
  /// Tile the mirror player must reach to unlock this room's doors.
  mirrorGoal?: Point;
  /// Overrides the normal scroll-zoom and shows the full ROOM_WIDTH x ROOM_HEIGHT room at once.
  fixedZoom?: boolean;
}

export interface Dungeon {
  id: string;
  name: string;
  startRoom: string;
  rooms: Record<string, Room>;
}
