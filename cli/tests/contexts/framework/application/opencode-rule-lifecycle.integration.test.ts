import "../../../../src/contexts/tools/domain/profiles/opencode/profile.js";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CleanUseCase } from "../../../../src/contexts/framework/application/clean-use-case.js";
import { GitignoreUseCase } from "../../../../src/contexts/framework/application/gitignore-use-case.js";
import { writePluginFiles } from "../../../../src/contexts/framework/application/plugin/plugin-helpers.js";
import { PublishRulesUseCase } from "../../../../src/contexts/framework/application/publish-rules-use-case.js";
import { RestoreUseCase } from "../../../../src/contexts/framework/application/restore/restore-use-case.js";
import { UninstallToolsUseCase } from "../../../../src/contexts/framework/application/uninstall/uninstall-tools-use-case.js";
import { Manifest } from "../../../../src/contexts/framework/domain/manifest.js";
import { InstallationFile } from "../../../../src/kernel/file.js";
import { FileAdapter } from "../../../../src/runtime/filesystem/file-adapter.js";
import { HasherAdapter } from "../../../../src/runtime/filesystem/hasher-adapter.js";
import { CapturingLogger } from "../../../helpers/ports/capturing-logger.js";
import { InMemoryManifestRepository } from "../../../helpers/ports/in-memory-manifest-repository.js";
import { RecordingPrompter } from "../../../helpers/ports/recording-prompter.js";

describe("OpenCode V2 lifecycle rule ownership", () => {
  let root: string;
  const logger = new CapturingLogger();
  const hasher = new HasherAdapter();
  const fs = new FileAdapter(hasher, logger);
  const source = ".opencode/rules/installed.md";
  const user =
    "User guidance\r\n<!-- aidd_project_memory:start -->\r\nMemory\r\n<!-- aidd_project_memory:end -->";
  let manifest: Manifest;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "aidd-opencode-rule-lifecycle-"));
    await fs.writeFile(join(root, "AGENTS.md"), user);
    await fs.writeFile(join(root, source), "Installed active rule");
    await fs.writeFile(join(root, "opencode.json"), "{}\n");
    manifest = Manifest.create();
    manifest.addTool("opencode", "1.0.0", [
      new InstallationFile({
        relativePath: source,
        content: "Installed active rule",
        hash: hasher.hash("Installed active rule"),
      }),
      new InstallationFile({
        relativePath: "opencode.json",
        content: "{}\n",
        hash: hasher.hash("{}\n"),
      }),
    ]);
    await new PublishRulesUseCase(fs).execute({ toolId: "opencode", projectRoot: root });
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("uninstall removes installed text and retains untracked rule guidance", async () => {
    await fs.writeFile(join(root, ".opencode/rules/user.md"), "Independent user rule");
    await new UninstallToolsUseCase(fs, logger).execute({
      toolIds: ["opencode"],
      projectRoot: root,
      manifest,
    });
    const active = await readFile(join(root, "AGENTS.md"), "utf8");
    expect(active).toContain(user);
    expect(active).toContain("Independent user rule");
    expect(active).not.toContain("Installed active rule");
    expect(manifest.isFileTracked("AGENTS.md")).toBe(false);
  });

  it("clean removes the final installed contribution and preserves exact user bytes", async () => {
    await new CleanUseCase(
      fs,
      new InMemoryManifestRepository(manifest, root),
      logger,
      new GitignoreUseCase(fs)
    ).execute({ projectRoot: root, force: true });
    expect(await readFile(join(root, "AGENTS.md"), "utf8")).toBe(user);
    expect(await fs.fileExists(join(root, source))).toBe(false);
  });

  it.each(["uninstall", "clean"])(
    "%s refuses edited publication before deleting any tracked file",
    async (operation) => {
      const edited = (await fs.readFile(join(root, "AGENTS.md"))).replace(
        "Installed active rule",
        "User edit"
      );
      await fs.writeFile(join(root, "AGENTS.md"), edited);
      const action =
        operation === "uninstall"
          ? new UninstallToolsUseCase(fs, logger).execute({
              toolIds: ["opencode"],
              projectRoot: root,
              manifest,
            })
          : new CleanUseCase(
              fs,
              new InMemoryManifestRepository(manifest, root),
              logger,
              new GitignoreUseCase(fs)
            ).execute({ projectRoot: root, force: true });
      await expect(action).rejects.toThrow(/edited/);
      expect(await fs.readFile(join(root, source))).toBe("Installed active rule");
      expect(await fs.readFile(join(root, "opencode.json"))).toBe("{}\n");
      expect(await fs.readFile(join(root, "AGENTS.md"))).toBe(edited);
    }
  );

  it("sync refreshes changed editable sources", async () => {
    await fs.writeFile(join(root, source), "Revised active rule");
    const useCase = new RestoreUseCase(
      fs,
      new InMemoryManifestRepository(manifest, root),
      hasher,
      logger,
      { current: () => "linux" },
      new RecordingPrompter(true)
    );
    await useCase.execute({ projectRoot: root, toolIds: ["opencode"], manifest });
    const active = await fs.readFile(join(root, "AGENTS.md"));
    expect(active).toContain("Revised active rule");
    expect(active).not.toContain("Installed active rule");
  });

  it("plugin materialization rejects unsafe prospective rules before writing unrelated plugin files", async () => {
    const content = "<!-- aidd_opencode_rules:end -->";
    await expect(
      writePluginFiles(
        [
          new InstallationFile({ relativePath: source, content, hash: hasher.hash(content) }),
          new InstallationFile({
            relativePath: ".opencode/agents/new.md",
            content: "Agent",
            hash: hasher.hash("Agent"),
          }),
        ],
        root,
        fs,
        "opencode"
      )
    ).rejects.toThrow(/Unsafe/);
    expect(await fs.readFile(join(root, source))).toBe("Installed active rule");
    expect(await fs.fileExists(join(root, ".opencode/agents/new.md"))).toBe(false);
  });
});
