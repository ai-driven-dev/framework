import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { cliPath } from "../shared/testing/cli-sandbox.builder.js";

const PARTS = resolve(import.meta.dirname, "..", "..", "assets", "hooks-runtime", "parts");

/** Every way a string literal of the bundle can spell `text`: in backticks, double or single quotes. */
function spellings(text: string): string[] {
  const quoted = (quote: string) =>
    text.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replaceAll(quote, `\\${quote}`);
  const backticked = text.replace(/[\\`]|\$\{/g, (escaped) => `\\${escaped}`);
  return [...new Set([backticked, quoted('"'), quoted("'")])];
}

function timesIn(bundle: string, part: string): number {
  const text = readFileSync(join(PARTS, part), "utf8").replace(/\n$/, "");
  return spellings(text).reduce((times, spelling) => times + bundle.split(spelling).length - 1, 0);
}

describe("the host adapters in the built binary", () => {
  it("holds each shared part once, however many adapters it joins", () => {
    const bundle = readFileSync(cliPath(), "utf8");
    const repeated = readdirSync(PARTS)
      .filter((part) => !part.startsWith("host-"))
      .map((part) => ({ part, times: timesIn(bundle, part) }))
      .filter(({ times }) => times !== 1);

    expect(repeated).toEqual([]);
  });
});
