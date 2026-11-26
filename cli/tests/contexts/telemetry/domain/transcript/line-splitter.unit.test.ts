import { describe, expect, it } from "vitest";
import { LineSplitter } from "../../../../../src/contexts/telemetry/domain/transcript/line-splitter.js";

describe("cutting bytes into lines", () => {
  it("hands over a line pushed in pieces once whole, without its carriage return", () => {
    const seen: [string, boolean][] = [];
    const splitter = new LineSplitter(0, 0, (line, counted) => seen.push([line, counted]));
    splitter.push(Buffer.from("one\r\ntw"));
    splitter.push(Buffer.from("o\nthr"));
    expect(seen).toEqual([
      ["one", true],
      ["two", true],
    ]);
    expect(splitter.consumed).toBe(9);
  });

  it("marks a line that starts before the count offset as not counted", () => {
    const seen: [string, boolean][] = [];
    const splitter = new LineSplitter(0, 4, (line, counted) => seen.push([line, counted]));
    splitter.push(Buffer.from("one\ntwo\n"));
    expect(seen).toEqual([
      ["one", false],
      ["two", true],
    ]);
  });
});
