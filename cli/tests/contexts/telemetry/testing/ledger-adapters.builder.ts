import { RepositoryAliasStoreAdapter } from "../../../../src/contexts/telemetry/infrastructure/legacy/repository-alias-store-adapter.js";
import { LeftOutAdapter } from "../../../../src/contexts/telemetry/infrastructure/storage/ledger/left-out-adapter.js";
import { ResolutionStoreAdapter } from "../../../../src/contexts/telemetry/infrastructure/storage/ledger/resolution-store-adapter.js";
import { UsageLedgerAdapter } from "../../../../src/contexts/telemetry/infrastructure/storage/ledger/usage-ledger-adapter.js";
import type { PrivateStorage } from "../../../../src/shared/ports/private-storage.js";
import { directoryLockOver } from "./lock-adapters.builder.js";

/** The ledger over one directory, with the left-out store, alias table and lock composition gives it. */
export function ledgerOver(dir: string, storage: PrivateStorage): UsageLedgerAdapter {
  return new UsageLedgerAdapter(dir, storage, {
    leftOut: new LeftOutAdapter(dir, storage),
    aliases: new RepositoryAliasStoreAdapter(dir),
    lock: directoryLockOver(dir, storage),
  });
}

/** The resolution store over one ledger directory, with its alias table. */
export function resolutionStoreOver(dir: string, storage: PrivateStorage): ResolutionStoreAdapter {
  return new ResolutionStoreAdapter(dir, storage, new RepositoryAliasStoreAdapter(dir));
}
