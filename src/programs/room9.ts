import { ProgramManagerBase } from "../program-manager-base";

export class Room9ProgramManager extends ProgramManagerBase {
  constructor() {
    super({
      scriptPath: "/programs/room9.js",
      factoryName: "createRoom9Module",
    });
  }
}
