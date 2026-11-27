import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isTemplate, partFile, partNamesIn, partText } from "../../scripts/host-adapter-parts.mjs";
import { cliPath } from "../shared/testing/cli-sandbox.builder.js";

const RUNTIME = resolve(import.meta.dirname, "..", "..", "assets", "hooks-runtime");

/** Every way a string literal of the bundle can spell `text`: in backticks, double or single quotes. */
function spellings(text: string): string[] {
  const quoted = (quote: string) =>
    text.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replaceAll(quote, `\\${quote}`);
  const backticked = text.replace(/[\\`]|\$\{/g, (escaped) => `\\${escaped}`);
  return [...new Set([backticked, quoted('"'), quoted("'")])];
}

function timesIn(bundle: string, part: string): number {
  const text = partText(readFileSync(join(RUNTIME, partFile(part)), "utf8"));
  return spellings(text).reduce((times, spelling) => times + bundle.split(spelling).length - 1, 0);
}

describe("the host adapters in the built binary", () => {
  it("holds each shared part once, however many adapters it joins", () => {
    const bundle = readFileSync(cliPath(), "utf8");
    const repeated = partNamesIn(RUNTIME)
      .filter((part) => !isTemplate(part))
      .map((part) => ({ part, times: timesIn(bundle, part) }))
      .filter(({ times }) => times !== 1);

    expect(repeated).toEqual([]);
  });
});
