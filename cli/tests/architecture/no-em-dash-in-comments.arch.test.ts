/**
 * An em dash printed to a user is a string and stays; one in a comment is prose that drifted
 * from the project's writing rule. Comments are found by walking tokens, so a `//` inside a
 * string, a template literal or a regular expression is never one.
 */
import { describe, expect, it } from "vitest";
import { commentRanges } from "./comment-ranges.js";
import { read, sourceFiles } from "./helpers.js";

const EM_DASH = "\u2014";

/** The comments of `source` that hold an em dash. */
function dashedComments(source: string): string[] {
  return commentRanges(source)
    .map(({ start, end }) => source.slice(start, end))
    .filter((comment) => comment.includes(EM_DASH));
}

describe("no source comment holds an em dash", () => {
  it("writes each comment without one", () => {
    const offenders = sourceFiles().filter((file) => dashedComments(read(file)).length > 0);
    expect(offenders, "an em dash in a comment: use a colon, a comma or a hyphen").toEqual([]);
  });
});

describe("the guard itself", () => {
  it("flags a line comment and a block comment holding one", () => {
    expect(dashedComments(`const a = 1; // one ${EM_DASH} two`)).toHaveLength(1);
    expect(dashedComments(`/** one ${EM_DASH} two */\nconst a = 1;`)).toHaveLength(1);
  });

  it("clears an em dash printed by a string or a template literal", () => {
    expect(dashedComments(`const a = "x ${EM_DASH} y";`)).toEqual([]);
    expect(dashedComments(`const a = \`x ${EM_DASH} \${b} ${EM_DASH} y\`;`)).toEqual([]);
  });

  it("reads a // inside a string, a template literal or a regex as text, and the comment after it", () => {
    expect(dashedComments(`const u = "http://a"; // ${EM_DASH}`)).toHaveLength(1);
    expect(dashedComments(`const u = \`http://\${a}/${EM_DASH}\`;`)).toEqual([]);
    expect(dashedComments(`const r = /\\/\\/${EM_DASH}/;`)).toEqual([]);
  });
});
