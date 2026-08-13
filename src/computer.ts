import {
  Color,
  drawRect,
  engineImageFont,
  mouseWasPressed,
  mousePosScreen,
  vec2,
  WHITE,
} from "littlejsengine";

const CANVAS_PIXELS = 1024;
const WINDOW_X = 96;
const WINDOW_Y = 96;
const WINDOW_WIDTH = CANVAS_PIXELS - WINDOW_X * 2;
const WINDOW_HEIGHT = CANVAS_PIXELS - WINDOW_Y * 2;
const STATUS_BAR_HEIGHT = 48;
const CLOSE_BUTTON_SIZE = 40;

let computerOpen = false;

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

export function openComputer(): void {
  computerOpen = true;
}

export function isComputerOpen(): boolean {
  return computerOpen;
}

export function updateComputer(): void {
  if (!computerOpen || !mouseWasPressed(0)) return;

  const closeX = WINDOW_X + WINDOW_WIDTH - CLOSE_BUTTON_SIZE / 2 - 4;
  const closeY = WINDOW_Y + STATUS_BAR_HEIGHT / 2;
  if (isInside(mousePosScreen.x, mousePosScreen.y, closeX, closeY, CLOSE_BUTTON_SIZE, STATUS_BAR_HEIGHT)) {
    computerOpen = false;
  }
}

export function drawComputer(): void {
  if (!computerOpen) return;

  const windowCenterX = WINDOW_X + WINDOW_WIDTH / 2;
  const windowCenterY = WINDOW_Y + WINDOW_HEIGHT / 2;
  const statusBarCenterY = WINDOW_Y + STATUS_BAR_HEIGHT / 2;
  const closeX = WINDOW_X + WINDOW_WIDTH - CLOSE_BUTTON_SIZE / 2 - 4;

  drawRect(
    vec2(windowCenterX, windowCenterY),
    vec2(WINDOW_WIDTH, WINDOW_HEIGHT),
    parseColor("#202020"),
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
    vec2(closeX, statusBarCenterY),
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
    vec2(closeX, statusBarCenterY),
    20,
    true,
    WHITE,
    false,
  );
  engineImageFont.drawTextScreen(
    "placeholder computer screen",
    vec2(windowCenterX, windowCenterY),
    20,
    true,
    WHITE,
    false,
  );
}
