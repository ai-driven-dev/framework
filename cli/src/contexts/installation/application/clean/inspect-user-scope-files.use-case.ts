import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { ScopeRecords, ToolRecords } from "../../contract/records/scope-records.js";
import type { Manifest } from "../../domain/manifest.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import type { MachineClaimsReading } from "../../ports/user-scope/machine-claims-reading.js";
import type {
  MachineStatePurge,
  UserScopeInspection,
} from "../../ports/user-scope/user-scope-purge.js";

/** What InspectUserScopeFiles is built from. */
export interface InspectUserScopeFilesDeps {
  readonly userManifestRepo: ManifestRepository;
  /** What the machine claims say, with the records they are read from. */
  readonly claims: MachineClaimsReading & Pick<ScopeRecords, "loadRecords">;
  readonly purgeMachineState: MachineStatePurge;
}

/** What the user manifest and the cache say before a user clean removes anything. */
export class InspectUserScopeFiles {
  constructor(
    private readonly deps: InspectUserScopeFilesDeps,
    private readonly tools: ToolCatalog
  ) {}

  async execute(
    referencingProjects: () => Promise<readonly string[]>
  ): Promise<UserScopeInspection> {
    const manifest = await this.deps.userManifestRepo.load();
    return {
      manifestFound: manifest !== null,
      toolIds: manifest?.getInstalledToolIds() ?? [],
      activePluginDependents: this.activeDependents(manifest, await this.deps.claims.loadRecords()),
      builtVersions: await this.deps.purgeMachineState.builtVersions(),
      referencingProjects: await referencingProjects(),
    };
  }

  private activeDependents(manifest: Manifest | null, records: ToolRecords): readonly string[] {
    if (manifest === null) return [];
    const toolIds = manifest.getInstalledToolIds().filter((toolId) => this.tools.isAiTool(toolId));
    const { claims } = this.deps;
    return claims.holdersOf(
      toolIds.flatMap((toolId) => [
        ...claims.pluginClaimsOf(
          records.get(toolId),
          manifest
            .getRecordedPlugins(toolId)
            .filter(({ plugin }) => plugin.scope === "user")
            .map(({ plugin }) => plugin.name)
        ),
        ...claims.claimsOf(records.get(toolId)),
      ])
    );
  }
}
