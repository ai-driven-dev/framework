import { describe, expect, it } from "vitest";
import {
  mainModelValues,
  planMainModelInstall,
  planMainModelRemoval,
} from "../../../../../src/contexts/tools/domain/formats/main-model-config.js";

const codex = { model: "gpt-6.1-sol", model_reasoning_effort: "medium" };

describe("main model settings", () => {
  it.each([
    ["claude", "anthropic", { model: "claude-opus-5-5", effortLevel: "high" }],
    ["codex", "openai", { model: "gpt-6.1-sol", model_reasoning_effort: "high" }],
    // OpenCode's root `model` keeps no variant, so no effort is written.
    ["opencode", "mistral", { model: "mistral/mistral-large-4" }],
  ] as const)(
    "resolves %s / %s to its smart model, in native settings",
    (host, provider, expected) => {
      expect(mainModelValues(host, provider)).toStrictEqual(expected);
    }
  );

  it.each([
    ["copilot", "openai"],
    ["cursor", "anthropic"],
    ["kilo", "mistral"],
  ] as const)("leaves %s without a file-based main model", (host, provider) => {
    expect(mainModelValues(host, provider)).toStrictEqual({});
  });

  it("merges JSON settings, keeping other keys, indentation and a BOM", () => {
    const content = '﻿{\n    "model": "opus",\n    "hooks": { "a": 1 }\n}';
    const { content: next, record } = planMainModelInstall(
      content,
      "json",
      { model: "x" },
      undefined
    );
    expect(next).toBe('﻿{\n    "model": "x",\n    "hooks": {\n        "a": 1\n    }\n}\n');
    expect(record).toStrictEqual({
      written: { model: "x" },
      previous: { model: "opus" },
      created: false,
    });
    expect(planMainModelRemoval(next, "json", record)).toContain('"model": "opus"');
  });

  it("refuses JSON it cannot parse instead of overwriting it", () => {
    expect(() => planMainModelInstall("// mine\n{}", "json", { model: "x" }, undefined)).toThrow();
  });

  it("edits top-level TOML lines, keeping comments, tables and CRLF endings", () => {
    const content = '# mine\r\nmodel = "old" # keep\r\n\r\n[profiles.fast]\r\nmodel = "table"\r\n';
    const { content: next, record } = planMainModelInstall(content, "toml", codex, undefined);
    expect(next).toBe(
      'model_reasoning_effort = "medium"\r\n# mine\r\nmodel = "gpt-6.1-sol" # keep\r\n\r\n[profiles.fast]\r\nmodel = "table"\r\n'
    );
    expect(planMainModelRemoval(next, "toml", record)).toBe(
      '# mine\r\nmodel = "old" # keep\r\n\r\n[profiles.fast]\r\nmodel = "table"\r\n'
    );
  });

  it.each([
    ["a multi-line string", 'instructions = """\nmodel = "x"\n"""\n'],
    ["a quoted key", '"model" = "old"\n'],
    ["a dotted key", "model.x = 1\n"],
    ["a multi-line array", 'list = [\n  [1, 2],\n]\nmodel = "old"\n'],
  ])("refuses to edit TOML with %s", (_, content) => {
    expect(() => planMainModelInstall(content, "toml", codex, undefined)).toThrow();
  });

  it("refuses to overwrite a value changed since AIDD set it", () => {
    const first = planMainModelInstall(null, "json", { model: "x" }, undefined);
    const edited = first.content.replace('"x"', '"mine"');
    expect(() => planMainModelInstall(edited, "json", { model: "y" }, first.record)).toThrow(
      /changed since AIDD/
    );
    const again = planMainModelInstall(first.content, "json", { model: "y" }, first.record);
    expect(again.record.previous).toStrictEqual({ model: null });
  });

  it("restores only unchanged keys and deletes a file it created once empty", () => {
    const created = planMainModelInstall(null, "toml", codex, undefined);
    expect(planMainModelRemoval(created.content, "toml", created.record)).toBeNull();
    const edited = created.content.replace('"medium"', '"high"');
    expect(planMainModelRemoval(edited, "toml", created.record)).toBe(
      'model_reasoning_effort = "high"\n'
    );
    const kept = planMainModelInstall("{}", "json", { model: "x" }, undefined);
    expect(planMainModelRemoval(kept.content, "json", kept.record)).toBe("{}\n");
  });

  it("leaves unreadable settings untouched on removal", () => {
    const record = { written: { model: "x" }, previous: { model: null }, created: false };
    expect(planMainModelRemoval("// broken", "json", record)).toBe("// broken");
  });
});
