import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { UpdateCheckCacheAdapter } from "../../../../src/contexts/update/infrastructure/update-check-cache-adapter.js";
import { InMemoryFileAdapter } from "../../../shared/testing/in-memory-file-adapter.fake.js";

describe("caching the update check", () => {
  it("writes the entry as JSON under cache/ in the config directory, creating it", async () => {
    const created: string[] = [];
    const fs = new InMemoryFileAdapter();
    fs.createDirectory = async (path: string) => {
      created.push(join(path));
    };

    await new UpdateCheckCacheAdapter(fs, () => "/cfg").write({ checkedAt: 7, latest: "2.0.0" });

    expect(created).toStrictEqual([join("/cfg", "cache")]);
    expect(fs.getFile(join("/cfg", "cache", "update-check.json"))).toBe(
      '{"checkedAt":7,"latest":"2.0.0"}'
    );
  });
});
