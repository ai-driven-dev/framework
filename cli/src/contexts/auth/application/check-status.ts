import type { Environment } from "../../../shared/ports/environment.js";
import type { AuthLevel } from "../contract/credential.js";
import { providerNamed, providerOf, storedTokenOf } from "../domain/credential-record.js";
import {
  type ActiveCredential,
  activeCredential,
  sourcesInOrder,
} from "../domain/credential-sources.js";
import type { CliAuthProvider } from "../ports/cli-auth-provider.js";
import type { CredentialRecordRepository } from "../ports/credential-record-repository.js";
import type { IdentityVerifier } from "../ports/identity-verifier.js";

export type CheckStatusResult =
  | { authenticated: true; login: string; level: AuthLevel }
  | { authenticated: false };

/** Verifies the credential this project would use, the one a token on the command line does
 * not replace. The order of the sources is `domain/credential-sources.ts`. */
export class CheckStatus {
  constructor(
    private readonly records: CredentialRecordRepository,
    private readonly environment: Environment,
    private readonly identity: IdentityVerifier,
    private readonly cliProviders: ReadonlyMap<string, CliAuthProvider>
  ) {}

  async execute(): Promise<CheckStatusResult> {
    const active = await activeCredential(
      sourcesInOrder({ environment: this.environment }, (level) => this.records.read(level))
    );
    if (active === null) return { authenticated: false };
    const login = await this.loginOf(active);
    return { authenticated: true, login, level: active.level };
  }

  private async loginOf(active: ActiveCredential): Promise<string> {
    if (active.method === "external") {
      return await providerNamed(this.cliProviders, providerOf(active)).verify();
    }
    return await this.identity.verifyToken(storedTokenOf(active));
  }
}
