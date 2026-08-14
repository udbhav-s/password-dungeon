import { Color, drawRect, engineImageFont, keyWasPressed, time, timeDelta, vec2 } from "littlejsengine";

const CANVAS_PIXELS = 1024;
const TITLE_TEXT_SIZE = 72;
const SUBTITLE_TEXT_SIZE = 22;
const PROMPT_TEXT_SIZE = 24;
const PROMPT_BLINK_SPEED = 1.6;
const FADE_DURATION = 1.5;

type TitleScreenState = "title" | "fading" | "done";

let state: TitleScreenState = "title";
let fadeElapsed = 0;

export function setTitleScreenSkipped(skipped: boolean): void {
  state = skipped ? "done" : "title";
  fadeElapsed = 0;
}

// Fully opaque while on the title, then eases out to reveal the game behind it.
function overlayAlpha(): number {
  if (state === "title") return 1;
  if (state === "done") return 0;
  const progress = Math.min(1, fadeElapsed / FADE_DURATION);
  return 1 - progress * progress;
}

export function isTitleScreenActive(): boolean {
  return state !== "done";
}

export function updateTitleScreen(): void {
  if (state === "done") return;

  if (state === "title") {
    if (keyWasPressed("Enter")) state = "fading";
    return;
  }

  fadeElapsed += timeDelta;
  if (fadeElapsed >= FADE_DURATION) state = "done";
}

export function drawTitleScreen(): void {
  const alpha = overlayAlpha();
  if (alpha <= 0) return;

  drawRect(
    vec2(CANVAS_PIXELS / 2, CANVAS_PIXELS / 2),
    vec2(CANVAS_PIXELS),
    new Color(0, 0, 0, alpha),
    0,
    false,
    true,
  );

  const textColor = new Color(1, 1, 1, alpha);

  engineImageFont.drawTextScreen(
    "PASSWORD",
    vec2(CANVAS_PIXELS / 2, CANVAS_PIXELS / 2 - TITLE_TEXT_SIZE),
    TITLE_TEXT_SIZE,
    true,
    textColor,
    false,
  );
  engineImageFont.drawTextScreen(
    "DUNGEON",
    vec2(CANVAS_PIXELS / 2, CANVAS_PIXELS / 2 + TITLE_TEXT_SIZE / 4),
    TITLE_TEXT_SIZE,
    true,
    textColor,
    false,
  );
  engineImageFont.drawTextScreen(
    "break the lock, open the door",
    vec2(CANVAS_PIXELS / 2, CANVAS_PIXELS / 2 + TITLE_TEXT_SIZE),
    SUBTITLE_TEXT_SIZE,
    true,
    new Color(0.6, 0.7, 0.9, alpha),
    false,
  );

  if (state !== "title") return;

  const blink = 0.55 + 0.45 * Math.sin(time * PROMPT_BLINK_SPEED * Math.PI);
  engineImageFont.drawTextScreen(
    "[Enter] to start",
    vec2(CANVAS_PIXELS / 2, CANVAS_PIXELS - CANVAS_PIXELS / 5),
    PROMPT_TEXT_SIZE,
    true,
    new Color(1, 1, 1, blink),
    false,
  );
}
