import { describe, expect, it } from "vitest";
import {
  createSessionTitlePublisher,
  readSessionTitle,
  sessionTitleTransfer,
} from "../../../../src/contexts/telemetry/infrastructure/otel/actions/session-title.js";

describe("Codex session titles", () => {
  it("dates a title when it is observed, not before a delayed read", async () => {
    let now = 100_000;
    const reader = {
      read: async () => {
        now = 103_000;
        return { available: true as const, title: "New title" };
      },
      close: () => {},
    };
    const publisher = createSessionTitlePublisher("/unused", {
      now: () => now,
      createReader: () => reader,
    });
    let time: string | undefined;
    await publisher.publish(
      "s1",
      { values: new Map([["user.email", "person@example.test"]]), conflict: false },
      async (event) => {
        time = event.at;
        return true;
      }
    );
    expect(time).toBe(new Date(103_000).toISOString());
    publisher.close();
  });

  it("backs off globally after an app-server failure instead of blocking every session", async () => {
    let now = 100_000;
    let starts = 0;
    let reads = 0;
    let warnings = 0;
    const publisher = createSessionTitlePublisher("/unused", {
      now: () => now,
      createReader: () => {
        starts++;
        return {
          unavailable: true,
          read: async () => {
            reads++;
            now += 5_000;
            return { available: false as const };
          },
          close: () => {},
        };
      },
      onUnavailable: () => {
        warnings++;
      },
    });
    const identity = { values: new Map([["user.email", "person@example.test"]]), conflict: false };
    const send = async () => true;
    expect(await publisher.publish("s1", identity, send)).toBe(false);
    expect(await publisher.publish("s2", identity, send)).toBe(false);
    expect(await publisher.publish("s3", identity, send)).toBe(false);
    expect({ starts, reads, warnings }).toEqual({ starts: 1, reads: 1, warnings: 1 });
    now += 60_000;
    expect(await publisher.publish("s3", identity, send)).toBe(false);
    expect({ starts, reads, warnings }).toEqual({ starts: 2, reads: 2, warnings: 1 });
    publisher.close();
  });

  it("does not mark a title delivered when consent is withdrawn during the read", async () => {
    let now = 100_000;
    const publisher = createSessionTitlePublisher("/unused", {
      now: () => now,
      createReader: () => ({
        read: async () => ({ available: true, title: "Title" }),
        close: () => {},
      }),
    });
    const identity = { values: new Map([["user.email", "person@example.test"]]), conflict: false };
    expect(await publisher.publish("s1", identity, async () => false)).toBe(false);
    now += 60_000;
    expect(await publisher.publish("s1", identity, async () => true)).toBe(true);
    publisher.close();
  });

  it("reads metadata only and requires exact thread and session IDs", async () => {
    const requests: Array<{ method: string; params: object }> = [];
    const read = async (method: string, params: object) => {
      requests.push({ method, params });
      return { thread: { id: "s1", sessionId: "s1", name: "A title", turns: [] } };
    };
    expect(await readSessionTitle(read, "s1")).toEqual({ available: true, title: "A title" });
    expect(requests).toEqual([
      { method: "thread/read", params: { threadId: "s1", includeTurns: false } },
    ]);
    expect(
      await readSessionTitle(
        async () => ({ thread: { id: "s1", sessionId: "root", name: "x" } }),
        "s1"
      )
    ).toEqual({ available: false });
  });

  it("sends an absent title explicitly without inventing a feature", () => {
    const identity = { values: new Map([["user.email", "person@example.test"]]), conflict: false };
    const event = sessionTitleTransfer("s1", identity, null, new Date("2026-11-05T00:00:00Z"));
    expect(event?.signal).toBe("logs");
    const attrs = event?.payload.resourceLogs;
    expect(JSON.stringify(attrs)).toContain("aidd.session_title");
    expect(JSON.stringify(attrs)).not.toContain("aidd.feature");
    expect(sessionTitleTransfer("s1", { ...identity, conflict: true }, "x", new Date())).toBeNull();
  });

  it("sends title changes and removal once, and keeps the last known value on read failure", async () => {
    let now = 100_000;
    let warnings = 0;
    let current: { available: true; title: string | null } | { available: false } = {
      available: true,
      title: "First",
    };
    const sent: string[] = [];
    const reader = { read: async () => current, close: () => {} };
    const publisher = createSessionTitlePublisher("/unused", {
      now: () => now,
      createReader: () => reader,
      onUnavailable: () => {
        warnings++;
      },
    });
    const identity = { values: new Map([["user.email", "person@example.test"]]), conflict: false };
    const send = async (event: { payload: object }) => {
      sent.push(JSON.stringify(event.payload));
      return true;
    };
    expect(await publisher.publish("s1", identity, send)).toBe(true);
    expect(await publisher.publish("s1", identity, send)).toBe(false);
    now += 60_000;
    current = { available: false };
    expect(await publisher.publish("s1", identity, send)).toBe(false);
    expect(warnings).toBe(1);
    now += 60_000;
    expect(await publisher.publish("s1", identity, send)).toBe(false);
    expect(warnings).toBe(1);
    now += 60_000;
    current = { available: true, title: "Second" };
    expect(await publisher.publish("s1", identity, send)).toBe(true);
    now += 60_000;
    current = { available: true, title: null };
    expect(await publisher.publish("s1", identity, send)).toBe(true);
    expect(sent).toHaveLength(3);
    expect(sent[0]).toContain("First");
    expect(sent[1]).toContain("Second");
    expect(sent[2]).not.toContain('"key":"aidd.session_title"');
    publisher.close();
  });
});
