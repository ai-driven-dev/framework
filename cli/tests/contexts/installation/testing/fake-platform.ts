import type { Platform } from "../../../../src/contexts/installation/ports/platform.js";

export class FakePlatform implements Platform {
  constructor(private readonly platformName: string = "linux") {}

  current(): string {
    return this.platformName;
  }
}
