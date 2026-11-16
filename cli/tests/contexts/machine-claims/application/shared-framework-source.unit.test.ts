import { describe, expect, it } from "vitest";
import { SharedFrameworkSource } from "../../../../src/contexts/machine-claims/application/shared-source/shared-framework-source.js";
import { CapturingLogger } from "../../../helpers/ports/capturing-logger.js";
import { InMemoryFileAdapter } from "../../../helpers/ports/in-memory-file-adapter.js";
import { TOOL } from "../../tools/testing/catalog-of.js";

const SHARED = { name: "aidd-framework", scope: "user" } as const;
const REGISTERED_AS_SHARED = new Map([
  [TOOL.codex, { buildFailed: false, marketplaces: [{ alias: "aidd-framework" }] }],
]);

function source(recorded: unknown[]) {
  return new SharedFrameworkSource(
    new InMemoryFileAdapter(),
    new CapturingLogger(),
    { execute: async (request) => void recorded.push(request) },
    { resolveCandidate: async () => null },
    "aidd-framework"
  );
}

describe("recording this project's claim on the shared source", () => {
  it("records nothing when the shared source is not among the listed marketplaces", async () => {
    const recorded: unknown[] = [];

    await source(recorded).recordSharedSourceReference(
      "/project",
      [{ name: "aidd-framework", scope: "project" }],
      REGISTERED_AS_SHARED
    );

    expect(recorded).toEqual([]);
  });

  it("records nothing when no host registered the shared source under its own name", async () => {
    const recorded: unknown[] = [];

    await source(recorded).recordSharedSourceReference(
      "/project",
      [SHARED],
      new Map([[TOOL.codex, { buildFailed: false, marketplaces: [{ alias: "another" }] }]])
    );

    expect(recorded).toEqual([]);
  });
});
