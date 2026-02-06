import { existsSync } from "node:fs";
import { basename } from "node:path";

export interface IShellCommand {
	executable: string;
	args: string[];
}

interface IResolveShellOptions {
	env?: NodeJS.ProcessEnv;
	platform?: NodeJS.Platform;
	existsFn?: (path: string) => boolean;
}

function defaultExists(path: string): boolean {
	try {
		return existsSync(path);
	} catch {
		return false;
	}
}

function getFirstAvailableShell(
	candidates: string[],
	existsFn: (path: string) => boolean,
): string | undefined {
	for (const candidate of candidates) {
		if (!candidate) {
			continue;
		}
		if (existsFn(candidate)) {
			return candidate;
		}
	}
	return undefined;
}

function getArgsForShell(shellPath: string, command: string): string[] {
	const shellName = basename(shellPath);
	if (/bash|zsh|fish|ksh$/u.test(shellName)) {
		return ["-lc", command];
	}

	if (/^sh$/u.test(shellName)) {
		return ["-c", command];
	}

	return ["-c", command];
}

export function resolveShellCommand(
	command: string,
	options: IResolveShellOptions = {},
): IShellCommand {
	const env = options.env ?? process.env;
	const platform = options.platform ?? process.platform;
	const existsFn = options.existsFn ?? defaultExists;

	if (platform === "win32") {
		const comSpec =
			env.AIDD_WORKTREE_SHELL ?? env.COMSPEC ?? env.ComSpec ?? "cmd.exe";
		return {
			executable: comSpec,
			args: ["/d", "/s", "/c", command],
		};
	}

	const explicitShell = env.AIDD_WORKTREE_SHELL || env.SHELL;
	const shellCandidates = Array.from(
		new Set(
			[
				explicitShell,
				"/bin/zsh",
				"/usr/bin/zsh",
				"/bin/bash",
				"/usr/bin/bash",
				"/bin/sh",
				"/usr/bin/sh",
			].filter(
				(candidate): candidate is string =>
					typeof candidate === "string" && candidate.length > 0,
			),
		),
	);

	const shellPath = getFirstAvailableShell(shellCandidates, existsFn);

	if (shellPath) {
		return {
			executable: shellPath,
			args: getArgsForShell(shellPath, command),
		};
	}

	return {
		executable: "/bin/sh",
		args: ["-c", command],
	};
}
