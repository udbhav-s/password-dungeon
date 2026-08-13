import { Color, drawRect, engineImageFont, timeDelta, vec2, WHITE } from "littlejsengine";
import { L1ProgramManager } from "./program-manager";

// Layout constants mirror computer.ts (not exported from there, so redeclared here).
const CANVAS_PIXELS = 1024;
const WINDOW_X = 64;
const WINDOW_Y = 64;
const WINDOW_WIDTH = CANVAS_PIXELS - WINDOW_X * 2;
const WINDOW_HEIGHT = CANVAS_PIXELS - WINDOW_Y * 2;
const STATUS_BAR_HEIGHT = 48;
const TERMINAL_PADDING = 32;
const CONTENT_WIDTH = WINDOW_WIDTH - 2 * TERMINAL_PADDING;

const BYTES_PER_ROW = 16;
// engineImageFont glyph advance is approximately one `size` px per glyph. If in practice glyphs
// render wider than that, the fix is to drop to 8 bytes per row rather than shrink the font further.
const MEMORY_TEXT_SIZE = 10;
const MEMORY_LINE_HEIGHT = 18;

const HEADER_BUTTON_HEIGHT = 26;
const HEADER_BUTTON_GAP = 12;
const STATUS_LINE_OFFSET = 44;
const ROWS_TOP_OFFSET = 62;

const REFRESH_INTERVAL_SECONDS = 0.25;
const HEAT_DECAY_PER_SECOND = 2 / 3; // ~1.5s fade from full heat to zero
const WHEEL_ROWS_PER_STEP = 3;

const FUNC_PANEL_WIDTH = 260;

type MemoryRow =
  | { kind: "bytes"; address: number }
  | { kind: "elided"; address: number; byteCount: number; runId: number };

interface Rect {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}

const HEX_BYTES: string[] = [];
for (let value = 0; value < 256; value++) {
  HEX_BYTES.push(value.toString(16).padStart(2, "0"));
}

let manager: L1ProgramManager | undefined;
let previousSnapshot = new Uint8Array(0);
let hasSnapshot = false;
let rows: MemoryRow[] = [];
const changedHeat: Map<number, number> = new Map();
const expandedRuns: Set<number> = new Set();
let scrollRow = 0;
let followBuffer = true;
let showFuncTable = false;
let refreshTimer = 0;

function parseColor(hex: string): Color {
  const value = hex.replace("#", "");
  const red = Number.parseInt(value.slice(0, 2), 16) / 255;
  const green = Number.parseInt(value.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(value.slice(4, 6), 16) / 255;
  return new Color(red, green, blue);
}

const ADDRESS_COLOR = parseColor("#6d3b9c");
const SEPARATOR_COLOR = parseColor("#555555");
const ZERO_COLOR = parseColor("#6a6a6a");
const NONZERO_COLOR = parseColor("#c8c8c8");
const ASCII_COLOR = parseColor("#9b9b9b");
const BUFFER_FILL_COLOR = parseColor("#4a2568");
const STACK_POINTER_COLOR = parseColor("#55aaff");
const HOT_GOLD = parseColor("#ffe680");
const HOT_RED = parseColor("#ef3340");
const ELIDED_COLOR = parseColor("#3a3a3a");
const FUNC_PANEL_BG = parseColor("#111111");
const FUNC_POINTER_UNDERLINE = parseColor("#9b59d0");
const BUTTON_COLOR = parseColor("#4a2568");
const BUTTON_ACTIVE_COLOR = parseColor("#6d3b9c");

function isInside(pointX: number, pointY: number, rect: Rect): boolean {
  return (
    pointX >= rect.centerX - rect.width / 2 &&
    pointX <= rect.centerX + rect.width / 2 &&
    pointY >= rect.centerY - rect.height / 2 &&
    pointY <= rect.centerY + rect.height / 2
  );
}

function contentTop(): number {
  return WINDOW_Y + STATUS_BAR_HEIGHT;
}

function headerButtonsY(): number {
  return contentTop() + HEADER_BUTTON_HEIGHT / 2 + 4;
}

// Shared hit-rect math: used by both the click handler and the draw code so they can't drift apart.
function jumpButtonRect(): Rect {
  return {
    centerX: WINDOW_X + TERMINAL_PADDING + 95,
    centerY: headerButtonsY(),
    width: 190,
    height: HEADER_BUTTON_HEIGHT,
  };
}

function funcTableButtonRect(): Rect {
  const jump = jumpButtonRect();
  return {
    centerX: jump.centerX + jump.width / 2 + HEADER_BUTTON_GAP + 70,
    centerY: headerButtonsY(),
    width: 140,
    height: HEADER_BUTTON_HEIGHT,
  };
}

function statusLineY(): number {
  return contentTop() + STATUS_LINE_OFFSET;
}

function rowsAreaTop(): number {
  return contentTop() + ROWS_TOP_OFFSET;
}

function visibleRowCount(): number {
  const bottom = WINDOW_Y + WINDOW_HEIGHT - TERMINAL_PADDING;
  return Math.max(1, Math.floor((bottom - rowsAreaTop()) / MEMORY_LINE_HEIGHT));
}

function charX(index: number): number {
  return WINDOW_X + TERMINAL_PADDING + index * MEMORY_TEXT_SIZE;
}

// Character-column layout for a row: "AAAAAAAA | xx xx .. xx | ascii....."
const ADDR_CHAR_COUNT = 8;
const HEX_START_CHAR = ADDR_CHAR_COUNT + 3; // + " | "
const HEX_BLOCK_CHARS = BYTES_PER_ROW * 3 - 1; // "xx " * 16 minus trailing space
const ASCII_START_CHAR = HEX_START_CHAR + HEX_BLOCK_CHARS + 3; // + " | "

function drawText(text: string, x: number, y: number, color: Color, center = false): void {
  engineImageFont.drawTextScreen(text, vec2(x, y), MEMORY_TEXT_SIZE, center, color, false);
}

// Finds the row whose address range contains `address`. Rows fully tile the address space with
// no gaps, so a binary search for the largest row.address <= address always lands correctly.
function rowIndexForAddress(address: number): number {
  if (rows.length === 0) return 0;
  let low = 0;
  let high = rows.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >>> 1;
    if (rows[mid].address <= address) low = mid;
    else high = mid - 1;
  }
  return low;
}

function clampScroll(): void {
  const maxScroll = Math.max(0, rows.length - visibleRowCount());
  scrollRow = Math.min(maxScroll, Math.max(0, scrollRow));
}

function scrollToBuffer(): void {
  if (!manager) return;
  const target = rowIndexForAddress(manager.bufferAddress);
  scrollRow = target - Math.floor(visibleRowCount() / 2);
  clampScroll();
}

function flushRun(target: MemoryRow[], startAddress: number, rowCount: number): void {
  if (rowCount >= 2 && !expandedRuns.has(startAddress)) {
    target.push({
      kind: "elided",
      address: startAddress,
      byteCount: rowCount * BYTES_PER_ROW,
      runId: startAddress,
    });
    return;
  }
  for (let i = 0; i < rowCount; i++) {
    target.push({ kind: "bytes", address: startAddress + i * BYTES_PER_ROW });
  }
}

// Word-level diff against the retained snapshot, seeding heat for every changed byte. Reads via
// Uint32Array (4 bytes/iteration), narrowing to byte level only inside words that actually differ,
// so it stays cheap despite the ~16MB heap. Returns whether anything changed.
function diffAgainstSnapshot(bytes: Uint8Array): boolean {
  const length = bytes.length;
  if (!hasSnapshot || previousSnapshot.length !== length) return false;

  const wordCount = Math.floor(length / 4);
  const currentWords = new Uint32Array(bytes.buffer, bytes.byteOffset, wordCount);
  const previousWords = new Uint32Array(previousSnapshot.buffer, previousSnapshot.byteOffset, wordCount);
  let changed = false;

  for (let wordIndex = 0; wordIndex < wordCount; wordIndex++) {
    if (currentWords[wordIndex] === previousWords[wordIndex]) continue;
    changed = true;
    const base = wordIndex * 4;
    for (let b = 0; b < 4; b++) {
      const address = base + b;
      if (bytes[address] !== previousSnapshot[address]) {
        changedHeat.set(address, 1);
      }
    }
  }

  return changed;
}

// Builds the run-length-elided row index over the whole heap.
function buildRows(bytes: Uint8Array): MemoryRow[] {
  const length = bytes.length;
  const newRows: MemoryRow[] = [];
  let runStartAddress = -1;
  let runByte = -1;
  let runRowCount = 0;

  for (let rowStart = 0; rowStart < length; rowStart += BYTES_PER_ROW) {
    const firstByte = bytes[rowStart];
    let isUniform = rowStart + BYTES_PER_ROW <= length;
    for (let i = 1; isUniform && i < BYTES_PER_ROW; i++) {
      if (bytes[rowStart + i] !== firstByte) isUniform = false;
    }

    if (isUniform && runRowCount > 0 && runByte === firstByte) {
      runRowCount++;
    } else {
      if (runRowCount > 0) flushRun(newRows, runStartAddress, runRowCount);
      if (isUniform) {
        runStartAddress = rowStart;
        runByte = firstByte;
        runRowCount = 1;
      } else {
        runRowCount = 0;
        newRows.push({ kind: "bytes", address: rowStart });
      }
    }
  }
  if (runRowCount > 0) flushRun(newRows, runStartAddress, runRowCount);

  return newRows;
}

// The throttled refresh fires 4x/second, but the C program only mutates memory inside the blocking
// read_line. Skipping the row rebuild and the full snapshot copy when nothing changed keeps the
// steady-state cost to one word-compare pass instead of a 16MB copy plus a 1M-iteration rebuild.
function refresh(bytes: Uint8Array, forceRebuild = false): void {
  const changed = diffAgainstSnapshot(bytes);

  if (changed || forceRebuild || rows.length === 0) {
    rows = buildRows(bytes);
  }

  if (changed || !hasSnapshot) {
    previousSnapshot = bytes.slice();
    hasSnapshot = true;
  }
}

function ensureInitialRefresh(): void {
  if (hasSnapshot || !manager) return;
  const bytes = manager.memoryBytes;
  if (!bytes) return;
  refresh(bytes);
  if (followBuffer) scrollToBuffer();
  clampScroll();
}

function decayHeat(): void {
  for (const [address, heat] of changedHeat) {
    const next = heat - timeDelta * HEAT_DECAY_PER_SECOND;
    if (next <= 0) changedHeat.delete(address);
    else changedHeat.set(address, next);
  }
}

export function resetMemoryView(nextManager: L1ProgramManager): void {
  manager = nextManager;
  previousSnapshot = new Uint8Array(0);
  hasSnapshot = false;
  rows = [];
  changedHeat.clear();
  expandedRuns.clear();
  scrollRow = 0;
  followBuffer = true;
  showFuncTable = false;
  refreshTimer = 0;
}

export function updateMemoryView(): void {
  if (!manager || !manager.memoryBytes) return;

  ensureInitialRefresh();

  refreshTimer += timeDelta;
  if (refreshTimer >= REFRESH_INTERVAL_SECONDS) {
    refreshTimer = 0;
    const bytes = manager.memoryBytes;
    if (bytes) refresh(bytes);
  }

  decayHeat();

  if (followBuffer) scrollToBuffer();
  clampScroll();
}

function byteColor(address: number, value: number): Color {
  const base = value === 0 ? ZERO_COLOR : NONZERO_COLOR;
  const heat = changedHeat.get(address);
  if (!heat) return base;
  const insideBuffer = manager !== undefined && isInsideBuffer(address);
  const hot = insideBuffer ? HOT_GOLD : HOT_RED;
  return base.lerp(hot, Math.min(1, heat));
}

function isInsideBuffer(address: number): boolean {
  if (!manager) return false;
  return address >= manager.bufferAddress && address < manager.bufferAddress + manager.bufferSize;
}

function rowContainsAddress(row: MemoryRow, address: number): boolean {
  const size = row.kind === "bytes" ? BYTES_PER_ROW : row.byteCount;
  return address >= row.address && address < row.address + size;
}

function drawLoadingMessage(): void {
  drawText(
    "loading memory...",
    WINDOW_X + WINDOW_WIDTH / 2,
    WINDOW_Y + WINDOW_HEIGHT / 2,
    ASCII_COLOR,
    true,
  );
}

function drawButton(rect: Rect, label: string, active: boolean): void {
  drawRect(
    vec2(rect.centerX, rect.centerY),
    vec2(rect.width, rect.height),
    active ? BUTTON_ACTIVE_COLOR : BUTTON_COLOR,
    0,
    false,
    true,
  );
  drawText(label, rect.centerX, rect.centerY, WHITE, true);
}

function drawHeader(): void {
  drawButton(jumpButtonRect(), "[JUMP TO BUFFER]", followBuffer);
  drawButton(funcTableButtonRect(), "[FUNC TABLE]", showFuncTable);

  if (!manager) return;
  const status = `sp=0x${manager.stackPointer.toString(16)}  buf=0x${manager.bufferAddress.toString(16)}  len=${manager.bufferSize}`;
  drawText(status, WINDOW_X + TERMINAL_PADDING, statusLineY(), ASCII_COLOR);
}

function drawBytesRow(row: MemoryRow & { kind: "bytes" }, y: number, bytes: Uint8Array): void {
  const containsStackPointer = manager !== undefined && rowContainsAddress(row, manager.stackPointer);
  if (containsStackPointer) {
    drawRect(
      vec2(WINDOW_X + TERMINAL_PADDING - 6, y),
      vec2(4, MEMORY_LINE_HEIGHT - 2),
      STACK_POINTER_COLOR,
      0,
      false,
      true,
    );
  }

  const addressText = row.address.toString(16).padStart(ADDR_CHAR_COUNT, "0");
  drawText(addressText, charX(0), y, ADDRESS_COLOR);
  drawText("|", charX(ADDR_CHAR_COUNT + 1), y, SEPARATOR_COLOR);
  drawText("|", charX(ASCII_START_CHAR - 2), y, SEPARATOR_COLOR);

  let asciiText = "";
  for (let i = 0; i < BYTES_PER_ROW; i++) {
    const address = row.address + i;
    const value = bytes[address] ?? 0;
    const hexCharIndex = HEX_START_CHAR + i * 3;
    const hexX = charX(hexCharIndex);

    if (isInsideBuffer(address)) {
      drawRect(
        vec2(hexX + MEMORY_TEXT_SIZE / 2, y),
        vec2(MEMORY_TEXT_SIZE * 2 + 2, MEMORY_LINE_HEIGHT - 2),
        BUFFER_FILL_COLOR,
        0,
        false,
        true,
      );
    }

    drawText(HEX_BYTES[value], hexX, y, byteColor(address, value));

    if (showFuncTable && isLikelyFunctionPointer(bytes, address)) {
      drawRect(
        vec2(hexX + MEMORY_TEXT_SIZE, y + MEMORY_LINE_HEIGHT / 2 - 1),
        vec2(MEMORY_TEXT_SIZE * 4, 2),
        FUNC_POINTER_UNDERLINE,
        0,
        false,
        true,
      );
    }

    asciiText += value >= 0x20 && value <= 0x7e ? String.fromCharCode(value) : ".";
  }

  drawText(asciiText, charX(ASCII_START_CHAR), y, ASCII_COLOR);
}

function drawElidedRow(row: MemoryRow & { kind: "elided" }, y: number, bytes: Uint8Array): void {
  const repeatedByte = bytes[row.address] ?? 0;
  const label = repeatedByte === 0 ? "zero bytes" : "identical bytes";
  const text = `~~~~ ${row.byteCount.toLocaleString()} ${label} ~~~~`;
  drawText(text, WINDOW_X + TERMINAL_PADDING + CONTENT_WIDTH / 2, y, ELIDED_COLOR, true);
}

// In WASM, return addresses live on the VM's internal call stack, not in linear memory, so
// classic stack-smashing ROP is impossible here. The real exploit primitive is corrupting a
// function-pointer i32 that indexes __indirect_function_table — this scan highlights candidates.
function isLikelyFunctionPointer(bytes: Uint8Array, address: number): boolean {
  if (!manager) return false;
  const rowOffset = address % BYTES_PER_ROW;
  if (rowOffset > BYTES_PER_ROW - 4) return false;
  const tableLength = manager.functionTableEntries().length;
  if (tableLength === 0) return false;
  const value =
    (bytes[address] | (bytes[address + 1] << 8) | (bytes[address + 2] << 16) | (bytes[address + 3] << 24)) >>> 0;
  return value >= 1 && value < tableLength;
}

function drawRows(bytes: Uint8Array): void {
  const top = rowsAreaTop();
  const count = visibleRowCount();
  for (let i = 0; i < count; i++) {
    const row = rows[scrollRow + i];
    if (!row) break;
    const y = top + i * MEMORY_LINE_HEIGHT;
    if (row.kind === "bytes") drawBytesRow(row, y, bytes);
    else drawElidedRow(row, y, bytes);
  }
}

function drawFuncTablePanel(): void {
  if (!manager) return;
  const panelCenterX = WINDOW_X + WINDOW_WIDTH - FUNC_PANEL_WIDTH / 2 - TERMINAL_PADDING / 2;
  const panelTop = rowsAreaTop() - MEMORY_LINE_HEIGHT / 2;
  const panelBottom = WINDOW_Y + WINDOW_HEIGHT - TERMINAL_PADDING;
  const panelHeight = panelBottom - panelTop;

  drawRect(
    vec2(panelCenterX, panelTop + panelHeight / 2),
    vec2(FUNC_PANEL_WIDTH, panelHeight),
    FUNC_PANEL_BG,
    0,
    false,
    true,
  );

  const entries = manager.functionTableEntries();
  const rowHeight = MEMORY_LINE_HEIGHT;
  const maxRows = Math.max(0, Math.floor(panelHeight / rowHeight));
  const textX = panelCenterX - FUNC_PANEL_WIDTH / 2 + 8;

  for (let i = 0; i < Math.min(maxRows, entries.length); i++) {
    const entry = entries[i];
    const y = panelTop + rowHeight / 2 + i * rowHeight;
    drawText(`[${entry.index}] ${entry.name}`, textX, y, ASCII_COLOR);
  }
}

export function drawMemoryView(): void {
  ensureInitialRefresh();

  if (!manager || !manager.memoryBytes) {
    drawLoadingMessage();
    return;
  }

  const bytes = manager.memoryBytes;
  if (!bytes) {
    drawLoadingMessage();
    return;
  }

  drawHeader();
  drawRows(bytes);
  if (showFuncTable) drawFuncTablePanel();
}

export function handleMemoryViewWheel(direction: number): void {
  followBuffer = false;
  scrollRow += direction > 0 ? WHEEL_ROWS_PER_STEP : -WHEEL_ROWS_PER_STEP;
  clampScroll();
}

export function handleMemoryViewClick(x: number, y: number): void {
  if (!manager) return;

  if (isInside(x, y, jumpButtonRect())) {
    followBuffer = true;
    scrollToBuffer();
    return;
  }

  if (isInside(x, y, funcTableButtonRect())) {
    showFuncTable = !showFuncTable;
    return;
  }

  const top = rowsAreaTop();
  if (y < top - MEMORY_LINE_HEIGHT / 2) return;
  const rowOffset = Math.floor((y - (top - MEMORY_LINE_HEIGHT / 2)) / MEMORY_LINE_HEIGHT);
  const row = rows[scrollRow + rowOffset];
  if (!row || row.kind !== "elided") return;

  expandedRuns.add(row.runId);
  const bytes = manager.memoryBytes;
  if (bytes) refresh(bytes);
  clampScroll();
}
