import { AiddError } from "./aidd-error.js";

export type ProfileInvariant =
  | "directory-not-relative"
  | "directory-without-trailing-slash"
  | "no-build-contract"
  | "unknown-section"
  | "plugin-sections-disagree"
  | "shipped-config-disagrees";

export class InvalidToolProfileError extends AiddError {
  readonly code = "invalid-tool-profile";
  constructor(
    readonly toolId: string,
    readonly invariant: ProfileInvariant,
    detail: string
  ) {
    super(`The profile of '${toolId}' breaks '${invariant}': ${detail}`);
    this.name = "InvalidToolProfileError";
  }
}
