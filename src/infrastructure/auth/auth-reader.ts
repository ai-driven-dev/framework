import type { AuthContext, AuthTokenProvider } from "../../domain/ports/auth-token-provider.js";
import type { ExternalTokenProvider } from "../../domain/ports/external-token-provider.js";
import type { Logger } from "../../domain/ports/logger.js";
import type { AuthStorage } from "./auth-storage.js";

const noopExternalProvider: ExternalTokenProvider = { resolve: () => null };

export class AuthReader implements AuthTokenProvider {
  constructor(
    private readonly storage: AuthStorage,
    private readonly projectRoot: string,
    private readonly logger?: Logger,
    private readonly externalProvider: ExternalTokenProvider = noopExternalProvider
  ) {}

  async resolve(): Promise<string | null> {
    const envToken = process.env.AIDD_TOKEN;
    if (envToken) {
      this.logger?.debug("Token resolved from AIDD_TOKEN env");
      return envToken;
    }

    const projectConfig = await this.storage.read(this.storage.projectConfigPath(this.projectRoot));
    if (projectConfig !== null) {
      if (projectConfig.method === "token" && projectConfig.token) {
        this.logger?.debug("Token resolved from project auth.json (token)");
        return projectConfig.token;
      }
      if (projectConfig.method === "gh") {
        const token = this.externalProvider.resolve();
        if (token) {
          this.logger?.debug("Token resolved from project auth.json (gh)");
          return token;
        }
      }
    }

    const userConfig = await this.storage.read(this.storage.userConfigPath());
    if (userConfig !== null) {
      if (userConfig.method === "token" && userConfig.token) {
        this.logger?.debug("Token resolved from user auth.json (token)");
        return userConfig.token;
      }
      if (userConfig.method === "gh") {
        const token = this.externalProvider.resolve();
        if (token) {
          this.logger?.debug("Token resolved from user auth.json (gh)");
          return token;
        }
      }
    }

    this.logger?.debug("No token available");
    return null;
  }

  async resolveContext(projectRoot: string): Promise<AuthContext | null> {
    const token = await this.resolve();
    if (token === null) return null;

    const projectConfig = await this.storage.read(this.storage.projectConfigPath(projectRoot));
    const userConfig = await this.storage.read(this.storage.userConfigPath());
    const config = projectConfig ?? userConfig;

    return {
      token,
      method: config?.method ?? "token",
      level: config?.level ?? "user",
    };
  }
}
