import { Color, drawRect, ParticleEmitter, rgb, timeDelta, vec2 } from "littlejsengine";
import type { Point, PressurePad, Room } from "./types";

const LIT_COLOR = "#fff2c2";
const UNLIT_COLOR = "#5a4a2a";
const FAIL_COLOR = "#c0392b";
const BIT_ON_COLOR = "#3ddc61";
const BIT_OFF_COLOR = "#e74c3c";
const PAD_SIZE = 0.7;
const FAIL_FLASH_DURATION = 0.6;

const GOLD_START = rgb(1, 0.94, 0.72, 1);
const GOLD_END = rgb(1, 0.78, 0.3, 0);

// Logical bit used for the target check; defaults to 0 for pairs no one has stepped on yet.
let padValues: Record<number, 0 | 1> = {};
// Which pad (if any) is currently lit per pair; null means neither plate has been pressed yet.
let litPad: Record<number, 0 | 1 | null> = {};
const litEmitters = new Map<string, ParticleEmitter>();
let previousPlayerTile: Point = { x: -1, y: -1 };
let solved = false;
let failFlashTimer = 0;
let justFailed = false;

function parseColor(hex: string): Color {
  const value = hex.replace("#", "");
  const red = Number.parseInt(value.slice(0, 2), 16) / 255;
  const green = Number.parseInt(value.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(value.slice(4, 6), 16) / 255;
  return new Color(red, green, blue);
}

function tileToWorld(room: Room, x: number, y: number): Point {
  return {
    x: x - room.width / 2,
    y: room.height / 2 - y,
  };
}

function isPadLit(pad: PressurePad): boolean {
  return litPad[pad.pairIndex] === pad.value;
}

function destroyEmitter(padId: string): void {
  litEmitters.get(padId)?.destroy();
  litEmitters.delete(padId);
}

function spawnLitEmitter(room: Room, pad: PressurePad): void {
  if (litEmitters.has(pad.id)) return;

  const world = tileToWorld(room, pad.position.x + 0.5, pad.position.y + 0.5);
  const emitter = new ParticleEmitter(
    vec2(world.x, world.y),
    0,
    PAD_SIZE,
    0,
    6,
    Math.PI,
    undefined,
    GOLD_START,
    GOLD_START,
    GOLD_END,
    GOLD_END,
    0.6,
    0.04,
    0,
    0.01,
    0.02,
    0.98,
    1,
    -0.05,
    Math.PI,
    0.3,
    0.5,
    false,
    true,
  );
  litEmitters.set(pad.id, emitter);
}

function clearPadState(room: Room): void {
  padValues = {};
  litPad = {};
  for (const pad of room.pressurePads ?? []) {
    if (!(pad.pairIndex in padValues)) padValues[pad.pairIndex] = 0;
    if (!(pad.pairIndex in litPad)) litPad[pad.pairIndex] = null;
  }

  litEmitters.forEach((emitter) => emitter.destroy());
  litEmitters.clear();
}

export function resetPressurePuzzle(room: Room): void {
  clearPadState(room);
  previousPlayerTile = { x: -1, y: -1 };
  solved = false;
  failFlashTimer = 0;
  justFailed = false;
}

function padAt(room: Room, x: number, y: number): PressurePad | undefined {
  return (room.pressurePads ?? []).find(
    (pad) => Math.floor(pad.position.x) === x && Math.floor(pad.position.y) === y,
  );
}

function checkButton(room: Room): void {
  const pairIndices = [...new Set((room.pressurePads ?? []).map((pad) => pad.pairIndex))];
  let value = 0;
  for (const pairIndex of pairIndices) {
    value |= (padValues[pairIndex] ?? 0) << pairIndex;
  }
  // Bit 31 makes the running value negative, so read it back unsigned before
  // comparing against a full 32 bit target.
  value >>>= 0;

  if (room.pressureTarget !== undefined && value === room.pressureTarget) {
    solved = true;
    return;
  }

  clearPadState(room);
  failFlashTimer = FAIL_FLASH_DURATION;
  justFailed = true;
}

export function updatePressurePuzzle(room: Room, playerTileNow: Point): void {
  const pads = room.pressurePads ?? [];
  if (pads.length === 0 && !room.pressureButton) return;

  failFlashTimer = Math.max(0, failFlashTimer - timeDelta);

  const enteredNewTile =
    playerTileNow.x !== previousPlayerTile.x || playerTileNow.y !== previousPlayerTile.y;
  previousPlayerTile = playerTileNow;
  if (!enteredNewTile) return;

  const steppedPad = padAt(room, playerTileNow.x, playerTileNow.y);
  if (steppedPad && !isPadLit(steppedPad)) {
    const siblingPad = pads.find(
      (pad) => pad.pairIndex === steppedPad.pairIndex && pad.value !== steppedPad.value,
    );
    if (siblingPad) destroyEmitter(siblingPad.id);

    padValues[steppedPad.pairIndex] = steppedPad.value;
    litPad[steppedPad.pairIndex] = steppedPad.value;
    spawnLitEmitter(room, steppedPad);
  }

  const button = room.pressureButton;
  if (
    button &&
    Math.floor(button.position.x) === playerTileNow.x &&
    Math.floor(button.position.y) === playerTileNow.y
  ) {
    checkButton(room);
  }
}

export function hasPressurePuzzleSucceeded(): boolean {
  return solved;
}

// Edge-triggered: true only on the frame the puzzle just failed, then clears itself.
export function consumePressurePuzzleFailure(): boolean {
  if (!justFailed) return false;
  justFailed = false;
  return true;
}

// The wall block between a pair's two plates is the readout: green for 1, red
// for 0. A pair nobody has stepped on yet is left as a plain wall.
function drawBitReadouts(room: Room): void {
  const pads = room.pressurePads ?? [];

  for (const pad of pads) {
    if (pad.value !== 1) continue;
    if (litPad[pad.pairIndex] == null) continue;

    const sibling = pads.find(
      (candidate) => candidate.pairIndex === pad.pairIndex && candidate.value === 0,
    );
    if (!sibling) continue;

    const midY = (pad.position.y + sibling.position.y) / 2 + 0.5;
    const world = tileToWorld(room, pad.position.x + 0.5, midY);
    const color = parseColor(padValues[pad.pairIndex] === 1 ? BIT_ON_COLOR : BIT_OFF_COLOR);
    drawRect(vec2(world.x, world.y), vec2(1), color);
  }
}

export function drawPressurePads(room: Room): void {
  for (const pad of room.pressurePads ?? []) {
    const world = tileToWorld(room, pad.position.x + 0.5, pad.position.y + 0.5);
    const color = isPadLit(pad) ? LIT_COLOR : UNLIT_COLOR;
    drawRect(vec2(world.x, world.y), vec2(PAD_SIZE), parseColor(color));
  }

  drawBitReadouts(room);

  const button = room.pressureButton;
  if (button) {
    const world = tileToWorld(room, button.position.x + 0.5, button.position.y + 0.5);
    const color = failFlashTimer > 0 ? FAIL_COLOR : solved ? LIT_COLOR : "#888888";
    drawRect(vec2(world.x, world.y), vec2(0.8), parseColor(color));
  }
}
