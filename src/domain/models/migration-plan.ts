import { InvalidMigrationFromVersionError } from "../errors.js";
import { FRAMEWORK_MARKETPLACE_NAME } from "./marketplace.js";
import { type AiToolId, isAiToolId } from "./tool-ids.js";

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

const VALID_FROM_VERSIONS = [1, 2, 3, 4, 5, 6] as const;
const CURRENT_VERSION = 6;

export class MigrationPlan {
  readonly fromVersion: number;
  readonly toVersion: 6 = CURRENT_VERSION;
  readonly fieldsToStrip: readonly string[];
  readonly filesToDelete: readonly string[];
  readonly pluginsToRewire: readonly PluginToRewire[];
  readonly defaultMarketplaceMissing: boolean;
  readonly userMemoryFiles: readonly string[];

  constructor(params: MigrationPlanParams) {
    if (!(VALID_FROM_VERSIONS as readonly number[]).includes(params.fromVersion)) {
      throw new InvalidMigrationFromVersionError(params.fromVersion, VALID_FROM_VERSIONS);
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
      this.fromVersion >= 5 &&
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

// --- Pure plan computation (no I/O) ---

const USER_MEMORY_FILES: readonly string[] = ["CLAUDE.md", "AGENTS.md", "copilot-instructions.md"];
const LEGACY_TOP_LEVEL_FIELDS: readonly string[] = [
  "docs",
  "mode",
  "repo",
  "docsDir",
  "scripts",
  "plugins",
];

export function computeMigrationPlan(
  raw: Record<string, unknown>,
  registryHasDefault = false
): MigrationPlan {
  const fromVersion = typeof raw.version === "number" ? raw.version : 0;
  const fieldsToStrip = detectFieldsToStrip(raw);
  const filesToDelete = collectLegacyFiles(raw);
  const pluginsToRewire = detectBundledPlugins(raw);
  const defaultMarketplaceMissing = !registryHasDefault && !hasDefaultMarketplace(raw);
  return new MigrationPlan({
    fromVersion,
    fieldsToStrip,
    filesToDelete,
    pluginsToRewire,
    defaultMarketplaceMissing,
    userMemoryFiles: [...USER_MEMORY_FILES],
  });
}

function detectFieldsToStrip(raw: Record<string, unknown>): string[] {
  return LEGACY_TOP_LEVEL_FIELDS.filter((f) => f in raw && raw[f] !== undefined && raw[f] !== null);
}

function collectLegacyFiles(raw: Record<string, unknown>): string[] {
  const files: string[] = [];
  for (const section of ["scripts", "plugins"] as const) {
    const entry = raw[section];
    if (entry && typeof entry === "object" && "files" in entry) {
      const rawFiles = (entry as { files: unknown }).files;
      if (Array.isArray(rawFiles)) {
        for (const f of rawFiles) {
          if (
            f &&
            typeof f === "object" &&
            "relativePath" in f &&
            typeof f.relativePath === "string"
          ) {
            files.push(f.relativePath);
          }
        }
      }
    }
  }
  return files;
}

function detectBundledPlugins(raw: Record<string, unknown>): PluginToRewire[] {
  const map = new Map<string, AiToolId[]>();
  const tools = raw.tools as
    | Record<string, { plugins?: Array<{ name: string; marketplace?: string }> }>
    | undefined;
  if (!tools) return [];
  for (const [toolId, entry] of Object.entries(tools)) {
    if (!isAiToolId(toolId)) continue;
    for (const plugin of entry.plugins ?? []) {
      if (plugin.marketplace !== undefined) continue;
      const existing = map.get(plugin.name) ?? [];
      existing.push(toolId as AiToolId);
      map.set(plugin.name, existing);
    }
  }
  return [...map.entries()].map(([name, toolIds]) => ({
    name,
    marketplace: FRAMEWORK_MARKETPLACE_NAME,
    toolIds,
  }));
}

function hasDefaultMarketplace(raw: Record<string, unknown>): boolean {
  const marketplaces = raw.marketplaces as Record<string, unknown> | undefined;
  if (!marketplaces) return false;
  return FRAMEWORK_MARKETPLACE_NAME in marketplaces;
}
