import type { UserScopeFileGuard } from "../../../../src/contexts/installation/ports/plugin/user-plugin-materialization.js";
import {
  assertUserScopeWriteBoundary,
  userScopeFilesSafeToDelete,
  withoutMissingFiles,
} from "../../../../src/contexts/machine-claims/application/user-scope-plugin-files.js";

export const userScopeFileGuard: UserScopeFileGuard = {
  safeToDelete: userScopeFilesSafeToDelete,
  withoutMissing: withoutMissingFiles,
  assertWriteBoundary: assertUserScopeWriteBoundary,
};
