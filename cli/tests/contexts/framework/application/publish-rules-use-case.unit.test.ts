import "../../../../src/contexts/tools/domain/profiles/opencode/profile.js";
import { describe, expect, it } from "vitest";
import { PublishRulesUseCase } from "../../../../src/contexts/framework/application/publish-rules-use-case.js";
import { InMemoryFileAdapter } from "../../../helpers/ports/in-memory-file-adapter.js";

const root = "/project";
const path = ".opencode/rules/a.md";
const source = `${root}/${path}`;
const target = `${root}/AGENTS.md`;

describe("safe rule publication", () => {
  it("writes prospective source and active instructions without a manifest", async () => {
    const fs = new InMemoryFileAdapter({ [target]: "User\r\n" });
    const useCase = new PublishRulesUseCase(fs);
    await useCase.execute({
      toolId: "opencode",
      projectRoot: root,
      changes: new Map([[path, "Rule one"]]),
    });
    const first = await fs.readFile(target);
    expect(first).toContain("User\r\n");
    expect(first).toContain("Rule one");
    await useCase.execute({ toolId: "opencode", projectRoot: root });
    expect(await fs.readFile(target)).toBe(first);
    await useCase.execute({
      toolId: "opencode",
      projectRoot: root,
      changes: new Map([[path, null]]),
    });
    expect(await fs.readFile(target)).toBe("User\r\n");
    expect(await fs.fileExists(source)).toBe(false);
  });

  it("refuses an edited block before changing the source", async () => {
    const fs = new InMemoryFileAdapter({ [source]: "Old source" });
    const useCase = new PublishRulesUseCase(fs);
    await useCase.execute({ toolId: "opencode", projectRoot: root });
    const edited = (await fs.readFile(target)).replace("Old source", "User edit");
    await fs.writeFile(target, edited);
    await expect(
      useCase.execute({
        toolId: "opencode",
        projectRoot: root,
        changes: new Map([[path, "New source"]]),
      })
    ).rejects.toThrow(/edited/);
    expect(await fs.readFile(source)).toBe("Old source");
    expect(await fs.readFile(target)).toBe(edited);
  });

  it("preflights every prospective source before any source mutation", async () => {
    const fs = new InMemoryFileAdapter({ [source]: "Old source" });
    await expect(
      new PublishRulesUseCase(fs).execute({
        toolId: "opencode",
        projectRoot: root,
        changes: new Map([
          [path, "New source"],
          [".opencode/rules/b.md", "```\nunclosed"],
        ]),
      })
    ).rejects.toThrow(/fence/);
    expect(await fs.readFile(source)).toBe("Old source");
    expect(await fs.fileExists(target)).toBe(false);
  });

  it("creates no AGENTS.md for an empty source set", async () => {
    const fs = new InMemoryFileAdapter();
    await new PublishRulesUseCase(fs).execute({ toolId: "opencode", projectRoot: root });
    expect(await fs.fileExists(target)).toBe(false);
  });

  it("refuses a frontmatter fence escape before replacing either project file", async () => {
    const fs = new InMemoryFileAdapter({ [source]: "Original source", [target]: "User\r\n" });
    const useCase = new PublishRulesUseCase(fs);
    await useCase.execute({ toolId: "opencode", projectRoot: root });
    const agents = await fs.readFile(target);
    await expect(
      useCase.execute({
        toolId: "opencode",
        projectRoot: root,
        changes: new Map([
          [path, "---\ndescription: |\n  ```\n---\n<!-- aidd_opencode_rules:end -->\n```\n"],
        ]),
      })
    ).rejects.toThrow();
    expect(await fs.readFile(source)).toBe("Original source");
    expect(await fs.readFile(target)).toBe(agents);
  });

  it("refuses escaping source paths and symlinked targets", async () => {
    const fs = new InMemoryFileAdapter({ [source]: "Rule", [target]: "User" });
    const useCase = new PublishRulesUseCase(fs);
    await expect(
      useCase.execute({
        toolId: "opencode",
        projectRoot: root,
        changes: new Map([[".opencode/rules/../../outside.md", "New"]]),
      })
    ).rejects.toThrow(/path/);
    fs.setSymlink(target, "/outside/AGENTS.md");
    await expect(useCase.execute({ toolId: "opencode", projectRoot: root })).rejects.toThrow(
      /outside/
    );
    expect(await fs.readFile(target)).toBe("User");
  });
});
