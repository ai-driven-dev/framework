import { InvalidMarketplaceNameError } from "../../../shared/domain/errors/invalid-marketplace-name-error.js";

export const FRAMEWORK_MARKETPLACE_NAME = "aidd-framework";
export const STALE_MAX_DAYS_DEFAULT = 7;

export function assertNotReservedMarketplaceName(name: string): void {
  if (name === FRAMEWORK_MARKETPLACE_NAME) {
    throw new InvalidMarketplaceNameError(
      `"${FRAMEWORK_MARKETPLACE_NAME}" is reserved for the framework auto-register entry`
    );
  }
}
