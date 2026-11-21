import { AiddError } from "./aidd-error.js";

export class UserScopeUnsupportedAiToolsError extends AiddError {
  readonly code = "user-scope-unsupported-ai-tools";
  constructor(aiTools: readonly string[]) {
    super(
      `--global installs through an IDE's own plugin CLI or its user configuration directory, and neither exists for: ${aiTools.join(", ")}. ` +
        "Drop them from --ide, or run `aidd setup --ide <ids>` in the project instead."
    );
    this.name = "UserScopeUnsupportedAiToolsError";
  }
}
