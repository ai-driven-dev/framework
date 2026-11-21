import type { CheckStatusResult } from "../../contexts/auth/application/check-status.use-case.js";
import type { LogOutResult } from "../../contexts/auth/application/log-out.use-case.js";
import type { AuthLevel } from "../../contexts/auth/contract/credential.js";
import type { Output } from "../../orchestration/domain/output.js";

export function printAuthenticated(output: Output, login: string, level: AuthLevel): void {
  output.success(`Authenticated as ${login} (${level})`);
}

export function printAuthStatus(output: Output, status: CheckStatusResult): void {
  if (!status.authenticated) {
    output.info("Not authenticated.");
    return;
  }
  printAuthenticated(output, status.login, status.level);
}

export function printLogoutResult(output: Output, result: LogOutResult): void {
  if (!result.found) {
    output.info("Not authenticated.");
    return;
  }
  if (result.hint === "external-provider-cleanup") {
    output.info(
      "To fully logout, run the external provider's logout command (e.g. gh auth logout)."
    );
  }
  output.success(`Logged out (${result.level})`);
}
