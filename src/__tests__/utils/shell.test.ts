import { describe, expect, it } from "vitest";
import type { IShellCommand } from "../../infra/shell/resolve-shell-command.js";
import { resolveShellCommand } from "../../infra/shell/resolve-shell-command.js";

type ExistsFn = (path: string) => boolean;

function createExists(paths: string[]): ExistsFn {
	const normalized = new Set(paths);
	return (path: string) => normalized.has(path);
}

describe("resolveShellCommand", () => {
	it("prefers explicit AIDD_WORKTREE_SHELL when available", () => {
		const shell = resolveShellCommand("echo test", {
			env: {
				AIDD_WORKTREE_SHELL: "/custom/shell",
			},
			existsFn: createExists(["/custom/shell"]),
			platform: "darwin",
		});

		expect(shell).toEqual<IShellCommand>({
			executable: "/custom/shell",
			args: ["-c", "echo test"],
		});
	});

	it("falls back to SHELL when defined", () => {
		const shell = resolveShellCommand("echo foo", {
			env: {
				SHELL: "/bin/zsh",
			},
			existsFn: createExists(["/bin/zsh"]),
			platform: "linux",
		});

		expect(shell).toEqual<IShellCommand>({
			executable: "/bin/zsh",
			args: ["-lc", "echo foo"],
		});
	});

	it("uses fallback shell list when environment shells are unavailable", () => {
		const shell = resolveShellCommand("run", {
			env: {},
			existsFn: createExists(["/bin/bash"]),
			platform: "linux",
		});

		expect(shell).toEqual<IShellCommand>({
			executable: "/bin/bash",
			args: ["-lc", "run"],
		});
	});

	it("defaults to /bin/sh when nothing else exists", () => {
		const shell = resolveShellCommand("cmd", {
			env: {},
			existsFn: createExists([]),
			platform: "linux",
		});

		expect(shell).toEqual<IShellCommand>({
			executable: "/bin/sh",
			args: ["-c", "cmd"],
		});
	});

	it("uses COMSPEC on Windows", () => {
		const shell = resolveShellCommand("dir", {
			env: { COMSPEC: "C:/Windows/System32/cmd.exe" },
			platform: "win32",
		});

		expect(shell).toEqual<IShellCommand>({
			executable: "C:/Windows/System32/cmd.exe",
			args: ["/d", "/s", "/c", "dir"],
		});
	});
});
