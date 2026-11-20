import type {
  MachineUserPlugin,
  UserScopePluginFiles,
} from "../../../../src/contexts/machine-claims/ports/machine-manifest.js";

interface MachinePluginFields {
  readonly name: string;
  readonly scope?: string;
  readonly dependents?: readonly string[];
  readonly files?: Readonly<Record<string, string>>;
}

/** A user plugin as the machine-wide record shows it to a claim: the narrow shape the claims
 * read, with no installation record behind it. */
export class MachinePlugin implements MachineUserPlugin, UserScopePluginFiles<MachinePlugin> {
  readonly name: string;
  readonly scope: string;
  readonly dependents: readonly string[];
  readonly files: ReadonlyMap<string, string>;

  constructor(fields: MachinePluginFields) {
    this.name = fields.name;
    this.scope = fields.scope ?? "user";
    this.dependents = fields.dependents ?? [];
    this.files = new Map(Object.entries(fields.files ?? {}));
  }

  withDependents(dependents: readonly string[]): MachinePlugin {
    return new MachinePlugin({ ...this.fields(), dependents });
  }

  withFiles(files: ReadonlyMap<string, string>): MachinePlugin {
    return new MachinePlugin({ ...this.fields(), files: Object.fromEntries(files) });
  }

  private fields(): MachinePluginFields {
    return {
      name: this.name,
      scope: this.scope,
      dependents: this.dependents,
      files: Object.fromEntries(this.files),
    };
  }
}
