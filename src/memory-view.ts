import { Color, engineImageFont, timeDelta, vec2 } from "littlejsengine";
import { ProgramManagerView } from "./program-manager-base";

const CANVAS_PIXELS = 1024;
const TITLE_BAR_HEIGHT = 48;
const HUD_HEIGHT = 160;
const CONTENT_BOTTOM = CANVAS_PIXELS - HUD_HEIGHT;
const TERMINAL_PADDING = 32;

const MEMORY_TEXT_SIZE = 14;
const MEMORY_LINE_HEIGHT = 18;
const REFRESH_INTERVAL_SECONDS = 0.25;
const HEAT_DECAY_PER_SECOND = 2 / 3;

const HEX_BYTES: string[] = [];
for (let value = 0; value < 256; value++) {
  HEX_BYTES.push(value.toString(16).padStart(2, "0"));
}

let manager: ProgramManagerView | undefined;
let previousBuffer = new Uint8Array(0);
const changedHeat: Map<number, number> = new Map();
let refreshTimer = 0;

function parseColor(hex: string): Color {
  const value = hex.replace("#", "");
  const red = Number.parseInt(value.slice(0, 2), 16) / 255;
  const green = Number.parseInt(value.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(value.slice(4, 6), 16) / 255;
  return new Color(red, green, blue);
}

const ZERO_COLOR = parseColor("#6a6a6a");
const NONZERO_COLOR = parseColor("#c8c8c8");
const HOT_GOLD = parseColor("#ffe680");

function contentTop(): number {
  return TITLE_BAR_HEIGHT;
}

function payloadY(): number {
  return contentTop() + TERMINAL_PADDING;
}

function byteX(index: number): number {
  return TERMINAL_PADDING + index * (MEMORY_TEXT_SIZE * 3);
}

function drawText(text: string, x: number, y: number, color: Color): void {
  engineImageFont.drawTextScreen(text, vec2(x, y), MEMORY_TEXT_SIZE, false, color, false);
}

function refresh(buffer: Uint8Array): void {
  if (previousBuffer.length === buffer.length) {
    for (let index = 0; index < buffer.length; index++) {
      if (buffer[index] !== previousBuffer[index]) changedHeat.set(index, 1);
    }
  }

  previousBuffer = buffer.slice();
}

function decayHeat(): void {
  for (const [index, heat] of changedHeat) {
    const next = heat - timeDelta * HEAT_DECAY_PER_SECOND;
    if (next <= 0) changedHeat.delete(index);
    else changedHeat.set(index, next);
  }
}

function byteColor(index: number, value: number): Color {
  const base = value === 0 ? ZERO_COLOR : NONZERO_COLOR;
  const heat = changedHeat.get(index);
  return heat ? base.lerp(HOT_GOLD, Math.min(1, heat)) : base;
}

function drawLoadingMessage(): void {
  engineImageFont.drawTextScreen(
    "loading memory...",
    vec2(CANVAS_PIXELS / 2, (TITLE_BAR_HEIGHT + CONTENT_BOTTOM) / 2),
    MEMORY_TEXT_SIZE,
    true,
    NONZERO_COLOR,
    false,
  );
}

function drawBuffer(buffer: Uint8Array): void {
  const y = payloadY();

  for (let index = 0; index < buffer.length; index++) {
    const x = byteX(index);
    drawText(HEX_BYTES[buffer[index]], x, y, byteColor(index, buffer[index]));
  }
}

export function resetMemoryView(nextManager: ProgramManagerView): void {
  manager = nextManager;
  previousBuffer = new Uint8Array(0);
  changedHeat.clear();
  refreshTimer = 0;
}

export function updateMemoryView(): void {
  if (!manager) return;

  const buffer = manager.bufferMemory;
  if (previousBuffer.length === 0) refresh(buffer);

  refreshTimer += timeDelta;
  if (refreshTimer >= REFRESH_INTERVAL_SECONDS) {
    refreshTimer = 0;
    refresh(buffer);
  }

  decayHeat();
}

export function drawMemoryView(): void {
  if (!manager || manager.isLoading) {
    drawLoadingMessage();
    return;
  }

  drawBuffer(manager.bufferMemory);
}
