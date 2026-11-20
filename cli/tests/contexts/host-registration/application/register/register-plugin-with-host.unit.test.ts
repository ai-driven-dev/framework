import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RegisterPluginWithHost } from "../../../../../src/contexts/host-registration/application/register/register-plugin-with-host.js";
import type { ClaimsView } from "../../../../../src/contexts/host-registration/contract/claims-view.js";
import type { HostMarketplaceRegistryReading } from "../../../../../src/contexts/host-registration/domain/reading/marketplace-registry-reading.js";
import type { HostPluginRegistryReading } from "../../../../../src/contexts/host-registration/domain/reading/plugin-registry-reading.js";
import type { NativeMarketplaceSource } from "../../../../../src/contexts/host-registration/domain/record/native-marketplace-source.js";
import type { ToolId } from "../../../../../src/shared/domain/tool.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.fake.js";
import { FakeHostActions } from "../../../../shared/testing/fake-host-actions.fake.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { registeredTools, TOOL } from "../../../../shared/testing/registered-tools.builder.js";
import { FakeHostMarketplaceRegistry } from "../../testing/fake-host-marketplace-registry.js";
import { FakeHostMarketplaceSources } from "../../testing/fake-host-marketplace-sources.js";
import { FakeHostPluginRegistry } from "../../testing/fake-host-plugin-registry.js";

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
    build?: null;
  } = {}
) {
  const activator = options.activator ?? new FakeHostActions({ available: true });
  const logger = new CapturingLogger();
  const warnings: string[] = [];
  const command = new RegisterPluginWithHost(
    new InMemoryFileAdapter({ [CATALOG]: JSON.stringify({ name: "aidd", plugins: [] }) }),
    new Map([["claude", activator]]),
    {
      marketplaceRegistries: new Map([
        [
          TOOL.claude,
          new FakeHostMarketplaceRegistry(
            options.registry ?? { location: "r", entries: new Map() }
          ),
        ],
      ]),
      pluginRegistries: new Map([
        [
          TOOL.claude,
          new FakeHostPluginRegistry(options.plugins ?? { location: "p", refs: new Map() }),
        ],
      ]),
      sources:
        options.sources === "absent"
          ? new Map()
          : new Map([
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
    },
    PLATFORM,
    registeredTools()
  );
  const run = (toolId: ToolId = TOOL.claude) =>
    command.execute({
      toolId,
      projectRoot: "/p",
      scope: "project",
      marketplaces: [{ name: "aidd", scope: "project" }],
      claims: { ...NONE, ...options.claims },
      build: async () => (options.build === null ? null : DIR),
      refsToEnable: (known) => (known.has("aidd") ? (options.refs ?? []) : []),
      userCacheRoot: () => "",
      sink: { logger, warnings },
    });
  return { activator, logger, warnings, run };
}

const EARLIER = { alias: "aidd", hostName: "aidd", provenance: OWN };
const CLAIMED = { marketplaces: [EARLIER] };
const REF = "p@aidd";
const RECORD = { marketplaces: [], pluginRefs: [REF], pluginClaims: [], binary: "claude" };
const enabled = (...refs: string[]) => ({
  location: "p",
  refs: new Map(refs.map((ref) => [ref, { enabled: true }])),
});

describe("register plugin with host", () => {
  it.each([TOOL.vscode, TOOL.cursor])(
    "is unconfigured for %s, which has no native CLI",
    async (toolId) => {
      expect(await setup().run(toolId)).toEqual({ status: "unconfigured" });
    }
  );

  it("is unconfigured when no activator serves the binary", async () => {
    const command = new RegisterPluginWithHost(
      new InMemoryFileAdapter(),
      new Map(),
      { marketplaceRegistries: new Map(), pluginRegistries: new Map(), sources: new Map() },
      PLATFORM,
      registeredTools()
    );
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
      pluginClaims: [],
      binary: "claude",
    };
    const { run } = setup({
      sources,
      claims: { recorded, machine: async () => CLAIMED },
      build: null,
    });
    expect(await run()).toMatchObject({ outcome: { buildFailed: true, [key]: [EARLIER] } });
  });

  it.each([
    [
      "enables nothing when the host takes no plugin",
      { activator: new FakeHostActions({ available: true, enablesPlugins: false }) },
      [],
    ],
    [
      "warns about a plugin the host refuses",
      { activator: new FakeHostActions({ available: true, failOnPlugins: [REF] }) },
      [
        "Native plugin activation \u2014 enable plugin 'p@aidd' skipped: plugin `p@aidd` was not found in marketplace",
      ],
    ],
  ])("%s", async (_case, options, expectedWarnings) => {
    const { warnings, run } = setup({ ...options, refs: [REF] });
    expect(await run()).toMatchObject({ outcome: { pluginRefs: [] } });
    expect(warnings).toEqual(expectedWarnings);
  });

  describe("a ref the host already lists enabled", () => {
    const host = { sources: new Map([["aidd", OWN]]), plugins: enabled(REF), refs: [REF] };

    it.each([
      ["machine claim", { machine: async () => ({ ...CLAIMED, pluginClaims: [{ ref: REF }] }) }],
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
