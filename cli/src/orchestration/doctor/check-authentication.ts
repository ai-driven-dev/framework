import type { TokenProvider } from "../../contexts/auth/contract/token-provider.js";
import type { DoctorIssue } from "../../contexts/installation/contract/doctor-issue.js";

/** Reports, as a doctor issue, that no token resolves on this machine. */
export class CheckAuthentication {
  constructor(private readonly tokenProvider: TokenProvider) {}

  async execute(): Promise<DoctorIssue[]> {
    if ((await this.tokenProvider.resolve()) !== null) return [];
    return [{ severity: "info", message: "Not authenticated", fix: "Run aidd auth login" }];
  }
}
