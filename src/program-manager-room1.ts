import { ProgramManagerBase } from "./program-manager-base";

export class Room1ProgramManager extends ProgramManagerBase {
  constructor() {
    super({
      scriptPath: "/programs/room1.js",
      factoryName: "createRoom1Module",
    });
  }
}
