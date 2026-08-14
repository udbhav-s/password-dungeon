import { ProgramManagerBase } from "../program-manager-base";

export class Room7ProgramManager extends ProgramManagerBase {
  constructor() {
    super({
      scriptPath: "/programs/room7.js",
      factoryName: "createRoom7Module",
    });
  }
}
