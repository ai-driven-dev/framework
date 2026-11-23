import { describe, expect, it } from "vitest";
import { SmolTomlCodec } from "../../../src/shared/infrastructure/smol-toml-codec.adapter.js";

const toml = new SmolTomlCodec();

describe("when TOML is parsed", () => {
  it("parses a simple TOML string into an object", () => {
    const result = toml.parse('name = "my-tool"\nenabled = true\n');
    expect(result).toEqual({ name: "my-tool", enabled: true });
  });

  it("parses nested TOML sections", () => {
    const result = toml.parse('[section]\nkey = "value"\n');
    expect(result).toEqual({ section: { key: "value" } });
  });

  it("parses arrays of strings", () => {
    const result = toml.parse('args = ["a", "b"]\n');
    expect(result.args).toEqual(["a", "b"]);
  });
});

describe("when an object is written as TOML", () => {
  it("serializes a simple object to TOML string", () => {
    const result = toml.stringify({ name: "my-tool" });
    expect(result).toContain('name = "my-tool"');
  });

  it("serializes nested objects as TOML tables", () => {
    const result = toml.stringify({ section: { key: "value" } });
    expect(result).toContain("[section]");
    expect(result).toContain('key = "value"');
  });

  it("round-trips: stringify then parse preserves data", () => {
    const original = { name: "tool", count: 42, tags: ["a", "b"] };
    const tomlStr = toml.stringify(original);
    const reparsed = toml.parse(tomlStr);
    expect(reparsed).toEqual(original);
  });
});
