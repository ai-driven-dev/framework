/**
 * Where a registration lives, project or user, is one type: `Scope` in `shared/domain/scope.ts`.
 * A second spelling of the union drifts the day a third scope is added, and the compiler cannot
 * say so because both spellings stay valid on their own.
 */
import { describe, expect, it } from "vitest";
import { read, tsFilesUnder } from "./helpers.js";

const SCOPE_HOME = "src/shared/domain/scope.ts";

/** A credential's level names who may use a token, a different notion that happens to carry the
 * same two words. */
const AUTH_LEVEL_HOME = "src/contexts/auth/contract/credential.ts";

/** The probes below plant the very shape this guard reports. */
const SELF = "tests/architecture/single-scope.arch.test.ts";

/** The two members side by side, across a line break or not. One with another member between
 * them, `"project" | null | "user"`, goes unseen: none exists in the code today. */
const INLINE_UNION = /"project"\s*\|\s*"user"|"user"\s*\|\s*"project"/;

describe("the project-or-user union has one spelling", () => {
  it("no file outside the scope module writes it inline", () => {
    const offenders = [...tsFilesUnder("src"), ...tsFilesUnder("tests")]
      .filter((file) => ![SCOPE_HOME, AUTH_LEVEL_HOME, SELF].includes(file))
      .filter((file) => INLINE_UNION.test(read(file)));

    expect(offenders, "write `Scope` from shared/domain/scope.js instead").toEqual([]);
  });
});

describe("the guard itself", () => {
  it("matches the union in either order and clears a lone literal", () => {
    expect(INLINE_UNION.test('let a: "project" | "user";')).toBe(true);
    expect(INLINE_UNION.test('let a: "user"|"project" | undefined;')).toBe(true);
    expect(INLINE_UNION.test('const a = "project";')).toBe(false);
  });
});
