import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bindCatalog, createDeps, createMenuDeps } from "../../src/composition/framework.js";
import { Manifest } from "../../src/contexts/installation/domain/manifest.js";
import { InstalledPlugin } from "../../src/contexts/installation/domain/plugins/installed-plugin.js";
import { CLIOutput } from "../../src/presentation/output.js";
import { catalogOf, TOOL } from "../contexts/tools/testing/catalog-of.js";

describe("createDeps", () => {
  const tools = catalogOf();
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "aidd-create-deps-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("builds the graph once per project root", async () => {
    const first = await createDeps(root, { verbose: false }, undefined, tools);

    expect(await createDeps(root, { verbose: false }, undefined, tools)).toBe(first);
  });

  it("builds a separate graph for another project root", async () => {
    const other = await mkdtemp(join(tmpdir(), "aidd-create-deps-other-"));
    try {
      expect(await createDeps(other, { verbose: false }, undefined, tools)).not.toBe(
        await createDeps(root, { verbose: false }, undefined, tools)
      );
    } finally {
      await rm(other, { recursive: true, force: true });
    }
  });

  it("builds a separate graph when a token is given on the command line", async () => {
    expect(await createDeps(root, { verbose: false, token: "ghp_x" }, undefined, tools)).not.toBe(
      await createDeps(root, { verbose: false }, undefined, tools)
    );
  });

  it("shares one graph between a missing token and an empty one", async () => {
    expect(await createDeps(root, { verbose: false, token: "" }, undefined, tools)).toBe(
      await createDeps(root, { verbose: false }, undefined, tools)
    );
  });

  it("builds a separate graph per token", async () => {
    expect(await createDeps(root, { verbose: false, token: "ghp_a" }, undefined, tools)).not.toBe(
      await createDeps(root, { verbose: false, token: "ghp_b" }, undefined, tools)
    );
  });

  it("builds a separate graph for another catalog, and reuses the one for the same catalog", async () => {
    const first = catalogOf();

    const graph = await createDeps(root, { verbose: false }, undefined, first);

    expect(await createDeps(root, { verbose: false }, undefined, first)).toBe(graph);
    expect(await createDeps(root, { verbose: false }, undefined, catalogOf())).not.toBe(graph);
  });

  it("binds the catalog the commands were registered with to the graph it builds", async () => {
    const bound = catalogOf();
    const graph = await bindCatalog(bound)(root, { verbose: false }, undefined);

    expect(await createDeps(root, { verbose: false }, undefined, bound)).toBe(graph);
    expect(await createDeps(root, { verbose: false }, undefined, catalogOf())).not.toBe(graph);
  });

  it("logs through the output it was handed", async () => {
    const output = new CLIOutput(false);
    const withOutput = await mkdtemp(join(tmpdir(), "aidd-create-deps-output-"));
    try {
      expect((await createDeps(withOutput, { verbose: false }, output, tools)).logger).toBe(output);
    } finally {
      await rm(withOutput, { recursive: true, force: true });
    }
  });

  it("reads the catalog it was handed, never one of its own", async () => {
    const handed = catalogOf();
    const walked = vi.spyOn(handed, "inHelpOrder");

    await createDeps(root, { verbose: false }, undefined, handed);

    expect(walked).toHaveBeenCalled();
  });

  describe("marketplace add --overwrite", () => {
    const source = {
      kind: "local" as const,
      path: join(process.cwd(), "tests/fixtures/framework/marketplace-sample"),
    };

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    async function registerThenOverwrite(scope: "project" | "user") {
      vi.stubEnv("AIDD_USER_CONFIG_DIR", join(root, "user-config"));
      const { addMarketplace } = await createDeps(root, { verbose: false }, undefined, tools);
      const command = { source, name: "awesome", scope, projectRoot: root, autoTrust: true };
      await addMarketplace.execute(command);
      return addMarketplace.execute({ ...command, overwrite: true });
    }

    it("removes a project entry through the project remover", async () => {
      await expect(registerThenOverwrite("project")).resolves.toMatchObject({
        marketplace: { name: "awesome", scope: "project" },
      });
    });

    it("removes a user entry through the user remover, which proves ownership first", async () => {
      await expect(registerThenOverwrite("user")).rejects.toThrow(
        "Cannot prove AIDD ownership of user-scope marketplace 'awesome'"
      );
    });
  });

  describe("the commands it wires", () => {
    // A machine of its own: no home, no user config, no token and no host binary of the real
    // one. `HOME` alone only sandboxes POSIX: `os.homedir()` reads `USERPROFILE` on Windows,
    // and the config-dir rule reads `APPDATA` ahead of it.
    beforeEach(() => {
      const home = join(root, "home");
      vi.stubEnv("HOME", home);
      vi.stubEnv("USERPROFILE", home);
      vi.stubEnv("APPDATA", join(home, "AppData", "Roaming"));
      vi.stubEnv("AIDD_USER_CONFIG_DIR", join(root, "user-config"));
      vi.stubEnv("PATH", join(root, "no-binaries"));
      vi.stubEnv("AIDD_TOKEN", undefined);
      vi.stubEnv("GH_TOKEN", undefined);
      vi.stubEnv("GITHUB_TOKEN", undefined);
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    const aPlugin = (
      scope: "project" | "user",
      extra: { mcpEntries?: Record<string, string> } = {}
    ) =>
      InstalledPlugin.fromJSON({
        name: "aidd-dev",
        source: { kind: "github", repo: "ai-driven-dev/framework" },
        version: "1.0.0",
        strict: true,
        files: {},
        scope,
        ...extra,
      });

    it("checks every category of an installed project and reports no category it could not check", async () => {
      const { manifestRepo, doctorAllUseCase } = await createDeps(
        root,
        { verbose: false },
        undefined,
        tools
      );
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "1.0.0", []);
      await manifestRepo.save(manifest);

      const result = await doctorAllUseCase.execute(root, tools);

      expect(result.errors).toEqual([]);
      expect(result.ai?.toolHealth).toEqual([
        { toolId: TOOL.claude, fileCount: 0, mergeFileCount: 0 },
      ]);
    });

    it("counts the token given on the command line as authenticated", async () => {
      const { manifestRepo, doctorUseCase } = await createDeps(
        root,
        { verbose: false, token: "ghp_given" },
        undefined,
        tools
      );
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "1.0.0", []);
      await manifestRepo.save(manifest);

      const report = await doctorUseCase.execute({ projectRoot: root, tools });

      expect(report.issues.map((issue) => issue.message)).not.toContain("Not authenticated");
    });

    it("purges the machine's built cache and checks each user plugin's files before deleting them", async () => {
      const builtCache = join(root, "user-config", "cache", "built");
      await mkdir(join(builtCache, "1.0.0"), { recursive: true });
      await writeFile(join(builtCache, "1.0.0", "marker"), "");
      const { userManifestRepo, cleanUserScopeUseCase } = await createDeps(
        root,
        { verbose: false },
        undefined,
        tools
      );
      const manifest = Manifest.create();
      manifest.addTool(TOOL.cursor, "1.0.0", []);
      manifest.addPlugin(TOOL.cursor, aPlugin("user"));
      await userManifestRepo.save(manifest);

      await cleanUserScopeUseCase.execute({ projectRoot: root, tools, force: true });

      expect(existsSync(builtCache)).toBe(false);
    });

    it("refuses a user clean whose host binary cannot be found, naming why", async () => {
      const { userManifestRepo, cleanUserScopeUseCase } = await createDeps(
        root,
        { verbose: false },
        undefined,
        tools
      );
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "1.0.0", []);
      manifest.setNativeRegistrations(TOOL.claude, {
        binary: "claude",
        marketplaces: [],
        pluginRefs: [],
      });
      await userManifestRepo.save(manifest);

      await expect(
        cleanUserScopeUseCase.execute({ projectRoot: root, tools, force: true })
      ).rejects.toThrow("User clean refused; canonical claims retained.");
    });

    it("refuses a project clean whose plugin's MCP entries cannot be read back", async () => {
      const { manifestRepo, cleanUseCase } = await createDeps(
        root,
        { verbose: false },
        undefined,
        tools
      );
      const manifest = Manifest.create();
      manifest.addTool(TOOL.opencode, "1.0.0", []);
      manifest.addPlugin(TOOL.opencode, aPlugin("project", { mcpEntries: { server: "digest" } }));
      await manifestRepo.save(manifest);
      await mkdir(join(root, "opencode.json"));

      await expect(
        cleanUseCase.execute({ projectRoot: root, tools, force: true })
      ).rejects.toMatchObject({ code: "EISDIR" });
      expect(existsSync(join(root, ".aidd", "manifest.json"))).toBe(true);
    });
  });

  it("builds a flat distribution through the graph's own files and assets", async () => {
    const fixture = join(process.cwd(), "tests/fixtures/framework");
    const { frameworkBuild } = await createDeps(root, { verbose: false }, undefined, tools);

    await frameworkBuild({ target: "copilot", mode: "flat", outDir: root, force: false })?.execute({
      sourceDir: fixture,
      outDir: root,
      target: TOOL.copilot,
    });

    expect(
      await readFile(join(root, ".github", "agents", "aidd-test-code-reviewer.agent.md"), "utf8")
    ).toContain("aidd-test-code-reviewer");
  });

  it("hands the menu a manifest repository that resolves tool ids through the catalog", async () => {
    const { manifestRepo } = createMenuDeps(root, catalogOf());
    const manifest = Manifest.create();
    manifest.addTool(TOOL.claude, "1.0.0", []);
    await manifestRepo.save(manifest);

    expect((await manifestRepo.load())?.getInstalledToolIds()).toEqual([TOOL.claude]);
  });

  it("hands the menu a manifest repository rooted at the project", () => {
    expect(createMenuDeps(root, catalogOf()).manifestRepo.path).toBe(
      join(root, ".aidd", "manifest.json")
    );
  });
});
