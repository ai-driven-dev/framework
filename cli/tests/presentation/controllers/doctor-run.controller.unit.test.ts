import { describe, expect, it } from "vitest";
import { concludeDoctor } from "../../../src/presentation/controllers/doctor-run.controller.js";
import { CapturingOutput, ExitRequested } from "../../shared/testing/capturing-output.fake.js";

describe("concludeDoctor", () => {
  it("says the message when the run is healthy and leaves the process alone", () => {
    const output = new CapturingOutput();

    concludeDoctor(output, true, "all well");

    expect(output.lines).toEqual(["all well"]);
  });

  it("fails the process when the run is not healthy, and says nothing", () => {
    const output = new CapturingOutput();

    expect(() => concludeDoctor(output, false, "all well")).toThrow(ExitRequested);
    expect(output.lines).toEqual([]);
  });
});
