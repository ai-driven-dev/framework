import { describe, expect, it, vi } from "vitest";
import { ListFrameworkReleases } from "../../../../src/contexts/distribution/application/list-framework-releases.use-case.js";

describe("ListFrameworkReleases", () => {
  it("lists the root releases of a repository, newest first, without component tags", async () => {
    const lister = {
      listReleaseTags: vi
        .fn()
        .mockResolvedValue(["aidd-refine-v1.0.0", "v2.3.4", "aidd-context-v9.0.0", "v2.3.3"]),
      readReleaseBody: vi.fn().mockResolvedValue(null),
    };

    expect(await new ListFrameworkReleases(lister).execute("acme/fw")).toEqual([
      "v2.3.4",
      "v2.3.3",
    ]);
    expect(lister.listReleaseTags).toHaveBeenCalledWith("acme/fw");
  });
});
