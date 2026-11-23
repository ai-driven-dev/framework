import type { AiToolId } from "../tool.js";
import type { PluginName } from "./plugin-name.js";

export interface PluginManifestFields {
  name: PluginName;
  version: string;
  description?: string;
  author?: { name: string; email?: string };
  strict?: boolean;
}

export interface PluginComponentFile {
  relativePath: string;
  content: string;
}

export interface PluginComponents {
  skills: readonly PluginComponentFile[];
  commands: readonly PluginComponentFile[];
  agents: readonly PluginComponentFile[];
  rules: readonly PluginComponentFile[];
  hooks: readonly PluginComponentFile[];
  mcp: readonly PluginComponentFile[];
}

export class PluginDistribution {
  readonly manifest: PluginManifestFields;
  readonly format: AiToolId;
  readonly files: readonly PluginComponentFile[];
  readonly components: PluginComponents;

  constructor(params: {
    manifest: PluginManifestFields;
    format: AiToolId;
    files: readonly PluginComponentFile[];
    components: PluginComponents;
  }) {
    this.manifest = params.manifest;
    this.format = params.format;
    this.files = params.files;
    this.components = params.components;
  }

  withStrict(strict: boolean): PluginDistribution {
    return new PluginDistribution({
      manifest: { ...this.manifest, strict },
      format: this.format,
      files: this.files,
      components: this.components,
    });
  }
}
