import { describe, expect, it } from "vitest";
import { warnRegistration } from "../../../../../src/contexts/host-registration/application/register/registration-run.js";
import { setup } from "../../testing/registration-run.builder.js";

describe("warning during a registration run", () => {
  it("logs the warning and keeps it, in order, for the caller's result", () => {
    const { run, logger, warnings } = setup();
    warnRegistration(run, "one");
    warnRegistration(run, "two");
    expect(logger.warnMessages).toEqual(["one", "two"]);
    expect(warnings).toEqual(["one", "two"]);
  });
});
