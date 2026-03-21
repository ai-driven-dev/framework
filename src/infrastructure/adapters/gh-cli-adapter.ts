import { execSync } from "node:child_process";
import type { ExternalTokenProvider } from "../../domain/ports/external-token-provider.js";

export class GhCliAdapter implements ExternalTokenProvider {
  resolve(): string | null {
    try {
      const output = execSync("gh auth token", {
        timeout: 3000,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      const token = output.trim();
      return token || null;
    } catch {
      return null;
    }
  }
}
