import { describe, expect, it } from "vitest";
import type { IsWithinUserScope } from "../../../src/contexts/machine-claims/contract/user-scope-containment.js";
import { UpdateUserPlugin } from "../../../src/orchestration/plugin/update-user-plugin.js";
import { registeredAiProfile, TOOL } from "../../contexts/tools/testing/catalog-of.js";

describe("UpdateUserPlugin", () => {
  it("hands the injected containment rule and the host refresh to the file update", async () => {
    const seen: { within?: IsWithinUserScope; refreshed: number } = { refreshed: 0 };
    const contained: IsWithinUserScope = () => false;
    const update = new UpdateUserPlugin(
      {
        execute: async (options) => {
          seen.within = options.isWithinUserScope;
          await options.refreshNative({
            tool: registeredAiProfile(TOOL.cursor),
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
      contained
    );

    await update.execute({ toolIds: [], projectRoot: "/A", scope: "user" });

    expect(seen.within).toBe(contained);
    expect(seen.refreshed).toBe(1);
  });
});
