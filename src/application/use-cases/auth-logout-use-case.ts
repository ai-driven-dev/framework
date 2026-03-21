import type { AuthStorage } from "../../infrastructure/auth/auth-storage.js";

interface AuthLogoutResult {
  found: false;
}

interface AuthLogoutResultFound {
  found: true;
  method: "gh" | "token";
  level: "user" | "project";
  ghHint?: string;
}

type AuthLogoutOutcome = AuthLogoutResult | AuthLogoutResultFound;

interface AuthLogoutOptions {
  projectRoot: string;
}

export class AuthLogoutUseCase {
  constructor(private readonly storage: AuthStorage) {}

  async execute(options: AuthLogoutOptions): Promise<AuthLogoutOutcome> {
    const projectPath = this.storage.projectConfigPath(options.projectRoot);
    const userPath = this.storage.userConfigPath();

    const projectConfig = await this.storage.read(projectPath);
    if (projectConfig !== null) {
      await this.storage.delete(projectPath);
      return {
        found: true,
        method: projectConfig.method,
        level: "project",
        ghHint: ghHint(projectConfig.method),
      };
    }

    const userConfig = await this.storage.read(userPath);
    if (userConfig !== null) {
      await this.storage.delete(userPath);
      return {
        found: true,
        method: userConfig.method,
        level: "user",
        ghHint: ghHint(userConfig.method),
      };
    }

    return { found: false };
  }
}

function ghHint(method: "gh" | "token"): string | undefined {
  return method === "gh" ? "To fully logout from GitHub, run gh auth logout" : undefined;
}
