import { describe, expect, it } from "vitest";
import {
  planMainModelInstall,
  planMainModelRemoval,
} from "../../../../src/contexts/installation/infrastructure/jsonc-main-session-settings.js";

const P = "/home/me/.claude/settings.json";

describe("main model settings", () => {
  it("sets the model, leaving the rest of the file as written, and restores the previous value", () => {
    const content = '{\n  "model": "opus",\n  "hooks": { "a": 1 }\n}';
    const { content: next, record } = planMainModelInstall({
      path: P,
      content,
      values: { model: "x" },
      record: undefined,
    });
    expect(next).toBe('{\n  "model": "x",\n  "hooks": { "a": 1 }\n}\n');
    expect(record).toStrictEqual({
      path: P,
      written: { model: "x" },
      previous: { model: "opus" },
      created: false,
    });
    expect(planMainModelRemoval(next, record)).toBe(
      '{\n  "model": "opus",\n  "hooks": { "a": 1 }\n}\n'
    );
  });

  it("refuses a file holding no object, or a value that is not a string", () => {
    expect(() =>
      planMainModelInstall({ path: P, content: "[]", values: { model: "x" }, record: undefined })
    ).toThrow("no JSON object");
    expect(() =>
      planMainModelInstall({
        path: P,
        content: '{ "model": 1 }',
        values: { model: "x" },
        record: undefined,
      })
    ).toThrow('"model" is not a string');
  });

  it("keeps comments and trailing commas, on install and on removal", () => {
    const commented = '{\n  // mine\n  "model": "opus",\n}\n';
    const { content, record } = planMainModelInstall({
      path: P,
      content: commented,
      values: { model: "x" },
      record: undefined,
    });
    expect(content).toBe('{\n  // mine\n  "model": "x",\n}\n');
    expect(planMainModelRemoval(content, record)).toBe(commented);
  });

  it("heads a file it creates with the schema, and deletes that file once nothing else is in it", () => {
    const { content, record } = planMainModelInstall({
      path: P,
      content: null,
      values: { model: "x" },
      record: undefined,
      schema: "https://example.test/schema.json",
    });
    expect(content).toBe(
      '{\n  "$schema": "https://example.test/schema.json",\n  "model": "x"\n}\n'
    );
    expect(planMainModelRemoval(content, record)).toBeNull();
    expect(planMainModelRemoval(content.replace("{\n", "{\n  // mine\n"), record)).toContain(
      "// mine"
    );
  });

  it("leaves an existing file's schema to its owner", () => {
    const { content } = planMainModelInstall({
      path: P,
      content: "{}",
      values: { model: "x" },
      record: undefined,
      schema: "https://s.test",
    });
    expect(content).not.toContain("$schema");
  });

  it("keeps what each key held before AIDD first wrote it", () => {
    const first = planMainModelInstall({
      path: P,
      content: null,
      values: { model: "x" },
      record: undefined,
    });
    const again = planMainModelInstall({
      path: P,
      content: first.content,
      values: { model: "y" },
      record: first.record,
    });
    expect(again.record).toStrictEqual({
      path: P,
      written: { model: "y" },
      previous: { model: null },
      created: true,
    });
  });

  it("takes a value the person set since AIDD wrote its own as the one to restore", () => {
    const first = planMainModelInstall({
      path: P,
      content: '{ "model": "opus" }',
      values: { model: "x" },
      record: undefined,
    });
    const edited = first.content.replace('"x"', '"haiku"');
    const again = planMainModelInstall({
      path: P,
      content: edited,
      values: { model: "y" },
      record: first.record,
    });
    expect(again.record.previous).toStrictEqual({ model: "haiku" });
    expect(planMainModelRemoval(again.content, again.record)).toBe('{ "model": "haiku" }\n');
  });

  it("counts a file deleted since AIDD wrote it as one AIDD creates again", () => {
    const first = planMainModelInstall({
      path: P,
      content: "{}",
      values: { model: "x" },
      record: undefined,
    });
    const again = planMainModelInstall({
      path: P,
      content: null,
      values: { model: "y" },
      record: first.record,
    });
    expect(again.record.created).toBe(true);
    expect(planMainModelRemoval(again.content, again.record)).toBeNull();
  });

  it("restores only unchanged keys and deletes a file it created once empty", () => {
    const values = { model: "x", effortLevel: "high" };
    const created = planMainModelInstall({ path: P, content: null, values, record: undefined });
    expect(planMainModelRemoval(created.content, created.record)).toBeNull();
    const edited = created.content.replace('"high"', '"low"');
    expect(planMainModelRemoval(edited, created.record)).toBe('{\n  "effortLevel": "low"\n}\n');
    const kept = planMainModelInstall({
      path: P,
      content: "{}",
      values: { model: "x" },
      record: undefined,
    });
    expect(planMainModelRemoval(kept.content, kept.record)).toBe("{\n}\n");
  });

  it("leaves missing or user-edited settings untouched on removal, and refuses unreadable ones", () => {
    const record = { path: P, written: { model: "x" }, previous: { model: null }, created: false };
    expect(planMainModelRemoval(null, record)).toBeNull();
    expect(planMainModelRemoval('{"model":"mine"}', record)).toBe('{"model":"mine"}');
    expect(() => planMainModelRemoval("// broken", record)).toThrow("no JSON object");
  });
});
