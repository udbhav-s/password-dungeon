import {
  BLACK,
  Color,
  drawRect,
  engineImageFont,
  engineInit,
  keyDirection,
  keyWasPressed,
  setCameraPos,
  setCameraScale,
  setCanvasClearColor,
  setCanvasFixedSize,
  setCanvasPixelated,
  timeDelta,
  vec2,
  WHITE,
} from "littlejsengine";
import room1Data from "./data/rooms/room-1.json";
import room2Data from "./data/rooms/room-2.json";
import type {
  DialogMessageSequence,
  DialogState,
  Dungeon,
  Door,
  Item,
  Player,
  Room,
  Tile,
  TileType,
} from "./types";
import { ROOM_HEIGHT, ROOM_WIDTH } from "./types";

const CANVAS_PIXELS = 1024;
const TILE_PIXELS = CANVAS_PIXELS / ROOM_WIDTH;
const DIALOG_HEIGHT_TILES = 14;
const DIALOG_HEIGHT_PIXELS = DIALOG_HEIGHT_TILES * TILE_PIXELS;
const DIALOG_TEXT_SIZE = 24;
const DIALOG_TEXT_SPEED = 28;
const DIALOG_PADDING = TILE_PIXELS;

const room1: Room = room1Data as unknown as Room;
const room2: Room = room2Data as unknown as Room;

const simpleDungeon: Dungeon = {
  id: "simple-dungeon",
  name: "Simple Dungeon",
  startRoom: "room-1",
  rooms: {
    [room1.id]: room1,
    [room2.id]: room2,
  },
};

const player: Player = {
  position: vec2(),
  size: 0.7,
  speed: 10,
  color: "#55aaff",
  inventory: [],
};

let currentRoom: Room = simpleDungeon.rooms[simpleDungeon.startRoom];
let roomItems: Item[] = [];
const collectedItemIds = new Set<string>();
let transitionCooldown = 0;
let dialog: DialogState | undefined;

function parseColor(hex: string): Color {
  const value = hex.replace("#", "");
  const red = Number.parseInt(value.slice(0, 2), 16) / 255;
  const green = Number.parseInt(value.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(value.slice(4, 6), 16) / 255;
  return new Color(red, green, blue);
}

function tileAt(room: Room, x: number, y: number): Tile {
  if (x < 0 || x >= room.width || y < 0 || y >= room.height) {
    return { type: "wall", color: room.wallColor };
  }

  const symbol = room.tiles[y][x];
  const type: TileType = symbol === "#" ? "wall" : symbol === "D" ? "door" : "space";
  return { type, color: type === "wall" ? room.wallColor : undefined };
}

function tileToWorld(x: number, y: number): { x: number; y: number } {
  return {
    x: x - ROOM_WIDTH / 2,
    y: ROOM_HEIGHT / 2 - y,
  };
}

function doorAt(room: Room, x: number, y: number): Door | undefined {
  return room.doors.find((door) => door.x === x && door.y === y);
}

function isWallTile(room: Room, x: number, y: number): boolean {
  if (x >= 0 && x < room.width && y >= 0 && y < room.height) {
    return tileAt(room, x, y).type === "wall";
  }

  if (y < 0) return !doorAt(room, x, 0);
  if (y >= room.height) return !doorAt(room, x, room.height - 1);
  if (x < 0) return !doorAt(room, 0, y);
  if (x >= room.width) return !doorAt(room, room.width - 1, y);
  return true;
}

function loadRoom(roomId: string, entry?: { x: number; y: number }): void {
  const nextRoom = simpleDungeon.rooms[roomId];
  if (!nextRoom) {
    console.warn(`Room "${roomId}" does not exist.`);
    return;
  }

  currentRoom = nextRoom;
  roomItems = currentRoom.items
    .filter((item) => !collectedItemIds.has(item.id))
    .map((item) => ({ ...item, position: { ...item.position } }));

  const spawn = entry ?? currentRoom.playerStart;
  const worldPosition = tileToWorld(spawn.x, spawn.y);
  player.position = { x: worldPosition.x, y: worldPosition.y };
  transitionCooldown = 0.25;
  setCameraPos(vec2());
  console.log(`Entered ${currentRoom.name}.`);

  if (currentRoom.id === "room-2") {
    openDialog(["this is the second room", "look around i guess"]);
  }
}

function overlapsWall(position: { x: number; y: number }): boolean {
  const halfSize = player.size / 2;
  const left = Math.floor(position.x - halfSize + ROOM_WIDTH / 2);
  const right = Math.floor(position.x + halfSize + ROOM_WIDTH / 2);
  const top = Math.floor(ROOM_HEIGHT / 2 - (position.y + halfSize));
  const bottom = Math.floor(ROOM_HEIGHT / 2 - (position.y - halfSize));

  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      if (isWallTile(currentRoom, x, y)) return true;
    }
  }

  return false;
}

function movePlayer(direction: { x: number; y: number }): void {
  if (direction.x === 0 && direction.y === 0) return;

  const length = Math.hypot(direction.x, direction.y) || 1;
  const velocity = {
    x: (direction.x / length) * player.speed * timeDelta,
    y: (direction.y / length) * player.speed * timeDelta,
  };

  const nextX = { x: player.position.x + velocity.x, y: player.position.y };
  if (!overlapsWall(nextX)) player.position.x = nextX.x;

  const nextY = { x: player.position.x, y: player.position.y + velocity.y };
  if (!overlapsWall(nextY)) player.position.y = nextY.y;
}

function findBoundaryDoor(): Door | undefined {
  const gridX = Math.floor(player.position.x + ROOM_WIDTH / 2);
  const gridY = Math.floor(ROOM_HEIGHT / 2 - player.position.y);

  if (player.position.y < -ROOM_HEIGHT / 2) return doorAt(currentRoom, gridX, ROOM_HEIGHT - 1);
  if (player.position.y > ROOM_HEIGHT / 2) return doorAt(currentRoom, gridX, 0);
  if (player.position.x < -ROOM_WIDTH / 2) return doorAt(currentRoom, 0, gridY);
  if (player.position.x > ROOM_WIDTH / 2) return doorAt(currentRoom, ROOM_WIDTH - 1, gridY);
  return undefined;
}

function collectItems(): void {
  const playerWorld = player.position;
  const remainingItems: Item[] = [];

  for (const item of roomItems) {
    const itemWorld = tileToWorld(item.position.x, item.position.y);
    const distance = Math.hypot(playerWorld.x - itemWorld.x, playerWorld.y - itemWorld.y);
    if (distance < player.size / 2 + 0.35) {
      player.inventory.push(item);
      collectedItemIds.add(item.id);
      console.log(`Picked up ${item.name}.`, item);
      openDialog(["wow, this is an apple", "you picked it up"]);
    } else {
      remainingItems.push(item);
    }
  }

  roomItems = remainingItems;
}

function openDialog(messages: DialogMessageSequence, charactersPerSecond = DIALOG_TEXT_SPEED): void {
  if (messages.length === 0) return;

  dialog = {
    messages,
    messageIndex: 0,
    visibleCharacters: 0,
    charactersPerSecond,
  };
}

function updateDialog(): void {
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

function drawDialog(): void {
  if (!dialog) return;

  const dialogOnBottom = player.position.y > 0;
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
      vec2(CANVAS_PIXELS - DIALOG_PADDING - promptWidth / 2, dialogTop + DIALOG_HEIGHT_PIXELS - DIALOG_PADDING),
      DIALOG_TEXT_SIZE / 1.5,
      true,
      WHITE,
      false,
    );
  }
}

function gameInit(): void {
  setCanvasFixedSize(vec2(1024, 1024));
  setCanvasPixelated(true);
  setCanvasClearColor(BLACK);
  setCameraScale(ROOM_WIDTH);
  loadRoom(simpleDungeon.startRoom);
  console.log(`Opened ${simpleDungeon.name}. Use WASD or the arrow keys to move.`);
}

function gameUpdate(): void {
  transitionCooldown = Math.max(0, transitionCooldown - timeDelta);

  if (dialog) {
    updateDialog();
    return;
  }

  movePlayer(keyDirection());
  collectItems();

  if (transitionCooldown === 0) {
    const door = findBoundaryDoor();
    if (door) loadRoom(door.toRoom, door.entry);
  }
}

function gameRender(): void {
  for (let y = 0; y < currentRoom.height; y += 1) {
    for (let x = 0; x < currentRoom.width; x += 1) {
      if (tileAt(currentRoom, x, y).type !== "wall") continue;
      const position = tileToWorld(x + 0.5, y + 0.5);
      drawRect(vec2(position.x, position.y), vec2(1), parseColor(currentRoom.wallColor));
    }
  }

  for (const item of roomItems) {
    const position = tileToWorld(item.position.x, item.position.y);
    drawRect(vec2(position.x, position.y), vec2(0.6), parseColor(item.color));
  }

  drawRect(vec2(player.position.x, player.position.y), vec2(player.size), parseColor(player.color));
}

function gameRenderPost(): void {
  drawDialog();
}

export function getInventory(): Item[] {
  return player.inventory;
}

// For debugging
declare global {
  var getInventory: () => Item[];
}

globalThis.getInventory = getInventory;

void engineInit(gameInit, gameUpdate, () => {}, gameRender, gameRenderPost);
