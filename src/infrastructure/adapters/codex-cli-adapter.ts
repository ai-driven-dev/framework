import { spawnSync } from "node:child_process";
import { CodexCliError } from "../../domain/errors.js";
import type { CodexActivator } from "../../domain/ports/codex-activator.js";

const CODEX_BIN = "codex";
const VERSION_TIMEOUT_MS = 5000;
// `codex plugin add` may fetch and cache a marketplace snapshot from a git remote.
const COMMAND_TIMEOUT_MS = 120000;

export class CodexCliAdapter implements CodexActivator {
  isAvailable(): boolean {
    const result = spawnSync(CODEX_BIN, ["--version"], {
      timeout: VERSION_TIMEOUT_MS,
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf-8",
    });
    return !result.error && result.status === 0;
  }

  addMarketplace(source: string): void {
    this.run(["plugin", "marketplace", "add", source], `marketplace add ${source}`);
  }

  upgradeMarketplaces(): void {
    this.run(["plugin", "marketplace", "upgrade"], "marketplace upgrade");
  }

  enablePlugin(pluginRef: string): void {
    this.run(["plugin", "add", pluginRef], `plugin add ${pluginRef}`);
  }

  private run(args: readonly string[], label: string): void {
    const result = spawnSync(CODEX_BIN, [...args], {
      timeout: COMMAND_TIMEOUT_MS,
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf-8",
    });
    if (result.error) {
      throw new CodexCliError(`codex ${label} failed: ${result.error.message}`);
    }
    if (result.status !== 0) {
      const detail = result.stderr?.trim() ?? "";
      throw new CodexCliError(
        `codex ${label} failed: ${detail || `exited with code ${result.status ?? "unknown"}`}`
      );
    }
  }
}
