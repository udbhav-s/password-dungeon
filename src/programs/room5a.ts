import { ProgramManagerBase } from "../program-manager-base";

export class Room5AProgramManager extends ProgramManagerBase {
  constructor() {
    super({
      scriptPath: "/programs/room5a.js",
      factoryName: "createRoom5AModule",
    });
  }

  getCrateSize(): number | undefined {
    return this.callNumber("get_crate_size");
  }
}
