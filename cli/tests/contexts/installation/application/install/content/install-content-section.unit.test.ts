import { describe, expect, it } from "vitest";
import {
  type ContentSectionCapability,
  type ContentSectionDescriptor,
  InstallContentSection,
} from "../../../../../../src/contexts/installation/application/install/content/install-content-section.js";
import type { ContentSection } from "../../../../../../src/contexts/installation/domain/canon.js";
import type { ContentSections } from "../../../../../../src/contexts/installation/ports/tool-sections.js";
import { FileHash } from "../../../../../../src/shared/domain/file-hash.js";
import { GITKEEP_FILE } from "../../../../../../src/shared/domain/redundant-gitkeeps.js";

const section: ContentSection = { name: "rules", directory: "rules", entryFile: null };

function capability(overrides: Partial<ContentSectionCapability> = {}): ContentSectionCapability {
  return {
    buildInstallPath: (name) => `out/${name}`,
    acceptsFileName: () => true,
    serialize: (frontmatter, body) => `${JSON.stringify(frontmatter)}|${body}`,
    ...overrides,
  };
}

function toolConfig(rewrite: (content: string) => string = (c) => c): ContentSections {
  return { markdownSection: () => null, skillsSection: () => null, rewriteContent: rewrite };
}

function build(cap: ContentSectionCapability | null) {
  const converted: string[] = [];
  const descriptor: ContentSectionDescriptor<ContentSectionCapability> = {
    answersOf: () => cap,
    convertFrontmatter: (_cap, frontmatter, relativeFileName) => {
      converted.push(relativeFileName);
      return { ...frontmatter, converted: true };
    },
  };
  return { useCase: new InstallContentSection(descriptor), converted };
}

describe("InstallContentSection", () => {
  it("returns nothing when the tool answers no capability for the section", () => {
    const { useCase } = build(null);

    const files = useCase.execute({
      toolConfig: toolConfig(),
      section,
      contentFiles: new Map([["rules/a.md", "body"]]),
    });

    expect(files).toStrictEqual([]);
  });

  it("builds a file from the rewritten, converted and serialized content", () => {
    const { useCase, converted } = build(capability());

    const files = useCase.execute({
      toolConfig: toolConfig((c) => c.replace("OLD", "NEW")),
      section,
      contentFiles: new Map([["rules/sub/a.md", "---\nk: v\n---\nOLD body"]]),
    });

    const content = '{"k":"v","converted":true}|NEW body';
    expect(files).toHaveLength(1);
    expect(files[0].relativePath).toBe("out/sub/a.md");
    expect(files[0].frameworkPath).toBe("rules/sub/a.md");
    expect(files[0].content).toBe(content);
    expect(files[0].hash).toStrictEqual(FileHash.of(content));
    expect(converted).toStrictEqual(["sub/a.md"]);
  });

  it("skips files outside the section directory", () => {
    const { useCase } = build(capability());

    const files = useCase.execute({
      toolConfig: toolConfig(),
      section,
      contentFiles: new Map([
        ["rulesets/a.md", "x"],
        ["agents/a.md", "x"],
      ]),
    });

    expect(files).toStrictEqual([]);
  });

  it("skips files the capability does not accept", () => {
    const { useCase } = build(capability({ acceptsFileName: (name) => name === "keep.md" }));

    const files = useCase.execute({
      toolConfig: toolConfig(),
      section,
      contentFiles: new Map([
        ["rules/keep.md", "x"],
        ["rules/drop.md", "x"],
      ]),
    });

    expect(files.map((f) => f.frameworkPath)).toStrictEqual(["rules/keep.md"]);
  });

  it("skips files the capability gives no install path", () => {
    const { useCase } = build(capability({ buildInstallPath: () => null }));

    const files = useCase.execute({
      toolConfig: toolConfig(),
      section,
      contentFiles: new Map([["rules/a.md", "x"]]),
    });

    expect(files).toStrictEqual([]);
  });

  it("keeps only the entry file when the section names one", () => {
    const { useCase } = build(capability());

    const files = useCase.execute({
      toolConfig: toolConfig(),
      section: { ...section, entryFile: "RULE.md" },
      contentFiles: new Map([
        ["rules/a/RULE.md", "x"],
        ["rules/a/notes.md", "x"],
      ]),
    });

    expect(files.map((f) => f.frameworkPath)).toStrictEqual(["rules/a/RULE.md"]);
  });

  it("writes an empty file for a gitkeep, without converting it", () => {
    const { useCase, converted } = build(capability());

    const files = useCase.execute({
      toolConfig: toolConfig(),
      section,
      contentFiles: new Map([[`rules/dir/${GITKEEP_FILE}`, "ignored"]]),
    });

    expect(files).toHaveLength(1);
    expect(files[0].relativePath).toBe(`out/dir/${GITKEEP_FILE}`);
    expect(files[0].content).toBe("");
    expect(files[0].hash).toStrictEqual(FileHash.of(""));
    expect(converted).toStrictEqual([]);
  });
});
