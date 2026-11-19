/**
 * A withdrawal step is composed by `WithdrawFromHost`, never by another step: a step that imports a
 * sibling step hides an ordering the class is meant to show. Steps share only `host-call.ts`
 * (helpers) and `withdrawal.ts` (types).
 */
import { describe, expect, it } from "vitest";
import { INTERNAL_IMPORT, read, resolveImportTarget, sourceFiles } from "./helpers.js";

const WITHDRAW_DIR = "src/contexts/host-registration/application/withdraw/";
const SHARED = new Set([`${WITHDRAW_DIR}host-call.ts`, `${WITHDRAW_DIR}withdrawal.ts`]);
const COMPOSER = `${WITHDRAW_DIR}withdraw-from-host.ts`;

function siblingStepImports(): string[] {
  const files = sourceFiles().filter((file) => file.startsWith(WITHDRAW_DIR));
  const violations: string[] = [];
  for (const file of files) {
    if (file === COMPOSER || SHARED.has(file)) continue;
    for (const match of read(file).matchAll(INTERNAL_IMPORT)) {
      const target = resolveImportTarget(file, match[1] ?? "");
      if (target.startsWith(WITHDRAW_DIR) && target !== file && !SHARED.has(target)) {
        violations.push(`${file} -> ${target}`);
      }
    }
  }
  return violations.sort();
}

describe("withdrawal steps stand alone", () => {
  it("no step imports a sibling step", () => {
    expect(siblingStepImports(), "a step imports a sibling step: compose it in the class").toEqual(
      []
    );
  });
});
