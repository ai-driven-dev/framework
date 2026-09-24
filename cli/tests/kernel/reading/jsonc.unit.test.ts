import { describe, expect, it } from "vitest";
import { stripJsonComments } from "../../../src/kernel/reading/jsonc.js";

describe("stripJsonComments", () => {
  describe("a line comment", () => {
    it("is dropped up to the end of its line, the line ending kept", () => {
      expect(stripJsonComments("a //c\nb")).toBe("a \nb");
    });

    it("is dropped when it closes the document with no line ending", () => {
      expect(stripJsonComments("1 // c")).toBe("1 ");
    });
  });

  describe("a block comment", () => {
    it("is dropped whole, its inner asterisks included", () => {
      expect(stripJsonComments("/* a * b */1")).toBe("1");
    });

    it("is dropped whole when a slash follows its opening marker", () => {
      expect(stripJsonComments("/*/ x */1")).toBe("1");
    });

    it("is dropped to the end of the document when never closed", () => {
      expect(stripJsonComments("1 /* x")).toBe("1 ");
    });
  });

  describe("a lone slash", () => {
    it("is not a comment and stays", () => {
      expect(stripJsonComments("1/2")).toBe("1/2");
    });
  });

  describe("inside a string", () => {
    it("an escaped quote does not end the string, so a comment marker after it stays", () => {
      expect(stripJsonComments('{"a":"x\\"y // kept"}')).toBe('{"a":"x\\"y // kept"}');
    });

    it("a backslash closing the document is kept as it is", () => {
      expect(stripJsonComments('"x\\')).toBe('"x\\');
    });
  });

  describe("a trailing comma", () => {
    it("is dropped before a closing brace", () => {
      expect(stripJsonComments('{"a":1,\n}')).toBe('{"a":1\n}');
    });

    it("is dropped before a closing bracket", () => {
      expect(stripJsonComments("[1,2,]")).toBe("[1,2]");
    });

    it("is kept when a value follows", () => {
      expect(stripJsonComments("[1, 2]")).toBe("[1, 2]");
    });
  });
});
