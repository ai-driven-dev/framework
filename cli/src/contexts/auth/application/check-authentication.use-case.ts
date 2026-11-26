import type { AuthenticationIssue } from "../contract/authentication-issue.js";
import type { TokenProvider } from "../contract/token-provider.js";

/** Reports, as a doctor issue, that no token resolves on this machine. */
export class CheckAuthentication {
  constructor(private readonly tokenProvider: TokenProvider) {}

  async execute(): Promise<AuthenticationIssue[]> {
    if ((await this.tokenProvider.resolve()) !== null) return [];
    return [{ severity: "info", message: "Not authenticated", fix: { code: "authenticate" } }];
  }
}
