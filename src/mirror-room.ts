import type { Color } from "littlejsengine";
import { drawRect, timeDelta, vec2 } from "littlejsengine";
import type { Point, Room } from "./types";
import { ROOM_HEIGHT, ROOM_WIDTH } from "./types";

export const MIRROR_PLAYER_SIZE = 0.7;
const MIRROR_PLAYER_COLOR = "#5599ff";

let mirrorPosition: Point = { x: 0, y: 0 };
let goalReached = false;

function tileToWorld(x: number, y: number): Point {
  return {
    x: x - ROOM_WIDTH / 2,
    y: ROOM_HEIGHT / 2 - y,
  };
}

export function isMirrorRoom(room: Room): boolean {
  return room.mirrorPlayerStart !== undefined;
}

export function resetMirrorRoom(room: Room): void {
  goalReached = false;
  if (!room.mirrorPlayerStart) return;
  const world = tileToWorld(room.mirrorPlayerStart.x, room.mirrorPlayerStart.y);
  mirrorPosition = { x: world.x, y: world.y };
}

export function getMirrorPlayerPosition(): Point {
  return mirrorPosition;
}

export function getMirrorPlayerTile(): Point {
  return {
    x: Math.floor(mirrorPosition.x + ROOM_WIDTH / 2),
    y: Math.floor(ROOM_HEIGHT / 2 - mirrorPosition.y),
  };
}

/// Moves the mirror player in the same direction as the real player's input, at the given
/// speed. Sticky per axis: if an axis move would collide, that axis simply doesn't move this
/// frame instead of blocking the whole move, matching the real player's own sliding collision.
export function updateMirrorPlayer(
  room: Room,
  direction: Point,
  speed: number,
  isBlocked: (position: Point) => boolean,
): void {
  if (!isMirrorRoom(room)) return;
  if (direction.x === 0 && direction.y === 0) return;

  const length = Math.hypot(direction.x, direction.y) || 1;
  const velocity = {
    x: (direction.x / length) * speed * timeDelta,
    y: (direction.y / length) * speed * timeDelta,
  };

  const nextX = { x: mirrorPosition.x + velocity.x, y: mirrorPosition.y };
  if (!isBlocked(nextX)) mirrorPosition = nextX;

  const nextY = { x: mirrorPosition.x, y: mirrorPosition.y + velocity.y };
  if (!isBlocked(nextY)) mirrorPosition = nextY;
}

/// Checks the mirror goal (if any) against the mirror player's current tile. Edge-triggered:
/// returns true only on the frame the goal is first reached.
export function checkMirrorGoal(room: Room): boolean {
  if (goalReached || !room.mirrorGoal) return false;

  const mirrorTile = getMirrorPlayerTile();
  if (mirrorTile.x === room.mirrorGoal.x && mirrorTile.y === room.mirrorGoal.y) {
    goalReached = true;
    return true;
  }

  return false;
}

export function hasMirrorGoalBeenReached(): boolean {
  return goalReached;
}

export function drawMirrorPlayer(room: Room, parseColor: (hex: string) => Color): void {
  if (!isMirrorRoom(room)) return;
  drawRect(
    vec2(mirrorPosition.x, mirrorPosition.y),
    vec2(MIRROR_PLAYER_SIZE),
    parseColor(MIRROR_PLAYER_COLOR),
  );

  if (!room.mirrorGoal) return;
  const goalWorld = tileToWorld(room.mirrorGoal.x + 0.5, room.mirrorGoal.y + 0.5);
  const goalColor = goalReached ? "#fff2c2" : "#8888aa";
  drawRect(vec2(goalWorld.x, goalWorld.y), vec2(0.8), parseColor(goalColor));
}
