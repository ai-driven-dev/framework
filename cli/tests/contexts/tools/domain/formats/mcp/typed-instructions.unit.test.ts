import { describe, expect, it } from "vitest";
import {
  addTypedInstruction,
  removeTypedInstruction,
} from "../../../../../../src/contexts/tools/domain/formats/mcp/typed-instructions.js";

describe("listing a rules glob in the instructions", () => {
  const GLOB = ".kilo/rules/aidd-*.md";

  it("creates the list in a new file and keeps the person's entries in an existing one", () => {
    expect(JSON.parse(addTypedInstruction(null, GLOB))).toEqual({ instructions: [GLOB] });
    const existing = '{ // mine\n "model": "m", "instructions": ["a.md"], }';
    expect(JSON.parse(addTypedInstruction(existing, GLOB))).toEqual({
      model: "m",
      instructions: ["a.md", GLOB],
    });
  });

  it("answers the file as it is when the glob is already listed", () => {
    const listed = `{ "instructions": ["${GLOB}"] }`;
    expect(addTypedInstruction(listed, GLOB)).toBe(listed);
  });

  it("takes only its glob out, dropping the list once empty, and leaves an unlisted file alone", () => {
    const both = `{ "model": "m", "instructions": ["a.md", "${GLOB}"] }`;
    expect(JSON.parse(removeTypedInstruction(both, GLOB))).toEqual({
      model: "m",
      instructions: ["a.md"],
    });
    expect(JSON.parse(removeTypedInstruction(`{ "instructions": ["${GLOB}"] }`, GLOB))).toEqual({});
    expect(removeTypedInstruction('{ "model": "m" }', GLOB)).toBe('{ "model": "m" }');
  });
});
