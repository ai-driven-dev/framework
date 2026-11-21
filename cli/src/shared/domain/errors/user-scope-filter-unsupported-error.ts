import { AiddError } from "./aidd-error.js";

export class UserScopeFilterUnsupportedError extends AiddError {
  readonly code = "user-scope-filter-unsupported";
  constructor(flag: string, command: string) {
    super(
      `--scope user tracks nothing ${flag} can narrow — it names every requested tool, ` +
        `not one plugin or one file. Drop ${flag}, or run \`aidd ${command}\` at project scope.`
    );
    this.name = "UserScopeFilterUnsupportedError";
  }
}
