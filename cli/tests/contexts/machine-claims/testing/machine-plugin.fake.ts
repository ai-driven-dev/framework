import type {
  MachineUserPlugin,
  UserScopePluginFiles,
} from "../../../../src/contexts/machine-claims/ports/machine-manifest.js";

interface MachinePluginFields {
  readonly name: string;
  readonly scope?: string;
  readonly files?: Readonly<Record<string, string>>;
}

/** A user plugin as the machine-wide record shows it to a claim: the narrow shape the claims
 * read, with no installation record behind it. */
export class MachinePlugin implements MachineUserPlugin, UserScopePluginFiles<MachinePlugin> {
  readonly name: string;
  readonly scope: string;
  readonly files: ReadonlyMap<string, string>;

  constructor(fields: MachinePluginFields) {
    this.name = fields.name;
    this.scope = fields.scope ?? "user";
    this.files = new Map(Object.entries(fields.files ?? {}));
  }

  /** The plugin itself: the fake is its own plugin, as the claims read one. */
  get plugin(): {
    readonly name: string;
    readonly scope: string;
    readonly files: ReadonlyMap<string, string>;
  } {
    return this;
  }

  /** The fake keeps no per-entry provenance, so recording none changes nothing. */
  withMcpEntries(_entries: ReadonlyMap<string, string>): MachinePlugin {
    return this;
  }

  withFiles(files: ReadonlyMap<string, string>): MachinePlugin {
    return new MachinePlugin({ ...this.fields(), files: Object.fromEntries(files) });
  }

  private fields(): MachinePluginFields {
    return {
      name: this.name,
      scope: this.scope,
      files: Object.fromEntries(this.files),
    };
  }
}
