import { ProgramManagerBase } from "../program-manager-base";

export class Room3ProgramManager extends ProgramManagerBase {
  constructor() {
    super({
      scriptPath: "/programs/room3.js",
      factoryName: "createRoom3Module",
    });
  }

  getBallSize(): number | undefined {
    return this.callNumber("get_ball_size");
  }
}
