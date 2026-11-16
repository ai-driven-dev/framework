import { isAbsolute } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ChooseMarketplaceSource } from "../../../../src/contexts/distribution/application/choose-marketplace-source.js";
import {
  DEFAULT_FRAMEWORK_REPO,
  MarketplaceSourceMode,
} from "../../../../src/contexts/distribution/domain/marketplace-source-mode.js";
import type { ReleaseLister } from "../../../../src/contexts/distribution/ports/release-lister.js";

function releasesOf(tags: string[]): ReleaseLister {
  return { listRootReleases: vi.fn().mockResolvedValue(tags) };
}

describe("ChooseMarketplaceSource", () => {
  describe("pinNewest", () => {
    it("returns a source that already names its release unchanged", async () => {
      const lister = releasesOf(["v9.9.9"]);
      const source = MarketplaceSourceMode.remote(undefined, "v1.0.0");

      const result = await new ChooseMarketplaceSource(lister).pinNewest(source);

      expect(result).toBe(source);
      expect(lister.listRootReleases).not.toHaveBeenCalled();
    });

    it("returns a local source unchanged without resolving a release", async () => {
      const lister = releasesOf(["v1.0.0"]);
      const source = MarketplaceSourceMode.local("/abs/path");

      const result = await new ChooseMarketplaceSource(lister).pinNewest(source);

      expect(result).toBe(source);
      expect(lister.listRootReleases).not.toHaveBeenCalled();
    });

    it("pins the newest root release of the source's repository", async () => {
      const lister = releasesOf(["v2.3.4", "v2.3.3"]);

      const result = await new ChooseMarketplaceSource(lister).pinNewest(
        MarketplaceSourceMode.remote("acme/fw")
      );

      expect(result.ref).toBe("v2.3.4");
      expect(result.repo).toBe("acme/fw");
      expect(lister.listRootReleases).toHaveBeenCalledWith("acme/fw");
    });

    it("falls back to the tip when the repository has no root release", async () => {
      const result = await new ChooseMarketplaceSource(releasesOf([])).pinNewest(
        MarketplaceSourceMode.remote()
      );

      expect(result.ref).toBeUndefined();
      expect(result.repo).toBe(DEFAULT_FRAMEWORK_REPO);
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
