import { describe, expect, it } from "vitest";
import { parseRegistrationScope } from "../../../../src/presentation/controllers/plugin/marketplace-add.controller.js";
import { CapturingOutput, ExitRequested } from "../../../shared/testing/capturing-output.fake.js";

describe("reading the registration scope", () => {
  it.each([
    [undefined, "project"],
    ["project", "project"],
    ["user", "user"],
  ])("reads %s as %s", (raw, scope) => {
    expect(parseRegistrationScope(raw, new CapturingOutput())).toBe(scope);
  });

  it("names a scope that is neither project nor user, and ends the run", () => {
    const output = new CapturingOutput();

    expect(() => parseRegistrationScope("machine", output)).toThrow(ExitRequested);
    expect(output.at("error")).toEqual([
      "Invalid --scope 'machine'. Expected 'project' or 'user'.",
    ]);
  });
});
