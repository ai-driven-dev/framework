/**
 * A context never asks a person anything: orchestration owns the conversation and the
 * `Prompter` port. A context that needs an answer declares its own port for the question.
 */
import { describe, expect, it } from "vitest";
import { read, sourceFiles } from "./source-graph.js";

const PROMPTER_IMPORT = /from\s+["'][^"']*\/ports\/prompter\.js["']/;

/** The context files whose text imports the `Prompter` port. */
function promptingContextFiles(files: Readonly<Record<string, string>>): string[] {
  return Object.keys(files)
    .filter((file) => file.startsWith("src/contexts/"))
    .filter((file) => PROMPTER_IMPORT.test(files[file] ?? ""));
}

describe("contexts do not prompt", () => {
  it("imports the Prompter port from no context file", () => {
    const files = Object.fromEntries(sourceFiles().map((file) => [file, read(file)]));
    expect(promptingContextFiles(files)).toEqual([]);
  });

  it("sees a context file that imports the Prompter port", () => {
    const planted = {
      "src/contexts/installation/application/ask.ts": `import type { Prompter } from "../../../orchestration/ports/prompter.js";`,
      "src/orchestration/setup/ask.ts": `import type { Prompter } from "../ports/prompter.js";`,
    };
    expect(promptingContextFiles(planted)).toEqual([
      "src/contexts/installation/application/ask.ts",
    ]);
  });
});
