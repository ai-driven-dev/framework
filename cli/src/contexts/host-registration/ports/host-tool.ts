import type { AiToolId } from "../../../shared/domain/tool.js";
import type {
  MarketplaceRegistrationAnswers,
  NativeActivationAnswers,
} from "../../tools/contract/tool-profile.js";

/** A tool as far as reading its marketplace catalog goes: an editor has none, an AI tool names
 * the relative file its marketplace distribution puts there. The tools context owns the profile
 * and the caller hands over the real one, which satisfies this shape. */
export type CatalogProbeTool =
  | { readonly kind: "ide" }
  | {
      readonly kind: "ai";
      distributionPaths(kind: "manifest" | "marketplace"): readonly string[];
    };

/** A tool as far as asking its machine-local settings file what it declares goes. */
export type SettingsDeclaringTool =
  | { readonly kind: "ide" }
  | {
      readonly kind: "ai";
      machineLocalFiles(): readonly string[];
      marketplaceRegistration(): MarketplaceRegistrationAnswers | null;
      nativeActivation(): NativeActivationAnswers | undefined;
    };

/** A tool as far as the host that activates its plugins goes: which host it is, whether plugin
 * enablement is machine-wide, and which of the host's refs it still counts as in use. */
export interface NativeHostTool {
  readonly toolId: AiToolId;
  nativeActivation(): NativeActivationAnswers | undefined;
  pluginEnablementIsMachineGlobal(): boolean;
  hostRefInUse(enabled: boolean): boolean;
}
