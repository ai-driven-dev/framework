import type { IdentityVerifier } from "../../../../src/contexts/auth/ports/identity-verifier.js";
import { AuthenticationError } from "../../../../src/kernel/errors.js";

/** Answers the login of each token it knows and refuses any other the way GitHub does; it
 * keeps the tokens it was asked about, so a test can check which one, and never prints one. */
export class FakeIdentityVerifier implements IdentityVerifier {
  readonly seen: string[] = [];

  constructor(private readonly logins: Readonly<Record<string, string>> = {}) {}

  async verifyToken(token: string): Promise<string> {
    this.seen.push(token);
    const login = this.logins[token];
    if (login === undefined) throw new AuthenticationError("GitHub API");
    return login;
  }
}
