import { describe, expect, it } from "vitest";
import {
  guardAgainstConflict,
  nativeCatalogProof,
  proveAddedSource,
  type RegistrationRun,
  warnRegistration,
} from "../../../../../src/contexts/host-registration/application/register/catalog-source-guard.js";
import type { ClaimsView } from "../../../../../src/contexts/host-registration/contract/claims-view.js";
import { MarketplaceSourceConflictError } from "../../../../../src/contexts/host-registration/domain/host-registration.error.js";
import type { HostMarketplaceRegistryReading } from "../../../../../src/contexts/host-registration/domain/reading/marketplace-registry-reading.js";
import type { HostPluginRegistryReading } from "../../../../../src/contexts/host-registration/domain/reading/plugin-registry-reading.js";
import type { NativeMarketplaceSource } from "../../../../../src/contexts/host-registration/domain/record/native-marketplace-source.js";
import { userBuiltMarketplaceDir } from "../../../../../src/shared/domain/layout/aidd-layout.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.fake.js";
import { FakeHostActions } from "../../../../shared/testing/fake-host-actions.fake.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { FakeHostMarketplaceRegistry } from "../../testing/fake-host-marketplace-registry.fake.js";
import { FakeHostMarketplaceSources } from "../../testing/fake-host-marketplace-sources.fake.js";
import { FakeHostPluginRegistry } from "../../testing/fake-host-plugin-registry.fake.js";

const DIR = "/built/aidd";
const OWN: NativeMarketplaceSource = { kind: "registry", source: DIR };
const NONE: ClaimsView = {
  recorded: undefined,
  machine: async () => undefined,
  machineKept: false,
  persistedProject: async () => undefined,
};
const catalogAt = (dir: string, plugins: string[]) => ({
  [`${dir}/.claude-plugin/marketplace.json`]: JSON.stringify({
    name: "aidd",
    plugins: plugins.map((name) => ({ name })),
  }),
});
const enabled = (...refs: string[]) => ({
  location: "p",
  refs: new Map(refs.map((ref) => [ref, { enabled: true }])),
});

function setup(
  options: {
    sources?: Map<string, NativeMarketplaceSource | null>;
    registry?: HostMarketplaceRegistryReading;
    plugins?: HostPluginRegistryReading;
    claims?: Partial<ClaimsView>;
    files?: Record<string, string>;
    userCacheRoot?: string;
  } = {}
) {
  const activator = new FakeHostActions({ available: true });
  const logger = new CapturingLogger();
  const warnings: string[] = [];
  const hosts = {
    marketplaceRegistries: new Map([
      [
        TOOL.claude,
        new FakeHostMarketplaceRegistry(options.registry ?? { location: "r", entries: new Map() }),
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
          options.sources ?? new Map()
        ),
      ],
    ]),
  };
  const profile = registeredTools().aiProfileIfAny(TOOL.claude);
  if (profile === null) throw new Error("claude is an AI tool");
  const run: RegistrationRun = {
    toolId: TOOL.claude,
    profile,
    activator,
    fs: new InMemoryFileAdapter(options.files ?? {}),
    hosts,
    projectRoot: "/p",
    claims: { ...NONE, ...options.claims },
    userCacheRoot: () => options.userCacheRoot ?? "",
    platform: "linux",
    logger,
    warnings,
  };
  return { run, logger, warnings };
}

describe("nativeCatalogProof", () => {
  it("is canonical and owned for a registration made this run, with no foreign ref", async () => {
    const { run } = setup({ sources: new Map([["aidd", OWN]]) });
    expect(
      await nativeCatalogProof(run, "aidd", { alias: "aidd", hostName: "aidd", provenance: OWN })
    ).toEqual({
      canonical: true,
      sourceStatus: "owned",
      source: OWN,
      hostReadable: true,
    });
  });

  it("is not canonical when neither this run nor any record holds the name", async () => {
    const { run } = setup();
    expect(await nativeCatalogProof(run, "aidd")).toMatchObject({
      canonical: false,
      sourceStatus: "absent",
    });
  });

  it("is canonical through a machine record of the name", async () => {
    const { run } = setup({
      claims: { machine: async () => ({ marketplaces: [{ alias: "aidd", hostName: "aidd" }] }) },
    });
    expect(await nativeCatalogProof(run, "aidd")).toMatchObject({ canonical: true });
  });

  it("names a ref enabled on the host under the name that no claim covers", async () => {
    const { run } = setup({ plugins: enabled("x@aidd") });
    expect(await nativeCatalogProof(run, "aidd")).toMatchObject({
      hostReadable: true,
      foreignRef: "x@aidd",
    });
  });

  it("does not name a ref the machine already claims", async () => {
    const { run } = setup({
      plugins: enabled("x@aidd"),
      claims: { machine: async () => ({ marketplaces: [], pluginClaims: [{ ref: "x@aidd" }] }) },
    });
    expect(await nativeCatalogProof(run, "aidd")).not.toHaveProperty("foreignRef");
  });

  it("reports where an unreadable plugin registry is, and is not host readable", async () => {
    const { run } = setup({ plugins: { location: "p" } });
    expect(await nativeCatalogProof(run, "aidd")).toMatchObject({
      hostReadable: false,
      unreadable: "p",
    });
  });

  it("is readable and clear when the plugin registry is absent", async () => {
    const { run } = setup({ plugins: { location: "p", absent: true } });
    expect(await nativeCatalogProof(run, "aidd")).toMatchObject({ hostReadable: true });
  });
});

describe("proveAddedSource", () => {
  it("returns the source the host now follows when it is the built directory", async () => {
    const { run, warnings } = setup({ sources: new Map([["aidd", OWN]]) });
    expect(await proveAddedSource(run, "aidd", DIR)).toEqual(OWN);
    expect(warnings).toEqual([]);
  });

  it("warns and returns nothing when the host follows another directory", async () => {
    const { run, warnings } = setup({
      sources: new Map([["aidd", { kind: "registry" as const, source: "/elsewhere" }]]),
    });
    expect(await proveAddedSource(run, "aidd", DIR)).toBeUndefined();
    expect(warnings).toEqual([
      "claude: catalogue 'aidd' add returned but effective host source could not be proven as '/built/aidd'; no AIDD claim or enablement recorded. Reconcile manually.",
    ]);
  });
});

describe("guardAgainstConflict", () => {
  const requested = { name: "aidd", pluginNames: ["a"] };
  const subject = { name: "aidd", scope: "project" as const };

  it("proceeds when the host registry holds nothing under the name", async () => {
    const { run } = setup();
    expect(
      await guardAgainstConflict(run, { builtDir: DIR, identity: requested, marketplace: subject })
    ).toBeUndefined();
  });

  it("proceeds when the registered catalog is the same one reached through another path", async () => {
    const { run } = setup({
      registry: { location: "r", entries: new Map([["aidd", "/other"]]) },
      files: catalogAt("/other", ["a"]),
    });
    expect(
      await guardAgainstConflict(run, { builtDir: DIR, identity: requested, marketplace: subject })
    ).toBeUndefined();
  });

  it("refuses a name the host holds for a different catalog, naming both sources", async () => {
    const { run } = setup({
      registry: { location: "r", entries: new Map([["aidd", "/other"]]) },
      files: catalogAt("/other", ["b"]),
    });
    const refusal = guardAgainstConflict(run, {
      builtDir: DIR,
      identity: requested,
      marketplace: subject,
    });
    await expect(refusal).rejects.toBeInstanceOf(MarketplaceSourceConflictError);
    await expect(refusal).rejects.toThrow(
      "Marketplace 'aidd' is already registered from a different catalog: /other differs from the one requested, /built/aidd"
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
    const decision = await guardAgainstConflict(run, {
      builtDir: built,
      identity: { name: "aidd-framework", pluginNames: [] },
      marketplace: { name: "aidd-framework", scope: "user" },
    });
    expect(decision).toBe("skip");
    expect(warnings).toEqual([
      "claude's marketplace registry (r) already carries a newer aidd-framework build, 2.0.0, than this run's own 1.0.0 — not registering this run's build over it. Run `aidd update` to bring this project's CLI to at least the version the host already follows.",
    ]);
  });
});

describe("warnRegistration", () => {
  it("logs the warning and keeps it, in order, for the caller's result", () => {
    const { run, logger, warnings } = setup();
    warnRegistration(run, "one");
    warnRegistration(run, "two");
    expect(logger.warnMessages).toEqual(["one", "two"]);
    expect(warnings).toEqual(["one", "two"]);
  });
});
