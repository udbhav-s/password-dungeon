import { Color, drawRect, drawTile, tile, timeDelta, vec2 } from "littlejsengine";
import type { Point, Room } from "./types";

export const MIRROR_PLAYER_SIZE = 0.7;

// Kept in step with the player sprite constants in main.ts: the mirror uses the
// same sheet and frame layout, drawn under a tint so the two are tellable apart.
const SPRITE_FRAME_SIZE = 64;
const SPRITE_TEXTURE_INDEX = 1;
const SPRITE_DRAW_SIZE = 1.2;
const WALK_FRAME_DURATION = 0.16;
const MIRROR_TINT = new Color(0.55, 0.85, 1, 0.85);

const GOAL_COLOR = "#8888aa";
const GOAL_REACHED_COLOR = "#fff2c2";

let mirrorPosition: Point = { x: 0, y: 0 };
let goalReached = false;
let facing: "left" | "right" = "right";
let walking = false;
let walkElapsed = 0;
let walkFrame = 0;

function tileToWorld(room: Room, x: number, y: number): Point {
  return {
    x: x - room.width / 2,
    y: room.height / 2 - y,
  };
}

export function isMirrorRoom(room: Room): boolean {
  return room.mirrorPlayerStart !== undefined;
}

export function resetMirrorRoom(room: Room): void {
  goalReached = false;
  facing = "right";
  walking = false;
  walkElapsed = 0;
  walkFrame = 0;
  if (!room.mirrorPlayerStart) return;
  const world = tileToWorld(room, room.mirrorPlayerStart.x, room.mirrorPlayerStart.y);
  mirrorPosition = { x: world.x, y: world.y };
}

export function getMirrorPlayerPosition(): Point {
  return mirrorPosition;
}

export function getMirrorPlayerTile(room: Room): Point {
  return {
    x: Math.floor(mirrorPosition.x + room.width / 2),
    y: Math.floor(room.height / 2 - mirrorPosition.y),
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

  if (direction.x < 0) facing = "left";
  else if (direction.x > 0) facing = "right";

  if (direction.x === 0 && direction.y === 0) {
    walking = false;
    walkElapsed = 0;
    walkFrame = 0;
    return;
  }

  const length = Math.hypot(direction.x, direction.y) || 1;
  const velocity = {
    x: (direction.x / length) * speed * timeDelta,
    y: (direction.y / length) * speed * timeDelta,
  };

  const nextX = { x: mirrorPosition.x + velocity.x, y: mirrorPosition.y };
  if (!isBlocked(nextX)) mirrorPosition = nextX;

  const nextY = { x: mirrorPosition.x, y: mirrorPosition.y + velocity.y };
  if (!isBlocked(nextY)) mirrorPosition = nextY;

  walking = true;
  walkElapsed += timeDelta;
  walkFrame = Math.floor(walkElapsed / WALK_FRAME_DURATION) % 2;
}

/// Checks the mirror goal (if any) against the mirror player's current tile. Edge-triggered:
/// returns true only on the frame the goal is first reached.
export function checkMirrorGoal(room: Room): boolean {
  if (goalReached || !room.mirrorGoal) return false;

  const mirrorTile = getMirrorPlayerTile(room);
  if (mirrorTile.x === room.mirrorGoal.x && mirrorTile.y === room.mirrorGoal.y) {
    goalReached = true;
    return true;
  }

  return false;
}

export function hasMirrorGoalBeenReached(): boolean {
  return goalReached;
}

function spriteFrame(): number {
  if (!walking) return facing === "left" ? 0 : 1;
  return facing === "left" ? 2 + walkFrame : 4 + walkFrame;
}

export function drawMirrorRoom(room: Room, parseColor: (hex: string) => Color): void {
  if (!isMirrorRoom(room)) return;

  if (room.mirrorGoal) {
    const goalWorld = tileToWorld(room, room.mirrorGoal.x + 0.5, room.mirrorGoal.y + 0.5);
    drawRect(
      vec2(goalWorld.x, goalWorld.y),
      vec2(0.8),
      parseColor(goalReached ? GOAL_REACHED_COLOR : GOAL_COLOR),
    );
  }

  drawTile(
    vec2(mirrorPosition.x, mirrorPosition.y),
    vec2(SPRITE_DRAW_SIZE),
    tile(spriteFrame(), SPRITE_FRAME_SIZE, SPRITE_TEXTURE_INDEX),
    MIRROR_TINT,
  );
}
