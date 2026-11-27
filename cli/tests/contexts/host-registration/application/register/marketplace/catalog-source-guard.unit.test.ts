import { describe, expect, it } from "vitest";
import {
  type CatalogRequest,
  guardAgainstConflict,
} from "../../../../../../src/contexts/host-registration/application/register/marketplace/catalog-source-guard.js";
import type { NativeCatalogProof } from "../../../../../../src/contexts/host-registration/application/register/native-catalog-proof.js";
import type { RegistrationRun } from "../../../../../../src/contexts/host-registration/application/register/registration-run.js";
import { MarketplaceSourceConflictError } from "../../../../../../src/contexts/host-registration/contract/host-registration.error.js";
import { userBuiltMarketplaceDir } from "../../../../../../src/shared/domain/layout/aidd-layout.js";
import { catalogAt, DIR, setup } from "../../../testing/registration-run.builder.js";

const ABSENT: NativeCatalogProof = { canonical: false, hostReadable: true, sourceStatus: "absent" };
const guard = (run: RegistrationRun, request: CatalogRequest) =>
  guardAgainstConflict(run, request, ABSENT);

describe("guarding a catalog against a name conflict", () => {
  const requested = { name: "aidd", pluginNames: ["a"] };
  const subject = { name: "aidd", scope: "project" as const };

  it("proceeds when the host registry holds nothing under the name", async () => {
    const { run } = setup();
    expect(
      await guard(run, { builtDir: DIR, identity: requested, marketplace: subject })
    ).toBeUndefined();
  });

  it("proceeds when the registered catalog is the same one reached through another path", async () => {
    const { run } = setup({
      registry: { location: "r", entries: new Map([["aidd", "/other"]]) },
      files: catalogAt("/other", ["a"]),
    });
    expect(
      await guard(run, { builtDir: DIR, identity: requested, marketplace: subject })
    ).toBeUndefined();
  });

  it("refuses a name the host holds for a different catalog, naming both sources", async () => {
    const { run } = setup({
      registry: { location: "r", entries: new Map([["aidd", "/other"]]) },
      files: catalogAt("/other", ["b"]),
    });
    const refusal = guard(run, {
      builtDir: DIR,
      identity: requested,
      marketplace: subject,
    });
    await expect(refusal).rejects.toBeInstanceOf(MarketplaceSourceConflictError);
    await expect(refusal).rejects.toThrow(
      expect.objectContaining({
        detail: expect.stringContaining(
          "Marketplace 'aidd' is already registered from a different catalog: /other differs from the one requested, /built/aidd"
        ),
      })
    );
  });

  it("skips, with a warning, a host already following a newer shared build", async () => {
    const root = "/home/.config/aidd";
    const registered = userBuiltMarketplaceDir({
      userConfigDir: root,
      cliVersion: "2.0.0",
      marketplaceName: "aidd-framework",
      target: "claude",
    });
    const built = userBuiltMarketplaceDir({
      userConfigDir: root,
      cliVersion: "1.0.0",
      marketplaceName: "aidd-framework",
      target: "claude",
    });
    const { run, warnings } = setup({
      registry: { location: "r", entries: new Map([["aidd-framework", registered]]) },
      userCacheRoot: root,
    });
    const decision = await guard(run, {
      builtDir: built,
      identity: { name: "aidd-framework", pluginNames: [] },
      marketplace: { name: "aidd-framework", scope: "user" },
    });
    expect(decision).toBe("skip");
    expect(warnings).toEqual([
      {
        text: "claude's marketplace registry (r) already carries a newer aidd-framework build, 2.0.0, than this run's own 1.0.0 — not registering this run's build over it.",
        hint: "update-cli",
      },
    ]);
  });
});
