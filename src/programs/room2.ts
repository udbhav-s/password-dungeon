import { ProgramManagerBase } from "../program-manager-base";

export class Room2ProgramManager extends ProgramManagerBase {
  constructor() {
    super({
      scriptPath: "/programs/room2.js",
      factoryName: "createRoom2Module",
    });
  }
}
