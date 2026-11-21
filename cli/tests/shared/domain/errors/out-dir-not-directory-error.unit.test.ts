import { describe, expect, it } from "vitest";
import { OutDirNotDirectoryError } from "../../../../src/shared/domain/errors/out-dir-not-directory-error.js";

describe("OutDirNotDirectoryError", () => {
  it("says exactly what went wrong", () => {
    const error = new OutDirNotDirectoryError("/out");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "OutDirNotDirectoryError",
      message: "Refusing to build: --out '/out' does not exist or is not a directory.",
    });
  });

  it("carries its stable code", () => {
    expect(new OutDirNotDirectoryError("/out").code).toBe("out-dir-not-directory");
  });
});
