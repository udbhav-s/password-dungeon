import {
  Color,
  drawRect,
  engineImageFont,
  keyWasPressed,
  timeDelta,
  vec2,
  WHITE,
} from "littlejsengine";
import type { DialogMessageSequence, DialogState } from "./types";
import { ROOM_WIDTH } from "./types";

const CANVAS_PIXELS = 1024;
const TILE_PIXELS = CANVAS_PIXELS / ROOM_WIDTH;
const DIALOG_HEIGHT_TILES = 14;
const DIALOG_HEIGHT_PIXELS = DIALOG_HEIGHT_TILES * TILE_PIXELS;
const DIALOG_TEXT_SIZE = 24;
const DIALOG_TEXT_SPEED = 28;
const DIALOG_PADDING = TILE_PIXELS;

let dialog: DialogState | undefined;

function parseColor(hex: string): Color {
  const value = hex.replace("#", "");
  const red = Number.parseInt(value.slice(0, 2), 16) / 255;
  const green = Number.parseInt(value.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(value.slice(4, 6), 16) / 255;
  return new Color(red, green, blue);
}

export function openDialog(
  messages: DialogMessageSequence,
  charactersPerSecond = DIALOG_TEXT_SPEED,
): void {
  if (messages.length === 0) return;

  dialog = {
    messages,
    messageIndex: 0,
    visibleCharacters: 0,
    charactersPerSecond,
  };
}

export function isDialogOpen(): boolean {
  return dialog !== undefined;
}

export function updateDialog(): void {
  if (!dialog) return;

  const message = dialog.messages[dialog.messageIndex];
  const complete = Math.floor(dialog.visibleCharacters) >= message.length;

  if (keyWasPressed("Enter")) {
    if (!complete) {
      dialog.visibleCharacters = message.length;
      return;
    }

    dialog.messageIndex += 1;
    if (dialog.messageIndex >= dialog.messages.length) {
      dialog = undefined;
      return;
    }

    dialog.visibleCharacters = 0;
    return;
  }

  if (!complete) {
    dialog.visibleCharacters = Math.min(
      message.length,
      dialog.visibleCharacters + dialog.charactersPerSecond * timeDelta,
    );
  }
}

function drawDialogText(text: string, centerX: number, centerY: number): void {
  const lines = text.split("\n");
  const lineHeight = DIALOG_TEXT_SIZE * 1.5;
  const firstLineY = centerY - ((lines.length - 1) * lineHeight) / 2;

  lines.forEach((line, index) => {
    engineImageFont.drawTextScreen(
      line,
      vec2(centerX, firstLineY + index * lineHeight),
      DIALOG_TEXT_SIZE,
      true,
      WHITE,
      false,
    );
  });
}

export function drawDialog(playerY: number): void {
  if (!dialog) return;

  const dialogOnBottom = playerY > 0;
  const dialogTop = dialogOnBottom ? CANVAS_PIXELS - DIALOG_HEIGHT_PIXELS : 0;
  const dialogCenterY = dialogTop + DIALOG_HEIGHT_PIXELS / 2;
  const currentMessage = dialog.messages[dialog.messageIndex];
  const visibleMessage = currentMessage.slice(0, Math.floor(dialog.visibleCharacters));
  const isComplete = visibleMessage.length === currentMessage.length;

  drawRect(
    vec2(CANVAS_PIXELS / 2, dialogCenterY),
    vec2(CANVAS_PIXELS - TILE_PIXELS, DIALOG_HEIGHT_PIXELS - TILE_PIXELS),
    parseColor("#111111"),
    0,
    false,
    true,
  );
  drawRect(
    vec2(CANVAS_PIXELS / 2, dialogTop + TILE_PIXELS / 2),
    vec2(CANVAS_PIXELS - TILE_PIXELS, 4),
    parseColor("#ffffff"),
    0,
    false,
    true,
  );
  drawRect(
    vec2(CANVAS_PIXELS / 2, dialogTop + DIALOG_HEIGHT_PIXELS - TILE_PIXELS / 2),
    vec2(CANVAS_PIXELS - TILE_PIXELS, 4),
    parseColor("#ffffff"),
    0,
    false,
    true,
  );

  drawDialogText(visibleMessage, CANVAS_PIXELS / 2, dialogCenterY - TILE_PIXELS);

  if (isComplete) {
    const prompt = "[Enter]";
    const promptWidth = prompt.length * (DIALOG_TEXT_SIZE / 1.5);
    engineImageFont.drawTextScreen(
      prompt,
      vec2(
        CANVAS_PIXELS - DIALOG_PADDING - promptWidth / 2,
        dialogTop + DIALOG_HEIGHT_PIXELS - DIALOG_PADDING,
      ),
      DIALOG_TEXT_SIZE / 1.5,
      true,
      WHITE,
      false,
    );
  }
}
