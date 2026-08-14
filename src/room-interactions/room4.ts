import type { Point, Room } from "../types";
import { Room3Interaction } from "./room3";

type CollisionChecker = (position: Point, size: number) => boolean;

export class Room4Interaction {
  private readonly ballInteraction: Room3Interaction;

  constructor(private readonly room: Room, isBlocked: CollisionChecker) {
    this.ballInteraction = new Room3Interaction(room, isBlocked, () => this.unlockExitDoor());
  }

  reset(): void {
    this.ballInteraction.reset();
  }

  update(playerPosition: Point, playerSize: number, direction: Point): void {
    this.ballInteraction.update(playerPosition, playerSize, direction);
  }

  draw(): void {
    this.ballInteraction.draw();
  }

  syncBallSizeFromProgram(size: number | undefined): void {
    this.ballInteraction.syncBallSizeFromProgram(size);
  }

  unlockMiddleDoor(): void {
    this.unlockDoors("middle-door", "middle door");
  }

  private unlockExitDoor(): void {
    this.unlockDoors("exit-door", "exit door");
  }

  private unlockDoors(id: string, label: string): void {
    let changed = false;
    for (const door of this.room.doors) {
      if (door.id !== id || door.locked !== true) continue;
      door.locked = false;
      changed = true;
    }
    if (changed) console.log(`Unlocked the ${label} in ${this.room.name}.`);
  }
}
