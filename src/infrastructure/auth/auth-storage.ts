import { execSync } from "node:child_process";
import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { AuthConfig } from "../../domain/models/auth-config.js";

export class AuthStorage {
  userConfigPath(): string {
    return join(homedir(), ".config", "aidd", "auth.json");
  }

  projectConfigPath(projectRoot: string): string {
    return join(projectRoot, ".aidd", "auth.json");
  }

  async read(path: string): Promise<AuthConfig | null> {
    try {
      const content = await readFile(path, "utf-8");
      const parsed = JSON.parse(content) as unknown;
      if (!isAuthConfig(parsed)) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  async write(path: string, config: AuthConfig): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(config, null, 2), "utf-8");
    if (process.platform === "win32") {
      try {
        execSync(`icacls "${path}" /inheritance:r /grant:r "%USERNAME%:(R,W)"`, {
          stdio: ["ignore", "ignore", "pipe"],
        });
      } catch (err) {
        throw new Error(
          `Failed to set restrictive permissions on ${path}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    } else {
      await chmod(path, 0o600);
    }
  }

  async delete(path: string): Promise<void> {
    await rm(path, { force: true });
  }
}

function isAuthConfig(value: unknown): value is AuthConfig {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    obj.version === 1 &&
    (obj.method === "gh" || obj.method === "token") &&
    (obj.level === "user" || obj.level === "project") &&
    typeof obj.createdAt === "string"
  );
}
