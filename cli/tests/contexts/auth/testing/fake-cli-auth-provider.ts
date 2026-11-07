import type { CliAuthProvider } from "../../../../src/contexts/auth/ports/cli-auth-provider.js";
import { AuthenticationError } from "../../../../src/kernel/errors.js";

interface Script {
  /** What `read` answers; absent, the provider has no token. */
  token?: string;
  /** What `verify` answers; absent, the provider refuses the way `gh` does. */
  login?: string;
  /** Thrown by `read`, as a provider that fails rather than having nothing. */
  readFailure?: Error;
}

/** A command-line provider answering from a script, counting how often it was asked. */
export class FakeCliAuthProvider implements CliAuthProvider {
  reads = 0;
  verifications = 0;

  constructor(private readonly script: Script = {}) {}

  read(): string | null {
    this.reads++;
    if (this.script.readFailure !== undefined) throw this.script.readFailure;
    return this.script.token ?? null;
  }

  async verify(): Promise<string> {
    this.verifications++;
    if (this.script.login === undefined) throw new AuthenticationError("gh CLI");
    return this.script.login;
  }
}
