import {
  BLACK,
  Color,
  drawRect,
  drawTile,
  engineImageFont,
  engineInit,
  keyDirection,
  keyWasPressed,
  mouseWheel,
  setCameraPos,
  setCameraScale,
  setCanvasClearColor,
  setCanvasFixedSize,
  setCanvasPixelated,
  setDebugKey,
  setDebugWatermark,
  tile,
  timeDelta,
  vec2,
  WHITE,
} from "littlejsengine";
import room1Data from "./data/rooms/room-1.json";
import room2Data from "./data/rooms/room-2.json";
import room3Data from "./data/rooms/room-3.json";
import room4Data from "./data/rooms/room-4.json";
import room5Data from "./data/rooms/room-5.json";
import room5aData from "./data/rooms/room-5a.json";
import room5bData from "./data/rooms/room-5b.json";
import room6Data from "./data/rooms/room-6.json";
import room7Data from "./data/rooms/room-7.json";
import room7aData from "./data/rooms/room-7a.json";
import room8Data from "./data/rooms/room-8.json";
import room8aData from "./data/rooms/room-8a.json";
import room9Data from "./data/rooms/room-9.json";
import room9aData from "./data/rooms/room-9a.json";
import room10Data from "./data/rooms/room-10.json";
import type {
  Dungeon,
  Door,
  Item,
  Player,
  Point,
  Room,
  RoomObject,
  Tile,
  TileType,
} from "./types";
import {
  drawComputer,
  getActiveBallSize,
  getActiveCrateSize,
  hasComputerProgramSucceeded,
  isComputerOpen,
  openComputer,
  updateComputer,
} from "./computer";
import { drawDialog, isDialogOpen, openDialog, updateDialog } from "./dialog";
import { drawInventoryBar, drawInventoryPopup, isInventoryOpen, updateInventory } from "./inventory";
import {
  itemIconFrame,
  ITEM_SPRITE_FRAME_SIZE,
  ITEM_SPRITE_TEXTURE_INDEX,
} from "./item-icons";
import {
  drawTitleScreen,
  isTitleScreenActive,
  setTitleScreenSkipped,
  updateTitleScreen,
} from "./title-screen";
import { LOCKED_DOOR_DIALOG as ROOM_1_LOCKED_DOOR_DIALOG } from "./room-interactions/room1";
import {
  LOCKED_DOOR_DIALOG as ROOM_2_LOCKED_DOOR_DIALOG,
  onEnter as onEnterRoom2,
} from "./room-interactions/room2";
import { Room3Interaction } from "./room-interactions/room3";
import { Room4Interaction } from "./room-interactions/room4";
import { Room5AInteraction } from "./room-interactions/room5a";
import { Room5BInteraction } from "./room-interactions/room5b";
import { Room7AInteraction } from "./room-interactions/room7a";
import {
  COMPUTER_APPROACH_DIALOG as ROOM_6_COMPUTER_APPROACH_DIALOG,
  Room6Interaction,
} from "./room-interactions/room6";
import {
  onEnter as onEnterRoom10,
  showFinishPrompt as showRoom10FinishPrompt,
} from "./room-interactions/room10";
import {
  checkMirrorGoal,
  drawMirrorRoom,
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

// Debug startup configuration. Set DEBUG_MODE to false to restore the normal game flow.
const DEBUG_MODE = false;
const DEBUG_START_ROOM = "room-5";
const DEBUG_ENABLED_ITEM_IDS = [
  "source-view",
  "memory-view",
  "ascii-lens",
  "int-lens",
  "memory-legend",
];
const DEBUG_CONSOLE = false;

const room1: Room = room1Data as unknown as Room;
const room2: Room = room2Data as unknown as Room;
const room3: Room = room3Data as unknown as Room;
const room4: Room = room4Data as unknown as Room;
const room5: Room = room5Data as unknown as Room;
const room5a: Room = room5aData as unknown as Room;
const room5b: Room = room5bData as unknown as Room;
const room6: Room = room6Data as unknown as Room;
const room7: Room = room7Data as unknown as Room;
const room7a: Room = room7aData as unknown as Room;
const room8: Room = room8Data as unknown as Room;
const room8a: Room = room8aData as unknown as Room;
const room9: Room = room9Data as unknown as Room;
const room9a: Room = room9aData as unknown as Room;
const room10: Room = room10Data as unknown as Room;

const room3Interaction = new Room3Interaction(
  room3,
  (position, size) => overlapsWall(room3, position, size),
  // The exit stays locked until the ball is in the hole, which needs the program
  // to shrink it first.
  () => unlockCurrentRoomDoors(),
);
const room4Interaction = new Room4Interaction(room4, (position, size) =>
  overlapsWall(room4, position, size),
);
const room5aInteraction = new Room5AInteraction(room5a, (position, size) =>
  overlapsWall(room5a, position, size),
  () => openDialog(["try pushing this crate"]),
);
const room5bInteraction = new Room5BInteraction(
  () => player.inventory.some((item) => item.id === "memory-view"),
  () => awardQuizItem("ascii-lens"),
);
const room7aInteraction = new Room7AInteraction(
  () => player.inventory.some((item) => item.id === "memory-view"),
  () => awardQuizItem("int-lens"),
);
const room6Interaction = new Room6Interaction(() => openDialog(ROOM_6_COMPUTER_APPROACH_DIALOG));
const ROOM_1_COMPUTER_DIALOG = [
  "this is a computer",
  "press [Enter] to access it",
] as const;

const simpleDungeon: Dungeon = {
  id: "simple-dungeon",
  name: "Simple Dungeon",
  startRoom: "room-1",
  rooms: {
    [room1.id]: room1,
    [room2.id]: room2,
    [room3.id]: room3,
    [room4.id]: room4,
    [room5.id]: room5,
    [room5a.id]: room5a,
    [room5b.id]: room5b,
    [room6.id]: room6,
    [room7.id]: room7,
    [room7a.id]: room7a,
    [room8.id]: room8,
    [room8a.id]: room8a,
    [room9.id]: room9,
    [room9a.id]: room9a,
    [room10.id]: room10,
  },
};

const player: Player = {
  position: vec2(),
  size: 0.7,
  speed: 10,
  color: "#55aaff",
  inventory: [],
};

const ZOOM_STEP = 0.1;
const CANVAS_PIXELS = 1024;
const CAMERA_SCALE_BASE = 48;
const PLAYER_SPRITE_FRAME_SIZE = 64;
const PLAYER_SPRITE_TEXTURE_INDEX = 1;
const LAVA_FRAME_SIZE = 96;
const LAVA_TEXTURE_INDEX = 5;
const PLAYER_SPRITE_DRAW_SIZE = 1.2;
const PLAYER_WALK_FRAME_DURATION = 0.16;
const WORLD_SPRITE_FRAME_SIZE = 64;
const COMPUTER_SPRITE_TEXTURE_INDEX = 3;
const LOCKED_DOOR_SPRITE_TEXTURE_INDEX = 4;
// Fixed for now; a future player-progression system can raise/lower these.
let minZoom = 1.6;
let maxZoom = 2.5;
let zoomLevel = 2;

let currentRoom: Room = simpleDungeon.rooms[simpleDungeon.startRoom];
let roomItems: Item[] = [];
const collectedItemIds = new Set<string>();
let transitionCooldown = 0;
let previousPlayerTile: Point = { x: 0, y: 0 };
let lockedDoorDialogShown = false;
let debugOverlayVisible = false;
let playerFacing: "left" | "right" = "right";
let playerWalking = false;
let playerWalkElapsed = 0;
let playerWalkFrame = 0;
let activeComputer: RoomObject | undefined;
let room1ComputerDialogShown = false;

function applyDebugConfiguration(): void {
  player.inventory.length = 0;
  collectedItemIds.clear();
  if (!DEBUG_MODE && !DEBUG_CONSOLE) return;

  const availableItems = Object.values(simpleDungeon.rooms).flatMap((room) => room.items);
  for (const itemId of DEBUG_ENABLED_ITEM_IDS) {
    const item = availableItems.find((candidate) => candidate.id === itemId);
    if (!item) {
      console.warn(`Debug item "${itemId}" does not exist.`);
      continue;
    }

    player.inventory.push({ ...item, position: { ...item.position } });
    collectedItemIds.add(item.id);
  }
}

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

  // Room objects are defined separately from the tile map, but still occupy
  // their grid tile for movement collision.
  if (
    type === "space" &&
    room.objects.some(
      (object) => Math.floor(object.position.x) === x && Math.floor(object.position.y) === y,
    )
  ) {
    return { type: "object" };
  }

  return { type, color: type === "wall" ? room.wallColor : undefined };
}

function tileToWorld(room: Room, x: number, y: number): { x: number; y: number } {
  return {
    x: x - room.width / 2,
    y: room.height / 2 - y,
  };
}

function playerTile(): Point {
  return {
    x: Math.floor(player.position.x + currentRoom.width / 2),
    y: Math.floor(currentRoom.height / 2 - player.position.y),
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
  const nextRoom = simpleDungeon.rooms[roomId];
  if (!nextRoom) {
    console.warn(`Room "${roomId}" does not exist.`);
    return;
  }

  currentRoom = nextRoom;
  lockedDoorDialogShown = false;
  roomItems = currentRoom.items
    .filter((item) => !collectedItemIds.has(item.id))
    .map((item) => ({ ...item, position: { ...item.position } }));

  if (currentRoom.id === "room-3") room3Interaction.reset();
  if (currentRoom.id === "room-4") room4Interaction.reset();
  if (currentRoom.id === "room-5a") room5aInteraction.reset();
  if (currentRoom.id === "room-6") room6Interaction.reset();
  resetPressurePuzzle(currentRoom);
  resetMirrorRoom(currentRoom);

  const spawn = entry ?? currentRoom.playerStart;
  const worldPosition = tileToWorld(currentRoom, spawn.x, spawn.y);
  player.position = { x: worldPosition.x, y: worldPosition.y };
  previousPlayerTile = playerTile();
  transitionCooldown = 0.25;
  applyZoom();
  const camera = cameraTarget();
  setCameraPos(vec2(camera.x, camera.y));
  console.log(`Entered ${currentRoom.name}.`);
  if (currentRoom.id === "room-2") onEnterRoom2();
  if (currentRoom.id === "room-10") onEnterRoom10();
}

function overlapsWall(room: Room, position: { x: number; y: number }, size = player.size): boolean {
  const halfSize = size / 2;
  const left = Math.floor(position.x - halfSize + room.width / 2);
  const right = Math.floor(position.x + halfSize + room.width / 2);
  const top = Math.floor(room.height / 2 - (position.y + halfSize));
  const bottom = Math.floor(room.height / 2 - (position.y - halfSize));

  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      if (isWallTile(room, x, y)) return true;
    }
  }

  return false;
}

function movePlayer(direction: { x: number; y: number }): boolean {
  if (direction.x === 0 && direction.y === 0) return false;

  const length = Math.hypot(direction.x, direction.y) || 1;
  const velocity = {
    x: (direction.x / length) * player.speed * timeDelta,
    y: (direction.y / length) * player.speed * timeDelta,
  };

  let moved = false;
  const nextX = { x: player.position.x + velocity.x, y: player.position.y };
  if (velocity.x !== 0 && !overlapsWall(currentRoom, nextX)) {
    player.position.x = nextX.x;
    moved = true;
  }

  const nextY = { x: player.position.x, y: player.position.y + velocity.y };
  if (velocity.y !== 0 && !overlapsWall(currentRoom, nextY)) {
    player.position.y = nextY.y;
    moved = true;
  }

  return moved;
}

function updatePlayerAnimation(direction: Point, moved: boolean): void {
  if (direction.x < 0) playerFacing = "left";
  else if (direction.x > 0) playerFacing = "right";

  playerWalking = moved;
  if (!moved) {
    playerWalkElapsed = 0;
    playerWalkFrame = 0;
    return;
  }

  playerWalkElapsed += timeDelta;
  playerWalkFrame = Math.floor(playerWalkElapsed / PLAYER_WALK_FRAME_DURATION) % 2;
}

function playerSpriteFrame(): number {
  if (!playerWalking) return playerFacing === "left" ? 0 : 1;
  return playerFacing === "left" ? 2 + playerWalkFrame : 4 + playerWalkFrame;
}

function drawPlayer(): void {
  drawTile(
    vec2(player.position.x, player.position.y),
    vec2(PLAYER_SPRITE_DRAW_SIZE),
    tile(playerSpriteFrame(), PLAYER_SPRITE_FRAME_SIZE, PLAYER_SPRITE_TEXTURE_INDEX),
    WHITE,
  );
}

function findBoundaryDoor(): Door | undefined {
  const gridX = Math.floor(player.position.x + currentRoom.width / 2);
  const gridY = Math.floor(currentRoom.height / 2 - player.position.y);

  if (player.position.y < -currentRoom.height / 2) {
    return doorAt(currentRoom, gridX, currentRoom.height - 1);
  }
  if (player.position.y > currentRoom.height / 2) return doorAt(currentRoom, gridX, 0);
  if (player.position.x < -currentRoom.width / 2) return doorAt(currentRoom, 0, gridY);
  if (player.position.x > currentRoom.width / 2) {
    return doorAt(currentRoom, currentRoom.width - 1, gridY);
  }
  return undefined;
}

// Items guarded by a quiz are never picked up by walking into them; the
// matching room interaction awards them once its questions are answered.
const QUIZ_ITEM_IDS = new Set(["ascii-lens", "int-lens", "memory-legend"]);

function collectItems(): void {
  const playerWorld = player.position;
  const remainingItems: Item[] = [];
  let asciiLensNearby = false;
  let intLensNearby = false;

  for (const item of roomItems) {
    const itemWorld = tileToWorld(currentRoom, item.position.x, item.position.y);
    const distance = Math.hypot(playerWorld.x - itemWorld.x, playerWorld.y - itemWorld.y);
    if (QUIZ_ITEM_IDS.has(item.id)) {
      const nearby = distance < player.size / 2 + 0.35;
      if (item.id === "ascii-lens") asciiLensNearby = nearby;
      else if (item.id === "int-lens") intLensNearby = nearby;
      remainingItems.push(item);
      continue;
    }
    if (distance < player.size / 2 + 0.35) {
      player.inventory.push(item);
      collectedItemIds.add(item.id);
      console.log(`Picked up ${item.name}.`, item);
      openDialog(
        item.id === "source-view"
          ? [
              "you got source view!",
              "having this item gives you a special ability",
              "you are now able to see the C code that the programs on computers are running",
              "maybe this is useful..?",
            ]
          : item.id === "memory-view"
            ? [
                "You got the memory view item!",
                "This allows you to see what the program memory looks like for running code",
                "very cool",
              ]
          : [`you got ${item.name.toLowerCase()}!`],
      );
    } else {
      remainingItems.push(item);
    }
  }

  roomItems = remainingItems;
  room5bInteraction.updateItemProximity(asciiLensNearby);
  room7aInteraction.updateItemProximity(intLensNearby);
}

function awardQuizItem(itemId: string): void {
  if (collectedItemIds.has(itemId)) return;
  const item = roomItems.find((candidate) => candidate.id === itemId);
  if (!item) return;
  player.inventory.push(item);
  collectedItemIds.add(item.id);
  roomItems = roomItems.filter((candidate) => candidate.id !== item.id);
  console.log(`Picked up ${item.name}.`, item);
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

function computerInRange(): RoomObject | undefined {
  let nearest: RoomObject | undefined;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const computer of currentRoom.objects.filter(
    (object) => object.objectType === "computer",
  )) {
    const computerWorld = tileToWorld(currentRoom, computer.position.x, computer.position.y);
    const distance = Math.hypot(
      player.position.x - computerWorld.x,
      player.position.y - computerWorld.y,
    );
    if (distance <= 1.5 && distance < nearestDistance) {
      nearest = computer;
      nearestDistance = distance;
    }
  }

  return nearest;
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

// Mirror rooms need both bodies on screen at once, so they ignore the player
// zoom and fit the whole room instead.
function cameraTarget(): Point {
  return currentRoom.fixedZoom ? { x: 0, y: 0 } : { x: player.position.x, y: player.position.y };
}

function applyZoom(): void {
  if (currentRoom.fixedZoom) {
    setCameraScale(CANVAS_PIXELS / Math.max(currentRoom.width, currentRoom.height));
    return;
  }
  setCameraScale(CAMERA_SCALE_BASE * zoomLevel);
}

function updateZoom(): void {
  if (currentRoom.fixedZoom) return;
  if (mouseWheel === 0) return;
  zoomLevel = Math.min(maxZoom, Math.max(minZoom, zoomLevel - mouseWheel * ZOOM_STEP));
  applyZoom();
}

function gameInit(): void {
  // The engine binds Esc to its own debug overlay, which collides with the
  // dialog quizzes using Esc to back out. An unmatched key code disables it.
  setDebugKey("");
  setDebugWatermark(false);
  setCanvasFixedSize(vec2(CANVAS_PIXELS, CANVAS_PIXELS));
  setCanvasPixelated(true);
  setCanvasClearColor(BLACK);
  applyZoom();
  const debugStartupEnabled = DEBUG_MODE || DEBUG_CONSOLE;
  setTitleScreenSkipped(debugStartupEnabled);
  applyDebugConfiguration();
  const startRoomId = debugStartupEnabled ? DEBUG_START_ROOM : simpleDungeon.startRoom;
  loadRoom(startRoomId);
  if (DEBUG_CONSOLE) {
    activeComputer = currentRoom.objects.find((object) => object.objectType === "computer");
    openComputer(activeComputer?.programId ?? startRoomId, player.inventory);
  }
  console.log(`Opened ${simpleDungeon.name}. Use WASD or the arrow keys to move, scroll to zoom.`);
}

function gameUpdate(): void {
  if (isTitleScreenActive()) {
    updateTitleScreen();
    return;
  }

  if (keyWasPressed("Escape") && !isDialogOpen() && !isComputerOpen()) {
    debugOverlayVisible = !debugOverlayVisible;
  }

  if (!isComputerOpen()) updateZoom();
  const camera = cameraTarget();
  setCameraPos(vec2(camera.x, camera.y));
  transitionCooldown = Math.max(0, transitionCooldown - timeDelta);

  if (isDialogOpen()) {
    updateDialog();
    return;
  }

  if (isComputerOpen()) {
    updateComputer();
    if (hasComputerProgramSucceeded()) {
      if (currentRoom.id === "room-3") {
        room3Interaction.syncBallSizeFromProgram(getActiveBallSize());
      }
      else if (currentRoom.id === "room-4" && activeComputer?.id === "computer-4-left") {
        room4Interaction.unlockMiddleDoor();
      }
      else if (currentRoom.id === "room-4" && activeComputer?.id === "computer-4-right") {
        room4Interaction.syncBallSizeFromProgram(getActiveBallSize());
      }
      else if (currentRoom.id === "room-5a") {
        room5aInteraction.syncCrateSizeFromProgram(getActiveCrateSize());
      }
      else unlockCurrentRoomDoors();
    }
    return;
  }

  updateInventory(player.inventory);
  if (isInventoryOpen()) return;

  const direction = keyDirection();
  const playerPositionBeforeMove = { ...player.position };
  const playerMoved = movePlayer(direction);
  const playerMovement = {
    x: player.position.x - playerPositionBeforeMove.x,
    y: player.position.y - playerPositionBeforeMove.y,
  };
  updatePlayerAnimation(direction, playerMoved);
  updateMirrorPlayer(currentRoom, direction, player.speed, (position) =>
    overlapsWall(currentRoom, position, MIRROR_PLAYER_SIZE),
  );
  collectItems();
  if (currentRoom.id === "room-3") {
    room3Interaction.update(player.position, player.size, direction);
  }
  if (currentRoom.id === "room-4") {
    room4Interaction.update(player.position, player.size, direction);
  }
  if (currentRoom.id === "room-5a") {
    room5aInteraction.update(player.position, player.size, playerMovement);
  }
  if (currentRoom.id === "room-6") {
    const computer = currentRoom.objects.find((object) => object.id === "computer-6");
    const computerPosition = computer
      ? tileToWorld(currentRoom, computer.position.x, computer.position.y)
      : undefined;
    room6Interaction.update(player.position, computerPosition);
  }

  updatePressurePuzzle(currentRoom, playerTile());
  if (consumePressurePuzzleFailure()) {
    const spawn = tileToWorld(currentRoom, currentRoom.playerStart.x, currentRoom.playerStart.y);
    player.position = { x: spawn.x, y: spawn.y };
    previousPlayerTile = playerTile();
  }
  if (hasPressurePuzzleSucceeded()) unlockCurrentRoomDoors();

  const currentPlayerTile = playerTile();
  // In a mirror room either body touching lava sends both back to the start.
  const mirrorTile = isMirrorRoom(currentRoom) ? getMirrorPlayerTile(currentRoom) : undefined;
  if (
    isLavaTile(currentRoom, currentPlayerTile.x, currentPlayerTile.y) ||
    (mirrorTile && isLavaTile(currentRoom, mirrorTile.x, mirrorTile.y))
  ) {
    const spawn = tileToWorld(currentRoom, currentRoom.playerStart.x, currentRoom.playerStart.y);
    player.position = { x: spawn.x, y: spawn.y };
    previousPlayerTile = playerTile();
    resetMirrorRoom(currentRoom);
  } else if (checkMirrorGoal(currentRoom)) {
    unlockCurrentRoomDoors();
    if (currentRoom.id === "room-9a") {
      awardQuizItem("memory-legend");
      openDialog([
        "The reflection reaches the pedestal, and the thing in its hands appears in yours",
        "You got the MEMORY LEGEND",
        "In memory view, every byte is now tinted by the field it belongs to",
        "Hover a byte to see which variable owns it",
      ]);
    }
  }

  if (isDialogOpen()) return;

  if (
    (currentRoom.id === "room-1" || currentRoom.id === "room-2") &&
    enteredLockedDoorAdjacentTile()
  ) {
    openDialog(
      currentRoom.id === "room-2"
        ? ROOM_2_LOCKED_DOOR_DIALOG
        : ROOM_1_LOCKED_DOOR_DIALOG,
    );
    return;
  }

  const nearbyComputer = computerInRange();
  if (currentRoom.id === "room-1" && nearbyComputer && !room1ComputerDialogShown) {
    room1ComputerDialogShown = true;
    openDialog(ROOM_1_COMPUTER_DIALOG);
    return;
  }

  if (keyWasPressed("Enter") && nearbyComputer) {
    activeComputer = nearbyComputer;
    openComputer(nearbyComputer.programId ?? currentRoom.id, player.inventory);
    return;
  }

  if (transitionCooldown === 0) {
    const door = findBoundaryDoor();
    if (door?.id === "finish-door" && currentRoom.id === "room-10") {
      const entryPosition = tileToWorld(currentRoom, door.entry.x, door.entry.y);
      player.position = { ...entryPosition };
      previousPlayerTile = playerTile();
      transitionCooldown = 0.25;
      showRoom10FinishPrompt();
    } else if (door) {
      loadRoom(door.toRoom, door.entry);
    }
  }
}

function drawDebugOverlay(): void {
  if (!debugOverlayVisible || isComputerOpen()) return;

  const tile = playerTile();
  const lines = [
    `room: ${currentRoom.id}`,
    `tile: (${tile.x}, ${tile.y})`,
    `world: (${player.position.x.toFixed(2)}, ${player.position.y.toFixed(2)})`,
  ];
  const lineHeight = 24;
  const padding = 16;

  drawRect(
    vec2(16 + 168 / 2, 16 + (lines.length * lineHeight + padding) / 2),
    vec2(168, lines.length * lineHeight + padding),
    new Color(0.03, 0.03, 0.03, 0.85),
    0,
    false,
    true,
  );

  lines.forEach((line, index) => {
    engineImageFont.drawTextScreen(
      line,
      vec2(24, 24 + index * lineHeight),
      18,
      false,
      new Color(0.95, 0.95, 0.95),
      false,
    );
  });
}

function gameRender(): void {
  if (isComputerOpen()) {
    drawComputer();
    return;
  }

  if (currentRoom.floorColor) {
    const center = tileToWorld(currentRoom, currentRoom.width / 2, currentRoom.height / 2);
    drawRect(
      vec2(center.x, center.y),
      vec2(currentRoom.width, currentRoom.height),
      parseColor(currentRoom.floorColor),
    );
  }

  for (let y = 0; y < currentRoom.height; y += 1) {
    for (let x = 0; x < currentRoom.width; x += 1) {
      const roomTile = tileAt(currentRoom, x, y);
      const door = roomTile.type === "door" ? doorAt(currentRoom, x, y) : undefined;
      const isLockedDoor = door?.locked === true;
      if (roomTile.type === "lava") {
        const position = tileToWorld(currentRoom, x + 0.5, y + 0.5);
        drawTile(
          vec2(position.x, position.y),
          vec2(1),
          tile(0, LAVA_FRAME_SIZE, LAVA_TEXTURE_INDEX),
          WHITE,
        );
        continue;
      }
      if (roomTile.type === "door" && !isLockedDoor) continue;
      if (roomTile.type !== "wall" && !isLockedDoor) continue;
      const position = tileToWorld(currentRoom, x + 0.5, y + 0.5);
      if (isLockedDoor) {
        drawTile(
          vec2(position.x, position.y),
          vec2(1),
          tile(0, WORLD_SPRITE_FRAME_SIZE, LOCKED_DOOR_SPRITE_TEXTURE_INDEX),
          WHITE,
        );
        continue;
      }
      drawRect(vec2(position.x, position.y), vec2(1), parseColor(currentRoom.wallColor));
    }
  }

  if (currentRoom.id === "room-3") room3Interaction.draw();
  if (currentRoom.id === "room-4") room4Interaction.draw();
  if (currentRoom.id === "room-5a") room5aInteraction.draw();
  drawPressurePads(currentRoom);
  drawMirrorRoom(currentRoom, parseColor);

  for (const item of roomItems) {
    const position = tileToWorld(currentRoom, item.position.x, item.position.y);
    const frame = itemIconFrame(item.id);
    if (frame !== undefined) {
      drawTile(
        vec2(position.x, position.y),
        vec2(0.7),
        tile(frame, ITEM_SPRITE_FRAME_SIZE, ITEM_SPRITE_TEXTURE_INDEX),
        WHITE,
      );
    }
  }

  for (const object of currentRoom.objects) {
    const position = tileToWorld(currentRoom, object.position.x, object.position.y);
    if (object.objectType === "computer") {
      drawTile(
        vec2(position.x, position.y),
        vec2(1),
        tile(0, WORLD_SPRITE_FRAME_SIZE, COMPUTER_SPRITE_TEXTURE_INDEX),
        WHITE,
      );
      continue;
    }
    drawRect(vec2(position.x, position.y), vec2(0.8), parseColor(object.color));
  }

  drawPlayer();
}

function gameRenderPost(): void {
  drawDialog(player.position.y);
  drawDebugOverlay();

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

void engineInit(
  gameInit,
  gameUpdate,
  () => {},
  gameRender,
  gameRenderPost,
  [
    "/assets/password-dungeon-typing.png",
    "/assets/character.png",
    "/assets/items.png",
    "/assets/computer.png",
    "/assets/locked door.png",
    "/assets/lava.png",
  ],
);
