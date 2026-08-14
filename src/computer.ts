import {
  Color,
  drawRect,
  drawTile,
  engineImageFont,
  mousePosScreen,
  mouseWasPressed,
  mouseWheel,
  tile,
  vec2,
  WHITE,
} from "littlejsengine";
import room1Source from "./c_levels_display/room1.c?raw";
import room2Source from "./c_levels_display/room2.c?raw";
import room3Source from "./c_levels_display/room3.c?raw";
import room4Source from "./c_levels_display/room4.c?raw";
import room5Source from "./c_levels_display/room5.c?raw";
import room5aSource from "./c_levels_display/room5a.c?raw";
import room6Source from "./c_levels_display/room6.c?raw";
import room7Source from "./c_levels_display/room7.c?raw";
import room8Source from "./c_levels_display/room8.c?raw";
import room9Source from "./c_levels_display/room9.c?raw";
import room10Source from "./c_levels_display/room10.c?raw";
import type { ProgramManagerBase } from "./program-manager-base";
import { Room1ProgramManager } from "./programs/room1";
import { Room2ProgramManager } from "./programs/room2";
import { Room3ProgramManager } from "./programs/room3";
import { Room4ProgramManager } from "./programs/room4";
import { Room5ProgramManager } from "./programs/room5";
import { Room5AProgramManager } from "./programs/room5a";
import { Room6ProgramManager } from "./programs/room6";
import { Room7ProgramManager } from "./programs/room7";
import { Room8ProgramManager } from "./programs/room8";
import { Room9ProgramManager } from "./programs/room9";
import { Room10ProgramManager } from "./programs/room10";
import type { Item, MemoryField } from "./types";
import {
  itemIconFrame,
  ITEM_SPRITE_FRAME_SIZE,
  ITEM_SPRITE_TEXTURE_INDEX,
} from "./item-icons";
import { drawMemoryView, resetMemoryView, updateMemoryView } from "./memory-view";

const CANVAS_PIXELS = 1024;
const TITLE_BAR_HEIGHT = 48;
const TITLE_BAR_CENTER_Y = TITLE_BAR_HEIGHT / 2;
const HUD_HEIGHT = 160;
const HUD_TOP = CANVAS_PIXELS - HUD_HEIGHT;
const HUD_CENTER_Y = HUD_TOP + HUD_HEIGHT / 2;
const TERMINAL_PADDING = 32;
const TERMINAL_TEXT_SIZE = 14;
const TERMINAL_LINE_HEIGHT = 24;
const SOURCE_SCROLLBAR_WIDTH = 8;
const SOURCE_SCROLLBAR_MIN_THUMB_HEIGHT = 24;
const CODE_VIEW_LINES = Math.max(
  1,
  Math.floor((HUD_TOP - TITLE_BAR_HEIGHT - TERMINAL_PADDING * 2) / TERMINAL_LINE_HEIGHT),
);

// Blank lines to put after each source line. The smallest spacing that pushes
// the program past a single screenful, so no one screenshot holds all of it.
function blankLinesPerSourceLine(lineCount: number): number {
  let gap = 1;
  while (lineCount * (gap + 1) <= CODE_VIEW_LINES) gap += 1;
  return gap;
}

/// Prepares a raw .c file for the code view. Vite hands back the file exactly as
/// it sits on disk, so a CRLF checkout leaves a trailing \r that the image font
/// has no glyph for and draws as a box. Spacing the lines out on top of that
/// makes the source awkward to capture and paste somewhere that would solve it.
function displayLines(source: string): string[] {
  const lines = source.replace(/\r/g, "").split("\n");
  const gap = blankLinesPerSourceLine(lines.length);
  return lines.flatMap((line) => [line, ...Array<string>(gap).fill("")]);
}

const SPRITE_FRAME_SIZE = 64;
const SPRITE_PANEL_SIZE = 144;
const SPRITE_DRAW_SIZE = 128;
const SPRITE_CENTER_X = 80;
const CLOSE_BUTTON_SIZE = 40;
const CLOSE_BUTTON_X = CANVAS_PIXELS - CLOSE_BUTTON_SIZE / 2 - 4;

const TAB_FONT_SIZE = 18;
const TAB_PADDING_X = 16;
const TAB_GAP = 4;
const TAB_START_X = 16;

const ITEM_PANEL_SIZE = 112;
const ITEM_ICON_SIZE = 76;
const ITEM_PANEL_GAP = 16;
const ITEM_PANEL_RIGHT = 16;

type ComputerView = "console" | "source" | "memory";

interface ComputerTab {
  id: ComputerView;
  label: string;
  isVisible: () => boolean;
}

interface ProgramDefinition {
  createManager: () => ProgramManagerBase;
  sourceLines: string[];
  loadingMessage: string;
  sourceRedaction?: string;
  /// Regex source applied per source line; every match is boxed out. Use this
  /// instead of sourceRedaction when a program has many values to hide.
  sourceRedactionPattern?: string;
  /// Field layout of the buffer this program exposes, revealed by the Memory Legend.
  memoryLegend?: MemoryField[];
}

/// Lays fields out back to back, so a legend can never disagree with itself
/// about where a field starts.
function structLegend(fields: readonly (readonly [string, string, number])[]): MemoryField[] {
  let offset = 0;
  return fields.map(([name, type, size]) => {
    const field: MemoryField = { name, type, offset, size };
    offset += size;
    return field;
  });
}

// Mirrors the field order of ImportantData in c_levels/room9.c.
const ROOM_9_LEGEND = structLegend([
  ["pass", "char[4]", 4],
  ["stuff", "char[4]", 4],
  ["howManyPushUpsIcanDo", "int", 4],
  ["pagesInMyNewBook", "int", 4],
  ["cupsOfCoffeeToday", "int", 4],
  ["stepsToTheFridge", "int", 4],
  ["unreadEmails", "int", 4],
  ["socksInTheDrawer", "int", 4],
  ["highScore", "int", 4],
  ["daysSinceLastBug", "int", 4],
  ["printerJamCount", "int", 4],
  ["lunchBudget", "int", 4],
  ["keyboardsDestroyed", "int", 4],
  ["hoursOfSleep", "int", 4],
  ["tabsOpen", "int", 4],
  ["plantsStillAlive", "int", 4],
  ["passwordNumber", "int", 4],
  ["meetingsThisWeek", "int", 4],
  ["rubberDucks", "int", 4],
  ["linesOfCommentedCode", "int", 4],
  ["cablesInTheDrawer", "int", 4],
  ["semicolonsForgotten", "int", 4],
  ["snacksRemaining", "int", 4],
  ["excusesPrepared", "int", 4],
]);

// Mirrors the field order of UserData in c_levels/room10.c. The struct packs to
// 36 bytes with no padding, so back to back offsets match what the wasm reports.
const ROOM_10_LEGEND = structLegend([
  ["reminder", "char[8]", 8],
  ["daysSinceLastExplosion", "int", 4],
  ["date", "int", 4],
  ["inputPassword", "char[8]", 8],
  ["myFavoriteSpiderManMovie", "int", 4],
  ["unmodifiable", "char[8]", 8],
]);

interface UsableItemLayout {
  item: Item;
  centerX: number;
}

interface TabLayout {
  tab: ComputerTab;
  centerX: number;
  width: number;
}

const roomPrograms: Record<string, ProgramDefinition> = {
  "room-1": {
    createManager: () => new Room1ProgramManager(),
    sourceLines: displayLines(room1Source),
    loadingMessage: "loading room1.c...",
  },
  "room-2": {
    createManager: () => new Room2ProgramManager(),
    sourceLines: displayLines(room2Source),
    loadingMessage: "loading room2.c...",
  },
  "room-3": {
    createManager: () => new Room3ProgramManager(),
    sourceLines: displayLines(room3Source),
    loadingMessage: "loading room3.c...",
  },
  "room-4-lock": {
    createManager: () => new Room4ProgramManager(),
    sourceLines: displayLines(room4Source),
    loadingMessage: "loading room4.c...",
  },
  "room-5": {
    createManager: () => new Room5ProgramManager(),
    sourceLines: displayLines(room5Source),
    loadingMessage: "loading room5.c...",
    sourceRedaction: "1mpossiblehidd3np4ss",
  },
  "room-5a": {
    createManager: () => new Room5AProgramManager(),
    sourceLines: displayLines(room5aSource),
    loadingMessage: "loading room5a.c...",
  },
  "room-6": {
    createManager: () => new Room6ProgramManager(),
    sourceLines: displayLines(room6Source),
    loadingMessage: "loading room6.c...",
    sourceRedaction: "structn4v1gator67",
  },
  "room-7": {
    createManager: () => new Room7ProgramManager(),
    sourceLines: displayLines(room7Source),
    loadingMessage: "loading room7.c...",
    sourceRedaction: "1234567890",
  },
  "room-8": {
    createManager: () => new Room8ProgramManager(),
    sourceLines: displayLines(room8Source),
    loadingMessage: "loading room8.c...",
  },
  "room-9": {
    createManager: () => new Room9ProgramManager(),
    sourceLines: displayLines(room9Source),
    loadingMessage: "loading room9.c...",
    // Boxes out the value of every designated initializer, leaving the field
    // names readable but the contents blank.
    sourceRedactionPattern: "(?<=\\.\\w+ = )[^,]+",
    memoryLegend: ROOM_9_LEGEND,
  },
  "room-10": {
    createManager: () => new Room10ProgramManager(),
    sourceLines: displayLines(room10Source),
    loadingMessage: "loading room10.c...",
    memoryLegend: ROOM_10_LEGEND,
  },
};

let computerOpen = false;
let programManager: ProgramManagerBase = new Room1ProgramManager();
let activeView: ComputerView = "console";
let codeScrollOffset = 0;
let sourceLines = displayLines(room1Source);
let loadingMessage = "loading room1.c...";
let sourceRedaction: string | undefined;
let sourceRedactionRegex: RegExp | undefined;
let memoryLegend: MemoryField[] | undefined;
let usableItems: Item[] = [];
let asciiLensActive = false;
let intLensActive = false;
let memoryLegendActive = false;
let typingFrame = 0;
const typingKeys = new Set<string>();

const tabs: ComputerTab[] = [
  { id: "console", label: "Console", isVisible: () => true },
  {
    id: "source",
    label: "View Source",
    isVisible: () => usableItems.some((item) => item.id === "source-view"),
  },
  {
    id: "memory",
    label: "Memory",
    isVisible: () => usableItems.some((item) => item.id === "memory-view"),
  },
];

function parseColor(hex: string): Color {
  const value = hex.replace("#", "");
  const red = Number.parseInt(value.slice(0, 2), 16) / 255;
  const green = Number.parseInt(value.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(value.slice(4, 6), 16) / 255;
  return new Color(red, green, blue);
}

function isInside(
  pointX: number,
  pointY: number,
  centerX: number,
  centerY: number,
  width: number,
  height: number,
): boolean {
  return (
    pointX >= centerX - width / 2 &&
    pointX <= centerX + width / 2 &&
    pointY >= centerY - height / 2 &&
    pointY <= centerY + height / 2
  );
}

function visibleTabs(): ComputerTab[] {
  return tabs.filter((tab) => tab.isVisible());
}

function tabLayouts(): TabLayout[] {
  let x = TAB_START_X;
  return visibleTabs().map((tab) => {
    const width = tab.label.length * TAB_FONT_SIZE + TAB_PADDING_X * 2;
    const centerX = x + width / 2;
    x += width + TAB_GAP;
    return { tab, centerX, width };
  });
}

function setActiveView(view: ComputerView): void {
  activeView = view;
  if (view !== "console") resetTypingFrame();
}

function usableItemLayouts(): UsableItemLayout[] {
  return usableItems.map((item, index) => ({
    item,
    centerX:
      CANVAS_PIXELS -
      ITEM_PANEL_RIGHT -
      ITEM_PANEL_SIZE / 2 -
      index * (ITEM_PANEL_SIZE + ITEM_PANEL_GAP),
  }));
}

function setTypingFrame(event: KeyboardEvent): void {
  typingKeys.add(event.code || event.key);
  typingFrame = 1 + Math.floor(Math.random() * 4);
}

function resetTypingFrame(event?: KeyboardEvent): void {
  if (event) typingKeys.delete(event.code || event.key);
  else typingKeys.clear();
  if (typingKeys.size === 0) typingFrame = 0;
}

function appendTerminalCharacter(character: string): void {
  if (!programManager.isRunning || programManager.inputText.length >= 80) return;
  programManager.appendInputCharacter(character);
}

function handleTerminalKeyDown(event: KeyboardEvent): void {
  if (!computerOpen || !programManager.isRunning || activeView !== "console") return;

  if (event.key === "Enter") {
    event.preventDefault();
    programManager.submitInput(programManager.inputText);
  } else if (event.key === "Backspace") {
    event.preventDefault();
    programManager.removeInputCharacter();
  } else if (event.key.length === 1) {
    event.preventDefault();
    appendTerminalCharacter(event.key);
  } else {
    return;
  }

  setTypingFrame(event);
}

function handleTerminalKeyUp(event: KeyboardEvent): void {
  resetTypingFrame(event);
}

window.addEventListener("keydown", handleTerminalKeyDown);
window.addEventListener("keyup", handleTerminalKeyUp);

function closeComputer(): void {
  computerOpen = false;
  resetTypingFrame();
}

export function openComputer(programId: string, inventory: readonly Item[]): void {
  const program = roomPrograms[programId];
  if (!program) {
    console.warn(`No computer program is configured for ${programId}.`);
    return;
  }

  computerOpen = true;
  programManager = program.createManager();
  activeView = "console";
  codeScrollOffset = 0;
  sourceLines = program.sourceLines;
  loadingMessage = program.loadingMessage;
  sourceRedaction = program.sourceRedaction;
  sourceRedactionRegex = program.sourceRedactionPattern
    ? new RegExp(program.sourceRedactionPattern, "g")
    : undefined;
  memoryLegend = program.memoryLegend;
  usableItems = inventory.filter(
    (item) =>
      item.id === "source-view" ||
      item.id === "memory-view" ||
      item.id === "ascii-lens" ||
      item.id === "int-lens" ||
      item.id === "memory-legend",
  );
  asciiLensActive = false;
  intLensActive = false;
  memoryLegendActive = false;
  resetTypingFrame();
  resetMemoryView(programManager);
  void programManager.start();
}

export function isComputerOpen(): boolean {
  return computerOpen;
}

export function hasComputerProgramSucceeded(): boolean {
  return programManager.isSuccessful;
}

export function getActiveBallSize(): number | undefined {
  if (!(programManager instanceof Room3ProgramManager)) return undefined;
  return programManager.getBallSize();
}

export function getActiveCrateSize(): number | undefined {
  if (!(programManager instanceof Room5AProgramManager)) return undefined;
  return programManager.getCrateSize();
}

function visibleCodeLines(): number {
  return CODE_VIEW_LINES;
}

function maxCodeScrollOffset(): number {
  return Math.max(0, sourceLines.length - visibleCodeLines());
}

function handleSourceWheel(direction: number): void {
  codeScrollOffset = Math.min(maxCodeScrollOffset(), Math.max(0, codeScrollOffset + direction));
}

export function updateComputer(): void {
  if (!computerOpen) return;

  if (mouseWasPressed(0)) {
    if (
      isInside(
        mousePosScreen.x,
        mousePosScreen.y,
        CLOSE_BUTTON_X,
        TITLE_BAR_CENTER_Y,
        CLOSE_BUTTON_SIZE,
        TITLE_BAR_HEIGHT,
      )
    ) {
      closeComputer();
      return;
    }

    for (const { tab, centerX, width } of tabLayouts()) {
      if (
        isInside(
          mousePosScreen.x,
          mousePosScreen.y,
          centerX,
          TITLE_BAR_CENTER_Y,
          width,
          TITLE_BAR_HEIGHT,
        )
      ) {
        setActiveView(tab.id);
        break;
      }
    }

    for (const { item, centerX } of usableItemLayouts()) {
      if (
        isInside(
          mousePosScreen.x,
          mousePosScreen.y,
          centerX,
          HUD_CENTER_Y,
          ITEM_PANEL_SIZE,
          ITEM_PANEL_SIZE,
        )
      ) {
        // The two lenses both reinterpret the hovered line, so only one of them
        // can be on: switching one on switches the other off.
        if (item.id === "ascii-lens") {
          asciiLensActive = !asciiLensActive;
          if (asciiLensActive) intLensActive = false;
        } else if (item.id === "int-lens") {
          intLensActive = !intLensActive;
          if (intLensActive) asciiLensActive = false;
        } else if (item.id === "memory-legend") memoryLegendActive = !memoryLegendActive;
        else if (item.id === "source-view") setActiveView("source");
        else if (item.id === "memory-view") setActiveView("memory");
        break;
      }
    }
  }

  if (activeView === "source" && mouseWheel !== 0) {
    handleSourceWheel(mouseWheel > 0 ? 1 : -1);
  }
  if (activeView === "memory") updateMemoryView();
}

function drawTerminalText(text: string, x: number, y: number, center = false): void {
  const availableWidth = center
    ? CANVAS_PIXELS
    : Math.max(0, CANVAS_PIXELS - TERMINAL_PADDING - x);
  const visibleCharacters = Math.floor(availableWidth / TERMINAL_TEXT_SIZE);
  engineImageFont.drawTextScreen(
    text.slice(0, visibleCharacters),
    vec2(x, y),
    TERMINAL_TEXT_SIZE,
    center,
    WHITE,
    false,
  );
}

function drawTerminal(): void {
  const firstLineY = TITLE_BAR_HEIGHT + TERMINAL_PADDING;
  const inputY = HUD_TOP - TERMINAL_PADDING;
  const terminalLineCapacity = Math.max(
    1,
    Math.floor((inputY - firstLineY) / TERMINAL_LINE_HEIGHT) - 1,
  );
  const visibleOutput = programManager.output.slice(-terminalLineCapacity);

  visibleOutput.forEach((line, index) => {
    drawTerminalText(line, TERMINAL_PADDING, firstLineY + index * TERMINAL_LINE_HEIGHT);
  });

  if (programManager.isLoading) {
    drawTerminalText(loadingMessage, TERMINAL_PADDING, firstLineY);
    return;
  }

  if (!programManager.isRunning) {
    drawTerminalText(
      "[program ended]",
      TERMINAL_PADDING,
      firstLineY + visibleOutput.length * TERMINAL_LINE_HEIGHT,
    );
    return;
  }

  drawTerminalText(`> ${programManager.inputText}_`, TERMINAL_PADDING, inputY);
}

interface RedactionRange {
  start: number;
  length: number;
}

// Character ranges of a source line to box out: either the one fixed secret
// string, or every match of the program's redaction pattern.
function redactionRanges(line: string): RedactionRange[] {
  if (sourceRedaction) {
    const start = line.indexOf(sourceRedaction);
    return start < 0 ? [] : [{ start, length: sourceRedaction.length }];
  }

  if (!sourceRedactionRegex) return [];
  sourceRedactionRegex.lastIndex = 0;
  const ranges: RedactionRange[] = [];
  for (const match of line.matchAll(sourceRedactionRegex)) {
    if (match.index === undefined || match[0].length === 0) continue;
    ranges.push({ start: match.index, length: match[0].length });
  }
  return ranges;
}

function drawCodeView(): void {
  const firstLineY = TITLE_BAR_HEIGHT + TERMINAL_PADDING;
  const lines = sourceLines.slice(codeScrollOffset, codeScrollOffset + visibleCodeLines());

  lines.forEach((line, index) => {
    const y = firstLineY + index * TERMINAL_LINE_HEIGHT;
    const ranges = redactionRanges(line);
    if (ranges.length === 0) {
      drawTerminalText(line, TERMINAL_PADDING, y);
      return;
    }

    let hiddenLine = line;
    for (const range of ranges) {
      hiddenLine = `${hiddenLine.slice(0, range.start)}${" ".repeat(range.length)}${hiddenLine.slice(range.start + range.length)}`;
    }
    drawTerminalText(hiddenLine, TERMINAL_PADDING, y);

    // Boxes stop at the right edge of the terminal so they cannot spill past it.
    const maxVisibleCharacters = Math.floor(
      (CANVAS_PIXELS - TERMINAL_PADDING * 2) / TERMINAL_TEXT_SIZE,
    );
    for (const range of ranges) {
      const visibleCharacters = Math.max(
        0,
        Math.min(range.length, maxVisibleCharacters - range.start),
      );
      for (let character = 0; character < visibleCharacters; character += 1) {
        drawRect(
          vec2(
            TERMINAL_PADDING + (range.start + character + 0.5) * TERMINAL_TEXT_SIZE,
            y + TERMINAL_TEXT_SIZE / 2,
          ),
          vec2(TERMINAL_TEXT_SIZE - 3, TERMINAL_TEXT_SIZE - 3),
          WHITE,
          0,
          false,
          true,
        );
      }
    }
  });

  drawSourceScrollbar();
}

function drawSourceScrollbar(): void {
  const trackTop = TITLE_BAR_HEIGHT + TERMINAL_PADDING;
  const trackBottom = HUD_TOP - TERMINAL_PADDING;
  const trackHeight = trackBottom - trackTop;
  const visibleLines = visibleCodeLines();
  const totalLines = sourceLines.length;
  const maxScroll = maxCodeScrollOffset();
  const thumbHeight = Math.max(
    SOURCE_SCROLLBAR_MIN_THUMB_HEIGHT,
    trackHeight * Math.min(1, visibleLines / totalLines),
  );
  const thumbTravel = trackHeight - thumbHeight;
  const thumbOffset = maxScroll === 0 ? 0 : (codeScrollOffset / maxScroll) * thumbTravel;
  const scrollbarX = CANVAS_PIXELS - TERMINAL_PADDING / 2;

  drawRect(
    vec2(scrollbarX, trackTop + trackHeight / 2),
    vec2(SOURCE_SCROLLBAR_WIDTH, trackHeight),
    parseColor("#222222"),
    0,
    false,
    true,
  );
  drawRect(
    vec2(scrollbarX, trackTop + thumbOffset + thumbHeight / 2),
    vec2(SOURCE_SCROLLBAR_WIDTH, thumbHeight),
    parseColor("#9b59d0"),
    0,
    false,
    true,
  );
}

function drawTypingSprite(): void {
  drawRect(
    vec2(SPRITE_CENTER_X, HUD_CENTER_Y),
    vec2(SPRITE_PANEL_SIZE),
    parseColor("#151515"),
    0,
    false,
    true,
  );
  drawTile(
    vec2(SPRITE_CENTER_X, HUD_CENTER_Y),
    vec2(SPRITE_DRAW_SIZE),
    tile(typingFrame, SPRITE_FRAME_SIZE),
    WHITE,
    0,
    false,
    undefined,
    false,
    true,
  );
}

function drawCloseButton(): void {
  drawRect(
    vec2(CLOSE_BUTTON_X, TITLE_BAR_CENTER_Y),
    vec2(CLOSE_BUTTON_SIZE, TITLE_BAR_HEIGHT - 8),
    parseColor("#b83b3b"),
    0,
    false,
    true,
  );
  engineImageFont.drawTextScreen(
    "x",
    vec2(CLOSE_BUTTON_X, TITLE_BAR_CENTER_Y),
    20,
    true,
    WHITE,
    false,
  );
}

function drawTabs(): void {
  for (const { tab, centerX, width } of tabLayouts()) {
    if (tab.id === activeView) {
      drawRect(
        vec2(centerX, TITLE_BAR_CENTER_Y),
        vec2(width - 4, TITLE_BAR_HEIGHT - 8),
        parseColor("#4a2568"),
        0,
        false,
        true,
      );
    }
    engineImageFont.drawTextScreen(
      tab.label,
      vec2(centerX, TITLE_BAR_CENTER_Y),
      TAB_FONT_SIZE,
      true,
      WHITE,
      false,
    );
  }
}

function drawTitleBar(): void {
  drawRect(
    vec2(CANVAS_PIXELS / 2, TITLE_BAR_CENTER_Y),
    vec2(CANVAS_PIXELS, TITLE_BAR_HEIGHT),
    parseColor("#6d3b9c"),
    0,
    false,
    true,
  );
  drawTabs();
  drawCloseButton();
}

function drawUsableItems(): void {
  for (const { item, centerX } of usableItemLayouts()) {
    const isActive =
      item.id === "ascii-lens"
        ? asciiLensActive
        : item.id === "int-lens"
          ? intLensActive
          : item.id === "memory-legend"
            ? memoryLegendActive
            : activeView === (item.id === "source-view" ? "source" : "memory");
    drawRect(
      vec2(centerX, HUD_CENTER_Y),
      vec2(ITEM_PANEL_SIZE),
      parseColor(isActive ? "#6d3b9c" : "#151515"),
      0,
      false,
      true,
    );
    const frame = itemIconFrame(item.id);
    if (frame !== undefined) {
      drawTile(
        vec2(centerX, HUD_CENTER_Y),
        vec2(ITEM_ICON_SIZE),
        tile(frame, ITEM_SPRITE_FRAME_SIZE, ITEM_SPRITE_TEXTURE_INDEX),
        WHITE,
        0,
        false,
        undefined,
        false,
        true,
      );
    }
  }
}

function drawHud(): void {
  drawRect(
    vec2(CANVAS_PIXELS / 2, HUD_CENTER_Y),
    vec2(CANVAS_PIXELS, HUD_HEIGHT),
    parseColor("#25222a"),
    0,
    false,
    true,
  );
  drawRect(
    vec2(CANVAS_PIXELS / 2, HUD_TOP),
    vec2(CANVAS_PIXELS, 4),
    parseColor("#6d3b9c"),
    0,
    false,
    true,
  );
  drawTypingSprite();
  drawUsableItems();
}

export function drawComputer(): void {
  if (!computerOpen) return;

  drawRect(
    vec2(CANVAS_PIXELS / 2, (TITLE_BAR_HEIGHT + HUD_TOP) / 2),
    vec2(CANVAS_PIXELS, HUD_TOP - TITLE_BAR_HEIGHT),
    parseColor("#080808"),
    0,
    false,
    true,
  );

  if (activeView === "source") drawCodeView();
  else if (activeView === "memory") {
    drawMemoryView(asciiLensActive, intLensActive, memoryLegendActive ? memoryLegend : undefined);
  }
  else drawTerminal();
  drawTitleBar();
  drawHud();
}
