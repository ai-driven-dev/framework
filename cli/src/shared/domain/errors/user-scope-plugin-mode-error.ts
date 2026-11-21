import { AiddError } from "./aidd-error.js";

export class UserScopePluginModeError extends AiddError {
  readonly code = "user-scope-plugin-mode";
  constructor() {
    super(
      "--global cannot ask which plugins to install. Pass --plugins all, recommended, " +
        "none, or comma-separated names."
    );
    this.name = "UserScopePluginModeError";
  }
}
