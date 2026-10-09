import { describe, expect, it } from "vitest";
import { publishOpencodeRules } from "../../../../../../src/contexts/tools/domain/profiles/opencode/opencode-rule-block.js";

const rule = { path: ".opencode/rules/a.md", content: "Apply SENTINEL.\n" };

describe("OpenCode V2 active rule contribution", () => {
  it.each(["", "User text", "User text\n", "User text\r\n"])(
    "preserves outside bytes and removes the last contribution: %j",
    (user) => {
      const original = `${user}<!-- aidd_project_memory:start -->\r\nMemory\r\n<!-- aidd_project_memory:end -->`;
      const published = publishOpencodeRules(original, [rule]);
      expect(published).toContain(original);
      expect(published).toContain(rule.content.trim());
      expect(publishOpencodeRules(published, [rule])).toBe(published);
      expect(publishOpencodeRules(published, [])).toBe(original);
    }
  );

  it("sorts sources and expresses scope as model instructions", () => {
    const scoped = {
      path: ".opencode/rules/z.md",
      content: '---\nglobs: ["src/**"]\nalwaysApply: false\n---\nScoped text.\n',
    };
    const first = publishOpencodeRules("", [scoped, rule]);
    expect(first).toBe(publishOpencodeRules("", [rule, scoped]));
    expect(first.indexOf("SENTINEL")).toBeLessThan(first.indexOf("Scoped text"));
    expect(first).toContain("src/**");
    expect(first).toContain("instruction to the model");
  });

  it("updates stale text and preserves suffix content", () => {
    const first = `${publishOpencodeRules("User\n", [rule])}Suffix\r\n`;
    const updated = publishOpencodeRules(first, [{ ...rule, content: "Replacement" }]);
    expect(updated).not.toContain("SENTINEL");
    expect(updated).toContain("Replacement");
    expect(publishOpencodeRules(updated, [])).toBe("User\nSuffix\r\n");
  });

  it("refuses an edited, duplicated or incomplete contribution", () => {
    const first = publishOpencodeRules("", [rule]);
    for (const unsafe of [
      first.replace("SENTINEL", "EDITED"),
      first + first,
      first.replace("<!-- aidd_opencode_rules:end -->", ""),
      first.replace("<!-- aidd_opencode_rules:end -->", "<!-- aidd_opencode_rules:end --> "),
    ]) {
      expect(() => publishOpencodeRules(unsafe, [rule])).toThrow(/AGENTS.md/);
    }
  });

  it("ignores fenced marker examples, but refuses unsafe prospective text", () => {
    const example =
      "```markdown\n<!-- aidd_opencode_rules:start -->\n<!-- aidd_opencode_rules:end -->\n```\n";
    const first = publishOpencodeRules(example, [rule]);
    expect(publishOpencodeRules(first, [])).toBe(example);
    const sourceExample = publishOpencodeRules("", [{ ...rule, content: example }]);
    expect(publishOpencodeRules(sourceExample, [{ ...rule, content: example }])).toBe(
      sourceExample
    );
    for (const content of [
      "<!-- aidd_opencode_rules:end -->",
      "```\nunclosed",
      "---\nglobs: x\n",
      "NUL\0text",
    ]) {
      expect(() => publishOpencodeRules("", [{ ...rule, content }])).toThrow();
    }
  });

  it("does not create an empty contribution", () => {
    expect(publishOpencodeRules("", [])).toBe("");
  });

  it.each([
    "---\ndescription: |\n  ```\n---\n<!-- aidd_opencode_rules:end -->\n```\n",
    "---\nalwaysApply: false\ndescription: |\n  ```\n  <!-- aidd_opencode_rules:end -->\n  ```\n---\nSafe body\n",
  ])("rejects markers exposed by rendering frontmatter: %j", (content) => {
    expect(() => publishOpencodeRules("User\n", [{ ...rule, content }])).toThrow();
  });
});
