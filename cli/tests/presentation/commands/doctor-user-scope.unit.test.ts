import { describe, expect, it, vi } from "vitest";
import { ExitRequested } from "../../shared/testing/capturing-output.fake.js";
import { registeredAiConfig } from "../../shared/testing/catalog-of.builder.js";
import { doctorHarness } from "../../shared/testing/doctor-command.builder.js";
import { TOOL } from "../../shared/testing/registered-tools.builder.js";

const PROJECT_ROOT = process.cwd();
const { doctorAll, doctorRegistration, loadUserManifest, errors, run } = doctorHarness();

describe("aidd doctor --scope user", () => {
  it("reads the machine-wide manifest and checks registrations alone", async () => {
    expect(await run("--scope", "user")).toEqual([
      "User-scope tools:",
      `  claude (v5.2.2): expects activation in ${registeredAiConfig(TOOL.claude)
        .nativeActivation()
        ?.userSettingsFile("/home/dev", () => undefined)}`,
      "",
      "User-scope installation is healthy",
    ]);
    expect(doctorRegistration).toHaveBeenCalledWith({
      projectRoot: PROJECT_ROOT,
      allowedIds: null,
      globalInstall: true,
    });
    expect(doctorAll).not.toHaveBeenCalled();
  });

  it("narrows the registration check to the one tool named", async () => {
    await run("--scope", "user", "--tool", "claude");

    expect(doctorRegistration.mock.calls[0][0].allowedIds).toEqual(new Set(["claude"]));
  });

  it("refuses a tool no profile declares, naming it unregistered", async () => {
    vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new ExitRequested(Number(code ?? 0));
    });

    await expect(run("--scope", "user", "--tool", "nope")).rejects.toThrow(ExitRequested);

    expect(errors.join("")).toBe("Error: Tool 'nope' is not registered.\n");
  });

  it("points at setup when nothing was ever registered machine-wide", async () => {
    loadUserManifest.mockResolvedValue(null);

    expect(await run("--scope", "user")).toEqual([
      "Nothing registered at user scope yet — run `aidd setup --global` first.",
    ]);
    expect(doctorRegistration).not.toHaveBeenCalled();
  });

  it("refuses a plugin filter user scope tracks nothing to narrow", async () => {
    vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new ExitRequested(Number(code ?? 0));
    });

    await expect(run("--scope", "user", "--plugin", "aidd-dev")).rejects.toThrow(ExitRequested);

    expect(errors.join("")).toBe(
      "Error: --scope user tracks nothing --plugin can narrow — it names every requested tool, " +
        "not one plugin or one file. Drop --plugin, or run `aidd doctor --plugin <name>` at project scope.\n"
    );
    expect(loadUserManifest).not.toHaveBeenCalled();
  });

  it("fails the process on a registration error, and stays quiet about health", async () => {
    doctorRegistration.mockResolvedValue([
      { severity: "error", message: "claude is not registered", fix: "aidd sync" },
    ]);
    const exit = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new ExitRequested(Number(code ?? 0));
    });

    await expect(run("--scope", "user")).rejects.toThrow(ExitRequested);

    expect(errors[0]).toBe("Error:   claude is not registered\n    Fix: aidd sync\n");
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("refuses a scope it does not know before building anything", async () => {
    vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new ExitRequested(Number(code ?? 0));
    });

    await expect(run("--scope", "machine")).rejects.toThrow(ExitRequested);

    expect(errors[0]).toBe('Error: Invalid --scope "machine" — expected "project" or "user".\n');
    expect(doctorAll).not.toHaveBeenCalled();
  });
});

describe("aidd doctor --scope user - what a tool without user-scope settings reports", () => {
  it("names the tool asked for, and says so when it has no user-scope settings file", async () => {
    loadUserManifest.mockResolvedValue({
      getInstalledToolIds: () => ["claude"],
      getToolVersion: () => undefined,
    });

    expect(await run("--scope", "user", "--tool", "cursor")).toEqual([
      "User-scope tools:",
      "  cursor (vunknown): expects activation in no user-scope settings file",
      "",
      "User-scope installation is healthy",
    ]);
  });

  it("names a warning under its own heading, and still calls the machine healthy", async () => {
    doctorRegistration.mockResolvedValue([
      { severity: "warning", message: "claude is ahead of this aidd", fix: "aidd update" },
    ]);

    const lines = await run("--scope", "user");

    expect(lines).toContain("User scope:");
    expect(errors.join("")).toBe("Warning:   claude is ahead of this aidd\n    Fix: aidd update\n");
    expect(lines[lines.length - 1]).toBe("User-scope installation is healthy");
  });
});
