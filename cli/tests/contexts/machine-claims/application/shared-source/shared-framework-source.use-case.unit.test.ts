import { describe, expect, it } from "vitest";
import { SharedFrameworkSource } from "../../../../../src/contexts/machine-claims/application/shared-source/shared-framework-source.use-case.js";
import { CapturingLogger } from "../../../../shared/testing/capturing-logger.fake.js";
import { InMemoryFileAdapter } from "../../../../shared/testing/in-memory-file-adapter.fake.js";
import { TOOL } from "../../../../shared/testing/registered-tools.builder.js";

const SHARED = { name: "aidd-framework", scope: "user" } as const;
const REGISTERED_AS_SHARED = new Map([
  [TOOL.codex, { buildFailed: false, marketplaces: [{ alias: "aidd-framework" }] }],
]);

function source(recorded: unknown[]) {
  return new SharedFrameworkSource({
    fs: new InMemoryFileAdapter(),
    logger: new CapturingLogger(),
    recordReference: { execute: async (request) => void recorded.push(request) },
    purgeCache: { resolveCandidate: async () => null },
    frameworkMarketplaceName: "aidd-framework",
  });
}

describe("recording this project's claim on the shared source", () => {
  it("records nothing when the shared source is not among the listed marketplaces", async () => {
    const recorded: unknown[] = [];

    await source(recorded).execute({
      kind: "record-reference",
      projectRoot: "/project",
      marketplaces: [{ name: "aidd-framework", scope: "project" }],
      outcomes: REGISTERED_AS_SHARED,
    });

    expect(recorded).toEqual([]);
  });

  it("records nothing when no host registered the shared source under its own name", async () => {
    const recorded: unknown[] = [];

    await source(recorded).execute({
      kind: "record-reference",
      projectRoot: "/project",
      marketplaces: [SHARED],
      outcomes: new Map([
        [TOOL.codex, { buildFailed: false, marketplaces: [{ alias: "another" }] }],
      ]),
    });

    expect(recorded).toEqual([]);
  });
});
