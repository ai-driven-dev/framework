import { describe, expect, it } from "vitest";
import { withoutPreviousTelemetry } from "../../../../../src/contexts/telemetry/domain/switch/legacy-config.js";

const block = '"telemetry": { "enabled": true, "endpoint": "https://x.test/a,b}", "version": 1 }';

function cleaned(text: string | null): string | null {
  const result = withoutPreviousTelemetry(text);
  return result.status === "block-removed" ? result.text : null;
}

describe("clearing the previous version's telemetry block from .aidd/config.json", () => {
  it("has nothing to do without a file, or without the key", () => {
    expect(withoutPreviousTelemetry(null)).toEqual({ status: "none" });
    expect(withoutPreviousTelemetry('{"a":1}')).toEqual({ status: "none" });
  });

  it.each([["{nope"], ["[1]"], [""], ["null"]])("never rewrites %j", (text) => {
    expect(withoutPreviousTelemetry(text)).toEqual({ status: "unparseable" });
  });

  it("empties a file that held only the block", () => {
    expect(withoutPreviousTelemetry(`{ ${block} }`)).toEqual({ status: "file-emptied" });
    expect(withoutPreviousTelemetry('{"telemetry":{"enabled":true,"endpoint":"x"}}')).toEqual({
      status: "file-emptied",
    });
  });

  it("removes a middle block and leaves every other byte alone", () => {
    const text = `{\n  "a": 1,\n  ${block},\n  "b": [1,  2]\n}\n`;
    expect(cleaned(text)).toBe('{\n  "a": 1,\n  "b": [1,  2]\n}\n');
  });

  it("removes a last block with the comma before it", () => {
    expect(cleaned(`{\n    "a": 1,\n    ${block}\n}\n`)).toBe('{\n    "a": 1\n}\n');
  });

  it("removes a first block", () => {
    expect(cleaned(`{\n\t${block},\n\t"a": 1\n}`)).toBe('{\n\t"a": 1\n}');
  });

  it("removes a block on a single line", () => {
    expect(cleaned(`{"a":1,${block},"b":2}`)).toBe('{"a":1,"b":2}');
    expect(cleaned(`{"a":1,${block}}`)).toBe('{"a":1}');
  });

  it("does not take a nested telemetry key, or text that only looks like one", () => {
    const text =
      '{\n  "x": { "telemetry": 1 },\n  "note": "\\"telemetry\\": 2",\n  "telemetry": {}\n}\n';
    expect(cleaned(text)).toBe(
      '{\n  "x": { "telemetry": 1 },\n  "note": "\\"telemetry\\": 2"\n}\n'
    );
  });

  it("keeps the other keys whatever the file looked like", () => {
    const text = `{"a":{"b":[1,{"telemetry":3}]},${block},"c":null}`;
    const result = cleaned(text);
    expect(JSON.parse(result as string)).toEqual({ a: { b: [1, { telemetry: 3 }] }, c: null });
  });

  it.each([
    ["true", "true"],
    ["a number", "3.5e2"],
    ["null", "null"],
    ["a string with braces, commas and an escaped quote", '"a } , ] \\" {"'],
    ["an array of arrays", '[1,[2,{"x":"]"}],"}"]'],
    ["an object holding strings that look like keys", '{"telemetry":"}","k":{"a":[]}}'],
  ])("removes a block that is %s", (_name, value) => {
    expect(cleaned(`{"a":1,"telemetry":${value},"b":2}`)).toBe('{"a":1,"b":2}');
    expect(cleaned(`{"a":1,"telemetry":${value}}`)).toBe('{"a":1}');
    expect(cleaned(`{"telemetry":${value},"a":1}`)).toBe('{"a":1}');
    expect(cleaned(`{\n  "a": 1,\n  "telemetry": ${value}\n}\n`)).toBe('{\n  "a": 1\n}\n');
  });

  it("keeps CRLF line endings and the other lines whole", () => {
    expect(cleaned('{\r\n  "a": 1,\r\n  "telemetry": {},\r\n  "b": 2\r\n}\r\n')).toBe(
      '{\r\n  "a": 1,\r\n  "b": 2\r\n}\r\n'
    );
  });

  it("leaves the rest of a line alone when the block shares it", () => {
    expect(cleaned('{\n  "a": 1, "telemetry": {}, "b": 2\n}\n')).toBe('{\n  "a": 1, "b": 2\n}\n');
    expect(cleaned('{\n  "telemetry": {}, "b": 2\n}\n')).toBe('{\n  "b": 2\n}\n');
  });

  it("does not mistake an escape inside a key for its end", () => {
    expect(cleaned('{"x\\"telemetry":1,"telemetry":{},"y":2}')).toBe('{"x\\"telemetry":1,"y":2}');
  });

  it("falls back to a canonical rendering when the text cannot be cut safely", () => {
    // a repeated key: JSON keeps the last, a cut of the first would keep a block
    expect(cleaned('{"telemetry":1,"a":1,"telemetry":2}')).toBe('{\n  "a": 1\n}\n');
  });
});
