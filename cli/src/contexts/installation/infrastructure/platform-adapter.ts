import type { Platform } from "../ports/platform.js";

export class PlatformAdapter implements Platform {
  current(): string {
    return process.platform;
  }
}
