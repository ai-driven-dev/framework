import { AuthenticationError } from "../../domain/errors.js";
import type { AuthConfig, AuthCredential, AuthLevel } from "../../domain/models/auth.js";
import type {
  AuthLoginResult,
  AuthLogoutHint,
  AuthLogoutResult,
  AuthProvider,
  AuthStatus,
} from "../../domain/ports/auth-provider.js";
import type { ExternalAuthProvider } from "../../domain/ports/external-auth-provider.js";
import type { LoginVerifier } from "../../domain/ports/login-verifier.js";
import type { AuthStorage } from "../auth/auth-storage.js";

export class AuthProviderAdapter implements AuthProvider {
  constructor(
    private readonly storage: AuthStorage,
    private readonly externalProviders: Map<string, ExternalAuthProvider>,
    private readonly tokenVerifier: LoginVerifier,
    private readonly projectRoot: string
  ) {}

  async login(credential: AuthCredential, level: AuthLevel): Promise<AuthLoginResult> {
    const login =
      credential.method === "external"
        ? await this.resolveExternalProvider(credential.provider).verify()
        : await this.tokenVerifier.verify(credential.token);
    await this.storage.save({ credential, level, projectRoot: this.projectRoot });
    return { login, level };
  }

  async status(): Promise<AuthStatus> {
    const config = await this.readActiveConfig();
    const login = await this.verifyConfig(config);
    return { login, level: config.level };
  }

  async logout(): Promise<AuthLogoutResult> {
    const projectPath = this.storage.projectConfigPath(this.projectRoot);
    const projectConfig = await this.storage.read(projectPath);
    if (projectConfig !== null) {
      await this.storage.delete(projectPath);
      return {
        found: true,
        level: projectConfig.level,
        hint: this.logoutHint(projectConfig.method),
      };
    }
    const userPath = this.storage.userConfigPath();
    const userConfig = await this.storage.read(userPath);
    if (userConfig !== null) {
      await this.storage.delete(userPath);
      return { found: true, level: userConfig.level, hint: this.logoutHint(userConfig.method) };
    }
    return { found: false };
  }

  private async readActiveConfig(): Promise<AuthConfig> {
    const config = await this.storage.readActive(this.projectRoot);
    if (config === null) throw new AuthenticationError("not authenticated");
    return config;
  }

  private async verifyConfig(config: AuthConfig): Promise<string> {
    if (config.method === "external") {
      return await this.resolveExternalProvider(config.provider ?? "gh").verify();
    }
    if (!config.token) throw new AuthenticationError("invalid config");
    return await this.tokenVerifier.verify(config.token);
  }

  private resolveExternalProvider(provider: string): ExternalAuthProvider {
    const adapter = this.externalProviders.get(provider);
    if (!adapter) throw new AuthenticationError(`unknown external provider: ${provider}`);
    return adapter;
  }

  private logoutHint(method: AuthConfig["method"]): AuthLogoutHint | undefined {
    return method === "external" ? "external-provider-cleanup" : undefined;
  }
}
