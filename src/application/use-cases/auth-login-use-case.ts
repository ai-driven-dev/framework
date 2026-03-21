import { appendFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AuthConfig } from "../../domain/models/auth-config.js";
import type { ExternalTokenProvider } from "../../domain/ports/external-token-provider.js";
import type { AuthStorage } from "../../infrastructure/auth/auth-storage.js";

interface Prompter {
  select<T>(message: string, choices: Array<{ name: string; value: T }>): Promise<T>;
  confirm(message: string): Promise<boolean>;
  input(message: string): Promise<string>;
}

interface AuthLoginOptions {
  method?: "gh" | "token";
  token?: string;
  level?: "user" | "project";
  projectRoot: string;
  interactive: boolean;
  prompter?: Prompter;
}

interface AuthLoginResult {
  method: "gh" | "token";
  level: "user" | "project";
  login: string;
}

export class AuthLoginUseCase {
  constructor(
    private readonly storage: AuthStorage,
    private readonly httpGet: (url: string, token: string) => Promise<{ login: string }>,
    private readonly externalProvider: ExternalTokenProvider
  ) {}

  async execute(options: AuthLoginOptions): Promise<AuthLoginResult> {
    let method = options.method;
    let level = options.level;

    if (options.interactive && options.prompter) {
      if (!method) {
        method = await options.prompter.select<"gh" | "token">("Authentication method:", [
          { name: "GitHub CLI (gh auth token)", value: "gh" },
          { name: "Personal Access Token", value: "token" },
        ]);
      }
      if (!level) {
        level = await options.prompter.select<"user" | "project">("Storage level:", [
          { name: "User (~/.config/aidd/auth.json)", value: "user" },
          { name: "Project (.aidd/auth.json)", value: "project" },
        ]);
      }
    }

    if (!method) throw new Error("Authentication method is required. Use --gh or --token.");
    if (!level) throw new Error("Storage level is required. Use --level user or --level project.");

    let resolvedToken: string;

    if (method === "gh") {
      const ghToken = this.externalProvider.resolve();
      if (!ghToken) {
        throw new Error("gh CLI is not installed or not authenticated. Run `gh auth login` first.");
      }
      resolvedToken = ghToken;
    } else {
      let token = options.token;
      if (!token && options.interactive && options.prompter) {
        token = await options.prompter.input("Paste your GitHub Personal Access Token:");
        if (!token) throw new Error("Token cannot be empty.");
      }
      if (!token) {
        throw new Error("--token <value> is required when using token method.");
      }
      resolvedToken = token;
    }

    const login = await this.httpGet("https://api.github.com/user", resolvedToken).then(
      (r) => r.login
    );

    const config: AuthConfig = {
      version: 1,
      method,
      level,
      createdAt: new Date().toISOString(),
      ...(method === "token" ? { token: resolvedToken } : {}),
    };

    const path =
      level === "project"
        ? this.storage.projectConfigPath(options.projectRoot)
        : this.storage.userConfigPath();

    await this.storage.write(path, config);

    if (level === "project" && options.interactive && options.prompter) {
      await this.maybeAddToGitignore(options.projectRoot, options.prompter);
    }

    return { method, level, login };
  }

  private async maybeAddToGitignore(projectRoot: string, prompter: Prompter): Promise<void> {
    const gitignorePath = join(projectRoot, ".gitignore");
    const entry = ".aidd/auth.json";

    let content = "";
    try {
      content = await readFile(gitignorePath, "utf-8");
    } catch {
      // no .gitignore
    }

    if (content.split("\n").some((line) => line.trim() === entry)) return;

    const confirmed = await prompter.confirm(`Add "${entry}" to .gitignore?`);
    if (confirmed) {
      const suffix = content.endsWith("\n") || content === "" ? "" : "\n";
      await appendFile(gitignorePath, `${suffix}${entry}\n`);
    }
  }
}
