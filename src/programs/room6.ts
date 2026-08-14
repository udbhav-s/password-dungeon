import { ProgramManagerBase } from "../program-manager-base";

export class Room6ProgramManager extends ProgramManagerBase {
  constructor() {
    super({
      scriptPath: "/programs/room6.js",
      factoryName: "createRoom6Module",
    });
  }
}
