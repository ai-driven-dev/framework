import { describe, expect, it, vi } from "vitest";
import { DecideIdentity } from "../../../../../src/contexts/telemetry/application/identity/decide-identity.use-case.js";
import type { ManageIdentityResult } from "../../../../../src/contexts/telemetry/application/identity/manage-identity.use-case.js";
import { InputRequiredError } from "../../../../../src/shared/domain/shared.error.js";

const NAMED: ManageIdentityResult = { status: "set", personId: "Ada Example" };
const UNSET: ManageIdentityResult = { status: "unset" };

function decider(identity: ManageIdentityResult, proposal: string | null = "Ada Example") {
  const propose = vi.fn(async () => proposal);
  const manage = vi.fn(async () => identity);
  const decide = new DecideIdentity({
    manageIdentity: { execute: manage },
    proposeIdentity: { execute: propose },
  });
  return { decide, propose, manage };
}

const REQUEST = { cwd: "/repo", yes: false, anonymous: false };

describe("DecideIdentity", () => {
  it("names the person a flag names, asking nothing", async () => {
    const { decide, manage } = decider(UNSET);
    expect(await decide.execute({ ...REQUEST, as: "Ada Example" })).toEqual({ set: "Ada Example" });
    expect(manage).not.toHaveBeenCalled();
  });

  it("names nobody when told to", async () => {
    const { decide } = decider(NAMED);
    expect(await decide.execute({ ...REQUEST, anonymous: true })).toBe("none");
  });

  it("keeps the identity already set, proposing nothing", async () => {
    const { decide, propose, manage } = decider(NAMED);
    expect(await decide.execute(REQUEST)).toBe("keep");
    expect(manage).toHaveBeenCalledWith({ action: "show" });
    expect(propose).not.toHaveBeenCalled();
  });

  it("refuses to guess when nothing is set and nobody is asked", async () => {
    const { decide, propose } = decider(UNSET);
    await expect(decide.execute({ ...REQUEST, yes: true })).rejects.toEqual(
      new InputRequiredError(
        "No identity is set, and --yes asks nothing: pass --as <id> to be named, or --anonymous to name nobody."
      )
    );
    expect(propose).not.toHaveBeenCalled();
  });

  it("leaves the question open with the identifier to offer first", async () => {
    const { decide, propose } = decider(UNSET);
    expect(await decide.execute(REQUEST)).toEqual({ ask: { proposal: "Ada Example" } });
    expect(propose).toHaveBeenCalledWith({ cwd: "/repo" });
  });

  it("leaves the question open with no identifier to offer when there is none", async () => {
    const { decide } = decider(UNSET, null);
    expect(await decide.execute(REQUEST)).toEqual({ ask: { proposal: null } });
  });
});
