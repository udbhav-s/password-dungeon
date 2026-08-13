import {
  Color,
  drawRect,
  engineImageFont,
  mouseWasPressed,
  mouseWheel,
  mousePosScreen,
  vec2,
  WHITE,
} from "littlejsengine";
import { L1ProgramManager } from "./program-manager";
import l1Source from "../c_levels/l1.c?raw";

const CANVAS_PIXELS = 1024;
const WINDOW_X = 64;
const WINDOW_Y = 64;
const WINDOW_WIDTH = CANVAS_PIXELS - WINDOW_X * 2;
const WINDOW_HEIGHT = CANVAS_PIXELS - WINDOW_Y * 2;
const STATUS_BAR_HEIGHT = 48;
const CLOSE_BUTTON_SIZE = 40;
const TERMINAL_PADDING = 32;
const TERMINAL_TEXT_SIZE = 14;
const TERMINAL_LINE_HEIGHT = 24;
const TERMINAL_MAX_LINES = 24;

interface ComputerTab {
  id: string;
  label: string;
  isVisible: () => boolean;
  draw: () => void;
}

let computerOpen = false;
let programManager = new L1ProgramManager();
let activeTabId = "console";
let codeScrollOffset = 0;
const l1SourceLines = l1Source.split("\n");

// TODO: update critirea when items are added
function hasSourceCodeAccess(): boolean {
  return true;
}

// New tabs can be added here — each gets its own visibility condition and draw function.
const tabs: ComputerTab[] = [
  { id: "console", label: "Console", isVisible: () => true, draw: () => drawTerminal() },
  { id: "source", label: "View Source", isVisible: hasSourceCodeAccess, draw: () => drawCodeView() },
];

function visibleTabs(): ComputerTab[] {
  return tabs.filter((tab) => tab.isVisible());
}

function currentTab(): ComputerTab | undefined {
  return visibleTabs().find((tab) => tab.id === activeTabId);
}

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

function closeButtonPosition(): { x: number; y: number } {
  return {
    x: WINDOW_X + WINDOW_WIDTH - CLOSE_BUTTON_SIZE / 2 - 4,
    y: WINDOW_Y + STATUS_BAR_HEIGHT / 2,
  };
}

const TAB_FONT_SIZE = 18;
const TAB_PADDING_X = 16;
const TAB_GAP = 4;
const TAB_START_X = WINDOW_X + 20;

interface TabLayout {
  tab: ComputerTab;
  centerX: number;
  width: number;
}

function tabLayout(): TabLayout[] {
  let x = TAB_START_X;
  return visibleTabs().map((tab) => {
    const width = tab.label.length * TAB_FONT_SIZE + TAB_PADDING_X * 2;
    const centerX = x + width / 2;
    x += width + TAB_GAP;
    return { tab, centerX, width };
  });
}

function contentTop(): number {
  return WINDOW_Y + STATUS_BAR_HEIGHT;
}

function appendTerminalCharacter(character: string): void {
  if (!programManager.isRunning || programManager.inputText.length >= 80) return;
  programManager.appendInputCharacter(character);
}

function handleTerminalKey(event: KeyboardEvent): void {
  if (!computerOpen || !programManager.isRunning) return;

  if (event.key === "Enter") {
    event.preventDefault();
    programManager.submitInput(programManager.inputText);
  } else if (event.key === "Backspace") {
    event.preventDefault();
    programManager.removeInputCharacter();
  } else if (event.key.length === 1) {
    event.preventDefault();
    appendTerminalCharacter(event.key);
  }
}

window.addEventListener("keydown", handleTerminalKey);

export function openComputer(): void {
  computerOpen = true;
  programManager = new L1ProgramManager();
  activeTabId = "console";
  codeScrollOffset = 0;
  void programManager.start();
}

export function isComputerOpen(): boolean {
  return computerOpen;
}

export function hasComputerProgramSucceeded(): boolean {
  return programManager.isSuccessful;
}

function visibleCodeLines(): number {
  const contentHeight = WINDOW_Y + WINDOW_HEIGHT - TERMINAL_PADDING - contentTop() - TERMINAL_PADDING;
  return Math.max(1, Math.floor(contentHeight / TERMINAL_LINE_HEIGHT));
}

function maxCodeScrollOffset(): number {
  return Math.max(0, l1SourceLines.length - visibleCodeLines());
}

export function updateComputer(): void {
  if (!computerOpen) return;

  const closeButton = closeButtonPosition();
  if (
    mouseWasPressed(0) &&
    isInside(
      mousePosScreen.x,
      mousePosScreen.y,
      closeButton.x,
      closeButton.y,
      CLOSE_BUTTON_SIZE,
      STATUS_BAR_HEIGHT,
    )
  ) {
    computerOpen = false;
    return;
  }

  if (mouseWasPressed(0)) {
    const statusBarCenterY = WINDOW_Y + STATUS_BAR_HEIGHT / 2;
    tabLayout().forEach(({ tab, centerX, width }) => {
      if (isInside(mousePosScreen.x, mousePosScreen.y, centerX, statusBarCenterY, width, STATUS_BAR_HEIGHT)) {
        activeTabId = tab.id;
      }
    });
  }

  if (activeTabId === "source" && mouseWheel !== 0) {
    const direction = mouseWheel > 0 ? 1 : -1;
    codeScrollOffset = Math.min(maxCodeScrollOffset(), Math.max(0, codeScrollOffset + direction));
  }
}

function drawTerminalText(text: string, x: number, y: number, center = false): void {
  engineImageFont.drawTextScreen(text, vec2(x, y), TERMINAL_TEXT_SIZE, center, WHITE, false);
}

function drawTerminal(): void {
  const firstLineY = contentTop() + TERMINAL_PADDING;
  const visibleOutput = programManager.output.slice(-TERMINAL_MAX_LINES);

  visibleOutput.forEach((line, index) => {
    drawTerminalText(line, WINDOW_X + TERMINAL_PADDING, firstLineY + index * TERMINAL_LINE_HEIGHT);
  });

  if (programManager.isLoading) {
    drawTerminalText("loading l1.c...", WINDOW_X + TERMINAL_PADDING, firstLineY);
    return;
  }

  if (!programManager.isRunning) {
    drawTerminalText("[program ended]", WINDOW_X + TERMINAL_PADDING, firstLineY + visibleOutput.length * TERMINAL_LINE_HEIGHT);
    return;
  }

  const inputY = WINDOW_Y + WINDOW_HEIGHT - TERMINAL_PADDING;
  drawTerminalText(`> ${programManager.inputText}_`, WINDOW_X + TERMINAL_PADDING, inputY);
}

function drawCodeView(): void {
  const firstLineY = contentTop() + TERMINAL_PADDING;
  const lines = l1SourceLines.slice(codeScrollOffset, codeScrollOffset + visibleCodeLines());

  lines.forEach((line, index) => {
    drawTerminalText(line, WINDOW_X + TERMINAL_PADDING, firstLineY + index * TERMINAL_LINE_HEIGHT);
  });
}

function drawTabs(): void {
  const statusBarCenterY = WINDOW_Y + STATUS_BAR_HEIGHT / 2;
  tabLayout().forEach(({ tab, centerX, width }) => {
    const isActive = tab.id === activeTabId;
    if (isActive) {
      drawRect(
        vec2(centerX, statusBarCenterY),
        vec2(width - 4, STATUS_BAR_HEIGHT - 8),
        parseColor("#4a2568"),
        0,
        false,
        true,
      );
    }
    engineImageFont.drawTextScreen(tab.label, vec2(centerX, statusBarCenterY), TAB_FONT_SIZE, true, WHITE, false);
  });
}

export function drawComputer(): void {
  if (!computerOpen) return;

  const windowCenterX = WINDOW_X + WINDOW_WIDTH / 2;
  const windowCenterY = WINDOW_Y + WINDOW_HEIGHT / 2;
  const statusBarCenterY = WINDOW_Y + STATUS_BAR_HEIGHT / 2;
  const closeButton = closeButtonPosition();

  drawRect(
    vec2(windowCenterX, windowCenterY),
    vec2(WINDOW_WIDTH, WINDOW_HEIGHT),
    parseColor("#080808"),
    0,
    false,
    true,
  );
  drawRect(
    vec2(windowCenterX, statusBarCenterY),
    vec2(WINDOW_WIDTH, STATUS_BAR_HEIGHT),
    parseColor("#6d3b9c"),
    0,
    false,
    true,
  );
  drawRect(
    vec2(closeButton.x, closeButton.y),
    vec2(CLOSE_BUTTON_SIZE, STATUS_BAR_HEIGHT - 8),
    parseColor("#b83b3b"),
    0,
    false,
    true,
  );

  engineImageFont.drawTextScreen(
    "x",
    vec2(closeButton.x, closeButton.y),
    20,
    true,
    WHITE,
    false,
  );
  drawTabs();
  const tab = currentTab() ?? visibleTabs()[0];
  tab?.draw();
}

export function getProgramMemory(): Uint8Array {
  return programManager.programMemory;
}
