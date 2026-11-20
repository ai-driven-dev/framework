import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { JsonParseError } from "../../../src/shared/domain/errors.js";
import { InMemoryFileAdapter } from "../testing/in-memory-file-adapter.fake.js";

const root = join("/", "merge");

describe("mergeIntoJsonFile", () => {
  let files: InMemoryFileAdapter;

  beforeEach(() => {
    files = new InMemoryFileAdapter();
  });

  describe("mergeJsonFile()", () => {
    it("creates file if it does not exist", async () => {
      const path = join(root, "new.json");
      await files.mergeJsonFile(path, JSON.stringify({ key: "value" }), "framework-prime");
      const result: unknown = JSON.parse(await files.readFile(path));
      expect(result).toEqual({ key: "value" });
    });

    it("merges new keys into existing JSON", async () => {
      const path = join(root, "merge.json");
      files.setFile(path, JSON.stringify({ existing: "data" }));
      await files.mergeJsonFile(path, JSON.stringify({ newKey: "newValue" }), "framework-prime");
      const result: unknown = JSON.parse(await files.readFile(path));
      expect(result).toMatchObject({ existing: "data", newKey: "newValue" });
    });

    describe("framework prime strategy", () => {
      it("incoming scalar values override existing values", async () => {
        const path = join(root, "override-framework-prime.json");
        files.setFile(path, JSON.stringify({ key: "old" }));
        await files.mergeJsonFile(path, JSON.stringify({ key: "new" }), "framework-prime");
        const result: unknown = JSON.parse(await files.readFile(path));
        expect(result).toMatchObject({ key: "new" });
      });
    });

    describe("user prime strategy", () => {
      it("existing scalar values win over incoming values", async () => {
        const path = join(root, "override-user-prime.json");
        files.setFile(path, JSON.stringify({ key: "user-value" }));
        await files.mergeJsonFile(path, JSON.stringify({ key: "framework-value" }), "user-prime");
        const result: unknown = JSON.parse(await files.readFile(path));
        expect(result).toMatchObject({ key: "user-value" });
      });

      it("new framework keys are added when absent in the existing file", async () => {
        const path = join(root, "new-keys-user-prime.json");
        files.setFile(path, JSON.stringify({ existing: "data" }));
        await files.mergeJsonFile(path, JSON.stringify({ newKey: "newValue" }), "user-prime");
        const result: unknown = JSON.parse(await files.readFile(path));
        expect(result).toMatchObject({ existing: "data", newKey: "newValue" });
      });
    });

    it("deep merges nested objects", async () => {
      const path = join(root, "deep.json");
      files.setFile(path, JSON.stringify({ outer: { a: 1, b: 2 } }));
      await files.mergeJsonFile(
        path,
        JSON.stringify({ outer: { b: 99, c: 3 } }),
        "framework-prime"
      );
      const result: unknown = JSON.parse(await files.readFile(path));
      expect(result).toMatchObject({ outer: { a: 1, b: 99, c: 3 } });
    });

    it("deduplicates merged arrays", async () => {
      const path = join(root, "arrays.json");
      files.setFile(path, JSON.stringify({ items: ["a", "b"] }));
      await files.mergeJsonFile(path, JSON.stringify({ items: ["b", "c"] }), "framework-prime");
      const result: unknown = JSON.parse(await files.readFile(path));
      expect(result).toEqual({ items: ["a", "b", "c"] });
    });

    it("deduplicates merged arrays of objects by value", async () => {
      const path = join(root, "obj-arrays.json");
      const entry = { file: "aidd_docs/templates/vcs/pull_request.md" };
      files.setFile(path, JSON.stringify({ instructions: [entry] }));
      await files.mergeJsonFile(path, JSON.stringify({ instructions: [entry] }), "framework-prime");
      const result: unknown = JSON.parse(await files.readFile(path));
      expect(result).toEqual({ instructions: [entry] });
    });

    it("strips JSONC comments before merging", async () => {
      const path = join(root, "jsonc.json");
      const jsonc = `{
  // single-line comment
  "key": "value",
  /* block comment */
  "other": true
}`;
      await files.mergeJsonFile(path, jsonc, "framework-prime");
      const result: unknown = JSON.parse(await files.readFile(path));
      expect(result).toMatchObject({ key: "value", other: true });
    });

    it("strips trailing commas in incoming content before merging", async () => {
      const path = join(root, "trailing-incoming.json");
      const jsonc = `{
  "key": "value",
  "nested": {
    "a": 1,
  },
}`;
      await files.mergeJsonFile(path, jsonc, "framework-prime");
      const result: unknown = JSON.parse(await files.readFile(path));
      expect(result).toMatchObject({ key: "value", nested: { a: 1 } });
    });

    it("tolerates comments and trailing commas in an existing .jsonc file", async () => {
      const path = join(root, "opencode.jsonc");
      const existingJsonc = `{
  // provider config
  "model": "neogen/swe-dev",
  "provider": {
    "neogen": {
      "npm": "@ai-sdk/openai-compatible",
      /* base URL */
      "options": {
        "baseURL": "https://neogen.example.com/api",
      },
    },
  },
}`;
      files.setFile(path, existingJsonc);
      await files.mergeJsonFile(path, JSON.stringify({ share: "disabled" }), "framework-prime");
      const result: unknown = JSON.parse(await files.readFile(path));
      expect(result).toMatchObject({ model: "neogen/swe-dev", share: "disabled" });
      expect(result).toHaveProperty("provider.neogen");
    });

    describe("prototype pollution guard", () => {
      it("does not pollute Object.prototype after merging __proto__ payload", async () => {
        const path = join(root, "proto-test.json");
        // Must pass a raw JSON string — a JS literal { __proto__: ... } would set the prototype,
        // not create an own key, and test nothing.
        const malicious = '{"__proto__":{"polluted":true}}';
        await files.mergeJsonFile(path, malicious, "framework-prime");
        expect(Object.prototype).not.toHaveProperty("polluted");
      });

      it("does not pollute Object.prototype after merging constructor payload", async () => {
        const path = join(root, "constructor-test.json");
        const malicious = '{"constructor":{"prototype":{"polluted":true}}}';
        await files.mergeJsonFile(path, malicious, "framework-prime");
        expect(Object.prototype).not.toHaveProperty("polluted");
      });

      it("merges regular keys correctly when prototype keys are present", async () => {
        const path = join(root, "mixed-test.json");
        files.setFile(path, JSON.stringify({ safe: "original" }));
        const malicious = '{"safe":"updated","__proto__":{"polluted":true}}';
        await files.mergeJsonFile(path, malicious, "framework-prime");
        const result: unknown = JSON.parse(await files.readFile(path));
        expect(result).toMatchObject({ safe: "updated" });
        expect(Object.prototype).not.toHaveProperty("polluted");
      });

      it("keeps a __proto__ payload from reaching the merged keys that follow it", async () => {
        const path = join(root, "inherited-test.json");
        const malicious = '{"__proto__":{"a":[1],"o":{"y":1}},"a":[2],"o":{"z":2}}';
        await files.mergeJsonFile(path, malicious, "framework-prime");
        expect(JSON.parse(await files.readFile(path))).toStrictEqual({ a: [2], o: { z: 2 } });
      });
    });
  });
});

describe("mergeIntoJsonFile, at the edges", () => {
  let files: InMemoryFileAdapter;

  beforeEach(() => {
    files = new InMemoryFileAdapter();
  });

  describe("mergeJsonFile()", () => {
    it("refuses to merge into a file it cannot parse, naming the file", async () => {
      const path = join(root, "settings.json");
      files.setFile(path, "{ not json");

      await expect(files.mergeJsonFile(path, "{}", "framework-prime")).rejects.toThrow(
        JsonParseError
      );
      await expect(files.mergeJsonFile(path, "{}", "framework-prime")).rejects.toThrow(
        `Cannot parse existing JSON at ${path}: `
      );
    });

    it.each(["constructor", "prototype"])(
      "drops a %s key from the incoming content",
      async (key) => {
        const path = join(root, "settings.json");
        files.setFile(path, JSON.stringify({ keep: 1 }));

        await files.mergeJsonFile(
          path,
          `{"${key}": {"polluted": true}, "b": 2}`,
          "framework-prime"
        );

        expect(JSON.parse(await files.readFile(path))).toStrictEqual({ keep: 1, b: 2 });
      }
    );

    it("replaces a scalar with an incoming array outright", async () => {
      const path = join(root, "settings.json");
      files.setFile(path, JSON.stringify({ list: "one" }));

      await files.mergeJsonFile(path, '{"list": ["a"]}', "framework-prime");

      expect(JSON.parse(await files.readFile(path))).toStrictEqual({ list: ["a"] });
    });

    it("replaces a scalar with an incoming object outright", async () => {
      const path = join(root, "settings.json");
      files.setFile(path, JSON.stringify({ nested: "one" }));

      await files.mergeJsonFile(path, '{"nested": {"a": 1}}', "framework-prime");

      expect(JSON.parse(await files.readFile(path))).toStrictEqual({ nested: { a: 1 } });
    });

    it("replaces an object with an incoming null outright", async () => {
      const path = join(root, "settings.json");
      files.setFile(path, JSON.stringify({ nested: { a: 1 } }));

      await files.mergeJsonFile(path, '{"nested": null}', "framework-prime");

      expect(JSON.parse(await files.readFile(path))).toStrictEqual({ nested: null });
    });
  });
});
