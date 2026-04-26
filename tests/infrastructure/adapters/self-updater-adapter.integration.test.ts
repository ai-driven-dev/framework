import { execSync } from "node:child_process";
import { platform } from "node:os";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SelfUpdaterAdapter } from "../../../src/infrastructure/adapters/self-updater-adapter.js";
import { HttpClient } from "../../../src/infrastructure/http/http-client.js";

vi.mock("node:child_process", () => ({ execSync: vi.fn() }));
vi.mock("node:os", () => ({ platform: vi.fn() }));

const mockExecSync = vi.mocked(execSync);
const mockPlatform = vi.mocked(platform);

function makeAdapter(): SelfUpdaterAdapter {
  return new SelfUpdaterAdapter(new HttpClient());
}

function mockInstall(whichOutput: string, os: "win32" | "linux" | "darwin" = "linux"): void {
  mockPlatform.mockReturnValue(os);
  mockExecSync
    .mockReturnValueOnce(whichOutput as unknown as ReturnType<typeof execSync>)
    .mockReturnValue(undefined as unknown as ReturnType<typeof execSync>);
}

describe("self-updater-adapter — package manager detection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Unix", () => {
    it("detects pnpm from /pnpm/ path", () => {
      mockInstall("/home/user/.local/share/pnpm/aidd");
      makeAdapter().install();
      expect(mockExecSync).toHaveBeenNthCalledWith(
        2,
        "pnpm add -g @ai-driven-dev/cli@latest",
        expect.anything()
      );
    });

    it("detects yarn from /.yarn/ path", () => {
      mockInstall("/home/user/.yarn/bin/aidd");
      makeAdapter().install();
      expect(mockExecSync).toHaveBeenNthCalledWith(
        2,
        "yarn global add @ai-driven-dev/cli@latest",
        expect.anything()
      );
    });

    it("detects bun from /bun/ path", () => {
      mockInstall("/home/user/.bun/bin/aidd");
      makeAdapter().install();
      expect(mockExecSync).toHaveBeenNthCalledWith(
        2,
        "bun add -g @ai-driven-dev/cli@latest",
        expect.anything()
      );
    });

    it("falls back to npm for system paths", () => {
      mockInstall("/usr/local/bin/aidd");
      makeAdapter().install();
      expect(mockExecSync).toHaveBeenNthCalledWith(
        2,
        "npm install -g @ai-driven-dev/cli@latest",
        expect.anything()
      );
    });
  });

  describe("Windows — path separator", () => {
    it("detects pnpm from backslash path", () => {
      mockInstall("C:\\Users\\user\\AppData\\Local\\pnpm\\aidd.cmd\r\n", "win32");
      makeAdapter().install();
      expect(mockExecSync).toHaveBeenNthCalledWith(
        2,
        "pnpm add -g @ai-driven-dev/cli@latest",
        expect.anything()
      );
    });

    it("detects yarn from AppData\\Local\\Yarn\\bin path", () => {
      mockInstall("C:\\Users\\user\\AppData\\Local\\Yarn\\bin\\aidd.cmd\r\n", "win32");
      makeAdapter().install();
      expect(mockExecSync).toHaveBeenNthCalledWith(
        2,
        "yarn global add @ai-driven-dev/cli@latest",
        expect.anything()
      );
    });

    it("detects bun from .bun backslash path", () => {
      mockInstall("C:\\Users\\user\\.bun\\bin\\aidd.cmd\r\n", "win32");
      makeAdapter().install();
      expect(mockExecSync).toHaveBeenNthCalledWith(
        2,
        "bun add -g @ai-driven-dev/cli@latest",
        expect.anything()
      );
    });

    it("falls back to npm for system paths on Windows", () => {
      mockInstall("C:\\Program Files\\nodejs\\aidd.cmd\r\n", "win32");
      makeAdapter().install();
      expect(mockExecSync).toHaveBeenNthCalledWith(
        2,
        "npm install -g @ai-driven-dev/cli@latest",
        expect.anything()
      );
    });
  });

  describe("Windows — multiple results from where", () => {
    it("uses only the first line when where returns multiple matches", () => {
      mockInstall(
        "C:\\Users\\user\\AppData\\Local\\pnpm\\aidd.cmd\r\nC:\\Users\\user\\AppData\\Local\\pnpm\\aidd\r\n",
        "win32"
      );
      makeAdapter().install();
      expect(mockExecSync).toHaveBeenNthCalledWith(
        2,
        "pnpm add -g @ai-driven-dev/cli@latest",
        expect.anything()
      );
    });

    it("throws when where returns no output", () => {
      mockPlatform.mockReturnValue("win32");
      mockExecSync.mockImplementationOnce(() => {
        throw new Error("not found");
      });
      expect(() => makeAdapter().install()).toThrow("Could not detect package manager");
    });
  });
});

describe("self-updater-adapter — install", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("surfaces a read:packages hint when the install command fails", () => {
    mockPlatform.mockReturnValue("linux");
    mockExecSync
      .mockReturnValueOnce("/usr/local/bin/aidd" as unknown as ReturnType<typeof execSync>)
      .mockImplementationOnce(() => {
        throw new Error("npm error 403");
      });
    expect(() => makeAdapter().install()).toThrow("read:packages");
  });
});
