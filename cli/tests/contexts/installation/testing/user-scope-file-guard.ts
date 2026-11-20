import type { UserScopeFileGuard } from "../../../../src/contexts/installation/application/plugin/plugin-materializer.js";
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
