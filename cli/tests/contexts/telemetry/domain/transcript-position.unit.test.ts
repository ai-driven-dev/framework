import { describe, expect, it } from "vitest";
import {
  parsePositions,
  renderPositions,
  resumeOffset,
} from "../../../../src/contexts/telemetry/domain/transcript-position.js";

const SINCE = { offset: 90, size: 100, identity: "1:42" };

describe("where a transcript is read from", () => {
  it("reads a file never read before from its start", () => {
    expect(resumeOffset(null, { size: 100, identity: "1:42" })).toEqual({
      offset: 0,
      restarted: false,
    });
  });

  it("resumes at the position when the file only grew", () => {
    expect(resumeOffset(SINCE, { size: 150, identity: "1:42" })).toEqual({
      offset: 90,
      restarted: false,
    });
  });

  it("resumes at the position when the file is unchanged", () => {
    expect(resumeOffset(SINCE, { size: 100, identity: "1:42" })).toEqual({
      offset: 90,
      restarted: false,
    });
  });

  it("reads a shrunk file whole", () => {
    expect(resumeOffset(SINCE, { size: 60, identity: "1:42" })).toEqual({
      offset: 0,
      restarted: true,
    });
  });

  it("reads a replaced file whole even when it is larger", () => {
    expect(resumeOffset(SINCE, { size: 500, identity: "1:77" })).toEqual({
      offset: 0,
      restarted: true,
    });
  });
});

describe("the positions kept between reads", () => {
  const position = { offset: 5, size: 9, identity: "1:2" };

  it("round-trip", () => {
    const positions = new Map([["/a", position]]);
    expect(parsePositions(renderPositions(positions))).toEqual(positions);
  });

  it("render in path order, so the file does not depend on discovery order", () => {
    const text = renderPositions(
      new Map([
        ["/b", position],
        ["/a", position],
      ])
    );
    expect(Object.keys(JSON.parse(text))).toEqual(["/a", "/b"]);
  });

  it("are none from no file, an unreadable one, or one that is not a map", () => {
    expect(parsePositions(null).size).toBe(0);
    expect(parsePositions("{broken").size).toBe(0);
    expect(parsePositions("[]").size).toBe(0);
    expect(parsePositions("null").size).toBe(0);
  });

  it.each([
    ["a negative offset", { ...position, offset: -1 }],
    ["a fractional offset", { ...position, offset: 1.5 }],
    ["a text offset", { ...position, offset: "5" }],
    ["no offset", { size: 9, identity: "i" }],
    ["a negative size", { ...position, size: -1 }],
    ["a fractional size", { ...position, size: 0.5 }],
    ["a text size", { ...position, size: "9" }],
    ["no size", { offset: 5, identity: "i" }],
    ["a numeric identity", { ...position, identity: 12 }],
    ["no identity", { offset: 5, size: 9 }],
    ["text", "x"],
  ])("drop an entry with %s and keep the rest", (_name, entry) => {
    const text = JSON.stringify({ "/ok": position, "/bad": entry });
    expect([...parsePositions(text).keys()]).toEqual(["/ok"]);
  });

  it("keep an entry at zero", () => {
    const text = JSON.stringify({ "/zero": { offset: 0, size: 0, identity: "i" } });
    expect(parsePositions(text).size).toBe(1);
  });
});
