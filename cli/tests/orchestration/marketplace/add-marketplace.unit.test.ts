import { describe, expect, it, vi } from "vitest";
import { Marketplace } from "../../../src/contexts/distribution/domain/marketplace.js";
import { AddMarketplace } from "../../../src/orchestration/marketplace/add-marketplace.js";
import { TrustDeniedError } from "../../../src/shared/domain/errors/trust-denied-error.js";
import { ScriptedPrompter } from "../../shared/testing/scripted-prompter.fake.js";

const PROJECT_ROOT = "/project";

const marketplace = Marketplace.create({
  name: "market",
  source: { kind: "local", path: "/market" },
  scope: "project",
  addedAt: "2026-04-29T10:00:00.000Z",
});

function addWith(trusted: boolean, prompter = new ScriptedPrompter([])) {
  const calls: string[] = [];
  const removeRegistered = {
    execute: vi.fn(async () => {
      calls.push("remove");
    }),
  };
  const prepare = {
    execute: vi.fn(async () => {
      calls.push("prepare");
      return { marketplace, trusted };
    }),
  };
  const record = {
    execute: vi.fn(async () => {
      calls.push("record");
    }),
  };
  const useCase = new AddMarketplace(removeRegistered, prepare, record, prompter);
  return { useCase, removeRegistered, prepare, record, calls };
}

const COMMAND = {
  name: "market",
  source: { kind: "local", path: "/market" },
  scope: "project",
  projectRoot: PROJECT_ROOT,
  autoTrust: false,
} as const;

describe("AddMarketplace", () => {
  it("removes the registered marketplace first, then prepares with the name accepted, when overwriting", async () => {
    const { useCase, removeRegistered, prepare, calls } = addWith(true);

    await useCase.execute({ ...COMMAND, overwrite: true });

    expect(calls).toEqual(["remove", "prepare", "record"]);
    expect(removeRegistered.execute).toHaveBeenCalledWith({
      name: "market",
      projectRoot: PROJECT_ROOT,
    });
    expect(prepare.execute).toHaveBeenCalledWith(expect.objectContaining({ replace: true }));
  });

  it("removes nothing when not overwriting", async () => {
    const { useCase, removeRegistered } = addWith(true);

    await useCase.execute(COMMAND);

    expect(removeRegistered.execute).not.toHaveBeenCalled();
  });

  it("records a source already trusted without asking and without trusting it again", async () => {
    const { useCase, record } = addWith(true);

    const result = await useCase.execute(COMMAND);

    expect(record.execute).toHaveBeenCalledWith({
      marketplace,
      projectRoot: PROJECT_ROOT,
      trust: false,
    });
    expect(result).toEqual({ marketplace });
  });

  it("trusts an untrusted source without asking when told to", async () => {
    const { useCase, record } = addWith(false);

    await useCase.execute({ ...COMMAND, autoTrust: true });

    expect(record.execute).toHaveBeenCalledWith(expect.objectContaining({ trust: true }));
  });

  it("trusts an untrusted source once the person confirms", async () => {
    const prompter = new ScriptedPrompter([{ type: "confirm", value: true }]);
    const { useCase, record } = addWith(false, prompter);

    await useCase.execute(COMMAND);

    expect(record.execute).toHaveBeenCalledWith(expect.objectContaining({ trust: true }));
  });

  it("records nothing when the person denies the trust", async () => {
    const prompter = new ScriptedPrompter([{ type: "confirm", value: false }]);
    const { useCase, record } = addWith(false, prompter);

    await expect(useCase.execute(COMMAND)).rejects.toThrow(TrustDeniedError);
    expect(record.execute).not.toHaveBeenCalled();
  });
});
