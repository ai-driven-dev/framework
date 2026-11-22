import pluginManifest from "../../../../assets/schemas/claude-code-plugin-manifest.json" with {
  type: "json",
};
import claudeMarketplace from "../../../../assets/schemas/claude-marketplace-manifest.json" with {
  type: "json",
};
import codexMarketplace from "../../../../assets/schemas/codex-marketplace-manifest.json" with {
  type: "json",
};
import codexPluginManifest from "../../../../assets/schemas/codex-plugin-manifest.json" with {
  type: "json",
};
import marketplace from "../../../../assets/schemas/copilot-plugin-marketplace.json" with {
  type: "json",
};
import type { SchemaName } from "../../../../src/shared/domain/config-asset.js";
import type { SchemaSource } from "./profile-translation-conformance.contract.js";

const VENDORED: Record<SchemaName, object> = {
  "plugin-manifest": pluginManifest,
  marketplace,
  "claude-marketplace": claudeMarketplace,
  "codex-marketplace": codexMarketplace,
  "codex-plugin-manifest": codexPluginManifest,
};

/** The schemas the package vendors, held as data: a unit test reads no disk through them. */
export const vendoredSchemas: SchemaSource = { loadSchema: (name) => VENDORED[name] };
