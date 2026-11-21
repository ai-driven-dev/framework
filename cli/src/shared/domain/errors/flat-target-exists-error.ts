import { AiddError } from "./aidd-error.js";

export class FlatTargetExistsError extends AiddError {
  readonly code = "flat-target-exists";
  constructor(targetPath: string, pluginName: string) {
    super(
      `Flat build conflict: '${targetPath}' already exists (plugin '${pluginName}'). ` +
        "Re-run with --force to overwrite."
    );
    this.name = "FlatTargetExistsError";
  }
}
