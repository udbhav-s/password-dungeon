import { ProgramManagerBase } from "../program-manager-base";

export class Room8ProgramManager extends ProgramManagerBase {
  constructor() {
    super({
      scriptPath: "/programs/room8.js",
      factoryName: "createRoom8Module",
    });
  }
}
