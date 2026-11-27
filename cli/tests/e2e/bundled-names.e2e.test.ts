import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { cliPath } from "../shared/testing/cli-sandbox.builder.js";

const CATALOGUE = resolve(
  import.meta.dirname,
  "..",
  "..",
  "src",
  "shared",
  "domain",
  "shared.error.ts"
);

describe("the names in the built binary", () => {
  it("keeps every catalogued error's class name, so a crash names what was thrown", () => {
    const bundle = readFileSync(cliPath(), "utf8");
    const classes = [
      ...readFileSync(CATALOGUE, "utf8").matchAll(/^export class (\w+) extends AiddError/gm),
    ].map(([, name]) => name);

    expect(classes).not.toEqual([]);
    expect(classes.filter((name) => !bundle.includes(`"${name}"`))).toEqual([]);
  });
});
