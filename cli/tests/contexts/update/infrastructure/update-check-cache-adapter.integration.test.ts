import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { UpdateCheckCacheAdapter } from "../../../../src/contexts/update/infrastructure/update-check-cache-adapter.js";
import { InMemoryFileAdapter } from "../../../helpers/ports/in-memory-file-adapter.js";

describe("UpdateCheckCacheAdapter", () => {
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

  it("reads what an earlier release left beside the cache directory", async () => {
    const fs = new InMemoryFileAdapter({
      [join("/cfg", "update-check.json")]: '{"checkedAt":5,"latest":"1.5.0"}',
    });

    expect(await new UpdateCheckCacheAdapter(fs, () => "/cfg").read()).toStrictEqual({
      checkedAt: 5,
      latest: "1.5.0",
    });
  });
});
