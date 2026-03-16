import { execSync } from "node:child_process";
import { platform } from "node:os";
import type { CliRelease, CliUpdater } from "../../domain/ports/cli-updater.js";
import type { HttpClient } from "../http/http-client.js";

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
    binaryPath = execSync(whichCommand, { encoding: "utf8" }).trim();
  } catch {
    throw new Error(
      `Could not detect package manager. Run manually:\n  ${PM_INSTALL_COMMANDS.npm}\n  ${PM_INSTALL_COMMANDS.pnpm}\n  ${PM_INSTALL_COMMANDS.yarn}\n  ${PM_INSTALL_COMMANDS.bun}`
    );
  }
  if (binaryPath.includes("/pnpm/")) return { pm: "pnpm", binaryPath };
  if (binaryPath.includes("/.yarn/")) return { pm: "yarn", binaryPath };
  if (binaryPath.includes("/bun/")) return { pm: "bun", binaryPath };
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
    throw new Error(`Unexpected GitHub API response from ${url}`);
  }
  return body as CliReleaseResponse;
}

interface CliUpdaterAdapterConfig {
  token?: string;
  githubApiBase?: string;
}

export class CliUpdaterAdapter implements CliUpdater {
  private readonly token: string | undefined;
  private readonly githubApiBase: string;

  constructor(
    private readonly http: HttpClient,
    config: CliUpdaterAdapterConfig = {}
  ) {
    this.token = config.token;
    this.githubApiBase = config.githubApiBase ?? DEFAULT_GITHUB_API_BASE;
  }

  async fetchLatestRelease(): Promise<CliRelease> {
    const url = `${this.githubApiBase}/repos/${CLI_REPO}/releases/latest`;
    const response = await this.http.get(url, { token: this.token });
    const release = parseCliRelease(response.body, url);
    return {
      version: release.tag_name.replace(/^v/, ""),
      changelog: release.body ?? "",
    };
  }

  install(): string {
    const { pm, binaryPath } = detectPackageManager();
    execSync(PM_INSTALL_COMMANDS[pm], { stdio: "inherit" });
    return binaryPath;
  }
}
