import { describe, expect, it, vi } from "vitest";
import { AssertMarketplaceReadable } from "../../../../src/contexts/distribution/application/assert-marketplace-readable.use-case.js";
import {
  localFrameworkSource,
  remoteFrameworkSource,
} from "../../../../src/contexts/distribution/contract/framework-source.js";
import { CatalogFetchAuthError } from "../../../../src/shared/domain/shared.error.js";

const withToken = { resolve: async () => "token" };
const withoutToken = { resolve: async () => null };
const remote = remoteFrameworkSource("owner/repo");

function visibilityOf(isPublic: boolean) {
  return { isRepoPublic: vi.fn(async () => isPublic) };
}

describe("asserting a framework marketplace is readable", () => {
  it("passes a remote source with a token and never asks the visibility", async () => {
    const visibility = visibilityOf(false);

    await new AssertMarketplaceReadable(withToken, visibility).execute(remote);

    expect(visibility.isRepoPublic).not.toHaveBeenCalled();
  });

  it("passes a public remote source without a token", async () => {
    const visibility = visibilityOf(true);

    await new AssertMarketplaceReadable(withoutToken, visibility).execute(remote);

    expect(visibility.isRepoPublic).toHaveBeenCalledWith("owner/repo");
  });

  it("refuses a private remote source without a token, naming its url", async () => {
    const refusal = new AssertMarketplaceReadable(withoutToken, visibilityOf(false)).execute(
      remote
    );

    await expect(refusal).rejects.toEqual(
      new CatalogFetchAuthError("https://github.com/owner/repo")
    );
  });

  it("asks nothing of a local source", async () => {
    const visibility = visibilityOf(false);

    await new AssertMarketplaceReadable(withoutToken, visibility).execute(
      localFrameworkSource("/framework")
    );

    expect(visibility.isRepoPublic).not.toHaveBeenCalled();
  });
});
