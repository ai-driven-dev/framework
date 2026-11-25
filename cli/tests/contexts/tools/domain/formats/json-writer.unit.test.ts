import { describe, expect, it } from "vitest";
import {
  type JsonWriter,
  keepingComments,
} from "../../../../../src/contexts/tools/domain/formats/json-writer.js";

const writer: JsonWriter = { rewrite: (current, next) => `${current}|${JSON.stringify(next)}` };

describe("when a result is written over the text a person kept", () => {
  it("hands the writer the current text and the parsed result", () => {
    expect(keepingComments(writer, "// mine", '{"a":1}')).toBe('// mine|{"a":1}');
  });

  it("returns the result as is without a writer, without a current text, or when nothing changed", () => {
    expect(keepingComments(undefined, "x", '{"a":1}')).toBe('{"a":1}');
    expect(keepingComments(writer, null, '{"a":1}')).toBe('{"a":1}');
    expect(keepingComments(writer, '{"a":1}', '{"a":1}')).toBe('{"a":1}');
  });
});
