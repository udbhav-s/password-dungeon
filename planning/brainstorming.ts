// Brainstorm file for initial codegen

// rooms will be 32x32
const LEVEL_WIDTH = 32;
const LEVEL_HEIGHT = 32;

/**
 * Tiles will be JSON
 * 
 * Types of tiles (will be expanded in the future)
 * - empty space
 * - wall
 * - door 
 * 
 * Doors look like empty space and can be walked through (crossing them to the other side of the map triggers a room change, not merely stepping over them)
 */
interface MapTile {
    type: "space" | "wall" | "door" | "item";
}

interface DoorMapTile extends MapTile {
    type: "door";
    /// Name of the room this leads to
    toRoom: string;
}

interface WallMapTile extends MapTile {
    type: "wall";
    /// Color
    color: string;
}

// room maps will look something like (this is 8x8 for simplicity, expand this to 32x32)
const ROOM_1_LEVEL_MAP = [
    1, 1, 1, 1, 1, 1, 1, 1,
    1, 0, 0, 0, 0, 0, 0, 1,
    1, 0, 0, 0, 0, 0, 0, 1,
    1, 0, 0, 0, 0, 1, 0, 1,
    1, 0, 0, 0, 0, 1, 0, 1,
    1, 0, 0, 0, 0, 1, 0, 1,
    1, 0, 0, 0, 0, 1, 0, 1,
    1, 1, 1, 1, 1, 1, 1, 1
];

// The below can be an empty room surrounded by walls and doors at the bottom
const ROOM_2_LEVEL_MAP = [];

// dungeon maps consist of all the rooms in a dungeon.

// Items
interface Item {
    id: number;
    name: string;
    description: string;
    // will be replaced with a sprite later on
    color: string;
}

// Player inventory
interface Player {
    inventory: Item[];
    // location: Point2D;
    // ...
}

