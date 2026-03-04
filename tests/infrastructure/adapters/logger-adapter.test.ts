import { describe, expect, it, vi } from "vitest";
import { LoggerAdapter } from "../../../src/infrastructure/adapters/logger-adapter.js";

describe("LoggerAdapter", () => {
  describe("debug()", () => {
    it("writes to stderr when verbose is true", () => {
      const written: string[] = [];
      const original = process.stderr.write.bind(process.stderr);
      process.stderr.write = (msg: unknown) => {
        written.push(String(msg));
        return true;
      };

      try {
        const logger = new LoggerAdapter(true);
        logger.debug("debug message");
        expect(written.some((m) => m.includes("debug message"))).toBe(true);
      } finally {
        process.stderr.write = original;
      }
    });

    it("does not write to stderr when verbose is false", () => {
      const written: string[] = [];
      const original = process.stderr.write.bind(process.stderr);
      process.stderr.write = (msg: unknown) => {
        written.push(String(msg));
        return true;
      };

      try {
        const logger = new LoggerAdapter(false);
        logger.debug("debug message");
        expect(written.length).toBe(0);
      } finally {
        process.stderr.write = original;
      }
    });

    it("does not write when verbose is not set (defaults to false)", () => {
      const written: string[] = [];
      const original = process.stderr.write.bind(process.stderr);
      process.stderr.write = (msg: unknown) => {
        written.push(String(msg));
        return true;
      };

      try {
        const logger = new LoggerAdapter();
        logger.debug("silent debug");
        expect(written.length).toBe(0);
      } finally {
        process.stderr.write = original;
      }
    });
  });

  describe("info()", () => {
    it("always writes to stderr regardless of verbose", () => {
      const written: string[] = [];
      const original = process.stderr.write.bind(process.stderr);
      process.stderr.write = (msg: unknown) => {
        written.push(String(msg));
        return true;
      };

      try {
        const logger = new LoggerAdapter(false);
        logger.info("info message");
        expect(written.some((m) => m.includes("info message"))).toBe(true);
      } finally {
        process.stderr.write = original;
      }
    });
  });

  describe("warn()", () => {
    it("always writes to stderr with [warn] prefix", () => {
      const written: string[] = [];
      const original = process.stderr.write.bind(process.stderr);
      process.stderr.write = (msg: unknown) => {
        written.push(String(msg));
        return true;
      };

      try {
        const logger = new LoggerAdapter(false);
        logger.warn("something wrong");
        expect(written.some((m) => m.includes("[warn]") && m.includes("something wrong"))).toBe(
          true
        );
      } finally {
        process.stderr.write = original;
      }
    });
  });
});
