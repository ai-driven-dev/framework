import { describe, expect, it } from "vitest";
import { parseScopeFlag } from "../../../../src/presentation/controllers/menu/global-options.controller.js";
import { CapturingOutput, ExitRequested } from "../../../shared/testing/capturing-output.fake.js";

describe("parseScopeFlag()", () => {
  it("returns undefined when no flag was given", () => {
    expect(parseScopeFlag(undefined, new CapturingOutput())).toBeUndefined();
  });

  it("passes project through", () => {
    expect(parseScopeFlag("project", new CapturingOutput())).toBe("project");
  });

  it("passes user through", () => {
    expect(parseScopeFlag("user", new CapturingOutput())).toBe("user");
  });

  it("exits 1 with an instructive message on anything else", () => {
    const output = new CapturingOutput();

    expect(() => parseScopeFlag("machine", output)).toThrow(new ExitRequested(1));
    expect(output.at("error")).toEqual([expect.stringContaining('"machine"')]);
  });
});
