import type {
  BuiltMarketplaceEnsurer,
  EnsureBuiltMarketplaceRequest,
} from "../../../src/contexts/installation/contract/built-marketplace.js";
/** Stand-in for BuiltMarketplaceEnsurer returning a deterministic per-target built dir, so a
 * native or materialize test can consume a built tree without disk I/O. */
export function fakeEnsureBuiltMarketplace(
  builtDirFor: (target: string) => string = (target) => `/built/${target}`
): BuiltMarketplaceEnsurer {
  return {
    execute: async (options: EnsureBuiltMarketplaceRequest) => ({
      builtDir: builtDirFor(options.target),
      version: "test",
      rebuilt: true,
    }),
  };
}
