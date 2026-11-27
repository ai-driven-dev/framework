import { describe, expect, it } from "vitest";
import {
  registerMarketplace,
  registrationOf,
} from "../../../../../../src/contexts/host-registration/application/register/marketplace/register-marketplace.js";
import { UnreadableBuiltCatalogError } from "../../../../../../src/contexts/host-registration/contract/host-registration.error.js";
import type { NativeMarketplaceSource } from "../../../../../../src/contexts/host-registration/domain/record/native-marketplace-source.js";
import {
  builtMarketplaceDir,
  userBuiltMarketplaceDir,
} from "../../../../../../src/shared/domain/layout/aidd-layout.js";
import { FakeHostActions } from "../../../../../shared/testing/fake-host-actions.fake.js";
import { TOOL } from "../../../../../shared/testing/registered-tools.builder.js";
import { catalogAt, DIR, enabled, OWN, setup } from "../../../testing/registration-run.builder.js";

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

describe("registering on a host that refuses a re-add from another source", () => {
  const NAME = "aidd";
  const USER_ROOT = "/home/.config/aidd";
  const build = (cliVersion: string) =>
    userBuiltMarketplaceDir({
      userConfigDir: USER_ROOT,
      cliVersion,
      marketplaceName: NAME,
      target: TOOL.codex,
    });
  const listed = (dir: string): NativeMarketplaceSource => ({
    kind: "effective-list",
    root: dir,
    sourceType: "local",
    source: dir,
  });
  const thisBuild = build("2.0.0");
  const codexTarget = {
    marketplace: { name: NAME, scope: "user" as const },
    builtDir: thisBuild,
    catalogClaims: [],
  };

  function codexHoldingRecorded(
    registered: string,
    {
      installed = [],
      host = (options) => new FakeHostActions(options),
      plugins,
    }: {
      readonly installed?: readonly string[] | "unlistable";
      readonly host?: (
        options: ConstructorParameters<typeof FakeHostActions>[0]
      ) => FakeHostActions;
      readonly plugins?: ReturnType<typeof enabled>;
    } = {}
  ) {
    return setup({
      tool: TOOL.codex,
      activator: host({ available: true, conflictOnAdd: true, installed }),
      ...(plugins === undefined ? {} : { plugins }),
      userCacheRoot: USER_ROOT,
      sources: new Map([[NAME, listed(registered)]]),
      claims: {
        machine: async () => ({
          marketplaces: [{ alias: NAME, hostName: NAME, provenance: listed(registered) }],
          claimedRefs: [],
        }),
      },
      files: {
        [`${thisBuild}/.agents/plugins/marketplace.json`]: JSON.stringify({
          name: NAME,
          plugins: [],
        }),
      },
    });
  }

  it("moves the registration this CLI recorded on an older build to this one, without a word", async () => {
    const { run, activator, warnings } = codexHoldingRecorded(build("1.0.0"));
    const claim = await registerMarketplace(run, codexTarget);
    expect(warnings).toEqual([]);
    expect(claim).toEqual({
      hostName: NAME,
      provenance: listed(thisBuild),
      addedThisRun: true,
    });
    expect(activator.removedMarketplaces).toEqual([NAME]);
    expect(activator.forcedRemovals).toEqual([true]);
    expect(activator.addedMarketplaces).toEqual([thisBuild]);
  });

  it("puts back on this build every plugin the host listed from it before the move", async () => {
    const order: string[] = [];
    class OrderedHost extends FakeHostActions {
      override removeMarketplace(...args: Parameters<FakeHostActions["removeMarketplace"]>) {
        order.push("remove");
        return super.removeMarketplace(...args);
      }
      override addMarketplace(...args: Parameters<FakeHostActions["addMarketplace"]>) {
        order.push("add");
        return super.addMarketplace(...args);
      }
      override enablePlugin(...args: Parameters<FakeHostActions["enablePlugin"]>) {
        order.push(`enable ${args[0]}`);
        return super.enablePlugin(...args);
      }
    }
    const { run } = codexHoldingRecorded(build("1.0.0"), {
      installed: ["demo@aidd", "extra@aidd"],
      host: (options) => new OrderedHost(options),
    });
    await registerMarketplace(run, codexTarget);
    expect(order).toEqual(["remove", "add", "enable demo@aidd", "enable extra@aidd"]);
  });

  it("never moves a registration whose installed plugins the host cannot list", async () => {
    const { run, activator, warnings } = codexHoldingRecorded(build("1.0.0"), {
      installed: "unlistable",
    });
    expect(await registerMarketplace(run, codexTarget)).toBeUndefined();
    expect(activator.removedMarketplaces).toEqual([]);
    expect(warnings).toEqual([
      `Native plugin activation — marketplace '${NAME}' not moved to this build: the plugins installed from it could not be listed.`,
    ]);
  });

  it("never moves an older build that holds a plugin no project claims, and says why", async () => {
    const { run, activator, warnings } = codexHoldingRecorded(build("1.0.0"), {
      installed: ["hand@aidd"],
      plugins: enabled("hand@aidd"),
    });
    expect(await registerMarketplace(run, codexTarget)).toBeUndefined();
    expect(activator.removedMarketplaces).toEqual([]);
    expect(warnings).toEqual([
      `codex: catalogue '${NAME}' carries foreign host ref 'hand@aidd'; registration left untouched.`,
    ]);
  });

  it("leaves a registration on a newer build in place, warns, and counts it as registered", async () => {
    const newer = build("3.0.0");
    const { run, activator, warnings } = codexHoldingRecorded(newer);
    const claim = await registerMarketplace(run, codexTarget);
    expect(activator.removedMarketplaces).toEqual([]);
    expect(activator.addedMarketplaces).toEqual([]);
    expect(claim).toEqual({ hostName: NAME, provenance: listed(newer) });
    expect(warnings).toEqual([
      {
        text: `codex's marketplace '${NAME}' (${newer}) already carries a newer aidd-framework build, 3.0.0, than this run's own 2.0.0 — not registering this run's build over it.`,
        hint: "update-cli",
      },
    ]);
  });

  it("never moves an older build of another marketplace", async () => {
    const other = userBuiltMarketplaceDir({
      userConfigDir: USER_ROOT,
      cliVersion: "1.0.0",
      marketplaceName: "other",
      target: TOOL.codex,
    });
    const { run, activator } = codexHoldingRecorded(other);
    await registerMarketplace(run, codexTarget);
    expect(activator.removedMarketplaces).toEqual([]);
  });

  it("never moves a registration whose path names no build version", async () => {
    const { run, activator } = codexHoldingRecorded(builtMarketplaceDir("/p", NAME, TOOL.codex));
    await registerMarketplace(run, codexTarget);
    expect(activator.removedMarketplaces).toEqual([]);
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
