import { execSync } from "node:child_process";
import { platform } from "node:os";
import {
  ElevatedPermissionUpdateError,
  FrameworkResolutionError,
  PackageManagerDetectionError,
  UpdateError,
} from "../../domain/errors.js";
import type { CliRelease, SelfUpdater } from "../../domain/ports/self-updater.js";
import type { TokenProvider } from "../../domain/ports/token-provider.js";
import type { HttpClient } from "./http-client.js";

const CLI_REPO = "ai-driven-dev/aidd-cli";
const CLI_PACKAGE = "@ai-driven-dev/cli";
const DEFAULT_GITHUB_API_BASE = "https://api.github.com";

type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

const PM_INSTALL_COMMANDS: Record<PackageManager, string> = {
  npm: `npm install -g ${CLI_PACKAGE}@latest`,
  pnpm: `pnpm add -g ${CLI_PACKAGE}@latest`,
  yarn: `yarn global add ${CLI_PACKAGE}@latest`,
  bun: `bun add -g ${CLI_PACKAGE}@latest`,
};

function detectPackageManager(): { pm: PackageManager; binaryPath: string } {
  const whichCommand = platform() === "win32" ? "where aidd" : "which aidd";
  let binaryPath: string;
  try {
    const raw = execSync(whichCommand, { encoding: "utf8" });
    // `where` on Windows may return multiple matches (one per line) — keep only the first
    binaryPath = raw.trim().split(/\r?\n/)[0].trim();
  } catch {
    throw new PackageManagerDetectionError(Object.values(PM_INSTALL_COMMANDS));
  }
  // Normalise Windows backslashes so path checks work cross-platform
  const normalised = binaryPath.replace(/\\/g, "/");
  if (normalised.includes("/pnpm/")) return { pm: "pnpm", binaryPath };
  // yarn: ~/.yarn/bin (Unix) or AppData/Local/Yarn/bin (Windows)
  if (normalised.includes("/.yarn/") || normalised.toLowerCase().includes("/yarn/bin/"))
    return { pm: "yarn", binaryPath };
  // bun: ~/.bun/bin (Unix) or AppData\Local\bun (Windows)
  if (normalised.includes("/.bun/") || normalised.toLowerCase().includes("/bun/bin/"))
    return { pm: "bun", binaryPath };
  // npm installs to system paths (e.g. /usr/local/bin, ~/.npm-global/bin) with no pm marker
  return { pm: "npm", binaryPath };
}

interface CliReleaseResponse {
  tag_name: string;
  body: string;
}

function parseCliRelease(body: unknown, url: string): CliReleaseResponse {
  if (
    body === null ||
    typeof body !== "object" ||
    !("tag_name" in body) ||
    typeof (body as Record<string, unknown>).tag_name !== "string"
  ) {
    throw new FrameworkResolutionError(`Unexpected GitHub API response from ${url}`);
  }
  return body as CliReleaseResponse;
}

interface SelfUpdaterAdapterConfig {
  tokenProvider?: TokenProvider;
  githubApiBase?: string;
}

export class SelfUpdaterAdapter implements SelfUpdater {
  private readonly tokenProvider: TokenProvider | undefined;
  private readonly githubApiBase: string;

  constructor(
    private readonly http: HttpClient,
    config: SelfUpdaterAdapterConfig = {}
  ) {
    this.tokenProvider = config.tokenProvider;
    this.githubApiBase = config.githubApiBase ?? DEFAULT_GITHUB_API_BASE;
  }

  async fetchLatestRelease(): Promise<CliRelease> {
    const url = `${this.githubApiBase}/repos/${CLI_REPO}/releases/latest`;
    const token = (await this.tokenProvider?.resolve()) ?? undefined;
    const response = await this.http.get(url, { token });
    const release = parseCliRelease(response.body, url);
    return {
      version: release.tag_name.replace(/^v/, ""),
      changelog: release.body ?? "",
    };
  }

  install(): string {
    const { pm, binaryPath } = detectPackageManager();
    const command = PM_INSTALL_COMMANDS[pm];
    try {
      // stderr piped (not inherited) so EPERM/EACCES can be classified;
      // captured stderr is echoed back to the user before throwing.
      execSync(command, { stdio: ["inherit", "inherit", "pipe"] });
    } catch (err) {
      const stderr = extractStderr(err);
      if (stderr.length > 0) process.stderr.write(stderr);
      if (isPermissionError(stderr)) throw new ElevatedPermissionUpdateError(command);
      throw new UpdateError();
    }
    return binaryPath;
  }
}

function extractStderr(err: unknown): string {
  if (err === null || typeof err !== "object" || !("stderr" in err)) return "";
  const raw = (err as { stderr: unknown }).stderr;
  if (typeof raw === "string") return raw;
  if (raw instanceof Buffer) return raw.toString("utf8");
  return "";
}

function isPermissionError(stderr: string): boolean {
  return /\bEPERM\b|\bEACCES\b/.test(stderr);
}
