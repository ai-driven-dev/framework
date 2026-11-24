import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import { InspectDeclaredMarketplaces } from "../../../src/contexts/host-registration/application/inspect/inspect-declared-marketplaces.use-case.js";
import type { HostPluginRegistryReading } from "../../../src/contexts/host-registration/domain/reading/plugin-registry-reading.js";
import type { HostPluginRegistry } from "../../../src/contexts/host-registration/ports/host-plugin-registry.js";
import type { ToolRecords } from "../../../src/contexts/installation/contract/records/scope-records.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { RecordedPlugin } from "../../../src/contexts/installation/domain/plugins/recorded-plugin.js";
import { resolveHomeTemplate } from "../../../src/contexts/tools/contract/home-path.js";
import { CheckRegistration } from "../../../src/orchestration/doctor/check-registration.use-case.js";
import { BUILT_CACHE_SUBDIR } from "../../../src/shared/domain/layout/aidd-layout.js";
import type { AiToolId, ToolId } from "../../../src/shared/domain/tool.js";
import { FakeHostPluginRegistry } from "../../contexts/host-registration/testing/fake-host-plugin-registry.fake.js";
import { aManifest } from "../../contexts/installation/testing/manifest.builder.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import { hostInspector } from "../../shared/testing/host-inspector.builder.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import {
  SYNTHETIC_NATIVE_PLUGIN_REGISTRY,
  SYNTHETIC_NATIVE_TOOL,
  SYNTHETIC_UPDATING_NATIVE_TOOL,
  SYNTHETIC_USER_TOOL,
  syntheticNativeFamilyCatalog,
} from "../../shared/testing/synthetic-native-tool.builder.js";
import { SYNTHETIC_IDE_TOOL } from "../../shared/testing/synthetic-tool-id.builder.js";
import {
  buildCheckRegistration,
  checkRegistrationOver,
  resolveRegisteredBuildsOver,
} from "../testing/build-check-registration.builder.js";

const PROJECT_ROOT = "/project";
const LOCAL_SETTINGS = `${PROJECT_ROOT}/.${SYNTHETIC_NATIVE_TOOL}/settings.local.json`;
const UNDECLARED = {
  severity: "warning",
  message: `${SYNTHETIC_NATIVE_TOOL} no longer declares marketplace 'mine'`,
  fix: { code: "refresh-marketplace", file: `.${SYNTHETIC_NATIVE_TOOL}/settings.local.json` },
};

const STALE = {
  severity: "warning",
  message: `${SYNTHETIC_NATIVE_TOOL} still declares marketplace 'aidd-framework', which this project no longer registers`,
  fix: {
    code: "remove-stale-declaration",
    name: "aidd-framework",
    file: `.${SYNTHETIC_NATIVE_TOOL}/settings.local.json`,
  },
};

function settingsDeclaring(names: string[]): string {
  const entries = Object.fromEntries(names.map((name) => [name, { source: {} }]));
  return JSON.stringify({ extraKnownMarketplaces: entries });
}

async function issuesFor(
  settings: string | null,
  options: {
    toolId?: ToolId;
    toolInstalled?: boolean;
    allowedIds?: Set<string> | null;
    machine?: boolean;
    records?: ToolRecords;
    registered?: boolean;
  } = {}
) {
  const {
    toolId = SYNTHETIC_NATIVE_TOOL,
    toolInstalled = true,
    allowedIds = null,
    machine,
    records,
    registered = true,
  } = options;
  const fs = new InMemoryFileAdapter();
  if (settings !== null) await fs.writeFile(LOCAL_SETTINGS, settings);
  const registry = new InMemoryMarketplaceRegistry();
  if (registered)
    for (const [name, scope] of [
      ["mine", "project"],
      ["aidd-framework", "project"],
      ["shared", "user"],
    ] as const)
      await registry.save(
        PROJECT_ROOT,
        Marketplace.create({
          name,
          source: { kind: "local", path: "/src" },
          scope,
          addedAt: "2026-01-01T00:00:00Z",
        })
      );
  const manifest = Manifest.create();
  manifest.addTool(toolId, "test", []);
  const activators = new Map<string, FakeHostActions>([
    [SYNTHETIC_NATIVE_TOOL, new FakeHostActions({ available: toolInstalled })],
  ]);
  return buildCheckRegistration(
    fs,
    registry,
    (binary) => activators.get(binary)?.isAvailable() ?? false,
    hostInspector(syntheticNativeFamilyCatalog(), {
      fs: fs,
      pluginRegistries: new Map(),
      marketplaceRegistries: new Map(),
    }),
    () => "/user-cache",
    "1.0.0",
    syntheticNativeFamilyCatalog()
  ).execute({
    manifest,
    records,
    projectRoot: PROJECT_ROOT,
    allowedIds,
    globalInstall: machine,
  });
}

describe("checking registrations", () => {
  // The framework marketplace and a user-scope one are registered once for the machine, in the
  // host's own registry, so a project's settings never declare them.
  it("says nothing once the project declares its own marketplace, whatever the machine holds", async () => {
    expect(await issuesFor(settingsDeclaring(["mine"]))).toStrictEqual([]);
  });

  // The file names a marketplace by the host's own name, which the alias aidd knows it by may not be.
  it("compares the declaration with the host name the alias was registered under", async () => {
    const records: ToolRecords = new Map([
      [
        SYNTHETIC_NATIVE_TOOL,
        {
          binary: SYNTHETIC_NATIVE_TOOL,
          marketplaces: [{ alias: "mine", hostName: "named-by-host" }],
          pluginRefs: [],
        },
      ],
    ]);
    expect(await issuesFor(settingsDeclaring(["named-by-host"]), { records })).toStrictEqual([]);
  });

  it("accepts the array form of the declaration", async () => {
    const settings = JSON.stringify({ extraKnownMarketplaces: ["mine"] });
    expect(await issuesFor(settings)).toStrictEqual([]);
  });

  it("reports a declaration of this project's built cache that no registered marketplace owns", async () => {
    const settings = JSON.stringify({
      extraKnownMarketplaces: {
        "aidd-framework": {
          source: {
            source: "directory",
            path: join(PROJECT_ROOT, BUILT_CACHE_SUBDIR, "gone", "x"),
          },
        },
        "aidd-framework-2": { source: { source: "directory", path: "/mine/elsewhere" } },
      },
    });
    const stale = await issuesFor(settings, { registered: false });

    expect(stale).toStrictEqual([STALE]);
  });

  it("reports the marketplace the file no longer declares", async () => {
    expect(await issuesFor(settingsDeclaring([]))).toStrictEqual([UNDECLARED]);
  });

  it("asks no project to declare a machine-wide install, which writes nothing there", async () => {
    expect(await issuesFor(null, { machine: true })).toStrictEqual([]);
  });

  it("reports it when the whole file is gone - nothing else would notice", async () => {
    expect(await issuesFor(null)).toStrictEqual([UNDECLARED]);
  });

  it("reports it when the file carries no declarations key at all", async () => {
    expect(await issuesFor("{}")).toStrictEqual([UNDECLARED]);
  });

  it("reports it, without throwing, when the file holds a JSON null", async () => {
    await expect(issuesFor("null")).resolves.toStrictEqual([UNDECLARED]);
  });

  // The registration is written by the tool itself, so it cannot exist while the tool does not:
  // reporting it missing would be reporting that something uninstalled is unconfigured.
  it("says nothing about a tool whose binary is out of reach", async () => {
    expect(await issuesFor(null, { toolInstalled: false })).toStrictEqual([]);
  });

  it("stays silent for a tool that keeps its registrations in a tracked file", async () => {
    expect(await issuesFor(null, { toolId: SYNTHETIC_USER_TOOL })).toStrictEqual([]);
  });

  // Copilot declares no place at all rather than a path, and a guard rejecting only `undefined`
  // lets `null` reach `join(root, null)`, which throws and takes `plugin doctor` down.
  it("stays silent, and does not throw, for a tool that declares no place at all", async () => {
    await expect(
      issuesFor(null, { toolId: SYNTHETIC_UPDATING_NATIVE_TOOL })
    ).resolves.toStrictEqual([]);
  });

  it("stays silent, and does not throw, for an IDE tool", async () => {
    await expect(issuesFor(null, { toolId: SYNTHETIC_IDE_TOOL })).resolves.toStrictEqual([]);
  });

  describe("narrowed to a set of tools", () => {
    it("ignores a tool outside the set", async () => {
      expect(await issuesFor(null, { allowedIds: new Set([SYNTHETIC_USER_TOOL]) })).toStrictEqual(
        []
      );
    });

    it("still reports a tool inside the set", async () => {
      expect(await issuesFor(null, { allowedIds: new Set([SYNTHETIC_NATIVE_TOOL]) })).toStrictEqual(
        [UNDECLARED]
      );
    });
  });
});

const REF = "aidd-context@aidd-framework";
const REGISTRY_LOCATION = resolveHomeTemplate(SYNTHETIC_NATIVE_PLUGIN_REGISTRY, "/home/dev");

function manifestWithNativeRegistrations(
  pluginRefs: string[],
  marketplaces: { alias: string; hostName: string }[] = [
    { alias: "aidd-framework", hostName: "aidd-framework" },
  ]
): { manifest: Manifest; records: ToolRecords } {
  const manifest = Manifest.create();
  manifest.addTool(SYNTHETIC_NATIVE_TOOL, "test", []);
  const records: ToolRecords = new Map([
    [SYNTHETIC_NATIVE_TOOL, { binary: SYNTHETIC_NATIVE_TOOL, marketplaces, pluginRefs }],
  ]);
  return { manifest, records };
}

function manifestWithPlugin(
  marketplace?: string,
  toolId: AiToolId = SYNTHETIC_NATIVE_TOOL
): { manifest: Manifest; records: ToolRecords } {
  const manifest = aManifest()
    .withTool(toolId, [], { version: "test" })
    .withPlugin(
      toolId,
      RecordedPlugin.fromMetadata({
        name: marketplace === undefined ? "hand-copied" : "aidd-context",
        version: "1.0.0",
        source: { kind: "github", repo: "ai-driven-dev/framework" },
        strict: true,
        scope: "user",
        marketplace,
      })
    )
    .build();
  return { manifest, records: new Map() };
}

async function nativeIssuesFor(
  { manifest, records }: { manifest: Manifest; records: ToolRecords },
  reading: HostPluginRegistryReading | "unreachable",
  registered?: Marketplace
) {
  const fs = new InMemoryFileAdapter();
  const registry = new InMemoryMarketplaceRegistry();
  if (registered) await registry.save(PROJECT_ROOT, registered);
  const activators = new Map<string, FakeHostActions>([
    [SYNTHETIC_NATIVE_TOOL, new FakeHostActions({ available: true })],
  ]);
  const hostRegistries = new Map<AiToolId, HostPluginRegistry>();
  if (reading !== "unreachable") {
    hostRegistries.set(SYNTHETIC_NATIVE_TOOL, new FakeHostPluginRegistry(reading));
  }
  return checkRegistrationOver(
    new InMemoryManifestRepository(manifest, undefined, records),
    fs,
    registry,
    (binary) => activators.get(binary)?.isAvailable() ?? false,
    hostInspector(syntheticNativeFamilyCatalog(), {
      fs: fs,
      pluginRegistries: hostRegistries,
      marketplaceRegistries: new Map(),
    }),
    () => "/user-cache",
    "1.0.0",
    syntheticNativeFamilyCatalog()
  ).execute({
    projectRoot: PROJECT_ROOT,
    allowedIds: null,
  });
}

describe("CheckRegistration - native registrations against the host's own registry", () => {
  it("says nothing when the registry carries the expected ref, enabled", async () => {
    const issues = await nativeIssuesFor(manifestWithNativeRegistrations([REF]), {
      location: REGISTRY_LOCATION,
      refs: new Map([[REF, { enabled: true }]]),
    });

    expect(issues).toEqual([]);
  });

  it("reports an error naming the ref and `aidd sync` when the registry lacks it", async () => {
    const issues = await nativeIssuesFor(manifestWithNativeRegistrations([REF]), {
      location: REGISTRY_LOCATION,
      refs: new Map(),
    });

    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("error");
    expect(issues[0].message).toContain(REF);
    expect(issues[0].message).toContain(REGISTRY_LOCATION);
    expect(issues[0].fix).toEqual({ code: "sync-reregister" });
  });

  it(`reports an error naming \`aidd framework install --tool ${SYNTHETIC_NATIVE_TOOL}\` when the registry disabled it`, async () => {
    const issues = await nativeIssuesFor(manifestWithNativeRegistrations([REF]), {
      location: REGISTRY_LOCATION,
      refs: new Map([[REF, { enabled: false }]]),
    });

    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("error");
    expect(issues[0].message).toContain(REF);
    expect(issues[0].message).toContain("disabled");
    expect(issues[0].fix).toEqual({ code: "install-framework", tool: SYNTHETIC_NATIVE_TOOL });
  });

  it("names the registry nobody has measured, never an error, when nothing here can read it", async () => {
    const issues = await nativeIssuesFor(manifestWithNativeRegistrations([REF]), "unreachable");

    expect(issues).toStrictEqual([
      {
        severity: "info",
        message: `${SYNTHETIC_NATIVE_TOOL} keeps a plugin registry, and nothing here has established its shape`,
        fix: `The plugin does not load until ${SYNTHETIC_NATIVE_TOOL}'s own CLI has run and answered this.`,
      },
    ]);
  });

  it("reports an info line when the registry file exists but could not be read", async () => {
    const issues = await nativeIssuesFor(manifestWithNativeRegistrations([REF]), {
      location: REGISTRY_LOCATION,
      unreadable: "ENOENT",
    });

    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("info");
    expect(issues[0].message).toContain("ENOENT");
  });

  // `nativeRegistrations.marketplaces` names a marketplace the host registered with no plugin
  // behind it, and nothing here can be asked about one alone, so this stays silent.
  it("says nothing for a registered marketplace with no plugin ref to check", async () => {
    const issues = await nativeIssuesFor(
      manifestWithNativeRegistrations(
        [],
        [{ alias: "aidd-framework", hostName: "aidd-framework" }]
      ),
      {
        location: REGISTRY_LOCATION,
        refs: new Map(),
      }
    );

    expect(issues).toEqual([]);
  });

  it("falls back to the manifest's own plugins when nativeRegistrations was never recorded", async () => {
    const issues = await nativeIssuesFor(manifestWithPlugin("aidd-framework"), {
      location: REGISTRY_LOCATION,
      refs: new Map(),
    });

    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain(REF);
  });

  it("names the plugin whose marketplace was never recorded, as unanswerable rather than an error", async () => {
    const issues = await nativeIssuesFor(manifestWithPlugin(undefined), {
      location: REGISTRY_LOCATION,
      refs: new Map(),
    });

    expect(issues).toStrictEqual([
      {
        severity: "info",
        message: `AIDD records no marketplace for hand-copied (${SYNTHETIC_NATIVE_TOOL}), so its registry cannot be asked`,
        fix: `${SYNTHETIC_NATIVE_TOOL} will not load it until a marketplace is recorded for it.`,
      },
    ]);
  });

  it("says nothing for a tool whose plugins are enabled by a file this CLI writes", async () => {
    const issues = await nativeIssuesFor(
      manifestWithPlugin("aidd-framework", SYNTHETIC_USER_TOOL),
      {
        location: REGISTRY_LOCATION,
        refs: new Map(),
      }
    );

    expect(issues).toStrictEqual([]);
  });
});

describe("CheckRegistration - order", () => {
  it("lists the undeclared marketplace before what the host's registry lacks", async () => {
    const marketplace = Marketplace.create({
      name: "mine",
      source: { kind: "local", path: "/src" },
      scope: "project",
      addedAt: "2026-01-01T00:00:00Z",
    });
    const issues = await nativeIssuesFor(
      manifestWithNativeRegistrations([REF]),
      { location: REGISTRY_LOCATION, refs: new Map() },
      marketplace
    );

    expect(issues.map((issue) => issue.severity)).toStrictEqual(["warning", "error"]);
  });
});

describe("the hosts handed to the registry inspection", () => {
  it("carry no marketplaces for a tool with no built marketplace", async () => {
    const manifest = Manifest.create();
    manifest.addTool(SYNTHETIC_NATIVE_TOOL, "test", []);
    const inspected: unknown[] = [];
    const check = new CheckRegistration({
      resolve: resolveRegisteredBuildsOver(
        new InMemoryManifestRepository(manifest),
        {
          execute: async () => ({
            projectScopedNames: [],
            userCacheRoot: "/user-cache",
            built: new Map(),
          }),
        },
        syntheticNativeFamilyCatalog()
      ),
      declared: new InspectDeclaredMarketplaces(
        new InMemoryFileAdapter(),
        () => false,
        syntheticNativeFamilyCatalog()
      ),
      inspectHost: {
        execute: async ({ hosts }) => {
          inspected.push(...hosts);
          return { findings: [] };
        },
      },
    });

    await check.execute({ projectRoot: PROJECT_ROOT, allowedIds: null, globalInstall: true });

    expect(inspected).toStrictEqual([
      { tool: SYNTHETIC_NATIVE_TOOL, expectedPlugins: [], marketplaces: [] },
    ]);
  });
});
