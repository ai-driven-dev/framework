import { describe, expect, it } from "vitest";
import { resolveKiloBin } from "./kilo-cli.js";

describe("Kilo CLI executable resolution", () => {
  const env = {
    APPDATA: "C:\\ci\\runner\\AppData\\Roaming",
    PATH: "C:\\Tools",
  };

  it.each(["cli-windows-x64", "cli-windows-x64-baseline", "cli-windows-arm64"])(
    "resolves the hoisted Windows %s package directly",
    (packageName) => {
      const expected = `C:\\ci\\runner\\AppData\\Roaming\\npm\\node_modules\\@kilocode\\${packageName}\\bin\\kilo.exe`;
      expect(resolveKiloBin("win32", env, (candidate) => candidate === expected)).toBe(expected);
    }
  );

  it("resolves an npm-nested Windows package when it is not hoisted", () => {
    const expected =
      "C:\\ci\\runner\\AppData\\Roaming\\npm\\node_modules\\@kilocode\\cli\\node_modules\\@kilocode\\cli-windows-x64-baseline\\bin\\kilo.exe";
    expect(resolveKiloBin("win32", env, (candidate) => candidate === expected)).toBe(expected);
  });

  it.each(["cli-windows-x64-baseline", "cli-windows-x64", "cli-windows-arm64"])(
    "resolves the npm-prefix Windows %s package directly",
    (packageName) => {
      const npmPrefix = "C:\\npm\\prefix";
      const expected = `C:\\npm\\prefix\\node_modules\\@kilocode\\cli\\node_modules\\@kilocode\\${packageName}\\bin\\kilo.exe`;
      const selected = resolveKiloBin(
        "win32",
        { ...env, NPM_CONFIG_PREFIX: npmPrefix },
        (candidate) => candidate === expected
      );

      expect(selected).toBe(expected);
      expect(selected.endsWith(".exe")).toBe(true);
    }
  );

  it("keeps the AppData package lookup when a custom npm prefix has no native binary", () => {
    const expected =
      "C:\\ci\\runner\\AppData\\Roaming\\npm\\node_modules\\@kilocode\\cli-windows-x64\\bin\\kilo.exe";
    expect(
      resolveKiloBin(
        "win32",
        { ...env, NPM_CONFIG_PREFIX: "C:\\npm\\prefix" },
        (candidate) => candidate === expected
      )
    ).toBe(expected);
  });

  it("uses the custom npm-prefix shim when no native binary is installed", () => {
    const expected = "C:\\npm\\prefix\\kilo.cmd";
    expect(
      resolveKiloBin(
        "win32",
        { ...env, NPM_CONFIG_PREFIX: "C:\\npm\\prefix" },
        (candidate) => candidate === expected
      )
    ).toBe(expected);
  });

  it("derives APPDATA from USERPROFILE without assuming the runner profile", () => {
    const expected =
      "C:\\profiles\\custom-user\\AppData\\Roaming\\npm\\node_modules\\@kilocode\\cli-windows-arm64\\bin\\kilo.exe";
    expect(
      resolveKiloBin(
        "win32",
        { USERPROFILE: "C:\\profiles\\custom-user" },
        (candidate) => candidate === expected
      )
    ).toBe(expected);
  });

  it("keeps the command shim as a fallback when no Windows package is installed", () => {
    expect(resolveKiloBin("win32", env, () => false)).toBe(
      "C:\\ci\\runner\\AppData\\Roaming\\npm\\kilo.cmd"
    );
  });

  it.each(["linux", "darwin"] as const)("resolves Kilo from the %s PATH", (platform) => {
    const expected = "/usr/local/bin/kilo";
    expect(
      resolveKiloBin(
        platform,
        { PATH: "/usr/local/bin:/usr/bin" },
        (candidate) => candidate === expected
      )
    ).toBe(expected);
  });
});
