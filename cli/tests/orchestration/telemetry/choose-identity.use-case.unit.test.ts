import { describe, expect, it, vi } from "vitest";
import { CheckIdentity } from "../../../src/contexts/telemetry/application/identity/check-identity.use-case.js";
import type { IdentityDecision } from "../../../src/contexts/telemetry/application/identity/decide-identity.use-case.js";
import { ChooseIdentity } from "../../../src/orchestration/telemetry/choose-identity.use-case.js";
import { prompterAnswering } from "../../shared/testing/partial-ports.builder.js";

function chooser(decision: IdentityDecision) {
  const select = vi.fn();
  const input = vi.fn();
  const decide = vi.fn(async () => decision);
  const choose = new ChooseIdentity({
    decideIdentity: { execute: decide },
    checkIdentity: new CheckIdentity(),
    prompter: prompterAnswering({ select, input }),
  });
  return { choose, select, input, decide };
}

const OPEN = { ask: { proposal: "Ada Example" } };
const ASK = { cwd: "/repo", yes: false, anonymous: false, onRefused: () => undefined };

describe("ChooseIdentity", () => {
  it.each<IdentityDecision>([{ set: "Ada Example" }, "none", "keep"])(
    "never reaches the prompter for a decision that asks nothing: %j",
    async (decision) => {
      const fail = vi.fn(async () => {
        throw new Error("the prompter was called");
      });
      const choose = new ChooseIdentity({
        decideIdentity: { execute: async () => decision },
        checkIdentity: new CheckIdentity(),
        prompter: prompterAnswering({ select: fail, input: fail }),
      });
      expect(await choose.execute(ASK)).toEqual(decision);
      expect(fail).not.toHaveBeenCalled();
    }
  );

  it("hands telemetry the request, without the refusal callback", async () => {
    const { choose, decide } = chooser("keep");
    await choose.execute({ ...ASK, as: "Ada Example" });
    expect(decide).toHaveBeenCalledWith({
      cwd: "/repo",
      yes: false,
      anonymous: false,
      as: "Ada Example",
    });
  });

  it("offers the proposal, another identifier, or anonymity, and returns the one chosen", async () => {
    const { choose, select } = chooser(OPEN);
    select.mockImplementation(async (_message, choices: { value: unknown }[]) => choices[0]?.value);
    expect(await choose.execute(ASK)).toEqual({ set: "Ada Example" });
    const choices = select.mock.calls[0]?.[1];
    expect(choices.map((c: { value: unknown }) => c.value)).toEqual([
      { set: "Ada Example" },
      "another",
      "none",
    ]);
    expect(choices.map((c: { name: string }) => c.name)).toEqual([
      'As "Ada Example", your git name',
      "As another identifier, typed next",
      "Anonymously",
    ]);
    expect(select.mock.calls[0]?.[0]).toBe(
      "How should your own measurement name you? The identity stays on this machine."
    );
  });

  it("offers no proposal when there is none", async () => {
    const { choose, select } = chooser({ ask: { proposal: null } });
    select.mockResolvedValue("none");
    expect(await choose.execute(ASK)).toBe("none");
    const choices = select.mock.calls[0]?.[1];
    expect(choices.map((c: { value: unknown }) => c.value)).toEqual(["another", "none"]);
  });

  it("asks again, saying so each time, until the identifier typed can be kept", async () => {
    const { choose, select, input } = chooser(OPEN);
    const onRefused = vi.fn();
    select.mockResolvedValue("another");
    input
      .mockResolvedValueOnce("   ")
      .mockResolvedValueOnce("a".repeat(129))
      .mockResolvedValueOnce("Ada at Work");
    expect(await choose.execute({ ...ASK, onRefused })).toEqual({ set: "Ada at Work" });
    expect(input).toHaveBeenCalledTimes(3);
    expect(onRefused).toHaveBeenCalledTimes(2);
    expect(input.mock.calls[0]?.[0]).toBe(
      "Identifier (one non-empty line, at most 128 characters):"
    );
  });
});
