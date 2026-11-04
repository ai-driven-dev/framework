import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  initialize: vi.fn(),
  verify: vi.fn(),
  launch: vi.fn(),
  checkId: vi.fn(),
  ensureId: vi.fn(),
  finishId: vi.fn(),
}));

vi.mock("node:os", async (load) => ({
  ...(await load<typeof import("node:os")>()),
  homedir: () => "/profile",
}));
vi.mock("../../../src/contexts/telemetry/infrastructure/otel/actions/init.js", () => ({
  initializeOtel: mocks.initialize,
}));
vi.mock("../../../src/contexts/telemetry/infrastructure/otel/actions/verify.js", () => ({
  verifyOtel: mocks.verify,
}));
vi.mock("../../../src/contexts/telemetry/infrastructure/otel/actions/run.js", () => ({
  runOtelOpenCode: mocks.launch,
}));
vi.mock("../../../src/runtime/filesystem/installation-identity.js", () => ({
  checkInstallationId: mocks.checkId,
  ensureInstallationId: mocks.ensureId,
  finishInstallationId: mocks.finishId,
}));
vi.mock("../../../src/runtime/user-config-dir.js", () => ({
  userConfigDirOf: () => "/profile/aidd",
}));
vi.mock("../../../src/runtime/wiring/telemetry.js", () => ({
  telemetryDir: () => "/profile/telemetry",
}));

const {
  collectOtel,
  configureOtel,
  checkOtel,
  launchOtel,
  syncCapturedSession,
  followCapturedSessions,
} = await import("../../../src/runtime/wiring/telemetry-otel.js");
const collector = await import(
  "../../../src/contexts/telemetry/infrastructure/otel/actions/collect.js"
);
const sync = await import("../../../src/contexts/telemetry/infrastructure/otel/actions/sync.js");
const follow = await import(
  "../../../src/contexts/telemetry/infrastructure/otel/actions/sync-all.js"
);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.checkId.mockReset().mockResolvedValue(null);
  mocks.initialize
    .mockReset()
    .mockResolvedValue({ path: "/config", changed: true, launch: "restart" });
  mocks.ensureId.mockReset().mockResolvedValue("installation-id");
  mocks.finishId.mockReset().mockImplementation(async (ensure: () => Promise<string>) => {
    await ensure();
  });
});

describe("OTLP runtime wiring", () => {
  it("places the collector in the user's profile and uses the requested port", async () => {
    const start = vi.spyOn(collector, "startOtelCollector").mockResolvedValue({
      port: 4318,
      close: async () => {},
    });
    await collectOtel(4318);
    expect(start).toHaveBeenCalledWith({ home: "/profile", port: 4318 });
    start.mockRestore();
  });

  it("validates identity before initialization and saves it only after a successful change", async () => {
    const result = await configureOtel("claude", "dev");
    expect(result).toMatchObject({ path: "/config", changed: true });
    expect(mocks.checkId).toHaveBeenCalledWith("/profile/aidd");
    expect(mocks.initialize).toHaveBeenCalledWith("claude", "dev", {
      home: "/profile",
      env: process.env,
    });
    expect(mocks.checkId.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.initialize.mock.invocationCallOrder[0]
    );
    expect(mocks.finishId.mock.invocationCallOrder[0]).toBeGreaterThan(
      mocks.initialize.mock.invocationCallOrder[0]
    );
    expect(mocks.ensureId).toHaveBeenCalledWith("/profile/aidd");
  });

  it("does not change exporter settings when an existing installation ID is invalid", async () => {
    mocks.checkId.mockRejectedValue(new Error("invalid identity"));
    await expect(configureOtel("codex", "dev")).rejects.toThrow("invalid identity");
    expect(mocks.initialize).not.toHaveBeenCalled();
    expect(mocks.ensureId).not.toHaveBeenCalled();
  });

  it("does not create an ID when a production destination is refused", async () => {
    mocks.initialize.mockRejectedValue(new Error("production unavailable"));
    await expect(configureOtel("codex", "prod")).rejects.toThrow("production unavailable");
    expect(mocks.checkId).not.toHaveBeenCalled();
    expect(mocks.ensureId).not.toHaveBeenCalled();
  });

  it("passes its runtime home and environment to verification and launch", async () => {
    mocks.verify.mockResolvedValue({ lines: 1 });
    mocks.launch.mockResolvedValue(7);
    await expect(checkOtel("codex", "dev")).resolves.toEqual({ lines: 1 });
    await expect(launchOtel(["check"])).resolves.toBe(7);
    expect(mocks.verify).toHaveBeenCalledWith("codex", "dev", {
      home: "/profile",
      env: process.env,
    });
    expect(mocks.launch).toHaveBeenCalledWith(["check"], { home: "/profile", env: process.env });
  });

  it("uses the private runtime profile for one session and automatic following", async () => {
    const bounded = vi
      .spyOn(sync, "syncOtel")
      .mockResolvedValue({ sent: 1, skipped: 0, offset: 5, partialLine: false });
    const automatic = vi
      .spyOn(follow, "syncAllOtel")
      .mockResolvedValue({ sent: 2, denied: 0, pending: 0 });
    const options = {
      config: "codex" as const,
      tenant: "acme",
      endpoint: "http://127.0.0.1:3000",
      token: "test-token",
    };
    const resolve = async () => ({ state: "unbound" as const });
    const allow = async () => true;
    const snapshot = async () => new Map();
    const permits = async () => "allow" as const;
    await syncCapturedSession({ ...options, session: "s1", follow: false }, resolve, allow);
    await followCapturedSessions(options, snapshot, permits);
    expect(bounded).toHaveBeenCalledWith(
      {
        ...options,
        session: "s1",
        follow: false,
        home: "/profile",
        stateDir: "/profile/telemetry",
      },
      resolve,
      allow
    );
    expect(automatic).toHaveBeenCalledWith(
      { ...options, home: "/profile", stateDir: "/profile/telemetry" },
      snapshot,
      permits
    );
  });
});
