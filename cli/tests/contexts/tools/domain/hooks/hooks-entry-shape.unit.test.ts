import { describe, expect, it } from "vitest";
import {
  type HooksFileFormat,
  shapeEntries,
} from "../../../../../src/contexts/tools/domain/hooks/hooks-entry-shape.js";

const groups = [
  { matcher: "Bash", hooks: [{ command: "run.sh", timeout: 5 }, { type: "prompt" }] },
  { matcher: "", hooks: [{ type: "command", command: "other.sh" }] },
];

const format = (entries: HooksFileFormat["entries"]): HooksFileFormat => ({ wrapper: {}, entries });

describe("a plugin's matcher groups are shaped to a tool's hooks file", () => {
  it("keeps every group as shipped when items are kept whole", () => {
    expect(shapeEntries(groups, format({ shape: "matchers", itemsKept: "all" }))).toEqual(groups);
  });

  it("keeps only the command items, typed, under their group's matcher", () => {
    expect(shapeEntries(groups, format({ shape: "matchers", itemsKept: "commands" }))).toEqual([
      { matcher: "Bash", hooks: [{ command: "run.sh", timeout: 5, type: "command" }] },
      { matcher: "", hooks: [{ type: "command", command: "other.sh" }] },
    ]);
  });

  it("lists one flat entry per command with the named fields, an empty matcher left out", () => {
    const flat = format({ shape: "flat", fieldsKept: ["type", "command", "matcher", "timeout"] });
    expect(shapeEntries(groups, flat)).toEqual([
      { type: "command", command: "run.sh", matcher: "Bash", timeout: 5 },
      { type: "command", command: "other.sh", matcher: undefined, timeout: undefined },
    ]);
  });

  it("skips a group with no hooks list unless items are kept whole", () => {
    const bare = JSON.parse('[{"matcher":"x"}]');
    expect(shapeEntries(bare, format({ shape: "matchers", itemsKept: "commands" }))).toEqual([]);
  });
});
