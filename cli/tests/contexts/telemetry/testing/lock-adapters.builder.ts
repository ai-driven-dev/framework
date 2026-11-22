import { join } from "node:path";
import {
  BINDINGS_LOCK_NAME,
  BindingsLockAdapter,
} from "../../../../src/contexts/telemetry/infrastructure/storage/declarations/bindings-lock-adapter.js";
import { DirectoryLock } from "../../../../src/contexts/telemetry/infrastructure/storage/ledger/directory-lock.js";
import {
  LedgerLock,
  type LockOptions,
} from "../../../../src/contexts/telemetry/infrastructure/storage/ledger/ledger-lock.js";
import type { PrivateStorage } from "../../../../src/shared/ports/private-storage.js";

/** The lock on `.lock` in one directory, as composition builds it. */
export function directoryLockOver(
  dir: string,
  storage: PrivateStorage,
  options: Partial<LockOptions> = {}
): DirectoryLock {
  return new DirectoryLock({ dir, storage, lock: new LedgerLock(join(dir, ".lock"), options) });
}

/** The bindings directory's lock, as composition builds it. */
export function bindingsLockOver(
  dir: string,
  storage: PrivateStorage,
  options: Partial<LockOptions> = {}
): BindingsLockAdapter {
  return new BindingsLockAdapter(
    directoryLockOver(dir, storage, { ...options, name: BINDINGS_LOCK_NAME })
  );
}
