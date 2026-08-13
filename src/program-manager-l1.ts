import { ProgramManagerBase } from "./program-manager-base";

export class L1ProgramManager extends ProgramManagerBase {
  constructor() {
    super({
      scriptPath: "/programs/l1.js",
      factoryName: "createL1Module",
    });
  }
}
