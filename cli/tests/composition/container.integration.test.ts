import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { containerFactory, createContainer } from "../../src/composition/container.js";
import { wireInstallation } from "../../src/composition/contexts/installation.js";
import { createOutput, wireBase } from "../../src/composition/shared.js";
import { Manifest } from "../../src/contexts/installation/domain/manifest.js";
import { ManifestRepositoryAdapter } from "../../src/contexts/installation/infrastructure/manifest-repository-adapter.js";
import type { Output } from "../../src/orchestration/domain/output.js";
import type { Scope } from "../../src/shared/domain/scope.js";
import { manifestFileDeps } from "../contexts/installation/testing/manifest-file-deps.builder.js";
import { catalogOf } from "../shared/testing/catalog-of.builder.js";
import { registeredTools, TOOL } from "../shared/testing/registered-tools.builder.js";

const containerOf = (
  projectRoot: string,
  options: Parameters<ReturnType<typeof containerFactory>>[1],
  output: Output | undefined,
  tools: ReturnType<typeof catalogOf>
) => containerFactory(tools)(projectRoot, options, output);

describe("the container a command is handed", () => {
  const tools = catalogOf();
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "aidd-create-deps-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("logs through the output it was handed", async () => {
    const output = createOutput(false);
    const withOutput = await mkdtemp(join(tmpdir(), "aidd-create-deps-output-"));
    try {
      expect((await containerOf(withOutput, { verbose: false }, output, tools)).shared.logger).toBe(
        output
      );
    } finally {
      await rm(withOutput, { recursive: true, force: true });
    }
  });

  it("reads the catalog it was handed, never one of its own", async () => {
    const handed = catalogOf();
    const walked = vi.spyOn(handed, "inHelpOrder");

    const container = await containerOf(root, { verbose: false }, undefined, handed);
    container.doctor.runUserScopeDoctor;

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

    async function registerThenOverwrite(scope: Scope) {
      vi.stubEnv("AIDD_USER_CONFIG_DIR", join(root, "user-config"));
      const container = await containerOf(root, { verbose: false }, undefined, tools);
      const { addMarketplace } = container.marketplace;
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

  it("builds a flat distribution through the container's own files and assets", async () => {
    const fixture = join(process.cwd(), "tests/fixtures/framework");
    const container = await containerOf(root, { verbose: false }, undefined, tools);
    const { frameworkBuild } = container.translate;

    await frameworkBuild({ target: "copilot", mode: "flat", outDir: root, force: false })?.execute({
      sourceDir: fixture,
      outDir: root,
      target: TOOL.copilot,
    });

    expect(
      await readFile(join(root, ".github", "agents", "aidd-test-code-reviewer.agent.md"), "utf8")
    ).toContain("aidd-test-code-reviewer");
  });

  it("hands the IDE settings propagation the bundled assets, so a settings file kept in an asset is written", async () => {
    const base = wireBase({ projectRoot: root, verbose: false, tools: registeredTools() });
    const manifest = Manifest.create();
    manifest.addTool(TOOL.copilot, "1.0.0", []);
    await base.manifestRepo.save(manifest);

    await wireInstallation(base).propagateAiSettingsToIde.execute({
      ideId: TOOL.vscode,
      projectRoot: root,
    });

    expect(
      JSON.parse(await readFile(join(root, ".vscode", "settings.json"), "utf8"))
    ).toHaveProperty("github.copilot.enable");
  });

  it("sends the menu to setup when no manifest exists", async () => {
    const ran: string[][] = [];
    const runner = {
      run: async (argv: string[]) => {
        ran.push(argv);
        return 1;
      },
    };

    const menuLoop = createContainer({
      projectRoot: root,
      verbose: false,
      tools: catalogOf(),
    }).menu({ runner, pause: { untilEnter: async () => {} } });

    expect(await menuLoop.execute()).toBe(1);
    expect(ran).toEqual([["setup"]]);
  });

  it("offers the menu, not setup, once the manifest at the project root lists a tool", async () => {
    const manifest = Manifest.create();
    manifest.addTool(TOOL.claude, "1.0.0", []);
    await new ManifestRepositoryAdapter(
      root,
      manifestFileDeps(() => join(root, ".aidd"))
    ).save(manifest);
    const ran: string[][] = [];
    const runner = {
      run: async (argv: string[]) => {
        ran.push(argv);
        throw new Error("stop");
      },
    };

    const menuLoop = createContainer({
      projectRoot: root,
      verbose: false,
      tools: catalogOf(),
    }).menu({ runner, pause: { untilEnter: async () => {} } });

    await expect(menuLoop.execute()).rejects.toThrow("stop");
    expect(ran[0]).not.toEqual(["setup"]);
  });
});
