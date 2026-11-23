import { userScopeFileGuard as wired } from "../../../../src/composition/machine-claims.js";
import type { UserScopeFileGuard } from "../../../../src/contexts/installation/ports/plugin/user-plugin-materialization.js";

export const userScopeFileGuard: UserScopeFileGuard = wired;
