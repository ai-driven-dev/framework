import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  confirm,
  forget,
  identity,
  installTelemetryIo,
  propose,
  retention,
  run,
  select,
  stderr,
  stdout,
  turnOff,
  turnOn,
} from "../../../shared/testing/telemetry-command.builder.js";

installTelemetryIo();

describe("aidd telemetry identity", () => {
  it("shows who is named when given nothing", async () => {
    identity.execute.mockResolvedValue({ status: "unset" });
    expect(await run("identity")).toBeNull();
    expect(identity.execute).toHaveBeenCalledWith({ action: "show" });
    expect(stdout()).toContain("No identity is set");
  });

  it("names the person it is given", async () => {
    identity.execute.mockResolvedValue({ status: "set", personId: "person-a" });
    await run("identity", "person-a");
    expect(identity.execute).toHaveBeenCalledWith({ action: "set", typed: "person-a" });
    expect(stdout()).toContain('"person-a"');
  });

  it("removes the identity with --off", async () => {
    identity.execute.mockResolvedValue({ status: "removed" });
    await run("identity", "--off");
    expect(identity.execute).toHaveBeenCalledWith({ action: "off" });
    expect(stdout()).toContain("removed");
  });

  it("exits 1 for an identifier it refuses", async () => {
    identity.execute.mockResolvedValue({ status: "refused" });
    expect(await run("identity", "x")).toBe(1);
  });

  it("refuses --off together with an identifier, touching nothing", async () => {
    expect(await run("identity", "person-a", "--off")).toBe(1);
    expect(stderr()).toBe("Error: --off removes the identity: give it no identifier.\n");
    expect(identity.execute).not.toHaveBeenCalled();
  });
});

const ON = {
  status: "on",
  consentWritten: true,
  root: "/w/repo",
  identity: { personId: null, previous: null },
};

describe("aidd telemetry on", () => {
  const ANONYMOUS = { status: "unset" };
  beforeEach(() => {
    identity.execute.mockResolvedValue(ANONYMOUS);
    turnOn.mockResolvedValue(ON);
    retention.mockResolvedValue({ days: 3650, short: false });
  });

  it("warns of a short retention, read from the root of the clone it turned on", async () => {
    retention.mockResolvedValue({ days: 30, short: true });
    expect(await run("on", "--yes", "--anonymous")).toBeNull();
    expect(retention).toHaveBeenCalledWith({ root: ON.root });
    expect(stderr()).toContain("Claude Code keeps transcripts for 30 days");
  });

  it("turns measurement on in the directory it was run from, without asking, with --yes and a choice", async () => {
    expect(await run("on", "--yes", "--anonymous")).toBeNull();
    expect(turnOn).toHaveBeenCalledWith({ cwd: process.cwd(), choice: "none" });
    expect(confirm).not.toHaveBeenCalled();
    expect(stdout()).toContain("Measurement is on");
  });

  it("names the person given with --as", async () => {
    expect(await run("on", "--yes", "--as", "Ada Example")).toBeNull();
    expect(turnOn).toHaveBeenCalledWith({ cwd: process.cwd(), choice: { set: "Ada Example" } });
  });

  describe("where a person can be asked", () => {
    const original = process.stdout.isTTY;
    beforeEach(() => {
      process.stdout.isTTY = true;
      confirm.mockResolvedValue(true);
      propose.mockResolvedValue("Ada Example");
    });
    afterEach(() => {
      process.stdout.isTTY = original;
    });

    it("turns on after a yes, defaulting the question to no", async () => {
      select.mockResolvedValue("none");
      expect(await run("on")).toBeNull();
      expect(confirm.mock.calls[0]?.[1]).toBe(false);
      expect(turnOn).toHaveBeenCalled();
    });

    it("changes nothing after a no, and reads no proposal", async () => {
      confirm.mockResolvedValue(false);
      expect(await run("on")).toBeNull();
      expect(turnOn).not.toHaveBeenCalled();
      expect(propose).not.toHaveBeenCalled();
      expect(stdout()).toContain("Nothing changed.");
    });
  });

  it("exits 1 when it is refused", async () => {
    turnOn.mockResolvedValue({ status: "refused", reason: "identity-set" });
    expect(await run("on", "--yes", "--anonymous")).toBe(1);
    expect(stderr()).toContain("aidd telemetry identity --off");
    expect(retention).not.toHaveBeenCalled();
  });
});

describe("aidd telemetry off", () => {
  it("turns measurement off", async () => {
    turnOff.mockResolvedValue({ status: "off", changed: true });
    expect(await run("off")).toBeNull();
    expect(turnOff).toHaveBeenCalledWith({ cwd: process.cwd() });
    expect(stdout()).toContain("Measurement is off");
  });

  it("exits 1 when it is refused", async () => {
    turnOff.mockResolvedValue({ status: "refused", reason: "unreadable-config" });
    expect(await run("off")).toBe(1);
  });
});

describe("aidd telemetry forget", () => {
  const plan = { entries: [], repositories: [], missing: [], unlocated: 0 };

  it("only previews without --yes", async () => {
    forget.mockResolvedValue({ status: "preview", plan });
    expect(await run("forget")).toBeNull();
    expect(forget).toHaveBeenCalledWith({ confirmed: false });
  });

  it("removes with --yes", async () => {
    forget.mockResolvedValue({ status: "forgotten", plan });
    await run("forget", "--yes");
    expect(forget).toHaveBeenCalledWith({ confirmed: true });
  });
});
