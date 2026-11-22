import { join } from "node:path";
import { RepositoryAliasStoreAdapter } from "../../../../src/contexts/telemetry/infrastructure/legacy/repository-alias-store-adapter.js";
import { LeftOutAdapter } from "../../../../src/contexts/telemetry/infrastructure/storage/ledger/left-out-adapter.js";
import { ResolutionStoreAdapter } from "../../../../src/contexts/telemetry/infrastructure/storage/ledger/resolution-store-adapter.js";
import { UsageLedgerAdapter } from "../../../../src/contexts/telemetry/infrastructure/storage/ledger/usage-ledger-adapter.js";
import type { PrivateStorage } from "../../../../src/contexts/telemetry/ports/private-storage.js";

/** The ledger over one directory, with the left-out store and alias table composition gives it. */
export function ledgerOver(dir: string, storage: PrivateStorage): UsageLedgerAdapter {
  return new UsageLedgerAdapter(dir, storage, {
    leftOut: new LeftOutAdapter(join(dir, "left-out.txt"), dir, storage),
    aliases: new RepositoryAliasStoreAdapter(dir),
  });
}

/** The resolution store over one ledger directory, with its alias table. */
export function resolutionStoreOver(dir: string, storage: PrivateStorage): ResolutionStoreAdapter {
  return new ResolutionStoreAdapter(dir, storage, new RepositoryAliasStoreAdapter(dir));
}
