import { describe, expect, it } from "vitest";
import type { IsWithinUserScope } from "../../../src/contexts/machine-claims/contract/user-scope-containment.js";
import { UpdateUserPlugin } from "../../../src/orchestration/plugin/update-user-plugin.use-case.js";
import {
  SYNTHETIC_TOOL,
  syntheticCatalog,
} from "../../shared/testing/synthetic-tool-id.builder.js";

describe("updating a user plugin", () => {
  it("hands the host registration's ref selection to the file update", async () => {
    const selection = {
      isQualifiedRef: () => false,
      refSelectedBy: () => true,
      claimsOf: () => [],
      holdersOf: () => [],
    };
    let seen: unknown;
    const update = new UpdateUserPlugin(
      {
        execute: async (options) => {
          seen = options.refSelection;
          return [];
        },
      },
      { execute: async () => ({ apply() {} }) },
      () => true,
      selection
    );

    await update.execute({ toolIds: [], projectRoot: "/A", scope: "user" });

    expect(seen).toBe(selection);
  });

  it("hands the injected containment rule and the host refresh to the file update", async () => {
    const seen: { within?: IsWithinUserScope; refreshed: number } = { refreshed: 0 };
    const contained: IsWithinUserScope = () => false;
    const update = new UpdateUserPlugin(
      {
        execute: async (options) => {
          seen.within = options.isWithinUserScope;
          await options.refreshNative({
            tool: syntheticCatalog().aiProfile(SYNTHETIC_TOOL),
            ref: "a@b",
            projectRoot: "/A",
            registrations: undefined,
          });
          return [];
        },
      },
      {
        execute: async () => {
          seen.refreshed += 1;
          return { apply() {} };
        },
      },
      contained,
      {
        isQualifiedRef: () => false,
        refSelectedBy: () => false,
        claimsOf: () => [],
        holdersOf: () => [],
      }
    );

    await update.execute({ toolIds: [], projectRoot: "/A", scope: "user" });

    expect(seen.within).toBe(contained);
    expect(seen.refreshed).toBe(1);
  });
});
