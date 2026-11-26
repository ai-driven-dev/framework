import { describe, expect, it } from "vitest";
import { MarketplaceNotFoundError } from "../../../src/contexts/distribution/contract/distribution.error.js";
import { describeMessage } from "../../../src/presentation/errors/describe-message.presenter.js";
import { render } from "../../../src/presentation/errors/error-translator.presenter.js";
import { OutputAdapter } from "../../../src/presentation/terminal/output.adapter.js";
import {
  InvalidSourceMarketplaceError,
  UnreadableUserSourceReferencesError,
} from "../../../src/shared/domain/shared.error.js";

const ended = (code: number): never => {
  throw new Error(`ended ${String(code)}`);
};

describe("writing output", () => {
  describe("when debugging", () => {
    it("writes to stderr with [verbose] prefix when verbose is true", () => {
      const written: string[] = [];
      const original = process.stderr.write.bind(process.stderr);
      process.stderr.write = (msg: unknown) => {
        written.push(String(msg));
        return true;
      };

      try {
        const output = new OutputAdapter(true, ended, String, describeMessage);
        output.debug("debug message");
        expect(written.some((m) => m.includes("[verbose]") && m.includes("debug message"))).toBe(
          true
        );
      } finally {
        process.stderr.write = original;
      }
    });

    it("does not write when verbose is false", () => {
      const written: string[] = [];
      const original = process.stderr.write.bind(process.stderr);
      process.stderr.write = (msg: unknown) => {
        written.push(String(msg));
        return true;
      };

      try {
        const output = new OutputAdapter(false, ended, String, describeMessage);
        output.debug("debug message");
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
        const output = new OutputAdapter(false, ended, String, describeMessage);
        output.debug("silent debug");
        expect(written.length).toBe(0);
      } finally {
        process.stderr.write = original;
      }
    });

    it("respects AIDD_VERBOSE env var even when verbose flag is false", () => {
      const prev = process.env.AIDD_VERBOSE;
      process.env.AIDD_VERBOSE = "true";
      const written: string[] = [];
      const original = process.stderr.write.bind(process.stderr);
      process.stderr.write = (msg: unknown) => {
        written.push(String(msg));
        return true;
      };

      try {
        const output = new OutputAdapter(false, ended, String, describeMessage);
        output.debug("env verbose debug");
        expect(written.some((m) => m.includes("env verbose debug"))).toBe(true);
      } finally {
        process.stderr.write = original;
        process.env.AIDD_VERBOSE = prev;
      }
    });
  });

  describe("when informing", () => {
    it("always writes to stdout regardless of verbose", () => {
      const written: string[] = [];
      const original = process.stdout.write.bind(process.stdout);
      process.stdout.write = (msg: unknown) => {
        written.push(String(msg));
        return true;
      };

      try {
        const output = new OutputAdapter(false, ended, String, describeMessage);
        output.info("info message");
        expect(written.some((m) => m.includes("info message"))).toBe(true);
      } finally {
        process.stdout.write = original;
      }
    });
  });

  describe("when warning", () => {
    it("always writes to stderr with Warning: prefix", () => {
      const written: string[] = [];
      const original = process.stderr.write.bind(process.stderr);
      process.stderr.write = (msg: unknown) => {
        written.push(String(msg));
        return true;
      };

      try {
        const output = new OutputAdapter(false, ended, String, describeMessage);
        output.warn("something wrong");
        expect(written.some((m) => m.includes("Warning:") && m.includes("something wrong"))).toBe(
          true
        );
      } finally {
        process.stderr.write = original;
      }
    });

    it("words a caught error after the message by its words alone, never its class name", () => {
      const written: string[] = [];
      const original = process.stderr.write.bind(process.stderr);
      process.stderr.write = (msg: unknown) => {
        written.push(String(msg));
        return true;
      };

      try {
        const output = new OutputAdapter(false, ended, render, describeMessage);
        output.warn("skip: ", new Error("offline"));
        output.warn("skip: ", new MarketplaceNotFoundError("aidd"));
        output.warn("skip: ", new InvalidSourceMarketplaceError("no name"));
        output.warn("", new UnreadableUserSourceReferencesError("/refs.json", "bad JSON"));
        expect(written).toEqual([
          "Warning: skip: offline\n",
          "Warning: skip: Marketplace 'aidd' is not registered.\n",
          "Warning: skip: Invalid source marketplace: no name.\n",
          "Warning: Cannot read the shared-source reference registry at /refs.json: bad JSON. Repair " +
            "the file, or delete it to start from an empty registry.\n",
        ]);
      } finally {
        process.stderr.write = original;
      }
    });
  });

  describe("when reporting an error", () => {
    it("always writes to stderr with Error: prefix", () => {
      const written: string[] = [];
      const original = process.stderr.write.bind(process.stderr);
      process.stderr.write = (msg: unknown) => {
        written.push(String(msg));
        return true;
      };

      try {
        const output = new OutputAdapter(false, ended, String, describeMessage);
        output.error("something failed");
        expect(written.some((m) => m.includes("Error:") && m.includes("something failed"))).toBe(
          true
        );
      } finally {
        process.stderr.write = original;
      }
    });
  });

  describe("success() and print()", () => {
    it("writes to stdout with no prefix", () => {
      const written: string[] = [];
      const original = process.stdout.write.bind(process.stdout);
      process.stdout.write = (msg: unknown) => {
        written.push(String(msg));
        return true;
      };

      try {
        const output = new OutputAdapter(false, ended, String, describeMessage);
        output.success("Installed claude (42 files)");
        output.print("  + .claude/CLAUDE.md");
        expect(written.some((m) => m.includes("Installed claude (42 files)"))).toBe(true);
        expect(written.some((m) => m.includes("  + .claude/CLAUDE.md"))).toBe(true);
      } finally {
        process.stdout.write = original;
      }
    });
  });

  describe("when exiting", () => {
    it("hands the code to the process end it was given, and does not return", () => {
      const codes: number[] = [];
      const output = new OutputAdapter(
        false,
        (code) => {
          codes.push(code);
          throw new Error("stopped");
        },
        String,
        describeMessage
      );

      expect(() => output.exit(3)).toThrow("stopped");
      expect(codes).toEqual([3]);
    });
  });
});
