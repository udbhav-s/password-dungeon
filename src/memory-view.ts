import {
  Color,
  drawRect,
  engineImageFont,
  mousePosScreen,
  mouseWheel,
  timeDelta,
  vec2,
} from "littlejsengine";
import { ProgramManagerView } from "./program-manager-base";

const CANVAS_PIXELS = 1024;
const TITLE_BAR_HEIGHT = 48;
const HUD_HEIGHT = 160;
const CONTENT_BOTTOM = CANVAS_PIXELS - HUD_HEIGHT;
const TERMINAL_PADDING = 32;

const MEMORY_TEXT_SIZE = 14;
const MEMORY_LINE_HEIGHT = 18;
const BYTES_PER_LINE = 16;
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
let memoryLineOffset = 0;

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
const ASCII_HOVER_COLOR = new Color(0.55, 0.35, 0.7, 0.6);

function contentTop(): number {
  return TITLE_BAR_HEIGHT;
}

function payloadY(): number {
  return contentTop() + TERMINAL_PADDING;
}

function byteX(index: number): number {
  return TERMINAL_PADDING + index * (MEMORY_TEXT_SIZE * 3);
}

function visibleLineCount(): number {
  return Math.max(
    1,
    Math.floor((CONTENT_BOTTOM - TERMINAL_PADDING - payloadY()) / MEMORY_LINE_HEIGHT),
  );
}

function totalLineCount(buffer: Uint8Array): number {
  return Math.ceil(buffer.length / BYTES_PER_LINE);
}

function maxLineOffset(buffer: Uint8Array): number {
  return Math.max(0, totalLineCount(buffer) - visibleLineCount());
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

function asciiCharacter(value: number): string {
  return value >= 32 && value <= 126 ? String.fromCharCode(value) : ".";
}

function drawBuffer(buffer: Uint8Array, asciiLensActive: boolean): void {
  const lineCount = Math.min(visibleLineCount(), totalLineCount(buffer) - memoryLineOffset);

  for (let visibleLine = 0; visibleLine < lineCount; visibleLine += 1) {
    const line = memoryLineOffset + visibleLine;
    const lineStart = line * BYTES_PER_LINE;
    const lineEnd = Math.min(buffer.length, lineStart + BYTES_PER_LINE);
    const y = payloadY() + visibleLine * MEMORY_LINE_HEIGHT;
    const lineWidth = (lineEnd - lineStart) * MEMORY_TEXT_SIZE * 3;
    const hovered =
      asciiLensActive &&
      mousePosScreen.x >= TERMINAL_PADDING - 8 &&
      mousePosScreen.x <= TERMINAL_PADDING + lineWidth &&
      mousePosScreen.y >= y - 4 &&
      mousePosScreen.y <= y + MEMORY_LINE_HEIGHT - 2;

    if (hovered) {
      drawRect(
        vec2(TERMINAL_PADDING - 8 + (lineWidth + 16) / 2, y + MEMORY_LINE_HEIGHT / 2 - 2),
        vec2(lineWidth + 16, MEMORY_LINE_HEIGHT),
        ASCII_HOVER_COLOR,
        0,
        false,
        true,
      );
    }

    for (let index = lineStart; index < lineEnd; index += 1) {
      const lineIndex = index - lineStart;
      const x = byteX(lineIndex);
      const text = hovered ? asciiCharacter(buffer[index]) : HEX_BYTES[buffer[index]];
      drawText(text, x, y, byteColor(index, buffer[index]));
    }
  }

  drawMemoryScrollbar(buffer);
}

function drawMemoryScrollbar(buffer: Uint8Array): void {
  const totalLines = totalLineCount(buffer);
  const visibleLines = visibleLineCount();
  if (totalLines <= visibleLines) return;

  const trackTop = payloadY();
  const trackHeight = CONTENT_BOTTOM - TERMINAL_PADDING - trackTop;
  const thumbHeight = Math.max(24, trackHeight * (visibleLines / totalLines));
  const thumbTravel = trackHeight - thumbHeight;
  const offset = maxLineOffset(buffer);
  const thumbOffset = offset === 0 ? 0 : (memoryLineOffset / offset) * thumbTravel;
  const scrollbarX = CANVAS_PIXELS - TERMINAL_PADDING / 2;

  drawRect(
    vec2(scrollbarX, trackTop + trackHeight / 2),
    vec2(8, trackHeight),
    parseColor("#222222"),
    0,
    false,
    true,
  );
  drawRect(
    vec2(scrollbarX, trackTop + thumbOffset + thumbHeight / 2),
    vec2(8, thumbHeight),
    parseColor("#9b59d0"),
    0,
    false,
    true,
  );
}

export function resetMemoryView(nextManager: ProgramManagerView): void {
  manager = nextManager;
  previousBuffer = new Uint8Array(0);
  changedHeat.clear();
  refreshTimer = 0;
  memoryLineOffset = 0;
}

export function updateMemoryView(): void {
  if (!manager) return;

  const buffer = manager.bufferMemory;
  if (mouseWheel !== 0) {
    const direction = mouseWheel > 0 ? 1 : -1;
    memoryLineOffset = Math.min(
      maxLineOffset(buffer),
      Math.max(0, memoryLineOffset + direction),
    );
  }
  if (previousBuffer.length === 0) refresh(buffer);

  refreshTimer += timeDelta;
  if (refreshTimer >= REFRESH_INTERVAL_SECONDS) {
    refreshTimer = 0;
    refresh(buffer);
  }

  decayHeat();
}

export function drawMemoryView(asciiLensActive = false): void {
  if (!manager || manager.isLoading) {
    drawLoadingMessage();
    return;
  }

  drawBuffer(manager.bufferMemory, asciiLensActive);
}
