import { describe, expect, it } from "vitest";
import { declaredContentSize } from "../../../../../src/contexts/telemetry/infrastructure/transcripts/zstd-frame.js";

const MAGIC = [0x28, 0xb5, 0x2f, 0xfd];

/** A frame header: the magic, the descriptor byte, then the fields it announces. */
function header(descriptor: number, ...fields: number[]): Buffer {
  return Buffer.from([...MAGIC, descriptor, ...fields]);
}

describe("the content size a zstd frame declares", () => {
  it("reads a one-byte size, on a single-segment frame with no window byte", () => {
    expect(declaredContentSize(header(0b0010_0000, 13))).toBe(13);
  });

  it("reads a two-byte size, offset by 256, after the window byte", () => {
    expect(declaredContentSize(header(0b0100_0000, 0x58, 0x01, 0x02))).toBe(0x0201 + 256);
  });

  it("reads a two-byte size on a single segment, where the flag alone gives its width", () => {
    expect(declaredContentSize(header(0b0110_0000, 0x01, 0x02))).toBe(0x0201 + 256);
  });

  it("reads a four-byte size", () => {
    expect(declaredContentSize(header(0b1000_0000, 0x58, 0x04, 0x03, 0x02, 0x01))).toBe(0x01020304);
  });

  it("reads an eight-byte size", () => {
    const size = [0x06, 0x05, 0x04, 0x03, 0x02, 0x01, 0x00, 0x00];
    expect(declaredContentSize(header(0b1100_0000, 0x58, ...size))).toBe(0x010203040506);
  });

  it.each([
    [1, [0xaa]],
    [2, [0xaa, 0xbb]],
    [3, [0xaa, 0xbb, 0xcc, 0xdd]],
  ])("skips a dictionary id of flag %s", (flag, id) => {
    expect(declaredContentSize(header(0b0010_0000 | flag, ...id, 42))).toBe(42);
  });

  it("is unknown when the frame declares no size", () => {
    expect(declaredContentSize(header(0b0000_0000, 0x58, 0x07))).toBeNull();
  });

  it("is unknown for bytes that are no zstd frame, or too few to hold the size", () => {
    expect(declaredContentSize(Buffer.from("not a frame"))).toBeNull();
    expect(declaredContentSize(header(0b1000_0000, 0x58, 0x04))).toBeNull();
    expect(declaredContentSize(Buffer.from(MAGIC))).toBeNull();
  });
});
