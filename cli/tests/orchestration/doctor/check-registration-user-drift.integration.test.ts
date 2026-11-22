import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import { Manifest } from "../../../src/contexts/installation/domain/manifest.js";
import {
  builtMarketplaceDir,
  userBuiltMarketplaceDir,
} from "../../../src/shared/domain/layout/aidd-layout.js";
import { FakeHostMarketplaceRegistry } from "../../contexts/host-registration/testing/fake-host-marketplace-registry.fake.js";
import { hostInspector } from "../../shared/testing/host-inspector.builder.js";
import { InMemoryFileAdapter } from "../../shared/testing/in-memory-file-adapter.fake.js";
import { InMemoryMarketplaceRegistry } from "../../shared/testing/in-memory-marketplace-registry.fake.js";
import {
  SYNTHETIC_NATIVE_MARKETPLACE_REGISTRY,
  SYNTHETIC_NATIVE_TOOL,
  syntheticNativeFamilyCatalog,
} from "../../shared/testing/synthetic-native-tool.builder.js";
import { buildCheckRegistration } from "../testing/build-check-registration.builder.js";

// resolve(): compared in `marketplaceSourceDrift` against an already-resolved source, so a
// drive-less literal makes win32 misclassify this project's own pre-migration cache as foreign.
const PROJECT_ROOT = resolve("/project");
const NAME = "probe-mkt";
const CATALOG_RELATIVE = ".claude-plugin/marketplace.json";
const REGISTRY_LOCATION = SYNTHETIC_NATIVE_MARKETPLACE_REGISTRY("/home");

describe("CheckRegistration - user-scope marketplace source drift", () => {
  // resolve(): compared against an already-resolved requested/registered source, so a
  // drive-less literal misses the base compare and every drift below returns undefined.
  const USER_CACHE_ROOT = resolve("/user-cache");
  const CURRENT_VERSION = "2.0.0";

  function sharedPath(version: string): string {
    return resolve(
      userBuiltMarketplaceDir({
        userConfigDir: USER_CACHE_ROOT,
        cliVersion: version,
        marketplaceName: NAME,
        target: SYNTHETIC_NATIVE_TOOL,
      })
    );
  }

  async function driftIssuesFor(hostReader: FakeHostMarketplaceRegistry) {
    const fs = new InMemoryFileAdapter({
      [`${sharedPath(CURRENT_VERSION)}/${CATALOG_RELATIVE}`]: JSON.stringify({
        name: NAME,
        plugins: [],
      }),
    });
    const registry = new InMemoryMarketplaceRegistry();
    await registry.save(
      PROJECT_ROOT,
      Marketplace.create({
        name: NAME,
        source: { kind: "local", path: "/source" },
        scope: "user",
        addedAt: "2026-01-01T00:00:00Z",
      })
    );
    const manifest = Manifest.create();
    manifest.addTool(SYNTHETIC_NATIVE_TOOL, "test", []);
    const useCase = buildCheckRegistration(
      fs,
      registry,
      () => false,
      hostInspector(syntheticNativeFamilyCatalog(), {
        fs: fs,
        pluginRegistries: new Map(),
        marketplaceRegistries: new Map([[SYNTHETIC_NATIVE_TOOL, hostReader]]),
      }),
      () => USER_CACHE_ROOT,
      CURRENT_VERSION,
      syntheticNativeFamilyCatalog()
    );
    return useCase.execute({
      manifest,
      projectRoot: PROJECT_ROOT,
      allowedIds: null,
    });
  }

  it("warns naming both versions when the host already follows a newer aidd version than this run", async () => {
    const hostReader = new FakeHostMarketplaceRegistry({
      location: REGISTRY_LOCATION,
      entries: new Map([[NAME, sharedPath("3.0.0")]]),
    });

    const issues = await driftIssuesFor(hostReader);

    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe("warning");
    expect(issues[0]?.message).toContain("3.0.0");
    expect(issues[0]?.message).toContain(CURRENT_VERSION);
    expect(issues[0]?.fix).toEqual({ code: "update-cli" });
  });

  it("warns naming `aidd sync` when the host still points at this project's own pre-migration cache", async () => {
    const projectCache = resolve(builtMarketplaceDir(PROJECT_ROOT, NAME, SYNTHETIC_NATIVE_TOOL));
    const hostReader = new FakeHostMarketplaceRegistry({
      location: REGISTRY_LOCATION,
      entries: new Map([[NAME, projectCache]]),
    });

    const issues = await driftIssuesFor(hostReader);

    expect(issues).toStrictEqual([
      {
        severity: "warning",
        message: `${SYNTHETIC_NATIVE_TOOL}'s marketplace registry (${REGISTRY_LOCATION}) still carries '${NAME}' from this project's own pre-migration cache (${projectCache})`,
        fix: { code: "sync-migrate-source" },
      },
    ]);
  });

  it("warns naming `aidd sync` when the host still points at another project's pre-migration cache", async () => {
    const foreignProjectCache = resolve(
      builtMarketplaceDir("/other-project", NAME, SYNTHETIC_NATIVE_TOOL)
    );
    const hostReader = new FakeHostMarketplaceRegistry({
      location: REGISTRY_LOCATION,
      entries: new Map([[NAME, foreignProjectCache]]),
    });

    const issues = await driftIssuesFor(hostReader);

    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe("warning");
    expect(issues[0]?.message).toContain(foreignProjectCache);
    // Never the wording pinned for *this* project's own cache above - a project
    // reading its own pre-migration path back would be told the wrong story.
    expect(issues[0]?.message).not.toContain("this project's own pre-migration cache");
    expect(issues[0]?.message).toContain("another project's pre-migration cache");
    expect(issues[0]?.fix).toEqual({ code: "sync-migrate-source" });
  });
});
