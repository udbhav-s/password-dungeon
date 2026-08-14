import { Color, drawRect, vec2 } from "littlejsengine";
import type { CratePressurePlateConfig, Point, Room } from "../types";

interface CrateState {
  position: Point;
  startPosition: Point;
  size: number;
  initialSize: number;
}

type CollisionChecker = (position: Point, size: number) => boolean;

function parseColor(hex: string): Color {
  const value = hex.replace("#", "");
  return new Color(
    Number.parseInt(value.slice(0, 2), 16) / 255,
    Number.parseInt(value.slice(2, 4), 16) / 255,
    Number.parseInt(value.slice(4, 6), 16) / 255,
  );
}

function tileToWorld(room: Room, x: number, y: number): Point {
  return {
    x: x - room.width / 2,
    y: room.height / 2 - y,
  };
}

export class Room5AInteraction {
  private crate: CrateState | undefined;
  private readonly pressedPlateIds = new Set<string>();
  private resetPlatePressed = false;
  private approachDialogShown = false;

  constructor(
    private readonly room: Room,
    private readonly isBlocked: CollisionChecker,
    private readonly onApproachCrate?: () => void,
  ) {
    this.reset();
  }

  reset(): void {
    const config = this.room.crate;
    this.pressedPlateIds.clear();
    this.resetPlatePressed = false;
    this.approachDialogShown = false;
    if (!config) {
      this.crate = undefined;
      return;
    }

    const position = tileToWorld(this.room, config.position.x, config.position.y);
    this.crate = {
      position: { ...position },
      startPosition: { ...position },
      size: config.size,
      initialSize: config.size,
    };
    this.updatePlateDoors({ x: Number.POSITIVE_INFINITY, y: Number.POSITIVE_INFINITY }, 0);
  }

  syncCrateSizeFromProgram(size: number | undefined): void {
    if (!this.crate || size === undefined) return;
    this.crate.size = size;
    if (this.isBlocked(this.crate.position, this.crate.size)) {
      this.crate.position = { ...this.crate.startPosition };
    }
  }

  update(playerPosition: Point, playerSize: number, playerMovement: Point): void {
    if (!this.crate) return;

    this.showApproachDialog(playerPosition, playerSize);
    this.pushWithPlayer(playerPosition, playerSize, playerMovement);
    this.updateResetPlate(playerPosition, playerSize);
    this.updatePlateDoors(playerPosition, playerSize);
  }

  draw(): void {
    this.drawPlates();
    this.drawResetPlate();
    this.drawCrate();
  }

  private showApproachDialog(playerPosition: Point, playerSize: number): void {
    if (!this.crate || this.approachDialogShown) return;
    const distance = Math.hypot(
      playerPosition.x - this.crate.position.x,
      playerPosition.y - this.crate.position.y,
    );
    if (distance <= this.crate.size / 2 + playerSize / 2 + 1) {
      this.approachDialogShown = true;
      this.onApproachCrate?.();
    }
  }

  private pushWithPlayer(
    playerPosition: Point,
    playerSize: number,
    playerMovement: Point,
  ): void {
    if (!this.crate) return;

    if (playerMovement.x !== 0 && this.playerOverlapsCrate(playerPosition, playerSize)) {
      if (!this.moveAxis("x", playerMovement.x)) playerPosition.x -= playerMovement.x;
    }
    if (playerMovement.y !== 0 && this.playerOverlapsCrate(playerPosition, playerSize)) {
      if (!this.moveAxis("y", playerMovement.y)) playerPosition.y -= playerMovement.y;
    }
  }

  private playerOverlapsCrate(playerPosition: Point, playerSize: number): boolean {
    if (!this.crate) return false;
    const combinedHalfSize = this.crate.size / 2 + playerSize / 2;
    return (
      Math.abs(playerPosition.x - this.crate.position.x) < combinedHalfSize &&
      Math.abs(playerPosition.y - this.crate.position.y) < combinedHalfSize
    );
  }

  private moveAxis(axis: "x" | "y", amount: number): boolean {
    if (!this.crate || amount === 0) return true;
    const next = { ...this.crate.position };
    next[axis] += amount;
    if (this.isBlocked(next, this.crate.size)) return false;
    this.crate.position[axis] = next[axis];
    return true;
  }

  private resetCrate(): void {
    if (!this.crate) return;
    this.crate.position = { ...this.crate.startPosition };
    this.crate.size = this.crate.initialSize;
  }

  private updateResetPlate(playerPosition: Point, playerSize: number): void {
    const plate = this.room.crateResetPlate;
    if (!plate) {
      this.resetPlatePressed = false;
      return;
    }

    const position = tileToWorld(this.room, plate.position.x, plate.position.y);
    const pressed =
      Math.abs(playerPosition.x - position.x) <= playerSize / 2 + 0.42 &&
      Math.abs(playerPosition.y - position.y) <= playerSize / 2 + 0.42;
    if (pressed && !this.resetPlatePressed) this.resetCrate();
    this.resetPlatePressed = pressed;
  }

  private updatePlateDoors(playerPosition: Point, playerSize: number): void {
    this.pressedPlateIds.clear();
    for (const plate of this.room.cratePressurePlates ?? []) {
      if (this.isPlatePressed(plate, playerPosition, playerSize)) {
        this.pressedPlateIds.add(plate.id);
      }
      const locked = !this.pressedPlateIds.has(plate.id);
      for (const door of this.room.doors) {
        if (door.id === plate.doorId) door.locked = locked;
      }
    }
  }

  private isPlatePressed(
    plate: CratePressurePlateConfig,
    playerPosition: Point,
    playerSize: number,
  ): boolean {
    const platePosition = tileToWorld(this.room, plate.position.x, plate.position.y);
    const plateHalfSize = 0.42;
    const cratePressed = this.crate
      ? Math.abs(this.crate.position.x - platePosition.x) <= this.crate.size / 2 + plateHalfSize &&
        Math.abs(this.crate.position.y - platePosition.y) <= this.crate.size / 2 + plateHalfSize
      : false;
    const playerPressed =
      Math.abs(playerPosition.x - platePosition.x) <= playerSize / 2 + plateHalfSize &&
      Math.abs(playerPosition.y - platePosition.y) <= playerSize / 2 + plateHalfSize;
    return cratePressed || playerPressed;
  }

  private drawPlates(): void {
    for (const plate of this.room.cratePressurePlates ?? []) {
      const position = tileToWorld(this.room, plate.position.x, plate.position.y);
      this.drawPlate(position, this.pressedPlateIds.has(plate.id));
    }
  }

  private drawResetPlate(): void {
    const plate = this.room.crateResetPlate;
    if (!plate) return;
    const position = tileToWorld(this.room, plate.position.x, plate.position.y);
    this.drawPlate(position, this.resetPlatePressed);
  }

  private drawPlate(position: Point, pressed: boolean): void {
    drawRect(
      vec2(position.x, position.y),
      vec2(0.85),
      parseColor(pressed ? "#59430c" : "#8a6a13"),
    );
    drawRect(
      vec2(position.x, position.y),
      vec2(0.58),
      parseColor(pressed ? "#765b10" : "#b18a1d"),
    );
  }

  private drawCrate(): void {
    if (!this.crate) return;
    drawRect(
      vec2(this.crate.position.x, this.crate.position.y),
      vec2(this.crate.size),
      parseColor("#5f3218"),
    );
    drawRect(
      vec2(this.crate.position.x, this.crate.position.y),
      vec2(Math.max(0.2, this.crate.size - 0.18)),
      parseColor("#a96332"),
    );
    drawRect(
      vec2(this.crate.position.x, this.crate.position.y),
      vec2(Math.max(0.08, this.crate.size * 0.12), Math.max(0.2, this.crate.size - 0.3)),
      parseColor("#70401f"),
    );
  }
}
