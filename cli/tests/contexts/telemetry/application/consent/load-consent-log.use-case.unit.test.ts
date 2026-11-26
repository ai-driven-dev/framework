import { describe, expect, it } from "vitest";
import { LoadConsentLog } from "../../../../../src/contexts/telemetry/application/consent/load-consent-log.use-case.js";
import { cloneOf } from "../../testing/clone.builder.js";
import { InMemoryConsentHistory } from "../../testing/in-memory-consent-history.fake.js";

describe("loading the consent log", () => {
  it("shows the intervals the history holds", async () => {
    const history = new InMemoryConsentHistory();
    const load = new LoadConsentLog(history);
    expect((await load.execute()).openIntervals()).toEqual([]);
    history.consented(cloneOf("/w/main"));
    expect((await load.execute()).openIntervals()).toHaveLength(1);
  });

  it("carries the damage the history reports", async () => {
    const history = new InMemoryConsentHistory();
    history.damaged = true;
    expect((await new LoadConsentLog(history).execute()).damaged).toBe(true);
  });
});
