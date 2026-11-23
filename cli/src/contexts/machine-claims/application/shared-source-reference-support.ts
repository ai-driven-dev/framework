import { UnreadableUserSourceReferencesError } from "../../../shared/domain/shared.error.js";
import type { Logger } from "../../../shared/ports/logger.js";

/**
 * Runs `action`, treating a `references.json` this CLI cannot make sense of exactly like an absent
 * one: the file is a help, not an authority, so reading or writing it must never block the command
 * it does not gate. Every caller reaches the port through this, so none can reintroduce that
 * failure by forgetting to catch it. Anything other than `UnreadableUserSourceReferencesError` is
 * a bug, not a corrupted file, and propagates.
 */
export async function toleratingUnreadableRefs<T>(
  logger: Logger,
  fallback: T,
  action: () => Promise<T>
): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (!(error instanceof UnreadableUserSourceReferencesError)) throw error;
    logger.warn("", error);
    return fallback;
  }
}
