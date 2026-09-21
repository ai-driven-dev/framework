import type { NativeMarketplaceSourceListContract } from "../../ports/native-marketplace-source-reader.js";

/** Installed Copilot 1.0.83 rejects --json; no structured source shape is verified yet. */
export const copilotMarketplaceSourceListContract: NativeMarketplaceSourceListContract = {
  binary: "copilot",
  args: ["plugin", "marketplace", "list", "--json"],
  unavailableMessage:
    "Copilot CLI marketplace list --json unavailable; upgrade to a supported binary and retry",
  unverifiedMessage:
    "Copilot CLI marketplace list --json output shape is not verified; upgrade to a supported binary and reconcile manually",
};
