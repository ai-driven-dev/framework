/**
 * The in-process runner registers the binary's commands itself, since `src/cli.ts` parses at import.
 * A command the binary gains and the runner misses would only surface when someone tests it in process.
 */
import { describe, expect, it } from "vitest";
import { read } from "./helpers.js";

const calls = (text: string, pattern: RegExp): string[] =>
  [...text.matchAll(pattern)].map((match) => match[1] as string);

describe("the in-process runner", () => {
  it("registers the same commands as the binary, in the same order", () => {
    const binary = calls(read("src/cli.ts"), /^(register\w+Command)\(program(?:, \w+)*\);$/gm);
    const runner = calls(
      read("tests/helpers/in-process-cli.ts"),
      /(?:\)\)\.|=> )(register\w+Command)/gm
    );

    expect(binary.length).toBeGreaterThan(0);
    expect(runner).toEqual(binary);
  });
});
