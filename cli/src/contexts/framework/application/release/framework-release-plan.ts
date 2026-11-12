import type { PluginSource } from "../../../../kernel/source.js";
import type { AiToolId } from "../../../../kernel/tool.js";
import type { Marketplace } from "../../../distribution/domain/marketplace.js";
import type { Manifest } from "../../domain/manifest.js";

export interface FrameworkUpgradeTarget {
  readonly toolId: AiToolId;
  readonly pluginName: string;
  readonly targetVersion?: string;
}

export interface NativeReleaseInstallation {
  readonly ref: string;
  readonly scope: "local" | "project" | "user";
  readonly projectPath?: string;
}

export interface FrameworkReleaseInput {
  readonly manifest: Manifest;
  readonly projectRoot: string;
  readonly targets: readonly FrameworkUpgradeTarget[];
  readonly marketplace: Marketplace;
  readonly localPath: string;
  readonly catalog: {
    version?: string;
    plugins: readonly { name: string; source: PluginSource; version?: string; strict?: boolean }[];
  };
}

/** Prepared bytes and native impact remain fixed while the user reviews the update. */
export interface FrameworkReleasePlan {
  readonly impact: readonly NativeReleaseInstallation[];
  readonly shared: boolean;
  readonly tool?: AiToolId;
  verifyImpact(): Promise<void>;
  install(target: FrameworkUpgradeTarget): Promise<void>;
  sync(): Promise<{
    warnings: readonly string[];
    errors: readonly { scope: string; message: string }[];
    binaryMissing: readonly { toolId: string; binary: string }[];
  }>;
}
