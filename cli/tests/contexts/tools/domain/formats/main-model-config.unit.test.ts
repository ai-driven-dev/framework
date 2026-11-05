import { describe, expect, it } from "vitest";
import {
  mainModelValues,
  planMainModelInstall,
  planMainModelRemoval,
} from "../../../../../src/contexts/tools/domain/formats/main-model-config.js";

const P = "/home/me/.claude/settings.json";

describe("main model settings", () => {
  it.each([
    ["claude", "anthropic", { model: "claude-sonnet-5-5", effortLevel: "medium" }],
    // OpenCode's root `model` keeps no variant, so no effort is written.
    ["opencode", "mistral", { model: "mistral/mistral-large-4" }],
  ] as const)(
    "resolves %s / %s to the main session's tier model, in native settings",
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
    const { content: next, record } = planMainModelInstall(P, content, { model: "x" }, undefined);
    expect(next).toBe('{\n  "model": "x",\n  "hooks": {\n    "a": 1\n  }\n}\n');
    expect(record).toStrictEqual({
      path: P,
      written: { model: "x" },
      previous: { model: "opus" },
      created: false,
    });
    expect(planMainModelRemoval(next, record)).toBe(
      '{\n  "model": "opus",\n  "hooks": {\n    "a": 1\n  }\n}\n'
    );
  });

  it("refuses a file holding comments, one holding no object, or a value that is not a string", () => {
    expect(() =>
      planMainModelInstall(P, '{\n  // mine\n  "a": 1\n}', { model: "x" }, undefined)
    ).toThrow("comments");
    expect(() => planMainModelInstall(P, "[]", { model: "x" }, undefined)).toThrow(
      "no JSON object"
    );
    expect(() => planMainModelInstall(P, '{ "model": 1 }', { model: "x" }, undefined)).toThrow(
      '"model" is not a string'
    );
  });

  it("keeps what each key held before AIDD first wrote it", () => {
    const first = planMainModelInstall(P, null, { model: "x" }, undefined);
    const again = planMainModelInstall(P, first.content, { model: "y" }, first.record);
    expect(again.record).toStrictEqual({
      path: P,
      written: { model: "y" },
      previous: { model: null },
      created: true,
    });
  });

  it("takes a value the person set since AIDD wrote its own as the one to restore", () => {
    const first = planMainModelInstall(P, '{ "model": "opus" }', { model: "x" }, undefined);
    const edited = first.content.replace('"x"', '"haiku"');
    const again = planMainModelInstall(P, edited, { model: "y" }, first.record);
    expect(again.record.previous).toStrictEqual({ model: "haiku" });
    expect(planMainModelRemoval(again.content, again.record)).toBe('{\n  "model": "haiku"\n}\n');
  });

  it("counts a file deleted since AIDD wrote it as one AIDD creates again", () => {
    const first = planMainModelInstall(P, "{}", { model: "x" }, undefined);
    const again = planMainModelInstall(P, null, { model: "y" }, first.record);
    expect(again.record.created).toBe(true);
    expect(planMainModelRemoval(again.content, again.record)).toBeNull();
  });

  it("restores only unchanged keys and deletes a file it created once empty", () => {
    const values = { model: "x", effortLevel: "high" };
    const created = planMainModelInstall(P, null, values, undefined);
    expect(planMainModelRemoval(created.content, created.record)).toBeNull();
    const edited = created.content.replace('"high"', '"low"');
    expect(planMainModelRemoval(edited, created.record)).toBe('{\n  "effortLevel": "low"\n}\n');
    const kept = planMainModelInstall(P, "{}", { model: "x" }, undefined);
    expect(planMainModelRemoval(kept.content, kept.record)).toBe("{}\n");
  });

  it("leaves missing or user-edited settings untouched on removal, and refuses unreadable ones", () => {
    const record = { path: P, written: { model: "x" }, previous: { model: null }, created: false };
    expect(planMainModelRemoval(null, record)).toBeNull();
    expect(planMainModelRemoval('{"model":"mine"}', record)).toBe('{"model":"mine"}');
    expect(() => planMainModelRemoval("// broken", record)).toThrow("comments or trailing commas");
  });
});
