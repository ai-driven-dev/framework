import { describe, expect, it } from "vitest";
import { answeredRegistry } from "../../../../src/contexts/host-registration/contract/host-registration-answers.js";
import { TOOL } from "../../tools/testing/catalog-of.js";

const { claude } = TOOL;

const REGISTRY = "/home/dev/.claude/plugins/installed_plugins.json";

describe("what a host's registry lets a caller ask", () => {
  it("hands over the refs and the file when the registry was read", () => {
    const refs = new Map([["aidd-telemetry@aidd-framework", { enabled: true }]]);

    expect(answeredRegistry(claude, { location: REGISTRY, refs }, true)).toStrictEqual({
      refs,
      location: REGISTRY,
    });
  });

  it("hands over an empty registry as read, never as unanswerable", () => {
    const answer = answeredRegistry(claude, { location: REGISTRY, refs: new Map() }, true);

    expect(answer).not.toHaveProperty("answer");
  });

  it("is unanswerable and names the failure when the registry could not be read", () => {
    const answer = answeredRegistry(claude, { location: REGISTRY, unreadable: "EACCES" }, true);

    expect(answer).toStrictEqual({
      answer: "unanswerable",
      detail: `${REGISTRY} could not be read — EACCES`,
    });
  });

  it("names a missing file as absent", () => {
    const answer = answeredRegistry(claude, { location: REGISTRY, absent: true }, true);

    expect(answer).toStrictEqual({
      answer: "unanswerable",
      detail: `${REGISTRY} could not be read — ENOENT`,
    });
  });

  it("gives a reason even when the reading names none", () => {
    const answer = answeredRegistry(claude, { location: REGISTRY }, true);

    expect(answer).toStrictEqual({
      answer: "unanswerable",
      detail: `${REGISTRY} could not be read — no reason given`,
    });
  });

  it("says a declared registry nobody read is unmeasured, not that none exists", () => {
    expect(answeredRegistry(TOOL.codex, undefined, true)).toStrictEqual({
      answer: "unanswerable",
      detail: "codex keeps a plugin registry, and nothing here has established its shape",
    });
  });

  it("says a host declaring no registry has none to read", () => {
    const expected = {
      answer: "unanswerable",
      detail: "cursor declares no plugin registry to read",
    };

    expect(answeredRegistry(TOOL.cursor, undefined, false)).toStrictEqual(expected);
    expect(answeredRegistry(TOOL.cursor, undefined, undefined)).toStrictEqual(expected);
  });
});
