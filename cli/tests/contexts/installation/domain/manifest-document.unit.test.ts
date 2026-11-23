import { describe, expect, it } from "vitest";
import { InvalidManifestDataError } from "../../../../src/contexts/installation/contract/installation.error.js";
import { Manifest } from "../../../../src/contexts/installation/domain/manifest.js";
import { render } from "../../../../src/presentation/errors/error-translator.presenter.js";
import { FileHash } from "../../../../src/shared/domain/file-hash.js";
import { InstallationFile } from "../../../../src/shared/domain/installation-file.js";
import { resolveRegisteredToolId, TOOL } from "../../../shared/testing/registered-tools.builder.js";
import { saying } from "../../../shared/testing/saying.builder.js";

const makeHash = (hex: string): FileHash => new FileHash(hex.padEnd(32, "0"));

const makeFile = (path: string, hashHex: string): InstallationFile =>
  new InstallationFile({
    relativePath: path,
    content: "content",
    hash: makeHash(hashHex),
  });

const claudeFiles = [
  makeFile(".claude/agents/code-reviewer.md", "aabbcc"),
  makeFile(".claude/rules/naming.md", "ddeeff"),
];

describe("Manifest read from a document", () => {
  describe("serialization round-trip", () => {
    it("fromJSON() rejects unsupported manifest version", () => {
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "3.0.0", claudeFiles);
      const json = manifest.toJSON();
      const badVersion = { ...json, version: 99 };
      expect(() => Manifest.fromJSON(badVersion, resolveRegisteredToolId)).toThrow(
        saying(/version/)
      );
    });

    it("toJSON() / fromJSON() preserves tool entries", () => {
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "3.0.0", claudeFiles);
      manifest.addTool(TOOL.cursor, "3.0.0", [makeFile(".cursor/rules/naming.md", "445566")]);

      const json = manifest.toJSON();
      const restored = Manifest.fromJSON(json, resolveRegisteredToolId);

      expect(restored.hasTool(TOOL.claude)).toBe(true);
      expect(restored.hasTool(TOOL.cursor)).toBe(true);
      expect(restored.getToolVersion(TOOL.claude)).toBe("3.0.0");
      expect(restored.getToolVersion(TOOL.cursor)).toBe("3.0.0");
    });

    it("marketplaces field is absent in a fresh manifest JSON", () => {
      const manifest = Manifest.create();
      const json = manifest.toJSON();
      expect("marketplaces" in json).toBe(false);
    });

    it("file hashes are preserved after round-trip", () => {
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "3.0.0", claudeFiles);

      const restored = Manifest.fromJSON(manifest.toJSON(), resolveRegisteredToolId);
      const restoredJson = restored.toJSON();

      expect(restoredJson.tools.claude).toBeDefined();
      expect(restoredJson.tools.claude.files).toHaveLength(2);
      expect(restoredJson.tools.claude.files[0].hash).toBe(`aabbcc${"0".repeat(26)}`);
    });

    it("fromJSON() reports an error on invalid data", () => {
      expect(() => Manifest.fromJSON(null, resolveRegisteredToolId)).toThrow();
    });
  });

  describe("version guard", () => {
    it("v9 manifest loads without error", () => {
      const manifest = Manifest.create();
      manifest.addTool(TOOL.copilot, "1.0.0", []);
      const json = manifest.toJSON();
      expect(json.version).toBe(9);
      expect(() => Manifest.fromJSON(json, resolveRegisteredToolId)).not.toThrow();
    });

    it("v9 round-trip is stable", () => {
      const manifest = Manifest.create();
      manifest.addTool(TOOL.claude, "3.0.0", claudeFiles);
      const restored = Manifest.fromJSON(manifest.toJSON(), resolveRegisteredToolId);
      expect(restored.toJSON().version).toBe(9);
    });

    // No published CLI has ever written v7, and every write path loads through this same guard
    // before it can save, so no command migrates it forward: deleting the document is the exit.
    const RECOVERY_INVOCATION = /delete \.aidd\/manifest\.json.*aidd setup/;

    it("rejects a version below 8 and names the file to delete, not a command to migrate it", () => {
      const v7 = { version: 7, tools: {} };
      expect(() => Manifest.fromJSON(v7, resolveRegisteredToolId)).toThrow(
        saying(RECOVERY_INVOCATION)
      );
      // The string this guard used to send a stuck user toward: a CLI that only ever wrote
      // v7 and would refuse the resulting document all over again.
      expect(() => Manifest.fromJSON(v7, resolveRegisteredToolId)).not.toThrow(
        saying(/update --force/)
      );
      expect(() => Manifest.fromJSON(v7, resolveRegisteredToolId)).toThrow(
        saying(/No published CLI can write this version/)
      );
    });

    // 5.2.2 is a published CLI that migrated a v5 document to v6 and re-saved it, so "no
    // published CLI can write this version" is false for v6, the one version it must not name.
    it("names 5.2.2 for a version 6 manifest, since that published CLI actually wrote it", () => {
      const v6 = { version: 6, tools: {} };
      expect(() => Manifest.fromJSON(v6, resolveRegisteredToolId)).toThrow(
        saying(RECOVERY_INVOCATION)
      );
      expect(() => Manifest.fromJSON(v6, resolveRegisteredToolId)).toThrow(saying(/5\.2\.2/));
      expect(() => Manifest.fromJSON(v6, resolveRegisteredToolId)).not.toThrow(
        saying(/No published CLI can write this version/)
      );
    });

    // 5.2.2's own reader accepts exactly version 6, so its `clean --force` can still unregister
    // a host's native registrations - only before the manifest naming them is deleted.
    it("names `clean --force` on 5.2.2 before naming the deletion, for a version 6 manifest", () => {
      const v6 = { version: 6, tools: {} };
      let message = "";
      try {
        Manifest.fromJSON(v6, resolveRegisteredToolId);
      } catch (error) {
        message = render(error);
      }
      expect(message).toContain("npx @ai-driven-dev/cli@5.2.2 clean --force");
      const cleanIndex = message.indexOf("clean --force");
      const deleteIndex = message.indexOf("delete .aidd/manifest.json");
      expect(cleanIndex).toBeGreaterThan(-1);
      expect(deleteIndex).toBeGreaterThan(cleanIndex);
    });

    // 5.2.2 refuses to read anything past its own native version 6, so naming its `clean` for a
    // v7 document would send a stuck user to a command that cannot even open the file.
    it("never names 5.2.2's clean for a version 7 manifest, which that CLI cannot read either", () => {
      const v7 = { version: 7, tools: {} };
      expect(() => Manifest.fromJSON(v7, resolveRegisteredToolId)).not.toThrow(saying(/5\.2\.2/));
    });

    it("v0 manifest throws, naming the recovery invocation", () => {
      const v0 = { version: 0, tools: {} };
      expect(() => Manifest.fromJSON(v0, resolveRegisteredToolId)).toThrow(saying(/version/));
      expect(() => Manifest.fromJSON(v0, resolveRegisteredToolId)).toThrow(
        saying(RECOVERY_INVOCATION)
      );
    });

    it("rejects a version above 9 by pointing at update, not a downgrade", () => {
      const v99 = { version: 99, tools: {} };
      expect(() => Manifest.fromJSON(v99, resolveRegisteredToolId)).toThrow(saying(/version/));
      expect(() => Manifest.fromJSON(v99, resolveRegisteredToolId)).toThrow(saying(/aidd update/));
      expect(() => Manifest.fromJSON(v99, resolveRegisteredToolId)).not.toThrow(
        saying(RECOVERY_INVOCATION)
      );
    });
  });

  describe("malformed tool entry", () => {
    it("throws an instructive, typed error naming the field when files is missing", () => {
      const data = { version: 9, tools: { claude: { toolId: TOOL.claude, version: "1.0.0" } } };
      expect(() => Manifest.fromJSON(data, resolveRegisteredToolId)).toThrow(
        saying(/tools\.claude\.files/)
      );
    });

    it("throws an instructive, typed error naming the field when files is the wrong type", () => {
      const data = {
        version: 9,
        tools: { claude: { toolId: TOOL.claude, version: "1.0.0", files: "nope" } },
      };
      expect(() => Manifest.fromJSON(data, resolveRegisteredToolId)).toThrow(
        saying(/tools\.claude\.files/)
      );
    });

    it("throws an instructive, typed error when a tool entry is not an object", () => {
      const data = { version: 9, tools: { claude: "nope" } };
      expect(() => Manifest.fromJSON(data, resolveRegisteredToolId)).toThrow(
        saying(/tools\.claude/)
      );
    });

    // `scope` is mandatory since v7: a default would guess exactly what the field exists to stop
    // guessing. Naming the plugin is what lets a person find the entry among several.
    it("rejects a plugin entry carrying no scope, naming the plugin", () => {
      const data = {
        version: 9,
        tools: {
          claude: {
            toolId: TOOL.claude,
            version: "1.0.0",
            files: [],
            plugins: [
              {
                name: "aidd-context",
                source: { kind: "local", path: "/fixture" },
                version: "1.0.0",
                strict: false,
                files: {},
              },
            ],
          },
        },
      };
      expect(() => Manifest.fromJSON(data, resolveRegisteredToolId)).toThrow(
        saying(/aidd-context/)
      );
    });

    it("rejects a plugin entry whose scope is neither project nor user", () => {
      const data = {
        version: 9,
        tools: {
          claude: {
            toolId: TOOL.claude,
            version: "1.0.0",
            files: [],
            plugins: [
              {
                name: "aidd-context",
                source: { kind: "local", path: "/fixture" },
                version: "1.0.0",
                strict: false,
                files: {},
                scope: "global",
              },
            ],
          },
        },
      };
      expect(() => Manifest.fromJSON(data, resolveRegisteredToolId)).toThrow(
        saying(/aidd-context/)
      );
    });
  });

  describe("a manifest written while the CLI still recorded MCP exclusions", () => {
    const written = {
      version: 9,
      tools: {
        claude: {
          toolId: TOOL.claude,
          version: "1.0.0",
          files: [],
          mergeFiles: [],
          excludedMcp: [{ configPath: ".claude/settings.json", entryKey: "old-server" }],
        },
      },
    };

    it("still loads, keeping the tool it records", () => {
      expect(Manifest.fromJSON(written, resolveRegisteredToolId).getToolVersion(TOOL.claude)).toBe(
        "1.0.0"
      );
    });

    it("drops the exclusions on its next write", () => {
      expect(
        Manifest.fromJSON(written, resolveRegisteredToolId).toJSON().tools.claude
      ).toStrictEqual({
        toolId: TOOL.claude,
        version: "1.0.0",
        files: [],
        mergeFiles: [],
      });
    });
  });

  describe("fromJSON() on a document that is not an object", () => {
    it("refuses null, saying an object was expected", () => {
      expect(() => Manifest.fromJSON(null, resolveRegisteredToolId)).toThrow(
        InvalidManifestDataError
      );
      expect(() => Manifest.fromJSON(null, resolveRegisteredToolId)).toThrow(
        saying("Invalid manifest data: expected an object.")
      );
    });

    it("refuses a string, saying an object was expected", () => {
      expect(() => Manifest.fromJSON("nope", resolveRegisteredToolId)).toThrow(
        saying("Invalid manifest data: expected an object.")
      );
    });
  });

  describe("version refusal wording", () => {
    it("spells out the 5.2.2 remedy, then the deletion, for a version 6 document", () => {
      expect(() => Manifest.fromJSON({ version: 6, tools: {} }, resolveRegisteredToolId)).toThrow(
        saying(
          "Invalid manifest data: manifest version 6 predates version 8, the oldest one this CLI reads. " +
            "5.2.2, a published CLI, wrote this version. Before deleting it, run " +
            "`npx @ai-driven-dev/cli@5.2.2 clean --force` in this project so it unregisters " +
            "what it registered and clears its own cache — once the manifest naming those " +
            "is gone, nothing can drive that anymore. Then delete .aidd/manifest.json in this project, " +
            "then run `aidd setup` to reinstall the framework."
        )
      );
    });

    it("spells out the deletion alone for a version 7 document", () => {
      expect(() => Manifest.fromJSON({ version: 7, tools: {} }, resolveRegisteredToolId)).toThrow(
        saying(
          "Invalid manifest data: manifest version 7 predates version 8, the oldest one this CLI reads. " +
            "No published CLI can write this version: delete .aidd/manifest.json in this project, " +
            "then run `aidd setup` to reinstall the framework."
        )
      );
    });

    it("reads a version that is not a number as unreadable, never as newer", () => {
      expect(() =>
        Manifest.fromJSON({ version: "99", tools: {} }, resolveRegisteredToolId)
      ).toThrow(saying("manifest version 99 predates version 8"));
    });
  });
});
