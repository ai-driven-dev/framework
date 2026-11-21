import { describe, expect, it } from "vitest";
import type { MainSessionModelsRequest } from "../../../../../src/contexts/installation/application/agents/main-session-models.use-case.js";
import { RestoreMainSessionModels } from "../../../../../src/contexts/installation/application/agents/restore-main-session-models.use-case.js";
import type { MainModelRecord } from "../../../../../src/contexts/installation/ports/main-session-settings.js";
import { InMemoryAgentModelStore } from "../../testing/in-memory-agent-model-store.fake.js";

const RECORD: MainModelRecord = {
  path: "/a.json",
  written: { model: "w" },
  previous: { model: null },
  created: false,
};

function restorer(dryRun: boolean) {
  const requests: MainSessionModelsRequest[] = [];
  const outcome = { changed: [{ host: "one", path: "/a.json" }], skipped: [] };
  const store = new InMemoryAgentModelStore({}, { one: RECORD, two: RECORD });
  const restore = new RestoreMainSessionModels(store, {
    execute: async (request) => {
      requests.push(request);
      return outcome;
    },
  });
  return { requests, outcome, result: restore.execute({ dryRun }) };
}

describe("RestoreMainSessionModels", () => {
  it("sets every recorded host back with no provider chosen", async () => {
    const { requests, outcome, result } = restorer(false);

    expect(await result).toBe(outcome);
    expect(requests).toStrictEqual([{ hosts: ["one", "two"], chosen: new Map(), dryRun: false }]);
  });

  it("hands a dry run on", async () => {
    const { requests, result } = restorer(true);

    await result;

    expect(requests[0]?.dryRun).toBe(true);
  });
});
