import { execSync } from "node:child_process";
import { platform } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FrameworkResolutionError, UpdateError } from "../../../src/kernel/errors.js";
import type { HttpGet, HttpGetOptions } from "../../../src/runtime/http/http-client.js";
import { SelfUpdaterAdapter } from "../../../src/runtime/self-update/self-updater-adapter.js";
import { CapturingLogger } from "../../helpers/ports/capturing-logger.js";

vi.mock("node:child_process", () => ({ execSync: vi.fn() }));
vi.mock("node:os", () => ({ platform: vi.fn() }));

const mockExecSync = vi.mocked(execSync);
const mockPlatform = vi.mocked(platform);

const NPM_URL = "https://registry.npmjs.org/-/package/@ai-driven-dev/cli/dist-tags";
const TAG_URL = "https://api.github.com/repos/ai-driven-dev/framework/releases/tags/cli-v1.2.3";

function http(
  answers: Record<string, unknown | Error>
): HttpGet & { calls: { url: string; options?: HttpGetOptions }[] } {
  const calls: { url: string; options?: HttpGetOptions }[] = [];
  return {
    calls,
    get: async (url, options) => {
      calls.push({ url, options });
      const answer = answers[url];
      if (answer instanceof Error) throw answer;
      return { body: answer, statusCode: 200, contentType: "application/json" };
    },
  };
}

function offline(): HttpGet {
  return { get: async () => ({ body: {}, statusCode: 200, contentType: "" }) };
}

describe("SelfUpdaterAdapter.fetchLatestRelease, the edges", () => {
  it("refuses a registry answer that is not an object", async () => {
    const adapter = new SelfUpdaterAdapter(http({ [NPM_URL]: null }));

    await expect(adapter.fetchLatestRelease()).rejects.toThrow(
      new FrameworkResolutionError(`Unexpected npm registry response from ${NPM_URL}`)
    );
  });

  it("wraps a transport failure with the URL it was reading", async () => {
    const adapter = new SelfUpdaterAdapter(http({ [NPM_URL]: new Error("socket hang up") }));

    await expect(adapter.fetchLatestRelease()).rejects.toThrow(
      new FrameworkResolutionError(
        `Could not resolve the latest CLI version from ${NPM_URL}: socket hang up`
      )
    );
  });

  it("reads the changelog with the token it was given", async () => {
    const client = http({ [NPM_URL]: { latest: "1.2.3" }, [TAG_URL]: { body: "notes" } });
    const adapter = new SelfUpdaterAdapter(client, {
      tokenProvider: { resolve: async () => "tok" },
    });

    expect(await adapter.fetchLatestRelease()).toStrictEqual({
      version: "1.2.3",
      changelog: "notes",
    });
    expect(client.calls[1]).toStrictEqual({ url: TAG_URL, options: { token: "tok" } });
  });

  it("says why the changelog is missing, on the debug channel", async () => {
    const logger = new CapturingLogger();
    const client = http({ [NPM_URL]: { latest: "1.2.3" }, [TAG_URL]: new Error("offline") });

    await new SelfUpdaterAdapter(client, { logger }).fetchLatestRelease();

    expect(logger.debugMessages).toStrictEqual([`Changelog unavailable from ${TAG_URL}: offline`]);
  });
});

describe("SelfUpdaterAdapter.install, what it runs", () => {
  let written: string[];
  const realWrite = process.stderr.write;

  beforeEach(() => {
    vi.clearAllMocks();
    written = [];
    process.stderr.write = ((chunk: string | Uint8Array) => {
      written.push(String(chunk));
      return true;
    }) as typeof process.stderr.write;
  });

  afterEach(() => {
    process.stderr.write = realWrite;
  });

  it("asks `which` on POSIX, reading its answer as text", () => {
    mockPlatform.mockReturnValue("linux");
    mockExecSync.mockReturnValueOnce("/usr/local/bin/aidd\n").mockReturnValue(Buffer.alloc(0));

    new SelfUpdaterAdapter(offline()).install();

    expect(mockExecSync.mock.calls[0]).toStrictEqual(["which aidd", { encoding: "utf8" }]);
  });

  it("asks `where` on Windows", () => {
    mockPlatform.mockReturnValue("win32");
    mockExecSync.mockReturnValueOnce("C:\\x\\aidd.cmd").mockReturnValue(Buffer.alloc(0));

    new SelfUpdaterAdapter(offline()).install();

    expect(mockExecSync.mock.calls[0]).toStrictEqual(["where aidd", { encoding: "utf8" }]);
  });

  it("runs the npm install with stderr piped, and answers the binary path", () => {
    mockPlatform.mockReturnValue("linux");
    mockExecSync.mockReturnValueOnce("/usr/local/bin/aidd\n").mockReturnValue(Buffer.alloc(0));

    const binaryPath = new SelfUpdaterAdapter(offline()).install();

    expect(binaryPath).toBe("/usr/local/bin/aidd");
    expect(mockExecSync.mock.calls[1]).toStrictEqual([
      "npm install -g @ai-driven-dev/cli@latest",
      { stdio: ["inherit", "inherit", "pipe"] },
    ]);
  });

  it("detects bun from a Windows bin directory whatever its case", () => {
    mockPlatform.mockReturnValue("win32");
    mockExecSync
      .mockReturnValueOnce("C:\\Users\\me\\AppData\\Local\\Bun\\Bin\\aidd.exe")
      .mockReturnValue(Buffer.alloc(0));

    new SelfUpdaterAdapter(offline()).install();

    expect(mockExecSync.mock.calls[1]?.[0]).toBe("bun add -g @ai-driven-dev/cli@latest");
  });

  it("echoes the failed install's stderr once, then refuses", () => {
    mockPlatform.mockReturnValue("linux");
    mockExecSync.mockReturnValueOnce("/usr/local/bin/aidd").mockImplementationOnce(() => {
      throw Object.assign(new Error("failed"), { stderr: Buffer.from("npm error 403\n") });
    });

    expect(() => new SelfUpdaterAdapter(offline()).install()).toThrow(new UpdateError());
    expect(written).toStrictEqual(["npm error 403\n"]);
  });

  it("echoes nothing when the failure carried no stderr", () => {
    mockPlatform.mockReturnValue("linux");
    mockExecSync.mockReturnValueOnce("/usr/local/bin/aidd").mockImplementationOnce(() => {
      throw new Error("failed");
    });

    expect(() => new SelfUpdaterAdapter(offline()).install()).toThrow(new UpdateError());
    expect(written).toStrictEqual([]);
  });

  it("echoes nothing when the failure was not even an object", () => {
    mockPlatform.mockReturnValue("linux");
    mockExecSync.mockReturnValueOnce("/usr/local/bin/aidd").mockImplementationOnce(() => {
      throw "failed";
    });

    expect(() => new SelfUpdaterAdapter(offline()).install()).toThrow(new UpdateError());
    expect(written).toStrictEqual([]);
  });

  it("echoes nothing when stderr is neither text nor bytes", () => {
    mockPlatform.mockReturnValue("linux");
    mockExecSync.mockReturnValueOnce("/usr/local/bin/aidd").mockImplementationOnce(() => {
      throw Object.assign(new Error("failed"), { stderr: 42 });
    });

    expect(() => new SelfUpdaterAdapter(offline()).install()).toThrow(new UpdateError());
    expect(written).toStrictEqual([]);
  });
});
