import { describe, expect, it } from "vitest";
import { RemoveBuiltMarketplace } from "../../../../../src/contexts/distribution/application/remove/remove-built-marketplace.use-case.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";

const BUILT = "/project/.aidd/cache/built";

describe("removing the built trees of a marketplace", () => {
  it("deletes every tool's tree of that marketplace and no other", async () => {
    const fs = new InMemoryFileAdapter({
      [`${BUILT}/drop/claude/a.md`]: "a",
      [`${BUILT}/drop/cursor/b.md`]: "b",
      [`${BUILT}/keep/claude/c.md`]: "c",
    });

    await new RemoveBuiltMarketplace(fs).execute({ projectRoot: "/project", name: "drop" });

    expect(fs.has(`${BUILT}/drop/claude/a.md`)).toBe(false);
    expect(fs.has(`${BUILT}/drop/cursor/b.md`)).toBe(false);
    expect(fs.has(`${BUILT}/keep/claude/c.md`)).toBe(true);
  });
});
