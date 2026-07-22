import type { Platform } from "../../../src/domain/ports/platform.js";

/**
 * Static Platform implementation returning a fixed OS string.
 */
export class FakePlatform implements Platform {
  constructor(private readonly platformName: string = "linux") {}

  current(): string {
    return this.platformName;
  }
}

export const linuxPlatform: Platform = new FakePlatform("linux");
export const win32Platform: Platform = new FakePlatform("win32");
export const darwinPlatform: Platform = new FakePlatform("darwin");
