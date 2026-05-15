import type { AuthLevel, AuthMethod } from "../../domain/models/auth.js";
import type { Logger } from "../../domain/ports/logger.js";
import type { TokenResolver } from "../../domain/ports/oauth-provider.js";
import type { TokenProvider } from "../../domain/ports/token-provider.js";
import type { AuthStorage } from "./auth-storage.js";

export interface AuthContext {
  token: string;
  method: AuthMethod;
  level: AuthLevel;
}

const noopExternalProvider: TokenResolver = { resolve: () => null };

export class AuthReader implements TokenProvider {
  private cached?: Promise<string | null>;

  constructor(
    private readonly storage: AuthStorage,
    private readonly projectRoot: string,
    private readonly logger?: Logger,
    private readonly externalProvider: TokenResolver = noopExternalProvider
  ) {}

  resolve(): Promise<string | null> {
    this.cached ??= this.resolveUncached();
    return this.cached;
  }

  private async resolveUncached(): Promise<string | null> {
    const envToken = process.env.AIDD_TOKEN;
    if (envToken) {
      this.logger?.debug("Token resolved from AIDD_TOKEN env");
      return envToken;
    }

    const projectConfig = await this.storage.read(this.storage.projectConfigPath(this.projectRoot));
    if (projectConfig !== null) {
      if (projectConfig.method === "stored" && projectConfig.token) {
        this.logger?.debug("Token resolved from project auth.json (stored)");
        return projectConfig.token;
      }
      if (projectConfig.method === "external") {
        const token = this.externalProvider.resolve();
        if (token) {
          this.logger?.debug("Token resolved from project auth.json (external)");
          return token;
        }
      }
    }

    const userConfig = await this.storage.read(this.storage.userConfigPath());
    if (userConfig !== null) {
      if (userConfig.method === "stored" && userConfig.token) {
        this.logger?.debug("Token resolved from user auth.json (stored)");
        return userConfig.token;
      }
      if (userConfig.method === "external") {
        const token = this.externalProvider.resolve();
        if (token) {
          this.logger?.debug("Token resolved from user auth.json (external)");
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
      method: config?.method ?? "stored",
      level: config?.level ?? "user",
    };
  }
}
