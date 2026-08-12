export const ROOM_WIDTH = 32;
export const ROOM_HEIGHT = 32;

export type TileType = "space" | "wall" | "door";

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
  x: number;
  y: number;
  toRoom: string;
  entry: Point;
}

export interface Item {
  id: string;
  name: string;
  description: string;
  color: string;
  position: Point;
}

export interface Player {
  position: Point;
  size: number;
  speed: number;
  color: string;
  inventory: Item[];
}

export interface Room {
  id: string;
  name: string;
  width: number;
  height: number;
  wallColor: string;
  tiles: string[];
  doors: Door[];
  items: Item[];
  playerStart: Point;
}

export interface Dungeon {
  id: string;
  name: string;
  startRoom: string;
  rooms: Record<string, Room>;
}
