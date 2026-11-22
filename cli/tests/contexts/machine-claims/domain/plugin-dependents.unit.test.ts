import { describe, expect, it } from "vitest";
import {
  dependentsClaim,
  readDependents,
} from "../../../../src/contexts/machine-claims/domain/plugin-dependents.js";

describe("a plugin's dependents claim", () => {
  it("lists each project root once", () => {
    expect(dependentsClaim(["/A", "/B", "/A"])).toEqual(["/A", "/B"]);
  });

  it("is no claim when no project holds the plugin", () => {
    expect(dependentsClaim([])).toBeUndefined();
  });

  it("reads no project from no claim", () => {
    expect(readDependents(undefined)).toEqual([]);
  });

  it("reads the project roots it lists", () => {
    expect(readDependents(["/A", "/B"])).toEqual(["/A", "/B"]);
  });

  it.each([["/A"], [["/A", 1]]])("refuses a claim that is not a list of paths: %j", (claim) => {
    expect(() => readDependents(claim)).toThrow("expected a list of project roots");
  });
});
