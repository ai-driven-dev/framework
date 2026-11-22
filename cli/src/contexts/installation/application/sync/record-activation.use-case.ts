import { resolve } from "node:path";
import { FileHash } from "../../../../shared/domain/file-hash.js";
import type { ToolId } from "../../../../shared/domain/tool.js";
import type { FileReader } from "../../../../shared/ports/file-reader.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { MarketplaceRegistrationAnswers } from "../../../tools/contract/tool-profile.js";
import { driftOf } from "../../domain/manifest/drift.js";
import type { Manifest } from "../../domain/manifest.js";
import type {
  RegistrationRecordData,
  RegistrationRecords,
} from "../../ports/record/registration-records.js";

/** A marketplace the host registered: the manifest reads the two names and keeps the rest. */
export type RegisteredMarketplace = Readonly<Record<string, unknown>> & {
  readonly alias: string;
  readonly hostName: string;
};

/** What the manifest records after one tool's registration. */
export type HostRegistrationOutcome = {
  readonly marketplaces: readonly RegisteredMarketplace[];
  readonly preservedMarketplaces: readonly RegisteredMarketplace[];
  readonly catalogClaims: readonly RegisteredMarketplace[];
  readonly pluginRefs: readonly string[];
  /** True when a build failed, so the host keeps its earlier registration for it. */
  readonly buildFailed: boolean;
};

/** The record a tool's activation leaves, `undefined` when it equals the one recorded: the host
 * registration's to answer. */
export type ActivationRecord = (
  existing: RegistrationRecordData | undefined,
  outcome: HostRegistrationOutcome,
  run: { readonly binary: string; readonly narrowed: boolean }
) => RegistrationRecordData | undefined;

/** What a run observed or caused. Each answer says whether it changed a manifest. */
export type RecordActivationRequest =
  | {
      readonly kind: "native-registrations";
      readonly records: RegistrationRecords;
      readonly activated: ReadonlyMap<ToolId, HostRegistrationOutcome>;
      readonly narrowed: boolean;
      readonly afterActivation: ActivationRecord;
    }
  | {
      readonly kind: "settings-written-by-host";
      readonly projectRoot: string;
      readonly manifest: Manifest;
      readonly activated: readonly ToolId[];
    };

type Of<K extends RecordActivationRequest["kind"]> = Extract<RecordActivationRequest, { kind: K }>;

/** What RecordActivation is built from. */
export interface RecordActivationDeps {
  readonly fs: FileReader;
}

/** What a run observed or caused, written back into the manifests that track it. */
export class RecordActivation {
  constructor(
    private readonly deps: RecordActivationDeps,
    private readonly tools: ToolCatalog
  ) {}

  async execute(request: RecordActivationRequest): Promise<boolean> {
    switch (request.kind) {
      case "native-registrations":
        return this.recordNativeRegistrations(request);
      case "settings-written-by-host":
        return this.recordWhatActivationWrote(request);
    }
  }

  /** Only for a tool this run actually activated. */
  private recordNativeRegistrations({
    records,
    activated,
    narrowed,
    afterActivation,
  }: Of<"native-registrations">): boolean {
    let changed = false;
    for (const [toolId, outcome] of activated) {
      const binary = this.nativeActivationBinary(toolId);
      if (binary === undefined) continue;
      const registrations = afterActivation(records.get(toolId), outcome, {
        binary,
        narrowed,
      });
      if (registrations === undefined) continue;
      records.set(toolId, registrations);
      changed = true;
    }
    return changed;
  }

  /**
   * A host's own CLI writes its registration into the very file `syncTool` had just hashed, so
   * the hash is re-read from disk after activation rather than re-derived: what is stored is
   * then the observation, not a guess at what the host would have written.
   */
  private async recordWhatActivationWrote({
    projectRoot,
    manifest,
    activated,
  }: Of<"settings-written-by-host">): Promise<boolean> {
    let changed = false;
    for (const toolId of activated) {
      if (await this.rehashHostSettings({ projectRoot, manifest }, toolId)) changed = true;
    }
    return changed;
  }

  private async rehashHostSettings(
    { projectRoot, manifest }: { projectRoot: string; manifest: Manifest },
    toolId: ToolId
  ): Promise<boolean> {
    const settingsPath = this.marketplaceSettingsOf(toolId)?.sharedSettingsFile();
    const tracked = manifest.getToolFiles(toolId).find((f) => f.relativePath === settingsPath);
    if (settingsPath === undefined || tracked === undefined) return false;
    const content = await this.deps.fs.readFileIfReadable(resolve(projectRoot, settingsPath));
    if (content === undefined) return false;
    const hash = FileHash.of(content);
    if (driftOf(tracked.hash.value, hash) === "ok") return false;
    manifest.recordFileHash(toolId, settingsPath, hash);
    return true;
  }

  private marketplaceSettingsOf(toolId: ToolId): MarketplaceRegistrationAnswers | undefined {
    return this.tools.aiProfileIfAny(toolId)?.marketplaceRegistration() ?? undefined;
  }

  private nativeActivationBinary(toolId: ToolId): string | undefined {
    return this.tools.aiProfileIfAny(toolId)?.nativeActivation()?.hostBinary();
  }
}
