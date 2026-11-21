import { AiddError } from "./aidd-error.js";

const MANIFEST_UNAVAILABLE_MESSAGE: Record<ManifestUnavailableCode, string> = {
  "manifest-missing": "No AIDD manifest found. Run `aidd setup` to initialize your project.",
  "manifest-corrupted":
    "Manifest is corrupted (invalid JSON). Run `aidd clean --force` and re-initialize.",
};

export type ManifestUnavailableCode = "manifest-missing" | "manifest-corrupted";

/** A project's manifest cannot be had, for the reason the stable `code` names.
 *
 * Both messages name a command, so target 03 §9.3 keys them on a presentation code-to-message
 * table. That translator is not built yet: until it is, the words stay here, as ratchet debt. */
export class ManifestUnavailableError extends AiddError {
  constructor(
    readonly code: ManifestUnavailableCode,
    options?: ErrorOptions
  ) {
    super(MANIFEST_UNAVAILABLE_MESSAGE[code], options);
    this.name = "ManifestUnavailableError";
  }
}
