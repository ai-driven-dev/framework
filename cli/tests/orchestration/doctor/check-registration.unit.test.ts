import { describe, expect, it } from "vitest";
import { registrationRecordRules } from "../../../src/composition/installation.js";
import type { ResolveBuiltMarketplaces } from "../../../src/contexts/distribution/application/resolve-built-marketplaces.js";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import { InspectDeclaredMarketplaces } from "../../../src/contexts/host-registration/application/inspect/inspect-declared-marketplaces.js";
import type { HostPluginRegistryReading } from "../../../src/contexts/host-registration/domain/reading/plugin-registry-reading.js";
import type { HostPluginRegistry } from "../../../src/contexts/host-registration/ports/host-plugin-registry.js";
import { ListRegisteredPlugins } from "../../../src/contexts/installation/application/doctor/list-registered-plugins.js";
import { LoadManifest } from "../../../src/contexts/installation/application/doctor/load-manifest.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import { InstalledPlugin } from "../../../src/contexts/installation/domain/plugins/installed-plugin.js";
import { CheckRegistration } from "../../../src/orchestration/doctor/check-registration.js";
import type { AiToolId, ToolId } from "../../../src/shared/domain/tool.js";
import { FakeHostPluginRegistry } from "../../contexts/host-registration/testing/fake-host-plugin-registry.fake.js";
import { aManifest } from "../../contexts/installation/testing/manifest.builder.js";
import { catalogOf } from "../../shared/testing/catalog-of.builder.js";
import { FakeHostActions } from "../../shared/testing/fake-host-actions.fake.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryManifestRepository } from "../../shared/testing/in-memory-manifest-repository.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import { registeredHostInspector } from "../../shared/testing/registered-host-inspector.builder.js";
import { TOOL } from "../../shared/testing/registered-tools.builder.js";
import { buildCheckRegistration } from "../testing/build-check-registration.builder.js";

const PROJECT_ROOT = "/project";
const LOCAL_SETTINGS = `${PROJECT_ROOT}/.claude/settings.local.json`;
const UNDECLARED = {
  severity: "warning",
  message: "claude no longer declares marketplace 'aidd-framework'",
  fix: { code: "refresh-marketplace", file: ".claude/settings.local.json" },
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
  } = {}
) {
  const { toolId = TOOL.claude, toolInstalled = true, allowedIds = null, machine } = options;
  const fs = new InMemoryFileAdapter();
  if (settings !== null) await fs.writeFile(LOCAL_SETTINGS, settings);
  const registry = new InMemoryMarketplaceRegistry();
  await registry.save(
    PROJECT_ROOT,
    Marketplace.create({
      name: "aidd-framework",
      source: { kind: "local", path: "/src" },
      scope: "project",
      addedAt: "2026-01-01T00:00:00Z",
    })
  );
  const manifest = Manifest.create();
  manifest.addTool(toolId, "test", []);
  const activators = new Map<string, FakeHostActions>([
    [TOOL.claude, new FakeHostActions({ available: toolInstalled, enablesPlugins: false })],
  ]);
  return buildCheckRegistration(
    fs,
    registry,
    (binary) => activators.get(binary)?.isAvailable() ?? false,
    registeredHostInspector(fs, new Map(), new Map()),
    () => "/user-cache",
    { get: () => "1.0.0" },
    catalogOf()
  ).execute({
    manifest,
    projectRoot: PROJECT_ROOT,
    allowedIds,
    globalInstall: machine,
  });
}

describe("CheckRegistration", () => {
  it("says nothing when the tool still declares the marketplace", async () => {
    expect(await issuesFor(settingsDeclaring(["aidd-framework"]))).toStrictEqual([]);
  });

  it("accepts the array form of the declaration", async () => {
    const settings = JSON.stringify({ extraKnownMarketplaces: ["aidd-framework"] });
    expect(await issuesFor(settings)).toStrictEqual([]);
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
    expect(await issuesFor(null, { toolId: TOOL.cursor })).toStrictEqual([]);
  });

  // Copilot declares no place at all rather than a path, and a guard rejecting only `undefined`
  // lets `null` reach `join(root, null)`, which throws and takes `plugin doctor` down.
  it("stays silent, and does not throw, for a tool that declares no place at all", async () => {
    await expect(issuesFor(null, { toolId: TOOL.copilot })).resolves.toStrictEqual([]);
  });

  it("stays silent, and does not throw, for an IDE tool", async () => {
    await expect(issuesFor(null, { toolId: TOOL.vscode })).resolves.toStrictEqual([]);
  });

  describe("narrowed to a set of tools", () => {
    it("ignores a tool outside the set", async () => {
      expect(await issuesFor(null, { allowedIds: new Set(["cursor"]) })).toStrictEqual([]);
    });

    it("still reports a tool inside the set", async () => {
      expect(await issuesFor(null, { allowedIds: new Set(["claude"]) })).toStrictEqual([
        UNDECLARED,
      ]);
    });
  });
});

const REF = "aidd-context@aidd-framework";
const REGISTRY_LOCATION = "/home/dev/.claude/plugins/installed_plugins.json";

function manifestWithNativeRegistrations(
  pluginRefs: string[],
  marketplaces: { alias: string; hostName: string }[] = [
    { alias: "aidd-framework", hostName: "aidd-framework" },
  ]
): Manifest {
  const manifest = Manifest.create();
  manifest.addTool(TOOL.claude, "test", []);
  manifest.setNativeRegistrations(TOOL.claude, { binary: "claude", marketplaces, pluginRefs });
  return manifest;
}

function manifestWithPlugin(marketplace?: string, toolId: AiToolId = TOOL.claude): Manifest {
  const manifest = aManifest()
    .withTool(toolId, [], { version: "test" })
    .withPlugin(
      toolId,
      InstalledPlugin.fromMetadata({
        name: marketplace === undefined ? "hand-copied" : "aidd-context",
        version: "1.0.0",
        source: { kind: "github", repo: "ai-driven-dev/framework" },
        strict: true,
        scope: "user",
        marketplace,
      })
    )
    .build();
  return manifest;
}

async function nativeIssuesFor(
  manifest: Manifest,
  reading: HostPluginRegistryReading | "unreachable",
  registered?: Marketplace
) {
  const fs = new InMemoryFileAdapter();
  const registry = new InMemoryMarketplaceRegistry();
  if (registered) await registry.save(PROJECT_ROOT, registered);
  const activators = new Map<string, FakeHostActions>([
    [TOOL.claude, new FakeHostActions({ available: true, enablesPlugins: true })],
  ]);
  const hostRegistries = new Map<AiToolId, HostPluginRegistry>();
  if (reading !== "unreachable") {
    hostRegistries.set(TOOL.claude, new FakeHostPluginRegistry(reading));
  }
  return buildCheckRegistration(
    fs,
    registry,
    (binary) => activators.get(binary)?.isAvailable() ?? false,
    registeredHostInspector(fs, hostRegistries, new Map()),
    () => "/user-cache",
    { get: () => "1.0.0" },
    catalogOf()
  ).execute({
    manifest,
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

  it("reports an error naming `aidd framework install --tool claude` when the registry disabled it", async () => {
    const issues = await nativeIssuesFor(manifestWithNativeRegistrations([REF]), {
      location: REGISTRY_LOCATION,
      refs: new Map([[REF, { enabled: false }]]),
    });

    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("error");
    expect(issues[0].message).toContain(REF);
    expect(issues[0].message).toContain("disabled");
    expect(issues[0].fix).toEqual({ code: "install-framework", tool: "claude" });
  });

  it("names the registry nobody has measured, never an error, when nothing here can read it", async () => {
    const issues = await nativeIssuesFor(manifestWithNativeRegistrations([REF]), "unreachable");

    expect(issues).toStrictEqual([
      {
        severity: "info",
        message: "claude keeps a plugin registry, and nothing here has established its shape",
        fix: "The plugin does not load until claude's own CLI has run and answered this.",
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
        message:
          "AIDD records no marketplace for hand-copied (claude), so its registry cannot be asked",
        fix: "claude will not load it until a marketplace is recorded for it.",
      },
    ]);
  });

  it("says nothing for a tool whose plugins are enabled by a file this CLI writes", async () => {
    const issues = await nativeIssuesFor(manifestWithPlugin("aidd-framework", TOOL.cursor), {
      location: REGISTRY_LOCATION,
      refs: new Map(),
    });

    expect(issues).toStrictEqual([]);
  });
});

describe("CheckRegistration - order", () => {
  it("lists the undeclared marketplace before what the host's registry lacks", async () => {
    const marketplace = Marketplace.create({
      name: "aidd-framework",
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

describe("the tools whose built marketplaces are resolved", () => {
  it("are the AI tools the manifest holds, and no IDE tool", async () => {
    const manifest = aManifest()
      .withTool(TOOL.claude, [], { version: "test" })
      .withTool(TOOL.vscode, [], { version: "test" })
      .build();
    const resolved: (readonly string[])[] = [];
    const builds: Pick<ResolveBuiltMarketplaces, "execute"> = {
      execute: async ({ toolIds }) => {
        resolved.push(toolIds);
        return { registeredNames: [], userCacheRoot: "/user-cache", built: new Map() };
      },
    };
    const check = new CheckRegistration(
      {
        listPlugins: new ListRegisteredPlugins(
          new LoadManifest(new InMemoryManifestRepository(manifest)),
          registrationRecordRules
        ),
        builds,
        declared: new InspectDeclaredMarketplaces(
          new InMemoryFileAdapter(),
          () => false,
          catalogOf()
        ),
        inspectHost: { execute: async () => ({ findings: [] }) },
      },
      catalogOf()
    );

    await check.execute({
      projectRoot: PROJECT_ROOT,
      allowedIds: null,
      globalInstall: true,
    });

    expect(resolved).toStrictEqual([[TOOL.claude]]);
  });
});

describe("the hosts handed to the registry inspection", () => {
  it("carry no marketplaces for a tool with no built marketplace", async () => {
    const manifest = Manifest.create();
    manifest.addTool(TOOL.claude, "test", []);
    const inspected: unknown[] = [];
    const check = new CheckRegistration(
      {
        listPlugins: new ListRegisteredPlugins(
          new LoadManifest(new InMemoryManifestRepository(manifest)),
          registrationRecordRules
        ),
        builds: {
          execute: async () => ({
            registeredNames: [],
            userCacheRoot: "/user-cache",
            built: new Map(),
          }),
        },
        declared: new InspectDeclaredMarketplaces(
          new InMemoryFileAdapter(),
          () => false,
          catalogOf()
        ),
        inspectHost: {
          execute: async ({ hosts }) => {
            inspected.push(...hosts);
            return { findings: [] };
          },
        },
      },
      catalogOf()
    );

    await check.execute({ projectRoot: PROJECT_ROOT, allowedIds: null, globalInstall: true });

    expect(inspected).toStrictEqual([{ tool: TOOL.claude, expectedPlugins: [], marketplaces: [] }]);
  });
});
