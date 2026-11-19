import { isAbsolute } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ChooseMarketplaceSource } from "../../../../src/contexts/distribution/application/choose-marketplace-source.js";
import {
  DEFAULT_FRAMEWORK_REPO,
  localFrameworkSource,
  remoteFrameworkSource,
} from "../../../../src/contexts/distribution/contract/framework-source.js";
import type { ReleaseLister } from "../../../../src/contexts/distribution/ports/release-lister.js";

function releasesOf(tags: string[]): ReleaseLister {
  return { listRootReleases: vi.fn().mockResolvedValue(tags) };
}

describe("ChooseMarketplaceSource", () => {
  describe("pinNewest", () => {
    it("returns a source that already names its release unchanged", async () => {
      const lister = releasesOf(["v9.9.9"]);
      const source = remoteFrameworkSource(undefined, "v1.0.0");

      const result = await new ChooseMarketplaceSource(lister).pinNewest(source);

      expect(result).toBe(source);
      expect(lister.listRootReleases).not.toHaveBeenCalled();
    });

    it("returns a local source unchanged without resolving a release", async () => {
      const lister = releasesOf(["v1.0.0"]);
      const source = localFrameworkSource("/abs/path");

      const result = await new ChooseMarketplaceSource(lister).pinNewest(source);

      expect(result).toBe(source);
      expect(lister.listRootReleases).not.toHaveBeenCalled();
    });

    it("pins the newest root release of the source's repository", async () => {
      const lister = releasesOf(["v2.3.4", "v2.3.3"]);

      const result = await new ChooseMarketplaceSource(lister).pinNewest(
        remoteFrameworkSource("acme/fw")
      );

      expect(result).toMatchObject({ repo: "acme/fw", ref: "v2.3.4" });
      expect(lister.listRootReleases).toHaveBeenCalledWith("acme/fw");
    });

    it("falls back to the tip when the repository has no root release", async () => {
      const result = await new ChooseMarketplaceSource(releasesOf([])).pinNewest(
        remoteFrameworkSource()
      );

      expect(result).toMatchObject({ repo: DEFAULT_FRAMEWORK_REPO });
      expect(result).not.toHaveProperty("ref", expect.any(String));
    });
  });

  describe("releases", () => {
    it("lists the root releases of a repository, newest first, without component tags", async () => {
      const lister = releasesOf(["aidd-refine-v1.0.0", "v2.3.4", "aidd-context-v9.0.0", "v2.3.3"]);

      expect(await new ChooseMarketplaceSource(lister).releases("acme/fw")).toEqual([
        "v2.3.4",
        "v2.3.3",
      ]);
    });
  });

  describe("sources", () => {
    it("names the framework's own repository when none is given", () => {
      expect(new ChooseMarketplaceSource(releasesOf([])).remote().repo).toBe(
        DEFAULT_FRAMEWORK_REPO
      );
    });

    it("makes a relative directory absolute", () => {
      const result = new ChooseMarketplaceSource(releasesOf([])).local("./some/relative/path");

      expect(result.kind).toBe("local");
      // A leading-slash regex misses a Windows drive letter, so isAbsolute() is the
      // platform-correct check for "resolved to absolute" on every OS.
      expect(isAbsolute(result.path)).toBe(true);
    });
  });
});
