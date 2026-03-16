import { execSync } from "node:child_process";
import type { CliRelease, CliUpdater } from "../../domain/ports/cli-updater.js";
import type { HttpClient } from "../http/http-client.js";

const CLI_REPO = "ai-driven-dev/aidd-cli";
const CLI_PACKAGE = "@ai-driven-dev/cli";
const DEFAULT_GITHUB_API_BASE = "https://api.github.com";

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

  install(): void {
    execSync(`npm install -g ${CLI_PACKAGE}@latest`, { stdio: "inherit" });
  }
}
