import { describe, expect, it, vi } from "vitest";
import { ListFrameworkReleases } from "../../../../src/contexts/distribution/application/list-framework-releases.use-case.js";
import { PinNewestFrameworkSource } from "../../../../src/contexts/distribution/application/pin-newest-framework-source.use-case.js";
import {
  DEFAULT_FRAMEWORK_REPO,
  localFrameworkSource,
  remoteFrameworkSource,
} from "../../../../src/contexts/distribution/contract/framework-source.js";
import type { ReleaseLister } from "../../../../src/shared/ports/release-lister.js";

function releasesOf(tags: string[]): ReleaseLister {
  return {
    listReleaseTags: vi.fn().mockResolvedValue(tags),
    readReleaseBody: vi.fn().mockResolvedValue(null),
  };
}

const pinNewestFrom = (lister: ReleaseLister) =>
  new PinNewestFrameworkSource(new ListFrameworkReleases(lister));

describe("PinNewestFrameworkSource", () => {
  it("returns a source that already names its release unchanged", async () => {
    const lister = releasesOf(["v9.9.9"]);
    const source = remoteFrameworkSource(undefined, "v1.0.0");

    const result = await pinNewestFrom(lister).execute(source);

    expect(result).toBe(source);
    expect(lister.listReleaseTags).not.toHaveBeenCalled();
  });

  it("returns a local source unchanged without resolving a release", async () => {
    const lister = releasesOf(["v1.0.0"]);
    const source = localFrameworkSource("/abs/path");

    const result = await pinNewestFrom(lister).execute(source);

    expect(result).toBe(source);
    expect(lister.listReleaseTags).not.toHaveBeenCalled();
  });

  it("pins the newest root release of the source's repository", async () => {
    const lister = releasesOf(["v2.3.4", "v2.3.3"]);

    const result = await pinNewestFrom(lister).execute(remoteFrameworkSource("acme/fw"));

    expect(result).toMatchObject({ repo: "acme/fw", ref: "v2.3.4" });
    expect(lister.listReleaseTags).toHaveBeenCalledWith("acme/fw");
  });

  it("falls back to the tip when the repository has no root release", async () => {
    const result = await pinNewestFrom(releasesOf([])).execute(remoteFrameworkSource());

    expect(result).toMatchObject({ repo: DEFAULT_FRAMEWORK_REPO });
    expect(result).not.toHaveProperty("ref", expect.any(String));
  });
});
