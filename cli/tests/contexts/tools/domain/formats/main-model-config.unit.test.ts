import { describe, expect, it } from "vitest";
import {
  mainModelValues,
  planMainModelInstall,
  planMainModelRemoval,
} from "../../../../../src/contexts/tools/domain/formats/main-model-config.js";

describe("main model settings", () => {
  it.each([
    ["claude", "anthropic", { model: "claude-opus-5-5", effortLevel: "high" }],
    // OpenCode's root `model` keeps no variant, so no effort is written.
    ["opencode", "mistral", { model: "mistral/mistral-large-4" }],
  ] as const)(
    "resolves %s / %s to its smart model, in native settings",
    (host, provider, expected) => {
      expect(mainModelValues(host, provider)).toStrictEqual(expected);
    }
  );

  it.each([
    ["codex", "openai"],
    ["copilot", "openai"],
    ["cursor", "anthropic"],
    ["kilo", "mistral"],
  ] as const)("leaves %s without a file-based main model", (host, provider) => {
    expect(mainModelValues(host, provider)).toStrictEqual({});
  });

  it("merges JSON settings, keeping other keys, and restores the previous value", () => {
    const content = '{\n  "model": "opus",\n  "hooks": { "a": 1 }\n}';
    const { content: next, record } = planMainModelInstall(content, { model: "x" }, undefined);
    expect(next).toBe('{\n  "model": "x",\n  "hooks": {\n    "a": 1\n  }\n}\n');
    expect(record).toStrictEqual({
      written: { model: "x" },
      previous: { model: "opus" },
      created: false,
    });
    expect(planMainModelRemoval(next, record)).toBe(
      '{\n  "model": "opus",\n  "hooks": {\n    "a": 1\n  }\n}\n'
    );
  });

  it("refuses JSON it cannot parse, or a value that is not a string", () => {
    expect(() => planMainModelInstall("// mine\n{}", { model: "x" }, undefined)).toThrow();
    expect(() => planMainModelInstall("[]", { model: "x" }, undefined)).toThrow(
      "must contain a JSON object"
    );
    expect(() => planMainModelInstall('{ "model": 1 }', { model: "x" }, undefined)).toThrow(
      '"model" is not a string'
    );
  });

  it("keeps what each key held before AIDD first wrote it", () => {
    const first = planMainModelInstall(null, { model: "x" }, undefined);
    const again = planMainModelInstall(first.content, { model: "y" }, first.record);
    expect(again.record).toStrictEqual({
      written: { model: "y" },
      previous: { model: null },
      created: true,
    });
  });

  it("restores only unchanged keys and deletes a file it created once empty", () => {
    const values = { model: "x", effortLevel: "high" };
    const created = planMainModelInstall(null, values, undefined);
    expect(planMainModelRemoval(created.content, created.record)).toBeNull();
    const edited = created.content.replace('"high"', '"low"');
    expect(planMainModelRemoval(edited, created.record)).toBe('{\n  "effortLevel": "low"\n}\n');
    const kept = planMainModelInstall("{}", { model: "x" }, undefined);
    expect(planMainModelRemoval(kept.content, kept.record)).toBe("{}\n");
  });

  it("leaves missing, unreadable or user-edited settings untouched on removal", () => {
    const record = { written: { model: "x" }, previous: { model: null }, created: false };
    expect(planMainModelRemoval(null, record)).toBeNull();
    expect(planMainModelRemoval("// broken", record)).toBe("// broken");
    expect(planMainModelRemoval('{"model":"mine"}', record)).toBe('{"model":"mine"}');
  });
});
