import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InstallMemoryStubUseCase } from "../../../../src/application/use-cases/install/install-memory-stub-use-case.js";
import { InstallationFile } from "../../../../src/domain/models/file.js";
import { Manifest } from "../../../../src/domain/models/manifest.js";
import type { Logger } from "../../../../src/domain/ports/logger.js";
import { FileSystemAdapter } from "../../../../src/infrastructure/adapters/file-system-adapter.js";
import { HasherAdapter } from "../../../../src/infrastructure/adapters/hasher-adapter.js";
import { BundledAssetProviderAdapter } from "../../../../src/infrastructure/assets/asset-loader.js";

class CapturingLogger implements Logger {
  warnings: string[] = [];
  debug(): void {}
  info(): void {}
  warn(message: string): void {
    this.warnings.push(message);
  }
}

describe("InstallMemoryStubUseCase", () => {
  let projectRoot: string;
  let logger: CapturingLogger;
  let useCase: InstallMemoryStubUseCase;

  beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), "memory-stub-"));
    const hasher = new HasherAdapter();
    const fs = new FileSystemAdapter(hasher);
    logger = new CapturingLogger();
    useCase = new InstallMemoryStubUseCase(fs, hasher, logger, new BundledAssetProviderAdapter());
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
  });

  it("returns CLAUDE.md installation file for claude when absent", async () => {
    const manifest = Manifest.create();

    const files = await useCase.execute({ toolId: "claude", projectRoot, manifest });

    expect(files).toHaveLength(1);
    expect(files[0]?.relativePath).toBe("CLAUDE.md");
    expect(files[0]?.content).toContain("aidd_docs/memory/");
  });

  it("returns AGENTS.md for cursor/opencode/codex", async () => {
    const manifest = Manifest.create();

    for (const tool of ["cursor", "opencode", "codex"] as const) {
      const files = await useCase.execute({ toolId: tool, projectRoot, manifest });
      expect(files[0]?.relativePath).toBe("AGENTS.md");
    }
  });

  it("returns .github/copilot-instructions.md for copilot", async () => {
    const files = await useCase.execute({
      toolId: "copilot",
      projectRoot,
      manifest: Manifest.create(),
    });

    expect(files[0]?.relativePath).toBe(".github/copilot-instructions.md");
  });

  it("skips with warn when file exists but is untracked", async () => {
    await writeFile(join(projectRoot, "CLAUDE.md"), "user-owned content", "utf-8");
    const manifest = Manifest.create();

    const files = await useCase.execute({ toolId: "claude", projectRoot, manifest });

    expect(files).toHaveLength(0);
    expect(logger.warnings).toHaveLength(1);
    expect(logger.warnings[0]).toContain("CLAUDE.md");
  });

  it("returns the stub when file exists but is tracked by manifest", async () => {
    const hasher = new HasherAdapter();
    const fs = new FileSystemAdapter(hasher);
    const stubProvider = new BundledAssetProviderAdapter();
    const stub = stubProvider.loadMemoryStub("claude");
    await writeFile(join(projectRoot, stub.fileName), stub.content, "utf-8");
    const manifest = Manifest.create();
    manifest.addTool("claude", "1.0.0", [
      new InstallationFile({
        relativePath: stub.fileName,
        content: stub.content,
        hash: hasher.hash(stub.content),
      }),
    ]);
    const useCaseTracked = new InstallMemoryStubUseCase(fs, hasher, logger, stubProvider);

    const files = await useCaseTracked.execute({ toolId: "claude", projectRoot, manifest });

    expect(files).toHaveLength(1);
    expect(logger.warnings).toHaveLength(0);
    expect(await readFile(join(projectRoot, stub.fileName), "utf-8")).toBe(stub.content);
  });
});
