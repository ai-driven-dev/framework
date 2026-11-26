import { MESSAGES } from "./error-messages.presenter.js";

/** The exit code of a failure no table catalogues: a plain `Error` or a thrown value. */
export const UNCATALOGUED_EXIT = 1;

/** The process exit code of each catalogued error, by its code. Every catalogued error exits 1; one
 * that must end otherwise is overridden here, the one place that maps an error to its exit code. */
export const EXIT_CODES: Readonly<Record<string, number>> = Object.fromEntries(
  Object.keys(MESSAGES).map((code) => [code, 1])
);
