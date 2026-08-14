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
  floorColor?: string;
  golfBall?: GolfBallConfig;
  golfHole?: GolfHoleConfig;
  pressurePlate?: PressurePlateConfig;
}

export interface Dungeon {
  id: string;
  name: string;
  startRoom: string;
  rooms: Record<string, Room>;
}
