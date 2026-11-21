import type { AiToolId } from "../../../shared/domain/tool.js";
import type { MarketplaceSourceDriftFound } from "./marketplace-source-drift.js";

/**
 * One thing a host's own registries say about what aidd asked it to register, in the host's own
 * terms: the caller decides how to word it and how serious it is.
 */
export type HostRegistrationFinding =
  /** The host's plugin registry gave no answer, so nothing about its plugins is known. */
  | { readonly kind: "registry-unanswerable"; readonly tool: AiToolId; readonly detail: string }
  /** A plugin the host was asked to load whose marketplace was never recorded, so it cannot be looked up. */
  | { readonly kind: "plugin-unrecorded"; readonly tool: AiToolId; readonly plugin: string }
  | {
      readonly kind: "plugin-missing";
      readonly tool: AiToolId;
      readonly ref: string;
      readonly location: string;
    }
  | {
      readonly kind: "plugin-disabled";
      readonly tool: AiToolId;
      readonly ref: string;
      readonly location: string;
    }
  | {
      readonly kind: "source-drift";
      readonly tool: AiToolId;
      readonly found: MarketplaceSourceDriftFound;
    }
  | {
      readonly kind: "source-conflict";
      readonly tool: AiToolId;
      readonly name: string;
      readonly location: string;
      readonly registeredSource: string;
      readonly requestedSource: string;
      /** Which plugins the registered catalog and the requested one differ by, already worded. */
      readonly pluginDiff: string;
    };

export interface InspectHostRegistrationResult {
  /** Plugin findings first, then marketplace-source findings, each in the order the hosts came. */
  readonly findings: readonly HostRegistrationFinding[];
}
