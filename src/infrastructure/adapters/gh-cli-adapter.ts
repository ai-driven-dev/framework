import { spawnSync } from "node:child_process";
import type { ExternalTokenProvider } from "../../domain/ports/external-token-provider.js";

export class GhCliAdapter implements ExternalTokenProvider {
  resolve(): string | null {
    const result = spawnSync("gh", ["auth", "token"], {
      timeout: 3000,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });

    if (result.error) {
      // gh not found in PATH
      return null;
    }

    if (result.status !== 0) {
      const detail = result.stderr?.trim();
      throw new Error(
        detail
          ? `gh auth token failed: ${detail}`
          : `gh auth token exited with code ${result.status ?? "unknown"}`
      );
    }

    return result.stdout.trim() || null;
  }
}
