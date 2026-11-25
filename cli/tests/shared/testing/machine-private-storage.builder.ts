import { MACHINE_PRIVATE_STORAGE_HOST } from "../../../src/composition/user-config-dir.js";
import { PrivateStorageAdapter } from "../../../src/shared/infrastructure/private-storage-adapter.js";

/** Private storage over this machine's own platform and environment, as the composition root builds it. */
export function machinePrivateStorage(): PrivateStorageAdapter {
  return new PrivateStorageAdapter(MACHINE_PRIVATE_STORAGE_HOST);
}
