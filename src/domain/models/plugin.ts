import { InvalidPluginNameError, InvalidPluginVersionError } from "../errors.js";
import type { InstallationFile } from "./file.js";
import type { PluginDistribution } from "./plugin-distribution.js";
import { type PluginSource, parsePluginSource, serializePluginSource } from "./plugin-source.js";
import { isSemver } from "./semver.js";

export const PLUGIN_NAME_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export interface PluginEntryData {
  name: string;
  source: Record<string, unknown>;
  version: string;
  strict: boolean;
  files: Record<string, string>;
}

export class Plugin {
  readonly name: string;
  readonly source: PluginSource;
  readonly version: string;
  readonly strict: boolean;
  readonly files: ReadonlyMap<string, string>;

  private constructor(params: {
    name: string;
    source: PluginSource;
    version: string;
    strict: boolean;
    files: ReadonlyMap<string, string>;
  }) {
    this.name = params.name;
    this.source = params.source;
    this.version = params.version;
    this.strict = params.strict;
    this.files = params.files;
  }

  static fromDistribution(
    dist: PluginDistribution,
    source: PluginSource,
    files: InstallationFile[]
  ): Plugin {
    const filesRecord: Record<string, string> = {};
    for (const f of files) {
      filesRecord[f.relativePath] = f.hash.value;
    }
    return Plugin.fromJSON({
      name: dist.manifest.name,
      source: serializePluginSource(source),
      version: dist.manifest.version,
      strict: dist.manifest.strict ?? false,
      files: filesRecord,
    });
  }

  static fromJSON(data: PluginEntryData): Plugin {
    if (!PLUGIN_NAME_REGEX.test(data.name)) {
      throw new InvalidPluginNameError(data.name);
    }
    if (!isSemver(data.version)) {
      throw new InvalidPluginVersionError(data.version);
    }
    const source = parsePluginSource(data.source);
    const files = new Map(Object.entries(data.files));
    return new Plugin({
      name: data.name,
      source,
      version: data.version,
      strict: data.strict,
      files,
    });
  }

  toJSON(): PluginEntryData {
    const files: Record<string, string> = {};
    for (const [key, value] of this.files) {
      files[key] = value;
    }
    return {
      name: this.name,
      source: serializePluginSource(this.source),
      version: this.version,
      strict: this.strict,
      files,
    };
  }

  isFileTracked(relPath: string): boolean {
    return this.files.has(relPath);
  }

  withVersion(v: string): Plugin {
    return new Plugin({
      name: this.name,
      source: this.source,
      version: v,
      strict: this.strict,
      files: this.files,
    });
  }

  withFiles(f: ReadonlyMap<string, string>): Plugin {
    return new Plugin({
      name: this.name,
      source: this.source,
      version: this.version,
      strict: this.strict,
      files: f,
    });
  }
}
