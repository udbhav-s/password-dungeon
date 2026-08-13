import {
  Color,
  drawRect,
  engineImageFont,
  mouseWasPressed,
  mousePosScreen,
  vec2,
  WHITE,
} from "littlejsengine";
import { L1ProgramManager } from "./program-manager";

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

let computerOpen = false;
let programManager = new L1ProgramManager();

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
  void programManager.start();
}

export function isComputerOpen(): boolean {
  return computerOpen;
}

export function hasComputerProgramSucceeded(): boolean {
  return programManager.isSuccessful;
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

}

function drawTerminalText(text: string, x: number, y: number, center = false): void {
  engineImageFont.drawTextScreen(text, vec2(x, y), TERMINAL_TEXT_SIZE, center, WHITE, false);
}

function drawTerminal(): void {
  const firstLineY = WINDOW_Y + STATUS_BAR_HEIGHT + TERMINAL_PADDING;
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
    "Console",
    vec2(WINDOW_X + 24, statusBarCenterY),
    20,
    false,
    WHITE,
    false,
  );
  engineImageFont.drawTextScreen(
    "x",
    vec2(closeButton.x, closeButton.y),
    20,
    true,
    WHITE,
    false,
  );
  drawTerminal();
}

export function getProgramMemory(): Uint8Array {
  return programManager.programMemory;
}
