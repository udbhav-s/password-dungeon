import { ProgramManagerBase } from "../program-manager-base";

export class Room4ProgramManager extends ProgramManagerBase {
  constructor() {
    super({
      scriptPath: "/programs/room4.js",
      factoryName: "createRoom4Module",
    });
  }
}
