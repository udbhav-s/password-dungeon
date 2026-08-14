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
import room1Source from "../c_levels/room1.c?raw";
import room2Source from "../c_levels/room2.c?raw";
import room3Source from "../c_levels/room3.c?raw";
import room4Source from "../c_levels/room4.c?raw";
import room5Source from "../c_levels/room5.c?raw";
import room5aSource from "../c_levels/room5a.c?raw";
import room6Source from "../c_levels/room6.c?raw";
import room10Source from "../c_levels/room10.c?raw";
import type { ProgramManagerBase } from "./program-manager-base";
import { Room1ProgramManager } from "./programs/room1";
import { Room2ProgramManager } from "./programs/room2";
import { Room3ProgramManager } from "./programs/room3";
import { Room4ProgramManager } from "./programs/room4";
import { Room5ProgramManager } from "./programs/room5";
import { Room5AProgramManager } from "./programs/room5a";
import { Room6ProgramManager } from "./programs/room6";
import { Room10ProgramManager } from "./programs/room10";
import type { Item } from "./types";
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
}

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
    sourceLines: room1Source.split("\n"),
    loadingMessage: "loading room1.c...",
  },
  "room-2": {
    createManager: () => new Room2ProgramManager(),
    sourceLines: room2Source.split("\n"),
    loadingMessage: "loading room2.c...",
  },
  "room-3": {
    createManager: () => new Room3ProgramManager(),
    sourceLines: room3Source.split("\n"),
    loadingMessage: "loading room3.c...",
  },
  "room-4-lock": {
    createManager: () => new Room4ProgramManager(),
    sourceLines: room4Source.split("\n"),
    loadingMessage: "loading room4.c...",
  },
  "room-5": {
    createManager: () => new Room5ProgramManager(),
    sourceLines: room5Source.split("\n"),
    loadingMessage: "loading room5.c...",
    sourceRedaction: "1mpossiblehidd3np4ss",
  },
  "room-5a": {
    createManager: () => new Room5AProgramManager(),
    sourceLines: room5aSource.split("\n"),
    loadingMessage: "loading room5a.c...",
  },
  "room-6": {
    createManager: () => new Room6ProgramManager(),
    sourceLines: room6Source.split("\n"),
    loadingMessage: "loading room6.c...",
    sourceRedaction: "structn4v1gator67",
  },
  "room-10": {
    createManager: () => new Room10ProgramManager(),
    sourceLines: room10Source.split("\n"),
    loadingMessage: "loading room10.c...",
  },
};

let computerOpen = false;
let programManager: ProgramManagerBase = new Room1ProgramManager();
let activeView: ComputerView = "console";
let codeScrollOffset = 0;
let sourceLines = room1Source.split("\n");
let loadingMessage = "loading room1.c...";
let sourceRedaction: string | undefined;
let usableItems: Item[] = [];
let asciiLensActive = false;
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
  usableItems = inventory.filter(
    (item) =>
      item.id === "source-view" ||
      item.id === "memory-view" ||
      item.id === "ascii-lens",
  );
  asciiLensActive = false;
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
  return Math.max(
    1,
    Math.floor(
      (HUD_TOP - TITLE_BAR_HEIGHT - TERMINAL_PADDING * 2) / TERMINAL_LINE_HEIGHT,
    ),
  );
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
        ) &&
        (item.id === "source-view" || item.id === "memory-view" || item.id === "ascii-lens")
      ) {
        if (item.id === "ascii-lens") asciiLensActive = !asciiLensActive;
        else setActiveView(item.id === "source-view" ? "source" : "memory");
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

function drawCodeView(): void {
  const firstLineY = TITLE_BAR_HEIGHT + TERMINAL_PADDING;
  const lines = sourceLines.slice(codeScrollOffset, codeScrollOffset + visibleCodeLines());

  lines.forEach((line, index) => {
    const y = firstLineY + index * TERMINAL_LINE_HEIGHT;
    const redactionStart = sourceRedaction ? line.indexOf(sourceRedaction) : -1;
    if (redactionStart < 0 || !sourceRedaction) {
      drawTerminalText(line, TERMINAL_PADDING, y);
      return;
    }

    const hiddenLine = `${line.slice(0, redactionStart)}${" ".repeat(sourceRedaction.length)}${line.slice(redactionStart + sourceRedaction.length)}`;
    drawTerminalText(hiddenLine, TERMINAL_PADDING, y);
    const maxVisibleCharacters = Math.floor(
      (CANVAS_PIXELS - TERMINAL_PADDING * 2) / TERMINAL_TEXT_SIZE,
    );
    const visibleRedactionCharacters = Math.max(
      0,
      Math.min(sourceRedaction.length, maxVisibleCharacters - redactionStart),
    );
    for (let character = 0; character < visibleRedactionCharacters; character += 1) {
      drawRect(
        vec2(
          TERMINAL_PADDING + (redactionStart + character + 0.5) * TERMINAL_TEXT_SIZE,
          y + TERMINAL_TEXT_SIZE / 2,
        ),
        vec2(TERMINAL_TEXT_SIZE - 3, TERMINAL_TEXT_SIZE - 3),
        WHITE,
        0,
        false,
        true,
      );
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
    const itemView = item.id === "source-view" ? "source" : "memory";
    const isActive =
      item.id === "ascii-lens" ? asciiLensActive : activeView === itemView;
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
  else if (activeView === "memory") drawMemoryView(asciiLensActive);
  else drawTerminal();
  drawTitleBar();
  drawHud();
}
