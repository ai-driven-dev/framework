import { describe, expect, it } from "vitest";
import {
  queueRequiredSource,
  sendPromptSource,
} from "../../../../../src/contexts/tools/domain/bridges/bridge-sources.js";

const prompt = { client: "c", method: "promptAsync", session: "s", text: "t" };

describe("sending a bridge prompt", () => {
  it("names the host's call, session and text", () => {
    expect(sendPromptSource(0, { ...prompt, method: "prompt" })).toBe(
      'c.session.prompt({ path: { id: s }, body: { parts: [{ type: "text", text: t }] } })'
    );
  });

  it("marks a prompt the bridge sent itself", () => {
    expect(sendPromptSource(0, { ...prompt, mark: "M" })).toContain("text: t, metadata: M }");
  });

  it("reports a refusal under the given prefix, never throws it", () => {
    expect(sendPromptSource(0, { ...prompt, failure: "not sent: " })).toContain(
      '.catch((error) => reportHookFailure(hook.script, "not sent: " + String(error)))'
    );
  });
});

describe("queueing a required finding", () => {
  it("sends the answer with promptAsync only when the script marked it required", () => {
    const source = queueRequiredSource(0, { client: "c", session: "s" });
    expect(source).toMatch(/^if \(required\) \{\n {2}c\.session\.promptAsync\(.*text: answer /);
    expect(source).toContain('"finding not queued: "');
  });
});
