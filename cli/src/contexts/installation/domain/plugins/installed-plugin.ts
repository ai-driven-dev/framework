import type { PluginSource } from "../../../../shared/domain/plugin/source.js";
import type { Scope } from "../../../../shared/domain/scope.js";
import { asPathHashMap, type PathHashMap } from "./plugin-entry.js";

/** What installation owns of a plugin, so a changed copy spreads one plugin into another. */
export interface InstalledPluginFields {
  readonly name: string;
  readonly source: PluginSource;
  readonly version: string;
  readonly strict: boolean;
  readonly files: PathHashMap;
  readonly scope: Scope;
}

/** A plugin as installation knows it: what it is, where it came from, and the files it wrote. */
export class InstalledPlugin implements InstalledPluginFields {
  readonly name: string;
  readonly source: PluginSource;
  readonly version: string;
  readonly strict: boolean;
  readonly files: PathHashMap;
  /** What `files` keys are relative to: the project root, or the tool's user-scope plugins
   * directory. Recorded once, at install, and never re-derived from a tool's current profile,
   * which can disagree with what was true when the entry was written. */
  readonly scope: Scope;

  constructor(fields: InstalledPluginFields) {
    this.name = fields.name;
    this.source = fields.source;
    this.version = fields.version;
    this.strict = fields.strict;
    this.files = fields.files;
    this.scope = fields.scope;
  }

  isFileTracked(relPath: string): boolean {
    return this.files.has(relPath);
  }

  withVersion(v: string): InstalledPlugin {
    return new InstalledPlugin({ ...this, version: v });
  }

  withFiles(f: ReadonlyMap<string, string>): InstalledPlugin {
    return new InstalledPlugin({ ...this, files: asPathHashMap(f) });
  }
}
