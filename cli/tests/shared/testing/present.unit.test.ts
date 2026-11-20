import { describe, expect, it } from "vitest";
import { present } from "./present.js";

describe("present", () => {
  it("hands back a value that is held, falsy ones included", () => {
    expect([present(""), present(0), present(null), present("x")]).toEqual(["", 0, null, "x"]);
  });

  it("names what was missing when the value is absent", () => {
    expect(() => present(undefined, "the first capture")).toThrow(
      "expected the first capture to be present"
    );
  });
});
