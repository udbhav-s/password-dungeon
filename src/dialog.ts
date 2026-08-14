import {
  Color,
  drawRect,
  engineImageFont,
  keyWasPressed,
  timeDelta,
  vec2,
  WHITE,
} from "littlejsengine";
import type { DialogMessageSequence, DialogOptions, DialogState } from "./types";
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
  options: DialogOptions = {},
): void {
  if (messages.length === 0) return;

  dialog = {
    messages,
    messageIndex: 0,
    visibleCharacters: 0,
    charactersPerSecond,
    choices: options.choices,
    selectedChoiceIndex: 0,
    onComplete: options.onComplete,
    onEscape: options.onEscape,
  };
}

export function isDialogOpen(): boolean {
  return dialog !== undefined;
}

export function updateDialog(): void {
  if (!dialog) return;

  if (keyWasPressed("Escape") && dialog.onEscape) {
    const onEscape = dialog.onEscape;
    dialog = undefined;
    onEscape();
    return;
  }

  const message = dialog.messages[dialog.messageIndex];
  const complete = Math.floor(dialog.visibleCharacters) >= message.length;

  if (complete && dialog.choices && dialog.choices.length > 0) {
    if (keyWasPressed("ArrowUp") || keyWasPressed("KeyW")) {
      dialog.selectedChoiceIndex =
        (dialog.selectedChoiceIndex - 1 + dialog.choices.length) % dialog.choices.length;
      return;
    }
    if (keyWasPressed("ArrowDown") || keyWasPressed("KeyS")) {
      dialog.selectedChoiceIndex = (dialog.selectedChoiceIndex + 1) % dialog.choices.length;
      return;
    }
  }

  if (keyWasPressed("Enter")) {
    if (!complete) {
      dialog.visibleCharacters = message.length;
      return;
    }

    if (
      dialog.messageIndex === dialog.messages.length - 1 &&
      dialog.choices &&
      dialog.choices.length > 0
    ) {
      const choice = dialog.choices[dialog.selectedChoiceIndex];
      dialog = undefined;
      choice.onSelect();
      return;
    }

    dialog.messageIndex += 1;
    if (dialog.messageIndex >= dialog.messages.length) {
      const onComplete = dialog.onComplete;
      dialog = undefined;
      onComplete?.();
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

function wrapText(text: string, maxCharacters = 58): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(" ");
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (candidate.length > maxCharacters && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  }
  return lines;
}

function drawDialogText(text: string, centerX: number, centerY: number): void {
  const lines = wrapText(text);
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

  const choicesVisible =
    isComplete &&
    dialog.messageIndex === dialog.messages.length - 1 &&
    dialog.choices &&
    dialog.choices.length > 0;
  drawDialogText(
    visibleMessage,
    CANVAS_PIXELS / 2,
    dialogCenterY - (choicesVisible ? TILE_PIXELS * 2.5 : TILE_PIXELS),
  );

  if (choicesVisible && dialog.choices) {
    const choiceStartY = dialogCenterY + TILE_PIXELS / 2;
    const selectedChoiceIndex = dialog.selectedChoiceIndex;
    dialog.choices.forEach((choice, index) => {
      const prefix = index === selectedChoiceIndex ? "> " : "  ";
      engineImageFont.drawTextScreen(
        `${prefix}${choice.label}`,
        vec2(CANVAS_PIXELS / 2, choiceStartY + index * DIALOG_TEXT_SIZE * 1.5),
        DIALOG_TEXT_SIZE,
        true,
        index === selectedChoiceIndex ? parseColor("#d4a6ff") : WHITE,
        false,
      );
    });
  }

  if (isComplete && !choicesVisible) {
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
