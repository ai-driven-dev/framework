import { describe, expect, it } from "vitest";
import {
  registerMarketplace,
  registrationOf,
} from "../../../../../../src/contexts/host-registration/application/register/marketplace/register-marketplace.js";
import { UnreadableBuiltCatalogError } from "../../../../../../src/contexts/host-registration/contract/host-registration.error.js";
import { catalogAt, DIR, OWN, setup } from "../../../testing/registration-run.builder.js";

const target = {
  marketplace: { name: "aidd", scope: "project" as const },
  builtDir: DIR,
  catalogClaims: [],
};

describe("registering a marketplace on a host", () => {
  it("adds the catalogue and claims it under the host's own name once the host follows it", async () => {
    const { run, activator } = setup({ files: catalogAt(DIR, []) });
    expect(await registerMarketplace(run, target)).toEqual({
      hostName: "aidd",
      provenance: OWN,
      addedThisRun: true,
    });
    expect(activator.addedMarketplaces).toEqual([DIR]);
  });

  it("refuses a built catalogue it cannot read back", async () => {
    const { run } = setup();
    await expect(registerMarketplace(run, target)).rejects.toThrow(UnreadableBuiltCatalogError);
  });
});

describe("recording a registration", () => {
  it("carries the provenance only when there is one", () => {
    expect(registrationOf("a", { hostName: "h", provenance: undefined })).toEqual({
      alias: "a",
      hostName: "h",
    });
    expect(registrationOf("a", { hostName: "h", provenance: OWN })).toEqual({
      alias: "a",
      hostName: "h",
      provenance: OWN,
    });
  });
});
