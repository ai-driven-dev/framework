import { resolve } from "node:path";
import { FileHash } from "../../../../shared/domain/file-hash.js";
import type { ToolId } from "../../../../shared/domain/tool.js";
import type { ToolCatalog } from "../../../tools/contract/tool-catalog.js";
import type { MarketplaceRegistrationAnswers } from "../../../tools/contract/tool-profile.js";
import { driftOf } from "../../domain/manifest/drift.js";
import type { NativeRegistrations } from "../../domain/manifest/native-registrations.js";
import type { Manifest } from "../../domain/manifest.js";
import type { HostRegistrationOutcome } from "../../ports/native-host.js";
import {
  RecordMachineClaims,
  type RecordMachineClaimsDeps,
  type RecordMachineClaimsRequest,
} from "./record-machine-claims.use-case.js";

/** The record a tool's activation leaves, `undefined` when it equals the one recorded: the host
 * registration's to answer. */
export type ActivationRecord = (
  existing: NativeRegistrations | undefined,
  outcome: HostRegistrationOutcome,
  run: { readonly binary: string; readonly narrowed: boolean }
) => NativeRegistrations | undefined;

/** What a run observed or caused. Each answer says whether it changed a manifest. */
export type RecordActivationRequest =
  | {
      readonly kind: "native-registrations";
      readonly manifest: Manifest;
      readonly activated: ReadonlyMap<ToolId, HostRegistrationOutcome>;
      readonly narrowed: boolean;
      readonly afterActivation: ActivationRecord;
    }
  | {
      readonly kind: "settings-written-by-host";
      readonly projectRoot: string;
      readonly manifest: Manifest;
      readonly activated: readonly ToolId[];
    }
  | RecordMachineClaimsRequest;

type Of<K extends RecordActivationRequest["kind"]> = Extract<RecordActivationRequest, { kind: K }>;

/** What RecordActivation is built from. */
export type RecordActivationDeps = RecordMachineClaimsDeps;

/** What a run observed or caused, written back into the manifests that track it. */
export class RecordActivation {
  private readonly machineClaims: RecordMachineClaims;

  constructor(
    private readonly deps: RecordActivationDeps,
    private readonly tools: ToolCatalog
  ) {
    this.machineClaims = new RecordMachineClaims(deps, tools);
  }

  async execute(request: RecordActivationRequest): Promise<boolean> {
    switch (request.kind) {
      case "native-registrations":
        return this.recordNativeRegistrations(request);
      case "settings-written-by-host":
        return this.recordWhatActivationWrote(request);
      case "machine-claims":
        return this.machineClaims.execute(request);
    }
  }

  /** Only for a tool this run actually activated. */
  private recordNativeRegistrations({
    manifest,
    activated,
    narrowed,
    afterActivation,
  }: Of<"native-registrations">): boolean {
    let changed = false;
    for (const [toolId, outcome] of activated) {
      const binary = this.nativeActivationBinary(toolId);
      if (binary === undefined) continue;
      const registrations = afterActivation(manifest.getNativeRegistrations(toolId), outcome, {
        binary,
        narrowed,
      });
      if (registrations === undefined) continue;
      manifest.setNativeRegistrations(toolId, registrations);
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
    const content = await this.deps.fs
      .readFile(resolve(projectRoot, settingsPath))
      .catch(() => null);
    if (content === null) return false;
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
