import type { ReadonlySkipList } from "../../../../../shared/domain/plugin/plugin-translation-skip.js";
import type { Logger } from "../../../../../shared/ports/logger.js";
import type { ReadonlyNoticeList } from "../../../../tools/contract/plugin-install-notice.js";

/** One warning per component a tool could not take. */
export function reportSkipWarnings(logger: Logger, skipped: ReadonlySkipList): void {
  for (const entry of skipped) {
    logger.warn(
      `Plugin "${entry.pluginName}": ${entry.component} skipped for ${entry.toolId} — ${entry.reason}`
    );
  }
}

/** One line per fact about a tool the person should know after the install. */
export function reportInstallNotices(logger: Logger, notices: ReadonlyNoticeList): void {
  for (const entry of notices) {
    logger.info(`Plugin "${entry.pluginName}" (${entry.toolId}): ${entry.message}`);
  }
}
