import type { Scope } from "../scope.js";
import { AiddError } from "./aidd-error.js";

export class InvalidPluginScopeError extends AiddError {
  readonly code = "invalid-plugin-scope";
  constructor(toolId: string, requested: Scope, supported: Scope) {
    super(
      `Tool '${toolId}' does not support scope '${requested}'. Supported scope: '${supported}'. ` +
        `Re-run with --scope ${supported} or omit the flag.`
    );
    this.name = "InvalidPluginScopeError";
  }
}
