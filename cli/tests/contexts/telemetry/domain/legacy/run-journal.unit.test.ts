import { describe, expect, it } from "vitest";
import { withoutRunsEntry } from "../../../../../src/contexts/telemetry/domain/legacy/run-journal.js";

describe(".gitignore without the run journal's entry", () => {
  it("is untouched when the entry is not there", () => {
    expect(withoutRunsEntry("node_modules/\n")).toEqual({ kind: "untouched" });
  });

  it("drops only that line", () => {
    expect(withoutRunsEntry("a\naidd_docs/runs/\nb\n")).toEqual({
      kind: "rewritten",
      text: "a\nb\n",
    });
  });

  it("is emptied when nothing else was in it", () => {
    expect(withoutRunsEntry("aidd_docs/runs/\n")).toEqual({ kind: "emptied" });
  });

  it("does not take a longer pattern for the entry", () => {
    expect(withoutRunsEntry("aidd_docs/runs/keep\n")).toEqual({ kind: "untouched" });
  });
});

describe("the edges of that entry", () => {
  it("takes the entry with padding and a carriage return", () => {
    expect(withoutRunsEntry("a\n  aidd_docs/runs/\r\n")).toEqual({
      kind: "rewritten",
      text: "a\n",
    });
  });

  it("is emptied when only blank lines remain, spaces included", () => {
    expect(withoutRunsEntry("\n  \naidd_docs/runs/\n\t\n")).toEqual({ kind: "emptied" });
  });
});
