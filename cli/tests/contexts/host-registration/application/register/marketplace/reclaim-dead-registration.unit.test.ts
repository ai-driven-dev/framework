import { describe, expect, it } from "vitest";
import { reclaimOrReport } from "../../../../../../src/contexts/host-registration/application/register/marketplace/reclaim-dead-registration.js";
import type { RegistrationRun } from "../../../../../../src/contexts/host-registration/application/register/registration-run.js";
import type { ClaimsView } from "../../../../../../src/contexts/host-registration/contract/claims-view.js";
import type { HostPluginRegistryReading } from "../../../../../../src/contexts/host-registration/domain/reading/plugin-registry-reading.js";
import type { NativeMarketplaceSource } from "../../../../../../src/contexts/host-registration/domain/record/native-marketplace-source.js";
import {
  builtMarketplaceDir,
  userBuiltMarketplaceDir,
} from "../../../../../../src/shared/domain/layout/aidd-layout.js";
import { CapturingLogger } from "../../../../../shared/testing/capturing-logger.fake.js";
import { catalogReadersOver } from "../../../../../shared/testing/catalog-readers.builder.js";
import { FakeHostActions } from "../../../../../shared/testing/fake-host-actions.fake.js";
import { InMemoryFileAdapter } from "../../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../../shared/testing/registered-tools.builder.js";
import { FakeHostMarketplaceRegistry } from "../../../testing/fake-host-marketplace-registry.fake.js";
import { FakeHostMarketplaceSources } from "../../../testing/fake-host-marketplace-sources.fake.js";
import { FakeHostPluginRegistry } from "../../../testing/fake-host-plugin-registry.fake.js";

const DIR = "/built/aidd";
const OWN: NativeMarketplaceSource = { kind: "registry", source: DIR };
const PROJECT_BUILT = builtMarketplaceDir("/p", "aidd", "claude");
const USER_ROOT = "/home/.config/aidd";
const ADD_ERROR = { detail: "already added" };
const SUBJECT = { name: "aidd", scope: "project" as const };
const KNOWN: Partial<ClaimsView> = {
  machine: async () => ({
    marketplaces: [{ alias: "aidd", hostName: "aidd", provenance: OWN }],
    claimedRefs: [],
  }),
};

function setup(
  options: {
    activator?: FakeHostActions;
    registered?: string;
    plugins?: HostPluginRegistryReading;
    claims?: Partial<ClaimsView>;
  } = {}
) {
  const activator = options.activator ?? new FakeHostActions({ available: true });
  const warnings: string[] = [];
  const hosts = {
    marketplaceRegistries: new Map([
      [
        TOOL.claude,
        new FakeHostMarketplaceRegistry({
          location: "r",
          entries: new Map(options.registered === undefined ? [] : [["aidd", options.registered]]),
        }),
      ],
    ]),
    pluginRegistries: new Map([
      [
        TOOL.claude,
        new FakeHostPluginRegistry(options.plugins ?? { location: "p", refs: new Map() }),
      ],
    ]),
    sources: new Map([
      [
        TOOL.claude,
        new FakeHostMarketplaceSources(
          activator,
          "registry",
          () => "aidd",
          new Map([["aidd", OWN]])
        ),
      ],
    ]),
  };
  const profile = registeredTools().aiProfileIfAny(TOOL.claude);
  if (profile === null) throw new Error("claude is an AI tool");
  const fs = new InMemoryFileAdapter();
  const run: RegistrationRun = {
    toolId: TOOL.claude,
    profile,
    activator,
    fs,
    catalogs: catalogReadersOver(fs),
    hosts,
    projectRoot: "/p",
    claims: {
      recorded: undefined,
      machine: async () => undefined,
      machineKept: false,
      persistedProject: async () => undefined,
      ...options.claims,
    },
    userCacheRoot: () => USER_ROOT,
    platform: "linux",
    logger: new CapturingLogger(),
    warnings,
  };
  return { run, activator, warnings };
}

const reclaim = (parts: ReturnType<typeof setup>) =>
  reclaimOrReport(parts.run, { marketplace: SUBJECT, hostName: "aidd", builtDir: DIR }, ADD_ERROR);

describe("reclaiming or reporting a dead registration", () => {
  it("leaves the host alone, naming the foreign ref, when ownership is unproven", async () => {
    const parts = setup({
      claims: KNOWN,
      plugins: { location: "p", refs: new Map([["x@aidd", { enabled: true }]]) },
    });
    expect(await reclaim(parts)).toBe(false);
    expect(parts.warnings).toEqual([
      "Native plugin activation — catalogue 'aidd' collides with unproven AIDD ownership and foreign ref 'x@aidd'; host registration left untouched. already added",
    ]);
  });

  it("leaves the host alone, with no foreign ref to name, when no claim makes it canonical", async () => {
    const parts = setup();
    expect(await reclaim(parts)).toBe(false);
    expect(parts.warnings).toEqual([
      "Native plugin activation — catalogue 'aidd' collides with unproven AIDD ownership; host registration left untouched. already added",
    ]);
  });

  it("leaves a registration alone when its source is not one this CLI built", async () => {
    const parts = setup({ claims: KNOWN, registered: "/elsewhere/aidd/claude" });
    expect(await reclaim(parts)).toBe(false);
    expect(parts.warnings).toEqual([
      "Native plugin activation — catalogue 'aidd' host catalogue source is unproven; host registration left untouched. already added",
    ]);
  });

  it("leaves a registration alone when it is built for another marketplace name", async () => {
    const parts = setup({
      claims: KNOWN,
      registered: builtMarketplaceDir("/p", "other", "claude"),
    });
    expect(await reclaim(parts)).toBe(false);
    expect(parts.activator.removedMarketplaces).toEqual([]);
  });

  it("leaves a registration alone when it is built for another tool", async () => {
    const parts = setup({ claims: KNOWN, registered: builtMarketplaceDir("/p", "aidd", "codex") });
    expect(await reclaim(parts)).toBe(false);
    expect(parts.activator.removedMarketplaces).toEqual([]);
  });

  it("only reports when the host still answers for a source this CLI built", async () => {
    const parts = setup({
      claims: KNOWN,
      registered: PROJECT_BUILT,
      activator: new FakeHostActions({ available: true, registrationState: "live" }),
    });
    expect(await reclaim(parts)).toBe(false);
    expect(parts.activator.removedMarketplaces).toEqual([]);
    expect(parts.warnings).toEqual([
      "Native plugin activation — register marketplace 'aidd' skipped: already added",
    ]);
  });

  it.each([
    ["this project's own build", PROJECT_BUILT],
    [
      "the shared user build",
      userBuiltMarketplaceDir({
        userConfigDir: USER_ROOT,
        cliVersion: "1.0.0",
        marketplaceName: "aidd",
        target: "claude",
      }),
    ],
  ])("re-registers a dead registration of %s, forced out first", async (_case, registered) => {
    const parts = setup({
      claims: KNOWN,
      registered,
      activator: new FakeHostActions({ available: true, registrationState: "dead" }),
    });
    expect(await reclaim(parts)).toBe(true);
    expect(parts.activator.removedMarketplaces).toEqual(["aidd"]);
    expect(parts.activator.forcedRemovals).toEqual([true]);
    expect(parts.activator.addedMarketplaces).toEqual([DIR]);
    expect(parts.warnings).toEqual([
      "Marketplace 'aidd' was registered to a directory that no longer exists; re-registering it for this project. Plugins installed from it are removed and the ones this CLI manages are put back.",
    ]);
  });

  it("does not add again when the stale registration cannot be removed", async () => {
    const parts = setup({
      claims: KNOWN,
      registered: PROJECT_BUILT,
      activator: new FakeHostActions({
        available: true,
        registrationState: "dead",
        throwOnRemove: true,
      }),
    });
    expect(await reclaim(parts)).toBe(false);
    expect(parts.activator.addedMarketplaces).toEqual([]);
    expect(parts.warnings.at(-1)).toBe(
      "Native plugin activation — unregister stale marketplace 'aidd' skipped: marketplace remove aidd failed: 'aidd' is not configured or installed"
    );
  });
});
