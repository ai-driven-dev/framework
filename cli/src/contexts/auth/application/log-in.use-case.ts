import { InputRequiredError } from "../../../shared/domain/shared.error.js";
import type { AuthLevel, Credential } from "../contract/credential.js";
import { providerNamed } from "../domain/credential-record.js";
import type { CliAuthProvider } from "../ports/cli-auth-provider.js";
import type { CredentialRecordRepository } from "../ports/credential-record-repository.js";
import type { IdentityVerifier } from "../ports/identity-verifier.js";

export interface LogInRequest {
  credential: Credential;
  level: AuthLevel;
}

export interface LogInResult {
  login: string;
  level: AuthLevel;
}

/** Keeps a credential at a level once it has been proven to name someone: a credential that
 * fails its check is never saved. */
export class LogIn {
  constructor(
    private readonly records: CredentialRecordRepository,
    private readonly identity: IdentityVerifier,
    private readonly cliProviders: ReadonlyMap<string, CliAuthProvider>
  ) {}

  async execute(command: LogInRequest): Promise<LogInResult> {
    const login = await this.loginOf(command.credential);
    await this.records.save(command.credential, command.level);
    return { login, level: command.level };
  }

  private async loginOf(credential: Credential): Promise<string> {
    if (credential.method === "external") {
      return await providerNamed(this.cliProviders, credential.provider).verify();
    }
    if (!credential.token) throw new InputRequiredError("Token cannot be empty.");
    return await this.identity.verifyToken(credential.token);
  }
}
