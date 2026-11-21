import { describe, expect, it, vi } from "vitest";
import { CheckIdentity } from "../../../../../src/contexts/telemetry/application/identity/check-identity.js";
import { ChooseIdentity } from "../../../../../src/contexts/telemetry/application/identity/choose-identity.js";
import type { ManageIdentityResult } from "../../../../../src/contexts/telemetry/application/identity/manage-identity.js";
import { InputRequiredError } from "../../../../../src/shared/domain/errors/input-required-error.js";
import { prompterAnswering } from "../../../../shared/testing/partial-ports.builder.js";

const NAMED: ManageIdentityResult = { status: "set", personId: "Ada Example" };
const UNSET: ManageIdentityResult = { status: "unset" };

function chooser(identity: ManageIdentityResult, proposal: string | null = "Ada Example") {
  const select = vi.fn();
  const input = vi.fn();
  const propose = vi.fn(async () => proposal);
  const manage = vi.fn(async () => identity);
  const choose = new ChooseIdentity(
    { execute: manage },
    { execute: propose },
    new CheckIdentity(),
    prompterAnswering({ select, input })
  );
  return { choose, select, input, propose, manage };
}

const ASK = { cwd: "/repo", yes: false, anonymous: false, onRefused: () => undefined };

describe("ChooseIdentity", () => {
  it("names the person a flag names, asking nothing", async () => {
    const { choose, manage, select } = chooser(UNSET);
    expect(await choose.execute({ ...ASK, as: "Ada Example" })).toEqual({ set: "Ada Example" });
    expect(manage).not.toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
  });

  it("names nobody when told to, asking nothing", async () => {
    const { choose, select } = chooser(NAMED);
    expect(await choose.execute({ ...ASK, anonymous: true })).toBe("none");
    expect(select).not.toHaveBeenCalled();
  });

  it("keeps the identity already set, asking nothing", async () => {
    const { choose, select, propose } = chooser(NAMED);
    expect(await choose.execute(ASK)).toBe("keep");
    expect(select).not.toHaveBeenCalled();
    expect(propose).not.toHaveBeenCalled();
  });

  it("refuses to guess when nothing is set and nobody is asked", async () => {
    const { choose, propose } = chooser(UNSET);
    await expect(choose.execute({ ...ASK, yes: true })).rejects.toEqual(
      new InputRequiredError(
        "No identity is set, and --yes asks nothing: pass --as <id> to be named, or --anonymous to name nobody."
      )
    );
    expect(propose).not.toHaveBeenCalled();
  });

  it("offers the proposal, another identifier, or anonymity, and returns the one chosen", async () => {
    const { choose, select, propose } = chooser(UNSET);
    select.mockImplementation(async (_message, choices: { value: unknown }[]) => choices[0]?.value);
    expect(await choose.execute(ASK)).toEqual({ set: "Ada Example" });
    expect(propose).toHaveBeenCalledWith({ cwd: "/repo" });
    const choices = select.mock.calls[0]?.[1];
    expect(choices.map((c: { value: unknown }) => c.value)).toEqual([
      { set: "Ada Example" },
      "another",
      "none",
    ]);
    expect(choices[0]?.name).toContain("Ada Example");
  });

  it("offers no proposal when there is none", async () => {
    const { choose, select } = chooser(UNSET, null);
    select.mockResolvedValue("none");
    expect(await choose.execute(ASK)).toBe("none");
    const choices = select.mock.calls[0]?.[1];
    expect(choices.map((c: { value: unknown }) => c.value)).toEqual(["another", "none"]);
  });

  it("asks again, saying so each time, until the identifier typed can be kept", async () => {
    const { choose, select, input } = chooser(UNSET);
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
