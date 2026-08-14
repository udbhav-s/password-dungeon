import type { Point } from "../types";

export const COMPUTER_APPROACH_DIALOG = [
  "structs are a feature in C that allow us to work with collections of fields related to one thing.",
  "They are somewhat like classes in Java",
  "C is designed so that variables in structs are stored right next to each other in memory, in the order they are declared in",
  "Also, strings in C are usually null-terminated",
  "This means the ending of a string is decided by a null byte (00) in memory",
] as const;

export class Room6Interaction {
  private approachDialogShown = false;

  constructor(private readonly onApproachComputer: () => void) {}

  reset(): void {
    this.approachDialogShown = false;
  }

  update(playerPosition: Point, computerPosition: Point | undefined): void {
    if (this.approachDialogShown || !computerPosition) return;
    const distance = Math.hypot(
      playerPosition.x - computerPosition.x,
      playerPosition.y - computerPosition.y,
    );
    if (distance > 2.25) return;

    this.approachDialogShown = true;
    this.onApproachComputer();
  }
}
