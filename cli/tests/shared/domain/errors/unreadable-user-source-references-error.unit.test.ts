import { describe, expect, it } from "vitest";
import { UnreadableUserSourceReferencesError } from "../../../../src/shared/domain/errors/unreadable-user-source-references-error.js";

describe("UnreadableUserSourceReferencesError", () => {
  it("says exactly what went wrong", () => {
    const error = new UnreadableUserSourceReferencesError("/refs.json", "EACCES");
    expect({ name: error.name, message: error.message }).toStrictEqual({
      name: "UnreadableUserSourceReferencesError",
      message:
        "Cannot read the shared-source reference registry at /refs.json: EACCES. Repair the file, or delete it to start from an empty registry.",
    });
  });

  it("carries its stable code", () => {
    expect(new UnreadableUserSourceReferencesError("/refs.json", "EACCES").code).toBe(
      "unreadable-user-source-references"
    );
  });
});
