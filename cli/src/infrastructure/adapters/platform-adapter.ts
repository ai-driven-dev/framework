import type { Platform } from "../../domain/ports/platform.js";

export class PlatformAdapter implements Platform {
  current(): string {
    return process.platform;
  }
}
