import type { RepositoryAliasStore } from "../../../../src/contexts/telemetry/ports/repository-alias-store.js";

/** No table of ids an earlier version gave repositories: every id is read as stored. */
export const NO_ALIASES: RepositoryAliasStore = {
  load: async () => null,
};
