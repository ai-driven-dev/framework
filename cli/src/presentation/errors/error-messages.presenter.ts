import type { AiddError } from "../../shared/domain/shared.error.js";

/** What each catalogued error says, by its code. */
export const MESSAGES: Record<string, ((error: AiddError) => string) | undefined> = {};
