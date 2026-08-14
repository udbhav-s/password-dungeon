import {
  Color,
  drawRect,
  drawTile,
  engineImageFont,
  keyWasPressed,
  tile,
  timeDelta,
  vec2,
  WHITE,
} from "littlejsengine";
import {
  itemIconFrame,
  ITEM_SPRITE_FRAME_SIZE,
  ITEM_SPRITE_TEXTURE_INDEX,
} from "./item-icons";
import type { Item } from "./types";

const CANVAS_PIXELS = 1024;

const RING_CENTER_X = CANVAS_PIXELS / 2;
const RING_CENTER_Y = 420;
const RING_RADIUS = 260;
const ITEM_BOX_SIZE = 64;
const SELECTED_ITEM_BOX_SIZE = 96;
const ROTATION_LERP_SPEED = 8;

const DESCRIPTION_PANEL_Y = 800;
const DESCRIPTION_PANEL_HEIGHT = 260;
const DESCRIPTION_PADDING = 64;
const DESCRIPTION_NAME_SIZE = 26;
const DESCRIPTION_TEXT_SIZE = 18;
const DESCRIPTION_LINE_HEIGHT = 26;

const BAR_HEIGHT = 84;
const BAR_ITEM_SIZE = 48;
const BAR_ITEM_GAP = 16;
const HINT_TEXT_SIZE = 16;

let isOpen = false;
let selectedIndex = 0;
let ringRotation = 0;

function drawItemIcon(item: Item, x: number, y: number, size: number): void {
  const frame = itemIconFrame(item.id);
  if (frame === undefined) return;
  drawTile(
    vec2(x, y),
    vec2(size),
    tile(frame, ITEM_SPRITE_FRAME_SIZE, ITEM_SPRITE_TEXTURE_INDEX),
    WHITE,
    0,
    false,
    undefined,
    false,
    true,
  );
}

function angleStep(itemCount: number): number {
  return (Math.PI * 2) / Math.max(itemCount, 1);
}

// Shortest signed distance from one angle to another, wrapped to [-PI, PI].
function angleDelta(from: number, to: number): number {
  const diff = (to - from) % (Math.PI * 2);
  if (diff > Math.PI) return diff - Math.PI * 2;
  if (diff < -Math.PI) return diff + Math.PI * 2;
  return diff;
}

export function isInventoryOpen(): boolean {
  return isOpen;
}

export function closeInventory(): void {
  isOpen = false;
}

export function updateInventory(items: Item[]): void {
  if (keyWasPressed("KeyE")) {
    isOpen = !isOpen;
    if (isOpen) selectedIndex = Math.min(selectedIndex, Math.max(items.length - 1, 0));
  }

  if (!isOpen || items.length === 0) return;

  if (keyWasPressed("KeyD")) selectedIndex = (selectedIndex + 1) % items.length;
  if (keyWasPressed("KeyA")) selectedIndex = (selectedIndex - 1 + items.length) % items.length;

  // Rotate the ring so the selected item eases toward the top position.
  const targetRotation = -selectedIndex * angleStep(items.length);
  const rotationStep = angleDelta(ringRotation, targetRotation) * Math.min(1, ROTATION_LERP_SPEED * timeDelta);
  ringRotation += rotationStep;
}

function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine.length === 0 ? word : `${currentLine} ${word}`;
    if (candidate.length > maxCharsPerLine && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = candidate;
    }
  }
  if (currentLine.length > 0) lines.push(currentLine);
  return lines;
}

function drawDescriptionPanel(item: Item): void {
  const panelWidth = CANVAS_PIXELS - DESCRIPTION_PADDING;
  drawRect(
    vec2(CANVAS_PIXELS / 2, DESCRIPTION_PANEL_Y),
    vec2(panelWidth, DESCRIPTION_PANEL_HEIGHT),
    new Color(0.07, 0.07, 0.07, 0.95),
    0,
    false,
    true,
  );
  drawRect(
    vec2(CANVAS_PIXELS / 2, DESCRIPTION_PANEL_Y - DESCRIPTION_PANEL_HEIGHT / 2),
    vec2(panelWidth, 3),
    WHITE,
    0,
    false,
    true,
  );

  const textTop = DESCRIPTION_PANEL_Y - DESCRIPTION_PANEL_HEIGHT / 2 + DESCRIPTION_PADDING / 2;

  engineImageFont.drawTextScreen(
    item.name,
    vec2(CANVAS_PIXELS / 2, textTop),
    DESCRIPTION_NAME_SIZE,
    true,
    WHITE,
    false,
  );

  const descriptionLines = wrapText(item.description, 72);
  descriptionLines.forEach((line, index) => {
    engineImageFont.drawTextScreen(
      line,
      vec2(CANVAS_PIXELS / 2, textTop + DESCRIPTION_NAME_SIZE + 12 + index * DESCRIPTION_LINE_HEIGHT),
      DESCRIPTION_TEXT_SIZE,
      true,
      new Color(0.8, 0.8, 0.8),
      false,
    );
  });
}

export function drawInventoryPopup(items: Item[]): void {
  drawRect(
    vec2(CANVAS_PIXELS / 2, CANVAS_PIXELS / 2),
    vec2(CANVAS_PIXELS),
    new Color(0, 0, 0, 0.7),
    0,
    false,
    true,
  );

  if (items.length === 0) {
    engineImageFont.drawTextScreen(
      "Inventory is empty",
      vec2(CANVAS_PIXELS / 2, RING_CENTER_Y),
      DESCRIPTION_NAME_SIZE,
      true,
      WHITE,
      false,
    );
    engineImageFont.drawTextScreen(
      "[E] Close",
      vec2(CANVAS_PIXELS / 2, RING_CENTER_Y + 48),
      HINT_TEXT_SIZE,
      true,
      new Color(0.7, 0.7, 0.7),
      false,
    );
    return;
  }

  const step = angleStep(items.length);
  items.forEach((item, index) => {
    const angle = -Math.PI / 2 + index * step + ringRotation;
    const x = RING_CENTER_X + Math.cos(angle) * RING_RADIUS;
    const y = RING_CENTER_Y + Math.sin(angle) * RING_RADIUS;
    const isSelected = index === selectedIndex;
    const boxSize = isSelected ? SELECTED_ITEM_BOX_SIZE : ITEM_BOX_SIZE;

    if (isSelected) {
      drawRect(vec2(x, y), vec2(boxSize + 12), WHITE, 0, false, true);
    }
    drawItemIcon(item, x, y, boxSize);
  });

  drawDescriptionPanel(items[selectedIndex]);

  engineImageFont.drawTextScreen(
    "[A] / [D] Browse\n\n[E] Close",
    vec2(CANVAS_PIXELS / 2, RING_CENTER_Y),
    HINT_TEXT_SIZE,
    true,
    new Color(0.7, 0.7, 0.7),
    false,
  );
}

export function drawInventoryBar(items: Item[]): void {
  const barCenterY = CANVAS_PIXELS - BAR_HEIGHT / 2;

  engineImageFont.drawTextScreen(
    "[E] Inventory",
    vec2(BAR_ITEM_SIZE + 64, barCenterY),
    HINT_TEXT_SIZE,
    true,
    new Color(0.7, 0.7, 0.7),
    false,
  );

  if (items.length === 0) return;

  const totalWidth = items.length * BAR_ITEM_SIZE + (items.length - 1) * BAR_ITEM_GAP;
  const startX = CANVAS_PIXELS / 2 - totalWidth / 2 + BAR_ITEM_SIZE / 2;

  items.forEach((item, index) => {
    const x = startX + index * (BAR_ITEM_SIZE + BAR_ITEM_GAP);
    drawItemIcon(item, x, barCenterY, BAR_ITEM_SIZE);
  });
}
