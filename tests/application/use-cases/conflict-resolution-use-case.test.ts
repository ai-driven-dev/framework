import { describe, expect, it, vi } from "vitest";
import { ConflictResolutionUseCase } from "../../../src/application/use-cases/conflict-resolution-use-case.js";
import type { Prompter } from "../../../src/domain/ports/prompter.js";

function buildMockPrompter(selectResponses: string[]): Prompter & { selectCallCount: number } {
  let idx = 0;
  const prompter = {
    selectCallCount: 0,
    resolveConflict: vi.fn().mockResolvedValue("overwrite"),
    confirm: vi.fn().mockResolvedValue(true),
    input: vi.fn().mockResolvedValue(""),
    select: vi.fn().mockImplementation(() => {
      prompter.selectCallCount++;
      const response = selectResponses[idx++] ?? selectResponses[selectResponses.length - 1];
      return Promise.resolve(response);
    }),
    checkbox: vi.fn().mockResolvedValue([]),
  };
  return prompter;
}

describe("ConflictResolutionUseCase", () => {
  it("returns empty map when no paths given", async () => {
    const prompter = buildMockPrompter([]);
    const useCase = new ConflictResolutionUseCase(prompter);

    const result = await useCase.execute([]);

    expect(result.size).toBe(0);
    expect(prompter.select).not.toHaveBeenCalled();
  });

  it("global 'overwrite all' maps all paths to overwrite", async () => {
    // First select: "global", second select: "overwrite all"
    const prompter = buildMockPrompter(["global", "overwrite all"]);
    const useCase = new ConflictResolutionUseCase(prompter);

    const paths = ["/project/a.md", "/project/b.md"];
    const result = await useCase.execute(paths);

    expect(result.get("/project/a.md")).toBe("overwrite");
    expect(result.get("/project/b.md")).toBe("overwrite");
  });

  it("global 'skip all' maps all paths to skip", async () => {
    const prompter = buildMockPrompter(["global", "skip all"]);
    const useCase = new ConflictResolutionUseCase(prompter);

    const paths = ["/project/a.md", "/project/b.md"];
    const result = await useCase.execute(paths);

    expect(result.get("/project/a.md")).toBe("skip");
    expect(result.get("/project/b.md")).toBe("skip");
  });

  it("global 'backup all' maps all paths to backup", async () => {
    const prompter = buildMockPrompter(["global", "backup all"]);
    const useCase = new ConflictResolutionUseCase(prompter);

    const paths = ["/project/a.md", "/project/b.md", "/project/c.md"];
    const result = await useCase.execute(paths);

    expect(result.get("/project/a.md")).toBe("backup");
    expect(result.get("/project/b.md")).toBe("backup");
    expect(result.get("/project/c.md")).toBe("backup");
  });

  it("one-by-one: handles overwrite, skip, and backup per file", async () => {
    // First select: "one-by-one", then per-file: "overwrite", "skip", "backup"
    const prompter = buildMockPrompter(["one-by-one", "overwrite", "skip", "backup"]);
    const useCase = new ConflictResolutionUseCase(prompter);

    const paths = ["/project/a.md", "/project/b.md", "/project/c.md"];
    const result = await useCase.execute(paths);

    expect(result.get("/project/a.md")).toBe("overwrite");
    expect(result.get("/project/b.md")).toBe("skip");
    expect(result.get("/project/c.md")).toBe("backup");
  });

  it("one-by-one: returns correct decisions for overwrite and skip without backup", async () => {
    const prompter = buildMockPrompter(["one-by-one", "overwrite", "skip"]);
    const useCase = new ConflictResolutionUseCase(prompter);

    const result = await useCase.execute(["/project/a.md", "/project/b.md"]);

    expect(result.get("/project/a.md")).toBe("overwrite");
    expect(result.get("/project/b.md")).toBe("skip");
  });
});
