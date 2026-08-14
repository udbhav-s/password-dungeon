import { ProgramManagerBase } from "../program-manager-base";

export class Buffer1ProgramManager extends ProgramManagerBase {
  constructor() {
    super({
      scriptPath: "/programs/buffer1.js",
      factoryName: "createBuffer1Module",
    });
  }
}
