import { openDialog } from "../dialog";
import type { DialogMessageSequence } from "../types";

export const LOCKED_DOOR_DIALOG: DialogMessageSequence = ["this one is also locked..."];

export function onEnter(): void {
  openDialog(["this is the second room", "look around i guess"]);
}
