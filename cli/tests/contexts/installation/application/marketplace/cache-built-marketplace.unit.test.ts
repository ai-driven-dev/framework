import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  CacheBuiltMarketplace,
  type FrameworkBuild,
  type FrameworkBuilds,
} from "../../../../../src/contexts/installation/application/marketplace/cache-built-marketplace.js";
import type {
  EnsureBuiltMarketplaceCommand,
  EnsureBuiltMarketplaceResult,
} from "../../../../../src/contexts/installation/contract/built-marketplace.js";
import type { DeclaredMarketplace } from "../../../../../src/contexts/installation/ports/marketplace-sources.js";
import {
  BUILT_CACHE_SUBDIR,
  builtMarketplaceDir,
} from "../../../../../src/shared/domain/layout/aidd-layout.js";
import type { VersionReader } from "../../../../../src/shared/ports/version-reader.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";

const PROJECT = "/proj";

function makeMarketplace(): DeclaredMarketplace {
  return {
    name: "aidd-framework",
    source: { kind: "local", path: "/src/framework" },
    scope: "project",
  };
}

/** A published source: its version changes when its content does, so it can be believed. */
function makeRemoteMarketplace(): DeclaredMarketplace {
  return {
    name: "aidd-framework",
    source: { kind: "github", repo: "ai-driven-dev/framework" },
    scope: "project",
  };
}

function makeUserMarketplace(): DeclaredMarketplace {
  return {
    name: "shared-mkt",
    source: { kind: "local", path: "/src/framework" },
    scope: "user",
  };
}

/** The source as the distribution resolved it: where it landed and the version it declares. */
function fakeResolve(localPath: string, version: string | undefined) {
  return { localPath, catalog: version === undefined ? null : { version } };
}

type BuildFor = FrameworkBuilds["buildFor"];

/** Every target's build, with no variant unless one is named. */
function buildsOf(buildFor: BuildFor, variant?: string): FrameworkBuilds {
  return { variant: async () => variant, buildFor };
}

function fakeVersion(value: string): VersionReader {
  return { get: () => value };
}

const USER_CACHE_ROOT = "/user-cache";

/** The cache as production wires it, with the source already resolved: the user cache and the
 * version fixed. */
function buildEnsurer(
  fs: InMemoryFileAdapter,
  resolved: ReturnType<typeof fakeResolve>,
  builds: FrameworkBuilds,
  version: VersionReader = fakeVersion("5.0.0")
): {
  execute(command: EnsureBuiltMarketplaceCommand): Promise<EnsureBuiltMarketplaceResult>;
} {
  const cache = new CacheBuiltMarketplace(fs, builds, version, () => USER_CACHE_ROOT);
  return { execute: (command) => cache.execute(command, resolved) };
}

describe("CacheBuiltMarketplace", () => {
  let fs: InMemoryFileAdapter;
  let builds: number;
  let buildFor: BuildFor;

  beforeEach(() => {
    fs = new InMemoryFileAdapter();
    builds = 0;
    buildFor = ({ outDir }) =>
      ({
        execute: async () => {
          builds += 1;
          await fs.writeFile(join(outDir, "plugins/aidd-vcs/SKILL.md"), "built content");
          return { outDir, plugins: [], totalFiles: 1 };
        },
      }) satisfies FrameworkBuild;
  });

  it("rebuilds and writes a sentinel when none exists", async () => {
    const uc = buildEnsurer(fs, fakeResolve("/src/framework", "1.0.0"), buildsOf(buildFor));
    const r = await uc.execute({
      projectRoot: PROJECT,
      marketplace: makeMarketplace(),
      target: TOOL.codex,
      mode: "marketplace",
    });
    expect(r.rebuilt).toBe(true);
    expect(builds).toBe(1);
    expect(fs.getFile(join(r.builtDir, ".build-version"))).toBe("5.0.0:1.0.0");
  });

  it("builds a target's agents with the provider chosen for it, and records it in the sentinel", async () => {
    const variants: (string | undefined)[] = [];
    const uc = buildEnsurer(fs, fakeResolve("/src/framework", "1.0.0"), {
      variant: async (target) => (target === TOOL.codex ? "openai" : undefined),
      buildFor: (request) => {
        variants.push(request.variant);
        return buildFor(request);
      },
    });
    const r = await uc.execute({
      projectRoot: PROJECT,
      marketplace: makeRemoteMarketplace(),
      target: TOOL.codex,
      mode: "marketplace",
    });
    expect(variants).toStrictEqual(["openai"]);
    expect(fs.getFile(join(r.builtDir, ".build-version"))).toBe("5.0.0:1.0.0:openai");
  });

  it("rebuilds a published source once its agents' provider changed", async () => {
    const builtDir = resolve(builtMarketplaceDir(PROJECT, "aidd-framework", TOOL.codex));
    fs.setFile(join(builtDir, ".build-version"), "5.0.0:1.0.0");
    const uc = buildEnsurer(
      fs,
      fakeResolve("/src/framework", "1.0.0"),
      buildsOf(buildFor, "openai")
    );
    const r = await uc.execute({
      projectRoot: PROJECT,
      marketplace: makeRemoteMarketplace(),
      target: TOOL.codex,
      mode: "marketplace",
    });
    expect(r.rebuilt).toBe(true);
    expect(builds).toBe(1);
  });

  it("always rebuilds an unversioned published source, even one its agents' provider marks", async () => {
    const builtDir = resolve(builtMarketplaceDir(PROJECT, "aidd-framework", TOOL.codex));
    fs.setFile(join(builtDir, ".build-version"), "5.0.0:unversioned:openai");
    const uc = buildEnsurer(
      fs,
      fakeResolve("/src/framework", undefined),
      buildsOf(buildFor, "openai")
    );
    const r = await uc.execute({
      projectRoot: PROJECT,
      marketplace: makeRemoteMarketplace(),
      target: TOOL.codex,
      mode: "marketplace",
    });
    expect(r.rebuilt).toBe(true);
    expect(r.version).toBe("unversioned");
  });

  it("does not rebuild a published source when the sentinel matches (cliVer:catalogVer)", async () => {
    // resolve(): a drive-less PROJECT would seed a key the in-memory fs never looks up under,
    // since the code's own builtDir is resolved with a drive letter.
    const builtDir = resolve(builtMarketplaceDir(PROJECT, "aidd-framework", "codex"));
    fs.setFile(join(builtDir, ".build-version"), "5.0.0:1.0.0");
    const uc = buildEnsurer(fs, fakeResolve("/src/framework", "1.0.0"), buildsOf(buildFor));
    const r = await uc.execute({
      projectRoot: PROJECT,
      marketplace: makeRemoteMarketplace(),
      target: TOOL.codex,
      mode: "marketplace",
    });
    expect(r.rebuilt).toBe(false);
    expect(builds).toBe(0);
  });

  // A directory on this machine can change without its version moving — which is all of
  // framework development — so the version says nothing about freshness there.
  it("rebuilds a local source even when the sentinel matches", async () => {
    const builtDir = builtMarketplaceDir(PROJECT, "aidd-framework", "codex");
    fs.setFile(join(builtDir, ".build-version"), "5.0.0:1.0.0");
    const uc = buildEnsurer(fs, fakeResolve("/src/framework", "1.0.0"), buildsOf(buildFor));
    const r = await uc.execute({
      projectRoot: PROJECT,
      marketplace: makeMarketplace(),
      target: TOOL.codex,
      mode: "marketplace",
    });
    expect(r.rebuilt).toBe(true);
    expect(builds).toBe(1);
  });

  // An explicit refresh asks for the source to be re-read; answering from cache would
  // answer a different question.
  it("rebuilds a published source when a refresh was asked for", async () => {
    const builtDir = builtMarketplaceDir(PROJECT, "aidd-framework", "codex");
    fs.setFile(join(builtDir, ".build-version"), "5.0.0:1.0.0");
    const uc = buildEnsurer(fs, fakeResolve("/src/framework", "1.0.0"), buildsOf(buildFor));
    const r = await uc.execute({
      projectRoot: PROJECT,
      marketplace: makeRemoteMarketplace(),
      target: TOOL.codex,
      mode: "marketplace",
      forceRefresh: true,
    });
    expect(r.rebuilt).toBe(true);
  });

  it("rebuilds when the CLI version changed even if catalog version is the same", async () => {
    const builtDir = builtMarketplaceDir(PROJECT, "aidd-framework", "codex");
    fs.setFile(join(builtDir, ".build-version"), "4.0.0:1.0.0");
    const uc = buildEnsurer(fs, fakeResolve("/src/framework", "1.0.0"), buildsOf(buildFor));
    const r = await uc.execute({
      projectRoot: PROJECT,
      marketplace: makeMarketplace(),
      target: TOOL.codex,
      mode: "marketplace",
    });
    expect(r.rebuilt).toBe(true);
    expect(builds).toBe(1);
  });

  it("always rebuilds when catalog version is undefined", async () => {
    const builtDir = builtMarketplaceDir(PROJECT, "aidd-framework", "codex");
    fs.setFile(join(builtDir, ".build-version"), "5.0.0:unversioned");
    const uc = buildEnsurer(fs, fakeResolve("/src/framework", undefined), buildsOf(buildFor));
    const r = await uc.execute({
      projectRoot: PROJECT,
      marketplace: makeMarketplace(),
      target: TOOL.codex,
      mode: "marketplace",
    });
    expect(r.rebuilt).toBe(true);
    expect(builds).toBe(1);
  });

  it("builds via a temp dir and copies into the cache when the cache nests under the source (dogfood)", async () => {
    // Source == project root, so builtDir (.aidd/cache/built/...) nests under source → guardPaths would throw.
    const uc = buildEnsurer(fs, fakeResolve(PROJECT, "1.0.0"), buildsOf(buildFor));
    const r = await uc.execute({
      projectRoot: PROJECT,
      marketplace: makeMarketplace(),
      target: TOOL.codex,
      mode: "marketplace",
    });
    expect(r.builtDir).toBe(resolve(builtMarketplaceDir(PROJECT, "aidd-framework", "codex")));
    expect(fs.getFile(join(r.builtDir, "plugins/aidd-vcs/SKILL.md"))).toBe("built content");
    expect(fs.listUnder(tmpdir()).length).toBe(0);
  });

  it("memoizes within a run: a second call for the same target/version does not rebuild", async () => {
    const uc = buildEnsurer(fs, fakeResolve("/src/framework", "1.0.0"), buildsOf(buildFor));
    const opts = {
      projectRoot: PROJECT,
      marketplace: makeMarketplace(),
      target: TOOL.codex,
      mode: "marketplace" as const,
    };
    await uc.execute(opts);
    await uc.execute(opts);
    expect(builds).toBe(1);
  });

  it("memoizes per target: a second target of the same marketplace builds again", async () => {
    const uc = buildEnsurer(fs, fakeResolve("/src/framework", "1.0.0"), buildsOf(buildFor));
    const codex = await uc.execute({
      projectRoot: PROJECT,
      marketplace: makeMarketplace(),
      target: TOOL.codex,
      mode: "marketplace",
    });
    const cursor = await uc.execute({
      projectRoot: PROJECT,
      marketplace: makeMarketplace(),
      target: TOOL.cursor,
      mode: "marketplace",
    });
    expect(builds).toBe(2);
    expect(codex.builtDir).not.toBe(cursor.builtDir);
  });

  it("reports the catalog version it built", async () => {
    const uc = buildEnsurer(fs, fakeResolve("/src/framework", "1.0.0"), buildsOf(buildFor));
    const r = await uc.execute({
      projectRoot: PROJECT,
      marketplace: makeMarketplace(),
      target: TOOL.codex,
      mode: "marketplace",
    });
    expect(r.version).toBe("1.0.0");
  });

  it("reports a catalog without a version as unversioned", async () => {
    const uc = buildEnsurer(fs, fakeResolve("/src/framework", undefined), buildsOf(buildFor));
    const r = await uc.execute({
      projectRoot: PROJECT,
      marketplace: makeMarketplace(),
      target: TOOL.codex,
      mode: "marketplace",
    });
    expect(r.version).toBe("unversioned");
  });

  it("refuses a target and mode pair no build exists for", async () => {
    const uc = buildEnsurer(
      fs,
      fakeResolve("/src/framework", "1.0.0"),
      buildsOf(() => undefined)
    );
    await expect(
      uc.execute({
        projectRoot: PROJECT,
        marketplace: makeMarketplace(),
        target: TOOL.codex,
        mode: "marketplace",
      })
    ).rejects.toThrow("No framework build for target 'codex' mode 'marketplace'.");
  });
});

describe("CacheBuiltMarketplace when a published source's sentinel can be believed", () => {
  let fs: InMemoryFileAdapter;
  let builds: number;
  let buildFor: BuildFor;
  const builtDir = resolve(builtMarketplaceDir(PROJECT, "aidd-framework", "codex"));

  beforeEach(() => {
    fs = new InMemoryFileAdapter();
    builds = 0;
    buildFor = ({ outDir }) =>
      ({
        execute: async () => {
          builds += 1;
          await fs.writeFile(join(outDir, "plugins/aidd-vcs/SKILL.md"), "built content");
          return { outDir, plugins: [], totalFiles: 1 };
        },
      }) satisfies FrameworkBuild;
  });

  async function ensure(catalogVersion: string | undefined): Promise<boolean> {
    const uc = buildEnsurer(fs, fakeResolve("/src/framework", catalogVersion), buildsOf(buildFor));
    const r = await uc.execute({
      projectRoot: PROJECT,
      marketplace: makeRemoteMarketplace(),
      target: TOOL.codex,
      mode: "marketplace",
    });
    return r.rebuilt;
  }

  it("rebuilds when no sentinel was ever written", async () => {
    expect(await ensure("1.0.0")).toBe(true);
    expect(builds).toBe(1);
  });

  it("rebuilds when the sentinel names another CLI version", async () => {
    fs.setFile(join(builtDir, ".build-version"), "4.0.0:1.0.0");
    expect(await ensure("1.0.0")).toBe(true);
    expect(builds).toBe(1);
  });

  it("rebuilds a catalog without a version even when the sentinel says unversioned too", async () => {
    fs.setFile(join(builtDir, ".build-version"), "5.0.0:unversioned");
    expect(await ensure(undefined)).toBe(true);
    expect(builds).toBe(1);
  });
});

// Which outDir runBuild() is called with is what keeps the collision bypass aimed at an
// aidd-owned directory, on the direct path and on the temp-dir path alike.
describe("outDir invariant for the cache-rebuild build path", () => {
  it("only ever builds into the aidd build cache or the OS temp dir, never a user directory", async () => {
    const memFs = new InMemoryFileAdapter();
    const capturedOutDirs: string[] = [];
    const capturingBuildFor: BuildFor = ({ outDir }) => {
      capturedOutDirs.push(outDir);
      return {
        execute: async () => {
          await memFs.writeFile(join(outDir, "plugins/aidd-vcs/SKILL.md"), "built content");
          return { outDir, plugins: [], totalFiles: 1 };
        },
      } satisfies FrameworkBuild;
    };

    // Direct path: source lives outside the cache tree → build() writes straight to builtDir.
    const direct = buildEnsurer(
      memFs,
      fakeResolve("/src/framework", "1.0.0"),
      buildsOf(capturingBuildFor)
    );
    await direct.execute({
      projectRoot: PROJECT,
      marketplace: makeMarketplace(),
      target: TOOL.codex,
      mode: "marketplace",
    });

    // Dogfood path: source is the project root, so builtDir nests under it and buildViaTemp()
    // routes the same call through a temp dir instead.
    const dogfood = buildEnsurer(memFs, fakeResolve(PROJECT, "1.0.0"), buildsOf(capturingBuildFor));
    await dogfood.execute({
      projectRoot: PROJECT,
      marketplace: makeMarketplace(),
      target: TOOL.cursor,
      mode: "marketplace",
    });

    expect(capturedOutDirs).toHaveLength(2);
    // resolve(): the direct-path outDir the code passes is itself resolved (drive letter
    // on win32), so the cache root it is compared against must be built the same way.
    const cacheRoot = resolve(join(PROJECT, BUILT_CACHE_SUBDIR));
    const tmpRoot = tmpdir();
    for (const outDir of capturedOutDirs) {
      const underCache = outDir === cacheRoot || outDir.startsWith(`${cacheRoot}${sep}`);
      const underTmp = outDir === tmpRoot || outDir.startsWith(`${tmpRoot}${sep}`);
      expect(underCache || underTmp).toBe(true);
    }
    // The dogfood call specifically must have gone through the temp dir, not the cache.
    expect(capturedOutDirs[1]?.startsWith(`${tmpRoot}${sep}`)).toBe(true);
  });

  // A user-scope marketplace is declared once for every project, so building it inside whichever
  // project registered it would leave the registration pointing at nothing once that one is gone.
  it("builds a user-scope marketplace outside the project", async () => {
    const memFs = new InMemoryFileAdapter();
    const built: string[] = [];
    const capturing: BuildFor = ({ outDir }) =>
      ({
        execute: async () => {
          built.push(outDir);
          await memFs.writeFile(join(outDir, ".claude-plugin/marketplace.json"), "{}");
          return { outDir, plugins: [], totalFiles: 1 };
        },
      }) satisfies FrameworkBuild;

    const uc = buildEnsurer(memFs, fakeResolve("/src/framework", "1.0.0"), buildsOf(capturing));
    const result = await uc.execute({
      projectRoot: PROJECT,
      marketplace: makeUserMarketplace(),
      target: TOOL.claude,
      mode: "marketplace",
    });

    // resolve(): result.builtDir comes back resolved (drive letter on win32), so the
    // prefix it is checked against needs the same treatment.
    expect(result.builtDir.startsWith(resolve(USER_CACHE_ROOT))).toBe(true);
    expect(result.builtDir.startsWith(PROJECT)).toBe(false);
    expect(result.builtDir).toContain(`${sep}5.0.0${sep}`);
  });

  // The shared source is one per CLI version: two projects on two CLI versions building the same
  // user-scope marketplace must land in disjoint trees, so a purge cannot take the other's.
  it("builds two different CLI versions of a user-scope marketplace into disjoint directories", async () => {
    const memFs = new InMemoryFileAdapter();
    const capturing: BuildFor = ({ outDir }) =>
      ({
        execute: async () => {
          await memFs.writeFile(join(outDir, ".claude-plugin/marketplace.json"), "{}");
          return { outDir, plugins: [], totalFiles: 1 };
        },
      }) satisfies FrameworkBuild;

    const buildAt = async (version: string) => {
      const uc = buildEnsurer(
        memFs,
        fakeResolve("/src/framework", "1.0.0"),
        buildsOf(capturing),
        fakeVersion(version)
      );
      return uc.execute({
        projectRoot: PROJECT,
        marketplace: makeUserMarketplace(),
        target: TOOL.claude,
        mode: "marketplace",
      });
    };

    const v1 = await buildAt("1.0.0");
    const v2 = await buildAt("2.0.0");

    expect(v1.builtDir).not.toBe(v2.builtDir);
    expect(v2.builtDir.startsWith(v1.builtDir)).toBe(false);
    expect(v1.builtDir.startsWith(v2.builtDir)).toBe(false);
  });
});
