import { describe, expect, it } from "vitest";
import { serverReplyOf } from "../../../../../src/contexts/host-registration/domain/server/server-reply.js";
import { exchangeOf } from "../../testing/server-recording.builder.js";

const reply = (id: string) => {
  const { status, response } = exchangeOf(id);
  return serverReplyOf(status, response);
};

describe("reading what a host's plugin server answered", () => {
  it("carries the data of an answer whose code is zero", () => {
    expect(reply("list")).toMatchObject({
      kind: "answered",
      data: { plugins: [{ id: "probe-plug", state: "ok" }] },
    });
  });

  it.each([
    ["unauthenticated", 40101],
    ["remove-absent", 40419],
    ["install-bad-path", 40409],
  ])("refuses, with the code and the host's words, an answer for %s", (id, code) => {
    expect(reply(id)).toEqual({
      kind: "refused",
      code,
      detail: expect.stringMatching(/\S/),
    });
  });

  it("refuses an answer that is no JSON, whatever its status", () => {
    expect(serverReplyOf(200, "<!doctype html>")).toEqual({
      kind: "refused",
      code: 200,
      detail: expect.stringContaining("unreadable"),
    });
  });
});
