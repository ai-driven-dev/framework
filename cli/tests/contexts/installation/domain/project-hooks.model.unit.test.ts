import { describe, expect, it } from "vitest";
import {
  digestEntry,
  recordedProjectHookEntries,
} from "../../../../src/contexts/installation/domain/project-hooks.model.js";
import { FileHash } from "../../../../src/shared/domain/file-hash.js";
import { registeredTools, TOOL } from "../../../shared/testing/registered-tools.builder.js";
import { entry, hooksFile, OTHER, PLUGIN } from "../testing/project-hooks-removal.builder.js";

const format = registeredTools().aiProfile(TOOL.cursor).projectHooksDelivery()?.format;

describe("project hook entries", () => {
  it("digests an entry by its own bytes", () => {
    expect(digestEntry(entry(PLUGIN))).toBe(FileHash.of(JSON.stringify(entry(PLUGIN))).value);
  });

  it("records only the entries the named plugin contributed, each with its digest", () => {
    if (format === undefined) throw new Error("cursor delivers project hooks");

    const recorded = recordedProjectHookEntries(format, hooksFile(PLUGIN, OTHER), PLUGIN);

    expect(recorded).toStrictEqual([
      {
        event: "preToolUse",
        command: entry(PLUGIN).command,
        digest: digestEntry(entry(PLUGIN)),
      },
    ]);
  });
});
