import { lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ManageAgentsUseCase } from "../../../../../src/contexts/framework/application/agents/manage-agents-use-case.js";
import { CleanUseCase } from "../../../../../src/contexts/framework/application/clean-use-case.js";
import { GitignoreUseCase } from "../../../../../src/contexts/framework/application/gitignore-use-case.js";
import { Manifest } from "../../../../../src/contexts/framework/domain/manifest.js";
import { AgentInstallationStoreAdapter } from "../../../../../src/contexts/framework/infrastructure/agent-installation-store-adapter.js";
import "../../../../../src/contexts/tools/domain/profiles/codex/profile.js";
import "../../../../../src/contexts/tools/domain/profiles/opencode/profile.js";
import { InstallationFile } from "../../../../../src/kernel/file.js";
import { FileAdapter } from "../../../../../src/runtime/filesystem/file-adapter.js";
import { HasherAdapter } from "../../../../../src/runtime/filesystem/hasher-adapter.js";
import { CapturingLogger } from "../../../../helpers/ports/capturing-logger.js";
import { InMemoryManifestRepository } from "../../../../helpers/ports/in-memory-manifest-repository.js";

describe("clean includes opt-in agents", () => {
  let root: string;
  let manager: ManageAgentsUseCase;
  let fs: FileAdapter;
  let hasher: HasherAdapter;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "aidd-clean-agents-"));
    hasher = new HasherAdapter();
    fs = new FileAdapter(hasher);
    manager = new ManageAgentsUseCase(fs, new AgentInstallationStoreAdapter(fs), hasher, {
      "aidd-dev-explorer": "---\nname: explorer\ndescription: Explore\n---\nExplore source.",
    });
    await manager.install({ projectRoot: root, host: "codex", provider: "openai" });
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  function clean(manifest: Manifest | null = null): CleanUseCase {
    return new CleanUseCase(
      fs,
      new InMemoryManifestRepository(manifest, root),
      new CapturingLogger(),
      new GitignoreUseCase(fs),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      manager
    );
  }

  it("previews and removes agents in a project without a framework manifest", async () => {
    const useCase = clean();
    const preview = await useCase.execute({ projectRoot: root, force: false });
    expect(preview.dryRun).toBe(true);
    expect(preview.preview.tools).toEqual([{ toolId: "codex", fileCount: 1 }]);
    expect(await readFile(join(root, ".codex/agents/aidd-dev-explorer.toml"), "utf8")).toContain(
      "Explore"
    );
    expect((await useCase.execute({ projectRoot: root, force: true })).fileCount).toBe(1);
    await expect(readFile(join(root, ".aidd/agents.json"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("keeps personal configuration beside the agent ledger", async () => {
    await writeFile(join(root, ".aidd/config.json"), "{}");
    await clean().execute({ projectRoot: root, force: true });
    expect(await readFile(join(root, ".aidd/config.json"), "utf8")).toBe("{}");
  });

  it("keeps personal directory links beside the agent ledger", async () => {
    const personal = join(root, "personal");
    await mkdir(personal);
    await writeFile(join(personal, "note.txt"), "personal");
    const link = join(root, ".aidd", "personal-link");
    await symlink(personal, link, "junction");
    await clean().execute({ projectRoot: root, force: true });
    expect((await lstat(link)).isSymbolicLink()).toBe(true);
    expect(await readFile(join(link, "note.txt"), "utf8")).toBe("personal");
  });

  it("counts agents once alongside framework files and other opted-in hosts", async () => {
    const manifest = Manifest.create();
    manifest.addTool("codex", "1.0.0", [
      new InstallationFile({
        relativePath: ".codex/rule.md",
        content: "rule",
        hash: hasher.hash("rule"),
      }),
    ]);
    await fs.writeFile(join(root, ".codex/rule.md"), "rule");
    await manager.install({ projectRoot: root, host: "opencode", provider: "openai" });
    const useCase = clean(manifest);
    const preview = await useCase.execute({ projectRoot: root, force: false });
    expect(preview.preview.tools).toEqual([
      { toolId: "codex", fileCount: 2 },
      { toolId: "opencode", fileCount: 1 },
    ]);
    expect(preview.preview.totalFileCount).toBe(3);
    expect((await useCase.execute({ projectRoot: root, force: true })).fileCount).toBe(3);
    await expect(readFile(join(root, ".codex/rule.md"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(root, ".aidd/agents.json"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("rejects modified agents before deleting framework files", async () => {
    const manifest = Manifest.create();
    manifest.addTool("codex", "1.0.0", [
      new InstallationFile({
        relativePath: ".codex/rule.md",
        content: "rule",
        hash: hasher.hash("rule"),
      }),
    ]);
    await fs.writeFile(join(root, ".codex/rule.md"), "rule");
    await writeFile(join(root, ".codex/agents/aidd-dev-explorer.toml"), "edited");
    await expect(clean(manifest).execute({ projectRoot: root, force: true })).rejects.toThrow(
      "modified"
    );
    expect(await readFile(join(root, ".codex/rule.md"), "utf8")).toBe("rule");
    expect(await readFile(join(root, ".aidd/agents.json"), "utf8")).toContain("codex");
  });
});
