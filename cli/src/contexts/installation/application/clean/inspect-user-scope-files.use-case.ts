import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { Manifest } from "../../domain/manifest.js";
import type { ManifestRepository } from "../../ports/manifest-repository.js";
import type {
  RecordsBesideManifest,
  RegistrationRecords,
} from "../../ports/record/registration-records.js";
import type { MachineClaimsReading } from "../../ports/user-scope/machine-claims-reading.js";
import type {
  MachineStatePurge,
  UserScopeInspection,
} from "../../ports/user-scope/user-scope-purge.js";

/** What InspectUserScopeFiles is built from. */
export interface InspectUserScopeFilesDeps {
  readonly userManifestRepo: ManifestRepository & RecordsBesideManifest;
  readonly claims: MachineClaimsReading;
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
      activePluginDependents: this.activeDependents(
        manifest,
        await this.deps.userManifestRepo.loadRecords()
      ),
      builtVersions: await this.deps.purgeMachineState.builtVersions(),
      referencingProjects: await referencingProjects(),
    };
  }

  private activeDependents(
    manifest: Manifest | null,
    records: RegistrationRecords
  ): readonly string[] {
    if (manifest === null) return [];
    const toolIds = manifest.getInstalledToolIds().filter((toolId) => this.tools.isAiTool(toolId));
    return this.deps.claims.holdersOf(
      toolIds.flatMap((toolId) =>
        manifest.getRecordedPlugins(toolId).filter(({ plugin }) => plugin.scope === "user")
      ),
      toolIds.flatMap((toolId) => this.deps.claims.claimsOf(records.get(toolId)))
    );
  }
}
