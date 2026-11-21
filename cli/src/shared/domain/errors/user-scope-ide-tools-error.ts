import { AiddError } from "./aidd-error.js";

export class UserScopeIdeToolsError extends AiddError {
  readonly code = "user-scope-ide-tools";
  constructor(ideTools: readonly string[]) {
    super(
      `--global installs no project files, so an editor (${ideTools.join(", ")}) has ` +
        "nothing to install machine-wide. Drop it from --ide, or run `aidd setup --ide <ids>` " +
        "separately in the project."
    );
    this.name = "UserScopeIdeToolsError";
  }
}
