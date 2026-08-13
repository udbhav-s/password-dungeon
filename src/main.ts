import {
  BLACK,
  Color,
  drawRect,
  engineInit,
  keyDirection,
  keyWasPressed,
  mouseWheel,
  setCameraPos,
  setCameraScale,
  setCanvasClearColor,
  setCanvasFixedSize,
  setCanvasPixelated,
  timeDelta,
  vec2,
} from "littlejsengine";
import room1Data from "./data/rooms/room-1.json";
import room2Data from "./data/rooms/room-2.json";
import room3Data from "./data/rooms/room-3.json";
import room4Data from "./data/rooms/room-4.json";
import room5Data from "./data/rooms/room-5.json";
import type {
  Dungeon,
  Door,
  Item,
  Player,
  Point,
  Room,
  Tile,
  TileType,
} from "./types";
import {
  drawComputer,
  hasComputerProgramSucceeded,
  isComputerOpen,
  openComputer,
  updateComputer,
} from "./computer";
import { drawDialog, isDialogOpen, openDialog, updateDialog } from "./dialog";
import { drawInventoryBar, drawInventoryPopup, isInventoryOpen, updateInventory } from "./inventory";
import {
  checkMirrorGoal,
  drawMirrorPlayer,
  getMirrorPlayerTile,
  isMirrorRoom,
  MIRROR_PLAYER_SIZE,
  resetMirrorRoom,
  updateMirrorPlayer,
} from "./mirror-room";
import {
  consumePressurePuzzleFailure,
  drawPressurePads,
  hasPressurePuzzleSucceeded,
  resetPressurePuzzle,
  updatePressurePuzzle,
} from "./pressure-puzzle";
import { drawTitleScreen, isTitleScreenActive, updateTitleScreen } from "./title-screen";
import { ROOM_HEIGHT, ROOM_WIDTH } from "./types";

const room1: Room = room1Data as unknown as Room;
const room2: Room = room2Data as unknown as Room;
const room3: Room = room3Data as unknown as Room;
const room4: Room = room4Data as unknown as Room;
const room5: Room = room5Data as unknown as Room;

const simpleDungeon: Dungeon = {
  id: "simple-dungeon",
  name: "Simple Dungeon",
  startRoom: "room-1",
  rooms: {
    [room1.id]: room1,
    [room2.id]: room2,
    [room3.id]: room3,
  },
};

const pressureDungeon: Dungeon = {
  id: "pressure-dungeon",
  name: "Pressure Dungeon",
  startRoom: "room-4",
  rooms: {
    [room1.id]: room1,
    [room2.id]: room2,
    [room3.id]: room3,
    [room4.id]: room4,
  },
};

const mirrorDungeon: Dungeon = {
  id: "mirror-dungeon",
  name: "Mirror Dungeon",
  startRoom: "room-5",
  rooms: {
    [room1.id]: room1,
    [room2.id]: room2,
    [room3.id]: room3,
    [room5.id]: room5,
  },
};

// Hot swap: point at pressureDungeon/mirrorDungeon to test those rooms in isolation.
// Swap back to simpleDungeon to return to the original start.
const activeDungeon: Dungeon = mirrorDungeon;

const player: Player = {
  position: vec2(),
  size: 0.7,
  speed: 10,
  color: "#55aaff",
  inventory: [],
};

const CANVAS_SIZE = 1024;
const LAVA_COLOR = "#c0392b";
const ZOOM_STEP = 0.1;
// Fixed for now; a future player-progression system can raise/lower these.
let minZoom = 1.6;
let maxZoom = 2.5;
let zoomLevel = 2;

let currentRoom: Room = activeDungeon.rooms[activeDungeon.startRoom];
let roomItems: Item[] = [];
const collectedItemIds = new Set<string>();
let transitionCooldown = 0;
let previousPlayerTile: Point = { x: 0, y: 0 };
let lockedDoorDialogShown = false;

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
  const type: TileType =
    symbol === "#"
      ? "wall"
      : symbol === "D"
        ? "door"
        : symbol === "O"
          ? "object"
          : symbol === "L"
            ? "lava"
            : "space";
  return { type, color: type === "wall" ? room.wallColor : undefined };
}

function tileToWorld(x: number, y: number): { x: number; y: number } {
  return {
    x: x - ROOM_WIDTH / 2,
    y: ROOM_HEIGHT / 2 - y,
  };
}

function playerTile(): Point {
  return {
    x: Math.floor(player.position.x + ROOM_WIDTH / 2),
    y: Math.floor(ROOM_HEIGHT / 2 - player.position.y),
  };
}

function doorAt(room: Room, x: number, y: number): Door | undefined {
  return room.doors.find((door) => door.x === x && door.y === y);
}

function isWallTile(room: Room, x: number, y: number): boolean {
  if (x >= 0 && x < room.width && y >= 0 && y < room.height) {
    const tileType = tileAt(room, x, y).type;
    const door = tileType === "door" ? doorAt(room, x, y) : undefined;
    return tileType === "wall" || tileType === "object" || door?.locked === true;
  }

  if (y < 0) {
    const door = doorAt(room, x, 0);
    return !door || door.locked === true;
  }
  if (y >= room.height) {
    const door = doorAt(room, x, room.height - 1);
    return !door || door.locked === true;
  }
  if (x < 0) {
    const door = doorAt(room, 0, y);
    return !door || door.locked === true;
  }
  if (x >= room.width) {
    const door = doorAt(room, room.width - 1, y);
    return !door || door.locked === true;
  }
  return true;
}

function isLavaTile(room: Room, x: number, y: number): boolean {
  if (x < 0 || x >= room.width || y < 0 || y >= room.height) return false;
  return tileAt(room, x, y).type === "lava";
}

function loadRoom(roomId: string, entry?: { x: number; y: number }): void {
  const nextRoom = activeDungeon.rooms[roomId];
  if (!nextRoom) {
    console.warn(`Room "${roomId}" does not exist.`);
    return;
  }

  currentRoom = nextRoom;
  roomItems = currentRoom.items
    .filter((item) => !collectedItemIds.has(item.id))
    .map((item) => ({ ...item, position: { ...item.position } }));
  resetPressurePuzzle(currentRoom);
  resetMirrorRoom(currentRoom);

  const spawn = entry ?? currentRoom.playerStart;
  const worldPosition = tileToWorld(spawn.x, spawn.y);
  player.position = { x: worldPosition.x, y: worldPosition.y };
  previousPlayerTile = playerTile();
  transitionCooldown = 0.25;
  applyZoom();
  const target = cameraTarget();
  setCameraPos(vec2(target.x, target.y));
  console.log(`Entered ${currentRoom.name}.`);

  if (currentRoom.id === "room-2") {
    openDialog(["this is the second room", "look around i guess"]);
  }
}

function overlapsWall(position: { x: number; y: number }, size: number = player.size): boolean {
  const halfSize = size / 2;
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

function enteredLockedDoorAdjacentTile(): boolean {
  const currentPlayerTile = playerTile();
  const enteredNewTile =
    currentPlayerTile.x !== previousPlayerTile.x || currentPlayerTile.y !== previousPlayerTile.y;
  previousPlayerTile = currentPlayerTile;

  if (!enteredNewTile || lockedDoorDialogShown) return false;

  const isAdjacentToLockedDoor = currentRoom.doors.some(
    (door) =>
      door.locked === true &&
      Math.abs(door.x - currentPlayerTile.x) + Math.abs(door.y - currentPlayerTile.y) === 1,
  );

  if (isAdjacentToLockedDoor) {
    lockedDoorDialogShown = true;
    return true;
  }

  return false;
}

function computerInRange(): boolean {
  const computer = currentRoom.objects.find((object) => object.objectType === "computer");
  if (!computer) return false;

  const computerWorld = tileToWorld(computer.position.x, computer.position.y);
  return Math.hypot(player.position.x - computerWorld.x, player.position.y - computerWorld.y) <= 1.5;
}

function unlockCurrentRoomDoors(): void {
  let unlockedDoor = false;

  for (const door of currentRoom.doors) {
    if (door.locked !== true) continue;
    door.locked = false;
    unlockedDoor = true;
  }

  if (unlockedDoor) console.log(`Unlocked the doors in ${currentRoom.name}.`);
}

function cameraTarget(): { x: number; y: number } {
  return currentRoom.fixedZoom ? { x: 0, y: 0 } : { x: player.position.x, y: player.position.y };
}

function applyZoom(): void {
  if (currentRoom.fixedZoom) {
    setCameraScale(CANVAS_SIZE / ROOM_WIDTH);
    return;
  }
  setCameraScale(ROOM_WIDTH * zoomLevel);
}

function updateZoom(): void {
  if (currentRoom.fixedZoom) return;
  if (mouseWheel === 0) return;
  zoomLevel = Math.min(maxZoom, Math.max(minZoom, zoomLevel - mouseWheel * ZOOM_STEP));
  applyZoom();
}

function gameInit(): void {
  setCanvasFixedSize(vec2(CANVAS_SIZE, CANVAS_SIZE));
  setCanvasPixelated(true);
  setCanvasClearColor(BLACK);
  applyZoom();
  loadRoom(activeDungeon.startRoom);
  console.log(`Opened ${activeDungeon.name}. Use WASD or the arrow keys to move, scroll to zoom.`);
}

function gameUpdate(): void {
  if (isTitleScreenActive()) {
    updateTitleScreen();
    return;
  }

  if (!isComputerOpen()) updateZoom();
  const target = cameraTarget();
  setCameraPos(vec2(target.x, target.y));
  transitionCooldown = Math.max(0, transitionCooldown - timeDelta);

  if (isDialogOpen()) {
    updateDialog();
    return;
  }

  if (isComputerOpen()) {
    updateComputer();
    if (hasComputerProgramSucceeded()) unlockCurrentRoomDoors();
    return;
  }

  updateInventory(player.inventory);
  if (isInventoryOpen()) return;

  const direction = keyDirection();
  movePlayer(direction);
  updateMirrorPlayer(currentRoom, direction, player.speed, (position) =>
    overlapsWall(position, MIRROR_PLAYER_SIZE),
  );
  collectItems();

  updatePressurePuzzle(currentRoom, playerTile());
  if (consumePressurePuzzleFailure()) {
    const spawn = tileToWorld(currentRoom.playerStart.x, currentRoom.playerStart.y);
    player.position = { x: spawn.x, y: spawn.y };
  }
  if (hasPressurePuzzleSucceeded()) unlockCurrentRoomDoors();

  if (isMirrorRoom(currentRoom)) {
    const currentPlayerTile = playerTile();
    const mirrorTile = getMirrorPlayerTile();
    const onLava =
      isLavaTile(currentRoom, currentPlayerTile.x, currentPlayerTile.y) ||
      isLavaTile(currentRoom, mirrorTile.x, mirrorTile.y);
    if (onLava) {
      const spawn = tileToWorld(currentRoom.playerStart.x, currentRoom.playerStart.y);
      player.position = { x: spawn.x, y: spawn.y };
      resetMirrorRoom(currentRoom);
    } else if (checkMirrorGoal(currentRoom)) {
      unlockCurrentRoomDoors();
    }
  }

  if (isDialogOpen()) return;

  if (enteredLockedDoorAdjacentTile()) {
    openDialog(["hmmm.. this door is locked"]);
    return;
  }

  if (keyWasPressed("Enter") && computerInRange()) {
    openComputer();
    return;
  }

  if (transitionCooldown === 0) {
    const door = findBoundaryDoor();
    if (door) loadRoom(door.toRoom, door.entry);
  }
}

function gameRender(): void {
  if (isComputerOpen()) {
    drawComputer();
    return;
  }

  for (let y = 0; y < currentRoom.height; y += 1) {
    for (let x = 0; x < currentRoom.width; x += 1) {
      const tile = tileAt(currentRoom, x, y);
      const door = tile.type === "door" ? doorAt(currentRoom, x, y) : undefined;
      if (tile.type === "lava") {
        const position = tileToWorld(x + 0.5, y + 0.5);
        drawRect(vec2(position.x, position.y), vec2(1), parseColor(LAVA_COLOR));
        continue;
      }
      if (tile.type !== "wall" && door?.locked !== true) continue;
      const position = tileToWorld(x + 0.5, y + 0.5);
      const color = door?.locked === true ? "#777777" : currentRoom.wallColor;
      drawRect(vec2(position.x, position.y), vec2(1), parseColor(color));
    }
  }

  drawPressurePads(currentRoom);
  drawMirrorPlayer(currentRoom, parseColor);

  for (const item of roomItems) {
    const position = tileToWorld(item.position.x, item.position.y);
    drawRect(vec2(position.x, position.y), vec2(0.6), parseColor(item.color));
  }

  for (const object of currentRoom.objects) {
    const position = tileToWorld(object.position.x, object.position.y);
    drawRect(vec2(position.x, position.y), vec2(0.8), parseColor(object.color));
  }

  drawRect(vec2(player.position.x, player.position.y), vec2(player.size), parseColor(player.color));
}

function gameRenderPost(): void {
  drawDialog(player.position.y);

  if (isInventoryOpen()) {
    drawInventoryPopup(player.inventory);
  } else if (!isTitleScreenActive() && !isComputerOpen() && !isDialogOpen()) {
    drawInventoryBar(player.inventory);
  }

  drawTitleScreen();
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
