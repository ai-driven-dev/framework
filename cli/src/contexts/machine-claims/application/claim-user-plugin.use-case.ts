import { ToolNotInManifestError } from "../../../shared/domain/shared.error.js";
import type { AiToolId } from "../../../shared/domain/tool.js";
import type { FileReader } from "../../../shared/ports/file-reader.js";
import { readHeldClaims, withPluginDependent } from "../domain/plugin-claim.model.js";
import type {
  OwnershipMachineManifest,
  ScopeRecordsRepository,
  UserPluginToClaim,
} from "../ports/machine-manifest.js";

/** A user-scope plugin a project hands to the machine, with the project that holds it. */
export interface UserScopeClaim {
  readonly machine: OwnershipMachineManifest;
  readonly toolId: AiToolId;
  readonly plugin: UserPluginToClaim;
  /** The tool's version in the project record, needed when the machine does not track the tool. */
  readonly toolVersion: string | undefined;
  readonly projectRoot: string;
}

/** Records the plugin on the machine manifest, and the project as a holder of it in the claims of
 * the tool's record. The records are written before the manifest is saved: a crash between the two
 * leaves a claim on a plugin the manifest lacks, which nothing reads. */
export class ClaimUserPlugin {
  constructor(
    private readonly fs: Pick<FileReader, "realpath">,
    private readonly records: ScopeRecordsRepository
  ) {}

  async execute(claim: UserScopeClaim): Promise<void> {
    const { machine, toolId, plugin, toolVersion } = claim;
    const root = await this.fs.realpath(claim.projectRoot);
    const owned = machine
      .getRecordedPlugins(toolId)
      .find((p) => p.plugin.name === plugin.plugin.name);
    if (!machine.hasTool(toolId)) {
      if (toolVersion === undefined) throw new ToolNotInManifestError(toolId);
      machine.addTool(toolId, toolVersion, []);
    }
    const records = await this.records.loadRecords();
    const held = records.get(toolId);
    const pluginClaims = withPluginDependent(
      readHeldClaims(held?.pluginClaims),
      plugin.plugin.name,
      root
    );
    await this.records.saveRecords(new Map(records).set(toolId, { ...held, pluginClaims }));
    machine.withPlugin(toolId, owned ?? plugin.withMcpEntries(new Map()));
  }
}
