import { describe, expect, it } from "vitest";
import {
  parsePersonIdentity,
  personIdOf,
  renderPersonIdentity,
} from "../../../../../src/contexts/telemetry/domain/identity/person-identity.js";

describe("a person's identifier", () => {
  it("is what was typed, trimmed", () => {
    expect(personIdOf("  person-a  ")).toBe("person-a");
  });

  it("is nothing when empty, spread over several lines, or too long to be a name", () => {
    expect(personIdOf("   ")).toBeNull();
    expect(personIdOf("a\nb")).toBeNull();
    expect(personIdOf("a\u0000b")).toBeNull();
    expect(personIdOf("x".repeat(129))).toBeNull();
    expect(personIdOf("x".repeat(128))).toBe("x".repeat(128));
  });

  it("is written as exactly one field and read back from it", () => {
    expect(renderPersonIdentity("person-a")).toBe('{"person_id":"person-a"}\n');
    expect(parsePersonIdentity(renderPersonIdentity("person-a"))).toBe("person-a");
  });

  it("is read only from a file that holds exactly that one field", () => {
    for (const text of [
      null,
      "",
      "not json",
      "[]",
      '{"person_id":""}',
      '{"person_id":7}',
      '{"person_id":"person-a","origin":"prompt"}',
      '{"personId":"person-a"}',
    ]) {
      expect(parsePersonIdentity(text)).toBeNull();
    }
  });
});
