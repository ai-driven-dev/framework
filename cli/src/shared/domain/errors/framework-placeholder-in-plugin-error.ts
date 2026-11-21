import { AiddError } from "./aidd-error.js";

export class FrameworkPlaceholderInPluginError extends AiddError {
  readonly code = "framework-placeholder-in-plugin";
  constructor(pluginName: string, relativePath: string) {
    super(
      `Framework placeholder '@{{TOOLS}}/' is not allowed inside plugin '${pluginName}' (file: ${relativePath}).`
    );
    this.name = "FrameworkPlaceholderInPluginError";
  }
}
