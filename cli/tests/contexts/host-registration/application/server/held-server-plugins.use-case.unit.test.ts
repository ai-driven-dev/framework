import { describe, expect, it } from "vitest";
import { HeldServerPlugins } from "../../../../../src/contexts/host-registration/application/server/held-server-plugins.use-case.js";
import { FakeServerPluginLedger } from "../../../../shared/testing/fake-server-plugin-ledger.fake.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";

const held = new HeldServerPlugins(
  new FakeServerPluginLedger(new Map([[TOOL.kimi, ["aidd-dev"]]]))
);

describe("telling which plugins aidd installed in a host's own server", () => {
  it("holds a plugin the ledger names, for any tool or the tool asked about", async () => {
    expect(await held.execute({ plugins: ["aidd-dev"], toolIds: "all" })).toBe(true);
    expect(await held.execute({ plugins: ["aidd-dev"], toolIds: [TOOL.kimi] })).toBe(true);
  });

  it("does not hold a plugin the ledger does not name", async () => {
    expect(await held.execute({ plugins: ["other"], toolIds: "all" })).toBe(false);
  });

  it("does not look past the tools it was asked about", async () => {
    expect(await held.execute({ plugins: ["aidd-dev"], toolIds: [TOOL.claude] })).toBe(false);
  });
});
