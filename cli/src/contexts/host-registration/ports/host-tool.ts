import type { AiToolId } from "../../../shared/domain/tool.js";
import type {
  MarketplaceRegistrationAnswers,
  NativeActivationAnswers,
} from "../../tools/contract/tool-profile.js";

// Each shape is the part of a tool one reader asks for. The tools context owns the profile, and
// the caller hands over the real one, which satisfies every shape here.
export type CatalogProbeTool =
  | { readonly kind: "ide" }
  | {
      readonly kind: "ai";
      distributionPaths(kind: "manifest" | "marketplace"): readonly string[];
    };

export type SettingsDeclaringTool =
  | { readonly kind: "ide" }
  | {
      readonly kind: "ai";
      machineLocalFiles(): readonly string[];
      marketplaceRegistration(): MarketplaceRegistrationAnswers | null;
      nativeActivation(): NativeActivationAnswers | undefined;
    };

export interface HostedTool {
  readonly toolId: AiToolId;
}

export interface ActivatedTool extends HostedTool {
  nativeActivation(): NativeActivationAnswers | undefined;
}

export interface HostRefCounter {
  hostRefInUse(enabled: boolean): boolean;
}

export interface NativeHostTool extends ActivatedTool, HostRefCounter {
  pluginEnablementIsMachineGlobal(): boolean;
}
