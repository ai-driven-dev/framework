import { describe, expect, it } from "vitest";
import { writeMarketplaceCatalog } from "../../../../../src/contexts/translate/application/sinks/marketplace-catalog-writer.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { aDiskTarget, aStubBuildContract } from "../../testing/stub-build-contract.builder.js";

const SOURCE = { name: "market", plugins: [] };

function depsOver(fs: InMemoryFileAdapter, validated: unknown[] = []) {
  return {
    fs,
    schemaCheck: {
      validate(_name: string, data: unknown) {
        validated.push(data);
      },
    },
  };
}

describe("the marketplace catalog", () => {
  it("writes nothing for a tool that builds none", async () => {
    const fs = new InMemoryFileAdapter();
    const target = aDiskTarget(aStubBuildContract());
    const count = await writeMarketplaceCatalog(depsOver(fs), target, {
      sourceMarketplace: SOURCE,
      builtPlugins: [{ name: "plug" }],
    });
    expect(count).toBe(0);
    expect(fs.listUnder("/out")).toEqual([]);
  });

  it("writes the catalog of the entries it built, after checking it against its schema", async () => {
    const fs = new InMemoryFileAdapter();
    const validated: unknown[] = [];
    const target = aDiskTarget(
      aStubBuildContract({
        buildMarketplaceEntry: async ({ name }) => ({ name }),
        buildMarketplaceCatalog: async (_source, entries) => ({
          catalog: { plugins: entries },
          schemaName: "marketplace",
          destRelPath: "catalog.json",
        }),
      })
    );
    const count = await writeMarketplaceCatalog(depsOver(fs, validated), target, {
      sourceMarketplace: SOURCE,
      builtPlugins: [{ name: "plug" }],
    });
    expect(count).toBe(1);
    expect(validated).toEqual([{ plugins: [{ name: "plug" }] }]);
    expect(JSON.parse(fs.getFile("/out/catalog.json") ?? "")).toEqual({
      plugins: [{ name: "plug" }],
    });
  });
});
