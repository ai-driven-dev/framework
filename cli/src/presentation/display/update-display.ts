import type { SelfUpdateResult } from "../../contexts/update/application/self-update.js";
import type { Output } from "../deps.js";

export function printSelfUpdateResult(output: Output, result: SelfUpdateResult): void {
  switch (result.kind) {
    case "up-to-date":
    case "check-current":
      output.success(`Already up to date (${result.version})`);
      break;
    case "check-available":
      output.info(
        `New version available: ${result.latestVersion} (current: ${result.currentVersion})`
      );
      break;
    case "dry-run":
      output.info(`Would install @ai-driven-dev/cli@${result.latestVersion}`);
      break;
    case "updated": {
      output.success(
        `Successfully updated to version ${result.latestVersion} (${result.binaryPath})`
      );
      if (result.changelog) {
        output.info(`\nChangelog:\n${result.changelog}`);
      }
      break;
    }
  }
}
