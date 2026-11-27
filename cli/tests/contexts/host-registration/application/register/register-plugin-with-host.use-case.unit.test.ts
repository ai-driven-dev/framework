import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { hostPortsOver } from "../../../../../src/contexts/host-registration/application/host-ports-over.js";
import { RegisterPluginWithHost } from "../../../../../src/contexts/host-registration/application/register/register-plugin-with-host.use-case.js";
import { ResolveNativeHost } from "../../../../../src/contexts/host-registration/application/register/resolve-native-host.use-case.js";
import type { ClaimsView } from "../../../../../src/contexts/host-registration/contract/claims-view.js";
import type { HostMarketplaceRegistryReading } from "../../../../../src/contexts/host-registration/domain/reading/marketplace-registry-reading.js";
import type { HostPluginRegistryReading } from "../../../../../src/contexts/host-registration/domain/reading/plugin-registry-reading.js";
import type { NativeMarketplaceSource } from "../../../../../src/contexts/host-registration/domain/record/native-marketplace-source.js";
import type { AiToolId, ToolId } from "../../../../../src/shared/domain/tool.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.fake.js";
import { catalogReadersOver } from "../../../../shared/testing/catalog-readers.builder.js";
import { FakeHostActions } from "../../../../shared/testing/fake-host-actions.fake.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { FakeHostMarketplaceRegistry } from "../../testing/fake-host-marketplace-registry.fake.js";
import { FakeHostMarketplaceSources } from "../../testing/fake-host-marketplace-sources.fake.js";
import { FakeHostPluginRegistry } from "../../testing/fake-host-plugin-registry.fake.js";
import {
  codexBuild,
  codexCatalogAt,
  enabled,
  listedAt,
  USER_CACHE_ROOT,
} from "../../testing/registration-run.builder.js";

const PLATFORM = "linux";
const DIR = "/built/aidd";
const CATALOG = join(DIR, ".claude-plugin", "marketplace.json");
const NONE: ClaimsView = {
  recorded: undefined,
  machine: async () => undefined,
  machineKept: false,
  persistedProject: async () => undefined,
};
const OWN: NativeMarketplaceSource = { kind: "registry", source: DIR };

function setup(
  options: {
    activator?: FakeHostActions;
    sources?: Map<string, NativeMarketplaceSource | null> | "absent";
    registry?: HostMarketplaceRegistryReading;
    plugins?: HostPluginRegistryReading;
    claims?: Partial<ClaimsView>;
    refs?: string[];
    build?: null | string;
    tool?: AiToolId;
    files?: Record<string, string>;
    userCacheRoot?: string;
  } = {}
) {
  const tool = options.tool ?? TOOL.claude;
  const activator = options.activator ?? new FakeHostActions({ available: true });
  const logger = new CapturingLogger();
  const warnings: string[] = [];
  const fs = new InMemoryFileAdapter({
    [CATALOG]: JSON.stringify({ name: "aidd", plugins: [] }),
    ...options.files,
  });
  const command = new RegisterPluginWithHost({
    fs,
    catalogs: catalogReadersOver(fs),
    nativeHosts: new ResolveNativeHost(
      hostPortsOver({
        activators: new Map([[tool, activator]]),
        marketplaceRegistries: new Map([
          [
            tool,
            new FakeHostMarketplaceRegistry(
              options.registry ?? { location: "r", entries: new Map() }
            ),
          ],
        ]),
        pluginRegistries: new Map([
          [tool, new FakeHostPluginRegistry(options.plugins ?? { location: "p", refs: new Map() })],
        ]),
        sources:
          options.sources === "absent"
            ? new Map()
            : new Map([
                [
                  tool,
                  new FakeHostMarketplaceSources(
                    activator,
                    tool === TOOL.claude ? "registry" : "effective-list",
                    () => "aidd",
                    options.sources ?? new Map()
                  ),
                ],
              ]),
      }),
      registeredTools()
    ),
    platform: PLATFORM,
  });
  const run = (toolId: ToolId = tool) =>
    command.execute({
      toolId,
      projectRoot: "/p",
      scope: "project",
      marketplaces: [{ name: "aidd", scope: "project" }],
      claims: { ...NONE, ...options.claims },
      build: async () => (options.build === undefined ? DIR : options.build),
      refsToEnable: (known) => (known.has("aidd") ? (options.refs ?? []) : []),
      userCacheRoot: () => options.userCacheRoot ?? "",
      sink: { logger, warnings },
    });
  return { activator, logger, warnings, run };
}

const EARLIER = { alias: "aidd", hostName: "aidd", provenance: OWN };
const CLAIMED = { marketplaces: [EARLIER], claimedRefs: [] };
const REF = "p@aidd";
const RECORD = { marketplaces: [], pluginRefs: [REF], binary: "claude" };

describe("register plugin with host", () => {
  it.each([TOOL.vscode, TOOL.cursor])(
    "is unconfigured for %s, which has no native CLI",
    async (toolId) => {
      expect(await setup().run(toolId)).toEqual({ status: "unconfigured" });
    }
  );

  it("is unconfigured when no activator serves the binary", async () => {
    const fs = new InMemoryFileAdapter();
    const command = new RegisterPluginWithHost({
      fs,
      catalogs: catalogReadersOver(fs),
      nativeHosts: new ResolveNativeHost(
        hostPortsOver({
          activators: new Map(),
          marketplaceRegistries: new Map(),
          pluginRegistries: new Map(),
          sources: new Map(),
        }),
        registeredTools()
      ),
      platform: PLATFORM,
    });
    const result = await command.execute({
      toolId: TOOL.claude,
      projectRoot: "/p",
      scope: "project",
      marketplaces: [],
      claims: NONE,
      build: async () => null,
      refsToEnable: () => [],
      userCacheRoot: () => "",
      sink: { logger: new CapturingLogger(), warnings: [] },
    });
    expect(result).toEqual({ status: "unconfigured" });
  });

  it("registers a marketplace the host proves it took, and records where it came from", async () => {
    const { activator, run } = setup();
    expect(await run()).toEqual({
      status: "activated",
      outcome: {
        marketplaces: [{ alias: "aidd", hostName: "aidd", provenance: OWN }],
        preservedMarketplaces: [],
        catalogClaims: [{ alias: "aidd", hostName: "aidd", provenance: OWN }],
        pluginRefs: [],
        buildFailed: false,
      },
    });
    expect(activator.addedMarketplaces).toEqual([DIR]);
    expect(activator.upgradeCount).toBe(0);
  });

  it("upgrades a marketplace it already holds and enables the refs it is asked for", async () => {
    const { activator, run } = setup({
      sources: new Map([["aidd", OWN]]),
      claims: { machine: async () => CLAIMED },
      refs: [REF],
    });
    const result = await run();
    expect(activator.addedMarketplaces).toEqual([]);
    expect(activator.upgradeCount).toBe(1);
    expect(activator.enabledPlugins).toEqual([REF]);
    expect(result).toMatchObject({
      outcome: { pluginRefs: [REF], catalogClaims: [{ provenance: OWN }] },
    });
  });

  it.each([
    [
      "it cannot prove the host source",
      { sources: "absent" as const },
      "claude: catalogue 'aidd' host source unproven (Catalogue 'aidd': host source reader unavailable; reconcile manually.); registration left untouched.",
    ],
    [
      "the name is held without a claim",
      { registry: { location: "r", entries: new Map([["aidd", "/elsewhere"]]) } },
      "claude: catalogue 'aidd' is already registered on the host without a canonical AIDD claim; same-name collision left untouched.",
    ],
    [
      "the host registry is unreadable",
      { registry: { location: "r" } },
      "claude: catalogue 'aidd' host registry is unreadable; ownership unproven and registration left untouched.",
    ],
    [
      "the plugin registry is unreadable",
      { plugins: { location: "p" } },
      "claude: catalogue 'aidd' collides with unreadable host plugin registry (p); registration left untouched.",
    ],
    [
      "a foreign ref sits on the name",
      { plugins: enabled("x@aidd") },
      "claude: catalogue 'aidd' carries foreign host ref 'x@aidd'; registration left untouched.",
    ],
  ])("refuses to register when %s", async (_case, options, warning) => {
    const { activator, warnings, run } = setup(options);
    expect(await run()).toMatchObject({ outcome: { marketplaces: [], catalogClaims: [] } });
    expect(activator.addedMarketplaces).toEqual([]);
    expect(warnings).toEqual([warning]);
  });

  it.each([
    ["claims it again when the host still proves it", new Map([["aidd", OWN]]), "marketplaces"],
    [
      "preserves its record when the host no longer proves it",
      new Map([["aidd", { kind: "registry" as const, source: "/elsewhere" }]]),
      "preservedMarketplaces",
    ],
  ])("when this build fails, %s", async (_case, sources, key) => {
    const recorded = {
      marketplaces: [EARLIER],
      pluginRefs: [],
      binary: "claude",
    };
    const { run } = setup({
      sources,
      claims: { recorded, machine: async () => CLAIMED },
      build: null,
    });
    expect(await run()).toMatchObject({ outcome: { buildFailed: true, [key]: [EARLIER] } });
  });

  it("warns about a plugin the host refuses", async () => {
    const { warnings, run } = setup({
      activator: new FakeHostActions({ available: true, failOnPlugins: [REF] }),
      refs: [REF],
    });
    expect(await run()).toMatchObject({ outcome: { pluginRefs: [] } });
    expect(warnings).toEqual([
      "Native plugin activation \u2014 enable plugin 'p@aidd' skipped: plugin `p@aidd` was not found in marketplace",
    ]);
  });

  it("moves codex off an older build that holds a plugin no project claims, and enables the refs it is asked for", async () => {
    const older = listedAt(codexBuild("1.0.0"));
    const { activator, warnings, run } = setup({
      tool: TOOL.codex,
      activator: new FakeHostActions({
        available: true,
        conflictOnAdd: true,
        installed: ["hand@aidd"],
      }),
      sources: new Map([["aidd", older]]),
      plugins: enabled("hand@aidd"),
      claims: {
        machine: async () => ({
          marketplaces: [{ alias: "aidd", hostName: "aidd", provenance: older }],
          claimedRefs: [],
        }),
      },
      files: codexCatalogAt(codexBuild("2.0.0")),
      userCacheRoot: USER_CACHE_ROOT,
      build: codexBuild("2.0.0"),
      refs: [REF],
    });
    await run();
    expect(warnings).toEqual([]);
    expect(activator.enabledPlugins).toEqual(["hand@aidd", REF]);
  });

  describe("a ref the host already lists enabled", () => {
    const host = { sources: new Map([["aidd", OWN]]), plugins: enabled(REF), refs: [REF] };

    it.each([
      ["machine claim", { machine: async () => ({ ...CLAIMED, claimedRefs: [REF] }) }],
      [
        "own record",
        {
          recorded: RECORD,
          persistedProject: async () => RECORD,
          machine: async () => CLAIMED,
        },
      ],
    ])(
      "counts as this project's through its %s, without enabling it again",
      async (_case, claims) => {
        const { activator, run } = setup({ ...host, claims });
        expect(await run()).toMatchObject({ outcome: { pluginRefs: [REF] } });
        expect(activator.enabledPlugins).toEqual([]);
      }
    );

    it("is left as it is, and said so, when this project never asked for it", async () => {
      const { activator, logger, run } = setup({
        ...host,
        plugins: enabled("q@other"),
        refs: ["q@other"],
        claims: { machine: async () => CLAIMED },
      });
      expect(await run()).toMatchObject({ outcome: { pluginRefs: [] } });
      expect(activator.enabledPlugins).toEqual([]);
      expect(logger.infoMessages).toEqual([
        "claude: 'q@other' was already enabled before this project asked for it \u2014 left as it is, and this project's clean will leave it enabled.",
      ]);
    });
  });
});
