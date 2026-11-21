/**
 * Only the `auth` context reads the token variable: the variable is a credential source, and a
 * second reader would bypass the order of sources `auth` resolves. Outside `contexts/auth`, no
 * source reads `process.env.AIDD_TOKEN`, names it as a string of its own, or imports `TOKEN_VARIABLE`.
 * A sentence that mentions it for the user to read is a longer string, and stays.
 */
import { describe, expect, it } from "vitest";
import { read, sourceFiles } from "./source-graph.js";

const TOKEN_READ =
  /process\.env(?:\.AIDD_TOKEN\b|\[\s*["'`]AIDD_TOKEN["'`]\s*\])|["'`]AIDD_TOKEN["'`]|\bTOKEN_VARIABLE\b/;

function readsToken(source: string): boolean {
  return TOKEN_READ.test(source);
}

describe("token owner", () => {
  it("sees a read, a bare name and the exported constant, and not a sentence", () => {
    expect(readsToken("const t = process.env.AIDD_TOKEN;")).toBe(true);
    expect(readsToken('const t = process.env["AIDD_TOKEN"];')).toBe(true);
    expect(readsToken('env.get("AIDD_TOKEN")')).toBe(true);
    expect(readsToken("import { TOKEN_VARIABLE } from './x.js';")).toBe(true);
    expect(readsToken('"Set AIDD_TOKEN, run `aidd auth login`"')).toBe(false);
  });

  it("keeps the token variable inside the auth context", () => {
    const readers = sourceFiles()
      .filter((file) => !file.startsWith("src/contexts/auth/"))
      .filter((file) => readsToken(read(file)));

    expect(readers).toEqual([]);
  });
});
