import { appendFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { AuthenticationError } from "../../domain/errors.js";
import type { AuthConfig } from "../../domain/models/auth-config.js";
import type { ExternalTokenProvider } from "../../domain/ports/external-token-provider.js";
import type { LoginVerifier } from "../../domain/ports/login-verifier.js";
import type { AuthStorage } from "../../infrastructure/auth/auth-storage.js";
import { InputRequiredError } from "../errors.js";

interface Prompter {
  select<T>(message: string, choices: Array<{ name: string; value: T }>): Promise<T>;
  confirm(message: string): Promise<boolean>;
  input(message: string): Promise<string>;
}

interface AuthLoginOptions {
  method: "gh" | "token";
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
    private readonly loginVerifier: LoginVerifier,
    private readonly externalProvider: ExternalTokenProvider
  ) {}

  async execute(options: AuthLoginOptions): Promise<AuthLoginResult> {
    const method = options.method;
    let level = options.level;

    if (options.interactive && options.prompter) {
      if (!level) {
        level = await options.prompter.select<"user" | "project">("Storage level:", [
          { name: "User (~/.config/aidd/auth.json)", value: "user" },
          { name: "Project (.aidd/auth.json)", value: "project" },
        ]);
      }
    }

    if (!level)
      throw new InputRequiredError(
        "Storage level is required. Use --level user or --level project."
      );

    const resolvedToken = await this.resolveToken(method, options);
    const login = await this.loginVerifier.getLogin(resolvedToken);

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

  private async resolveToken(method: "gh" | "token", options: AuthLoginOptions): Promise<string> {
    if (method === "gh") {
      const ghToken = this.externalProvider.resolve();
      if (!ghToken) {
        throw new AuthenticationError("gh CLI");
      }
      return ghToken;
    }

    let token = options.token;
    if (!token && options.interactive && options.prompter) {
      token = await options.prompter.input("Paste your GitHub Personal Access Token:");
      if (!token) throw new InputRequiredError("Token cannot be empty.");
    }
    if (!token) {
      throw new InputRequiredError("--token <value> is required when using token method.");
    }
    return token;
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
