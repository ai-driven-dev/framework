import type { AiToolId } from "./tool-ids.js";

export interface PluginToRewire {
  readonly name: string;
  readonly marketplace: string;
  readonly toolIds: readonly AiToolId[];
}

export interface MigrationPlanParams {
  fromVersion: number;
  fieldsToStrip: readonly string[];
  filesToDelete: readonly string[];
  pluginsToRewire: readonly PluginToRewire[];
  defaultMarketplaceMissing: boolean;
  userMemoryFiles: readonly string[];
}

const VALID_FROM_VERSIONS = [1, 2, 3, 4, 5] as const;

export class MigrationPlan {
  readonly fromVersion: number;
  readonly toVersion: 5 = 5;
  readonly fieldsToStrip: readonly string[];
  readonly filesToDelete: readonly string[];
  readonly pluginsToRewire: readonly PluginToRewire[];
  readonly defaultMarketplaceMissing: boolean;
  readonly userMemoryFiles: readonly string[];

  constructor(params: MigrationPlanParams) {
    if (!(VALID_FROM_VERSIONS as readonly number[]).includes(params.fromVersion)) {
      throw new Error(
        `Invalid fromVersion: ${params.fromVersion}. Must be one of ${VALID_FROM_VERSIONS.join(", ")}.`
      );
    }
    this.fromVersion = params.fromVersion;
    this.fieldsToStrip = params.fieldsToStrip;
    this.filesToDelete = params.filesToDelete;
    this.pluginsToRewire = params.pluginsToRewire;
    this.defaultMarketplaceMissing = params.defaultMarketplaceMissing;
    this.userMemoryFiles = params.userMemoryFiles;
  }

  isNoOp(): boolean {
    return (
      this.fromVersion === 5 &&
      !this.defaultMarketplaceMissing &&
      this.fieldsToStrip.length === 0 &&
      this.filesToDelete.length === 0 &&
      this.pluginsToRewire.length === 0
    );
  }

  describe(): string {
    const lines: string[] = [`Migration plan (v${this.fromVersion} → v${this.toVersion}):`];
    if (this.fieldsToStrip.length > 0) {
      lines.push(`  Strip legacy fields: ${this.fieldsToStrip.join(", ")}`);
    }
    if (this.filesToDelete.length > 0) {
      lines.push(`  Delete ${this.filesToDelete.length} legacy file(s) from disk`);
      for (const f of this.filesToDelete) {
        lines.push(`    - ${f}`);
      }
    }
    if (this.defaultMarketplaceMissing) {
      lines.push("  Register default marketplace");
    }
    if (this.pluginsToRewire.length > 0) {
      lines.push(`  Rewire ${this.pluginsToRewire.length} bundled plugin(s):`);
      for (const p of this.pluginsToRewire) {
        lines.push(`    - ${p.name} (tools: ${p.toolIds.join(", ")}) → ${p.marketplace}`);
      }
    }
    if (this.userMemoryFiles.length > 0) {
      lines.push(`  Preserve user memory files: ${this.userMemoryFiles.join(", ")}`);
    }
    if (this.isNoOp()) {
      lines.push("  (nothing to do)");
    }
    return lines.join("\n");
  }

  equals(other: MigrationPlan): boolean {
    return (
      this.fromVersion === other.fromVersion &&
      this.toVersion === other.toVersion &&
      this.defaultMarketplaceMissing === other.defaultMarketplaceMissing &&
      arraysEqual(this.fieldsToStrip, other.fieldsToStrip) &&
      arraysEqual(this.filesToDelete, other.filesToDelete) &&
      arraysEqual(this.userMemoryFiles, other.userMemoryFiles) &&
      pluginsEqual(this.pluginsToRewire, other.pluginsToRewire)
    );
  }
}

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

function pluginsEqual(a: readonly PluginToRewire[], b: readonly PluginToRewire[]): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (p, i) =>
      p.name === b[i]?.name &&
      p.marketplace === b[i]?.marketplace &&
      arraysEqual(p.toolIds as readonly string[], b[i]?.toolIds as readonly string[])
  );
}
