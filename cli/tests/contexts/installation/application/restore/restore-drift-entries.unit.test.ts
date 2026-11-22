import { describe, expect, it } from "vitest";
import {
  type DriftDescriptor,
  type RestoreDriftLeaf,
  restoreDriftEntries,
} from "../../../../../src/contexts/installation/application/restore/restore-drift-entries.js";
import { ScriptedPrompter } from "../../../../shared/testing/scripted-prompter.fake.js";

interface Summary {
  restored: string[];
  kept: string[];
  unrestorable: string[];
}

function leafOver(
  drift: DriftDescriptor[],
  unrestorable: DriftDescriptor[] = []
): RestoreDriftLeaf<DriftDescriptor, Summary> & { readonly written: string[] } {
  const written: string[] = [];
  return {
    written,
    collectDrift: async () => ({ drift, unrestorable }),
    restore: async (entry) => {
      written.push(entry.relativePath);
    },
    buildResult: (restored, kept, lost) => ({ restored, kept, unrestorable: lost }),
  };
}

const deleted: DriftDescriptor = { relativePath: "gone.md", reason: "deleted" };
const modified: DriftDescriptor = { relativePath: "edited.md", reason: "modified" };

describe("restoring the drifted entries", () => {
  it("answers nothing when nothing drifted", async () => {
    const leaf = leafOver([]);

    const result = await restoreDriftEntries(new ScriptedPrompter([]), leaf, {
      force: false,
      interactive: false,
    });

    expect(result).toBeNull();
  });

  it("restores a deleted file without asking", async () => {
    const leaf = leafOver([deleted]);

    const result = await restoreDriftEntries(new ScriptedPrompter([]), leaf, {
      force: false,
      interactive: false,
    });

    expect(result).toStrictEqual({ restored: ["gone.md"], kept: [], unrestorable: [] });
    expect(leaf.written).toStrictEqual(["gone.md"]);
  });

  it("overwrites a modified file when forced", async () => {
    const leaf = leafOver([modified]);

    const result = await restoreDriftEntries(new ScriptedPrompter([]), leaf, {
      force: true,
      interactive: false,
    });

    expect(result?.restored).toStrictEqual(["edited.md"]);
  });

  it("keeps a modified file the user chooses to keep and writes nothing for it", async () => {
    const leaf = leafOver([modified]);
    const prompter = new ScriptedPrompter([ScriptedPrompter.answer.conflict("keep")]);

    const result = await restoreDriftEntries(prompter, leaf, { force: false, interactive: true });

    expect(result).toStrictEqual({ restored: [], kept: ["edited.md"], unrestorable: [] });
    expect(leaf.written).toStrictEqual([]);
  });

  it("reports entries the distribution cannot restore even when no other file drifted", async () => {
    const leaf = leafOver([], [modified]);

    const result = await restoreDriftEntries(new ScriptedPrompter([]), leaf, {
      force: false,
      interactive: false,
    });

    expect(result).toStrictEqual({ restored: [], kept: [], unrestorable: ["edited.md"] });
  });
});
