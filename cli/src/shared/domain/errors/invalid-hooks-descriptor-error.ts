import { AiddError } from "./aidd-error.js";

export type HooksInvariant =
  | "unknown-event"
  | "empty-native-list"
  | "duplicate-native-event"
  | "project-without-file"
  | "loader-with-file"
  | "path-outside-directory"
  | "root-token-without-file"
  | "file-without-root-token"
  | "adapter-not-stamped";

export class InvalidHooksDescriptorError extends AiddError {
  readonly code = "invalid-hooks-descriptor";
  constructor(
    readonly toolId: string,
    readonly invariant: HooksInvariant,
    detail: string
  ) {
    super(`The hooks descriptor of '${toolId}' breaks '${invariant}': ${detail}`);
    this.name = "InvalidHooksDescriptorError";
  }
}
