import { describe, expect, it } from "vitest";
import { RecordConsentEvent } from "../../../../../src/contexts/telemetry/application/consent/record-consent-event.use-case.js";
import { InMemoryConsentHistory } from "../../testing/in-memory-consent-history.fake.js";

describe("recording a consent event", () => {
  it("appends the event to the history, once", async () => {
    const history = new InMemoryConsentHistory();
    const event = { kind: "close", token: "tok-1", at: "2026-10-09T10:00:00.000Z" } as const;
    await new RecordConsentEvent(history).execute(event);
    expect(history.written).toEqual([event]);
  });
});
