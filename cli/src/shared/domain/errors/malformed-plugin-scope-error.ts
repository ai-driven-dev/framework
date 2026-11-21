import { AiddError } from "./aidd-error.js";

// Not `InvalidPluginScopeError`, the CLI-facing "this tool does not support the scope you
// asked for" (`install-scope.ts`): this one is a manifest integrity failure: the recorded
// `scope` field is missing or not one of the two values it may hold.
export class MalformedPluginScopeError extends AiddError {
  readonly code = "malformed-plugin-scope";
  constructor(pluginName: string, scope: unknown) {
    super(
      `Plugin "${pluginName}" carries an invalid scope: ${JSON.stringify(scope)}. Expected "project" or "user".`
    );
    this.name = "MalformedPluginScopeError";
  }
}
