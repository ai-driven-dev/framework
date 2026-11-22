import type { SchemaProvider } from "../../../../src/contexts/translate/ports/schema-provider.js";
import type { SchemaName } from "../../../../src/shared/domain/config-asset.js";

/** Schemas that accept anything: the validator under test is a stub that never reads one. */
export const openSchemas: SchemaProvider = { loadSchema: () => ({}) };

/** Schemas that record which one was asked for. */
export function schemasNaming(loaded: SchemaName[]): SchemaProvider {
  return {
    loadSchema: (name) => {
      loaded.push(name);
      return { schemaFor: name };
    },
  };
}

const MINIMAL_MANIFEST_SCHEMA = {
  type: "object",
  required: ["name"],
  properties: { name: { type: "string" } },
};

const MINIMAL_MARKETPLACE_SCHEMA = {
  type: "object",
  required: ["name", "metadata", "owner", "plugins"],
  properties: {
    name: { type: "string" },
    metadata: { type: "object" },
    owner: { type: "object" },
    plugins: { type: "array" },
  },
};

/** The smallest manifest and marketplace schemas a validator can tell apart; any other name is open. */
export const minimalSchemas: SchemaProvider = {
  loadSchema: (name) => {
    if (name === "plugin-manifest") return MINIMAL_MANIFEST_SCHEMA;
    if (name === "marketplace") return MINIMAL_MARKETPLACE_SCHEMA;
    return {};
  },
};
