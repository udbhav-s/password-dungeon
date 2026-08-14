import { ProgramManagerBase } from "../program-manager-base";

export class Room5ProgramManager extends ProgramManagerBase {
  constructor() {
    super({
      scriptPath: "/programs/room5.js",
      factoryName: "createRoom5Module",
    });
  }
}
