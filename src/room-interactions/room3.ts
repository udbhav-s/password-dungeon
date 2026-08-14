import { Color, drawCircle, drawRect, timeDelta, vec2 } from "littlejsengine";
import type { Point, Room } from "../types";

const BALL_SIZE_TO_WORLD = 0.1;
const HOLE_MAX_BALL_SIZE = 10;

interface GolfBallState {
  position: Point;
  startPosition: Point;
  velocity: Point;
  size: number;
  initialSize: number;
  friction: number;
  acceleration: number;
  wallBounciness: number;
  inHole: boolean;
}

type CollisionChecker = (position: Point, size: number) => boolean;

function parseColor(hex: string): Color {
  const value = hex.replace("#", "");
  const red = Number.parseInt(value.slice(0, 2), 16) / 255;
  const green = Number.parseInt(value.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(value.slice(4, 6), 16) / 255;
  return new Color(red, green, blue);
}

function tileToWorld(room: Room, x: number, y: number): Point {
  return {
    x: x - room.width / 2,
    y: room.height / 2 - y,
  };
}

export class Room3Interaction {
  private golfBall: GolfBallState | undefined;
  private pressurePlatePressed = false;

  constructor(
    private readonly room: Room,
    private readonly isBlocked: CollisionChecker,
    private readonly onBallInHole?: () => void,
  ) {
    this.reset();
  }

  reset(): void {
    const config = this.room.golfBall;
    if (!config) {
      this.golfBall = undefined;
      this.pressurePlatePressed = false;
      return;
    }

    const worldPosition = tileToWorld(this.room, config.position.x, config.position.y);
    this.golfBall = {
      position: { ...worldPosition },
      startPosition: { ...worldPosition },
      velocity: { x: 0, y: 0 },
      size: config.size,
      initialSize: config.size,
      friction: config.friction,
      acceleration: config.acceleration,
      wallBounciness: config.wallBounciness,
      inHole: false,
    };
    this.pressurePlatePressed = false;
  }

  syncBallSizeFromProgram(size: number | undefined): void {
    if (!this.golfBall || size === undefined) return;
    this.golfBall.size = size;
  }

  update(playerPosition: Point, playerSize: number, direction: Point): void {
    this.updatePressurePlate(playerPosition, playerSize);
    if (!this.golfBall || this.golfBall.inHole) return;

    const ballSize = this.golfBallWorldSize();
    const playerToBall = {
      x: this.golfBall.position.x - playerPosition.x,
      y: this.golfBall.position.y - playerPosition.y,
    };
    const distance = Math.hypot(playerToBall.x, playerToBall.y);
    const minimumDistance = playerSize / 2 + ballSize / 2;

    if ((direction.x !== 0 || direction.y !== 0) && distance < minimumDistance) {
      const directionLength = Math.hypot(direction.x, direction.y) || 1;
      const pushDirection =
        distance > 0.001
          ? { x: playerToBall.x / distance, y: playerToBall.y / distance }
          : { x: direction.x / directionLength, y: direction.y / directionLength };
      const overlap = minimumDistance - distance + 0.01;
      this.moveAxis("x", pushDirection.x * overlap, ballSize);
      this.moveAxis("y", pushDirection.y * overlap, ballSize);
      this.golfBall.velocity.x += pushDirection.x * this.golfBall.acceleration;
      this.golfBall.velocity.y += pushDirection.y * this.golfBall.acceleration;
    }

    const friction = Math.max(0, 1 - this.golfBall.friction * timeDelta);
    this.golfBall.velocity.x *= friction;
    this.golfBall.velocity.y *= friction;

    if (!this.moveAxis("x", this.golfBall.velocity.x * timeDelta, ballSize)) {
      this.golfBall.velocity.x *= -this.golfBall.wallBounciness;
    }
    if (!this.moveAxis("y", this.golfBall.velocity.y * timeDelta, ballSize)) {
      this.golfBall.velocity.y *= -this.golfBall.wallBounciness;
    }

    this.checkHole(ballSize);
  }

  draw(): void {
    this.drawHole();
    this.drawPressurePlate();
    this.drawBall();
  }

  private golfBallWorldSize(): number {
    return (this.golfBall?.size ?? 0) * BALL_SIZE_TO_WORLD;
  }

  private resetGolfBall(): void {
    if (!this.golfBall) return;
    this.golfBall.position = { ...this.golfBall.startPosition };
    this.golfBall.velocity = { x: 0, y: 0 };
    this.golfBall.size = this.golfBall.initialSize;
    this.golfBall.inHole = false;
  }

  private updatePressurePlate(playerPosition: Point, playerSize: number): void {
    const plate = this.room.pressurePlate;
    if (!plate) {
      this.pressurePlatePressed = false;
      return;
    }

    const plateWorld = tileToWorld(this.room, plate.position.x, plate.position.y);
    const distance = Math.hypot(
      playerPosition.x - plateWorld.x,
      playerPosition.y - plateWorld.y,
    );
    const pressed = distance <= playerSize / 2 + 0.35;
    if (pressed && !this.pressurePlatePressed) this.resetGolfBall();
    this.pressurePlatePressed = pressed;
  }

  private moveAxis(axis: "x" | "y", amount: number, size: number): boolean {
    if (!this.golfBall || amount === 0) return true;

    const start = { ...this.golfBall.position };
    const next = { ...start };
    next[axis] += amount;
    if (!this.isBlocked(next, size)) {
      this.golfBall.position[axis] = next[axis];
      return true;
    }

    // Stop at the nearest valid point instead of leaving the ball embedded in a wall.
    if (this.isBlocked(start, size)) return false;
    let low = 0;
    let high = 1;
    for (let iteration = 0; iteration < 12; iteration += 1) {
      const middle = (low + high) / 2;
      const candidate = { ...start };
      candidate[axis] += amount * middle;
      if (this.isBlocked(candidate, size)) high = middle;
      else low = middle;
    }

    const resolved = { ...start };
    resolved[axis] += amount * low;
    this.golfBall.position[axis] = resolved[axis];
    return false;
  }

  private checkHole(ballSize: number): void {
    const hole = this.room.golfHole;
    if (!this.golfBall || !hole || this.golfBall.size >= HOLE_MAX_BALL_SIZE) return;

    const holeWorld = tileToWorld(this.room, hole.position.x, hole.position.y);
    const holeDistance = Math.hypot(
      this.golfBall.position.x - holeWorld.x,
      this.golfBall.position.y - holeWorld.y,
    );
    if (holeDistance <= hole.size / 2 + ballSize / 2) {
      this.golfBall.position = { ...holeWorld };
      this.golfBall.velocity = { x: 0, y: 0 };
      this.golfBall.inHole = true;
      this.onBallInHole?.();
    }
  }

  private drawHole(): void {
    const hole = this.room.golfHole;
    if (!hole) return;

    const position = tileToWorld(this.room, hole.position.x, hole.position.y);
    drawCircle(vec2(position.x, position.y), hole.size, parseColor("#151515"));
    drawRect(vec2(position.x + 0.45, position.y + 0.75), vec2(0.08, 1.5), parseColor("#f5f5f5"));
    drawRect(vec2(position.x + 0.2, position.y + 1.3), vec2(0.55, 0.3), parseColor("#e74c3c"));
  }

  private drawPressurePlate(): void {
    const plate = this.room.pressurePlate;
    if (!plate) return;

    const position = tileToWorld(this.room, plate.position.x, plate.position.y);
    drawRect(
      vec2(position.x, position.y),
      vec2(0.85),
      parseColor(this.pressurePlatePressed ? "#6b4a00" : "#a87500"),
    );
  }

  private drawBall(): void {
    if (!this.golfBall || this.golfBall.inHole) return;

    drawCircle(
      vec2(this.golfBall.position.x, this.golfBall.position.y),
      this.golfBallWorldSize(),
      parseColor("#f5f5f5"),
      0.06,
      parseColor("#bdbdbd"),
      false,
    );
  }
}
