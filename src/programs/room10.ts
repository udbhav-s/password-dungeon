import { ProgramManagerBase } from "../program-manager-base";

export class Room10ProgramManager extends ProgramManagerBase {
  constructor() {
    super({
      scriptPath: "/programs/room10.js",
      factoryName: "createRoom10Module",
    });
  }
}
