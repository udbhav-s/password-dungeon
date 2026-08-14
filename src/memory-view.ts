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
import type { MemoryField } from "./types";

const CANVAS_PIXELS = 1024;
const TITLE_BAR_HEIGHT = 48;
const HUD_HEIGHT = 160;
const CONTENT_BOTTOM = CANVAS_PIXELS - HUD_HEIGHT;
const TERMINAL_PADDING = 32;

const MEMORY_TEXT_SIZE = 16;
const MEMORY_LINE_HEIGHT = 20;
const BYTES_PER_LINE = 16;
const BYTE_CELL_WIDTH = MEMORY_TEXT_SIZE * 3;
const BYTES_PER_INT = 4;
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
const INT_HOVER_COLOR = new Color(0.18, 0.5, 0.48, 0.6);

// Adjacent fields must not share a color, so consecutive entries stay distinct.
const LEGEND_COLORS = [
  parseColor("#e8a33d"),
  parseColor("#5bc8e8"),
  parseColor("#9ad84f"),
  parseColor("#e87fb0"),
  parseColor("#c9a0ff"),
];
const LEGEND_LABEL_COLOR = parseColor("#f0f0f0");

function contentTop(): number {
  return TITLE_BAR_HEIGHT;
}

function payloadY(): number {
  return contentTop() + TERMINAL_PADDING;
}

function byteX(index: number): number {
  return TERMINAL_PADDING + index * BYTE_CELL_WIDTH;
}

// drawTextScreen centers every glyph on the position it is given, so a byte cell
// starts half a character to the left of its text and a line of text is centered
// on its y. Hit tests and highlights have to use those edges, not the text
// position itself.
function byteCellLeft(lineIndex: number): number {
  return byteX(lineIndex) - MEMORY_TEXT_SIZE / 2;
}

function lineY(visibleLine: number): number {
  return payloadY() + visibleLine * MEMORY_LINE_HEIGHT;
}

function isMouseOnLine(y: number): boolean {
  return (
    mousePosScreen.y >= y - MEMORY_LINE_HEIGHT / 2 &&
    mousePosScreen.y <= y + MEMORY_LINE_HEIGHT / 2
  );
}

// Lines actually on screen right now, which is what the mouse can reach.
function drawnLineCount(buffer: Uint8Array): number {
  return Math.min(visibleLineCount(), totalLineCount(buffer) - memoryLineOffset);
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

function fieldAt(legend: MemoryField[] | undefined, index: number): number {
  if (!legend) return -1;
  return legend.findIndex((field) => index >= field.offset && index < field.offset + field.size);
}

function byteColor(
  index: number,
  value: number,
  legend?: MemoryField[],
  fieldIndex = -1,
): Color {
  const base =
    legend && fieldIndex >= 0
      ? LEGEND_COLORS[fieldIndex % LEGEND_COLORS.length]
      : value === 0
        ? ZERO_COLOR
        : NONZERO_COLOR;
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

// Bytes are stored little endian, so the lowest address holds the lowest part
// of the value. Unsigned shift keeps the top bit from turning the result negative.
function littleEndianInt(buffer: Uint8Array, start: number): number {
  return (
    (buffer[start] |
      (buffer[start + 1] << 8) |
      (buffer[start + 2] << 16) |
      (buffer[start + 3] << 24)) >>>
    0
  );
}

// Replaces each group of 4 bytes on the line with the integer they encode.
// Trailing bytes that cannot fill a group stay as hex.
function drawIntLine(
  buffer: Uint8Array,
  lineStart: number,
  lineEnd: number,
  y: number,
  legend?: MemoryField[],
): void {
  for (let index = lineStart; index < lineEnd; index += BYTES_PER_INT) {
    const lineIndex = index - lineStart;
    if (index + BYTES_PER_INT > lineEnd) {
      for (let tail = index; tail < lineEnd; tail += 1) {
        drawText(
          HEX_BYTES[buffer[tail]],
          byteX(tail - lineStart),
          y,
          byteColor(tail, buffer[tail], legend, fieldAt(legend, tail)),
        );
      }
      return;
    }

    const fieldIndex = fieldAt(legend, index);
    const value = littleEndianInt(buffer, index);
    const color =
      legend && fieldIndex >= 0
        ? LEGEND_COLORS[fieldIndex % LEGEND_COLORS.length]
        : value === 0
          ? ZERO_COLOR
          : NONZERO_COLOR;
    drawText(String(value), byteX(lineIndex), y, color);
  }
}

// Byte cell the mouse is over, or -1. Cells are the same grid the hex dump uses,
// so this has to walk the scrolled-to lines rather than the whole buffer.
function hoveredByteIndex(buffer: Uint8Array): number {
  const lineCount = drawnLineCount(buffer);
  for (let visibleLine = 0; visibleLine < lineCount; visibleLine += 1) {
    if (!isMouseOnLine(lineY(visibleLine))) continue;

    const lineStart = (memoryLineOffset + visibleLine) * BYTES_PER_LINE;
    const lineEnd = Math.min(buffer.length, lineStart + BYTES_PER_LINE);
    for (let index = lineStart; index < lineEnd; index += 1) {
      const left = byteCellLeft(index - lineStart);
      if (mousePosScreen.x >= left && mousePosScreen.x < left + BYTE_CELL_WIDTH) {
        return index;
      }
    }
  }
  return -1;
}

// Names the field under the cursor and shows where it sits in the buffer.
function drawLegendLabel(buffer: Uint8Array, legend: MemoryField[]): void {
  const hoveredIndex = hoveredByteIndex(buffer);
  const fieldIndex = fieldAt(legend, hoveredIndex);
  // A line below the last row on screen, but never past the bottom of the
  // content area — a scrolling dump fills the view and would push it off.
  const y = Math.min(
    lineY(drawnLineCount(buffer)) + MEMORY_LINE_HEIGHT,
    CONTENT_BOTTOM - TERMINAL_PADDING - MEMORY_TEXT_SIZE / 2,
  );

  if (fieldIndex < 0) {
    drawText("hover a byte to name its field", TERMINAL_PADDING, y, ZERO_COLOR);
    return;
  }

  const field = legend[fieldIndex];
  const swatch = LEGEND_COLORS[fieldIndex % LEGEND_COLORS.length];
  drawRect(
    vec2(TERMINAL_PADDING + MEMORY_TEXT_SIZE / 2, y),
    vec2(MEMORY_TEXT_SIZE),
    swatch,
    0,
    false,
    true,
  );
  drawText(
    `${field.type} ${field.name}  [offset ${field.offset}, ${field.size} bytes]`,
    TERMINAL_PADDING + MEMORY_TEXT_SIZE * 2,
    y,
    LEGEND_LABEL_COLOR,
  );
}

function drawBuffer(
  buffer: Uint8Array,
  asciiLensActive: boolean,
  intLensActive: boolean,
  legend?: MemoryField[],
): void {
  const lineCount = drawnLineCount(buffer);

  for (let visibleLine = 0; visibleLine < lineCount; visibleLine += 1) {
    const line = memoryLineOffset + visibleLine;
    const lineStart = line * BYTES_PER_LINE;
    const lineEnd = Math.min(buffer.length, lineStart + BYTES_PER_LINE);
    const y = lineY(visibleLine);
    const rowLeft = byteCellLeft(0);
    const lineWidth = (lineEnd - lineStart) * BYTE_CELL_WIDTH;
    // The band is the hit area, so both use the same bounds.
    const hovered =
      (asciiLensActive || intLensActive) &&
      mousePosScreen.x >= rowLeft - 8 &&
      mousePosScreen.x <= rowLeft + lineWidth + 8 &&
      isMouseOnLine(y);

    if (hovered) {
      drawRect(
        vec2(rowLeft + lineWidth / 2, y),
        vec2(lineWidth + 16, MEMORY_LINE_HEIGHT),
        intLensActive ? INT_HOVER_COLOR : ASCII_HOVER_COLOR,
        0,
        false,
        true,
      );
    }

    // The lenses are mutually exclusive, but guard the order anyway so the int
    // reading wins if both ever end up set.
    if (hovered && intLensActive) {
      drawIntLine(buffer, lineStart, lineEnd, y, legend);
      continue;
    }

    for (let index = lineStart; index < lineEnd; index += 1) {
      const lineIndex = index - lineStart;
      const x = byteX(lineIndex);
      const text = hovered ? asciiCharacter(buffer[index]) : HEX_BYTES[buffer[index]];
      drawText(text, x, y, byteColor(index, buffer[index], legend, fieldAt(legend, index)));
    }
  }

  if (legend) drawLegendLabel(buffer, legend);
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

export function drawMemoryView(
  asciiLensActive = false,
  intLensActive = false,
  legend?: MemoryField[],
): void {
  if (!manager || manager.isLoading) {
    drawLoadingMessage();
    return;
  }

  drawBuffer(manager.bufferMemory, asciiLensActive, intLensActive, legend);
}
