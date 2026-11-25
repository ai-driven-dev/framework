import { describe, expect, it } from "vitest";
import { ForgetProjectMarketplace } from "../../../../../src/contexts/distribution/application/remove/forget-project-marketplace.use-case.js";
import { Marketplace } from "../../../../../src/contexts/distribution/domain/marketplace.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryMarketplaceRegistry } from "../../../../shared/testing/in-memory-marketplace-registry.fake.js";

const PROJECT = "/project";
const BUILT = `${PROJECT}/.aidd/cache/built`;

const registered = (name: string) =>
  Marketplace.create({
    name,
    source: { kind: "local", path: `/mkt/${name}` },
    scope: "project",
    addedAt: "2026-01-01T00:00:00.000Z",
  });

describe("forgetting a project marketplace", () => {
  it("forgets its registry entry and every tool's built tree, and no other marketplace's", async () => {
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(PROJECT, registered("keep"));
    await registry.save(PROJECT, registered("drop"));
    const fs = new InMemoryFileAdapter({
      [`${BUILT}/drop/claude/a.md`]: "a",
      [`${BUILT}/drop/cursor/b.md`]: "b",
      [`${BUILT}/keep/claude/c.md`]: "c",
    });

    await new ForgetProjectMarketplace(registry, fs).execute({
      projectRoot: PROJECT,
      marketplace: { name: "drop", scope: "project" },
    });

    expect((await registry.list(PROJECT)).map((m) => m.name)).toEqual(["keep"]);
    expect(fs.has(`${BUILT}/drop/claude/a.md`)).toBe(false);
    expect(fs.has(`${BUILT}/drop/cursor/b.md`)).toBe(false);
    expect(fs.has(`${BUILT}/keep/claude/c.md`)).toBe(true);
  });
});
