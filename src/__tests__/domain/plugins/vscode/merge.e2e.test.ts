import { promises as fs } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { DisplayAdapter } from "../../../../domain/policies/installation-policy.js";
import { MergeJsonPolicy } from "../../../../domain/policies/primitives/merge-json.js";
import { FileSystemAdapter } from "../../../../infra/fs/file-system-adapter.js";
import { getE2ETestDir } from "../../../utils/test-utils.js";

/** Minimal E2E-style test to verify JSON merge behavior for VS Code files */
describe("VS Code JSON merge", () => {
	const baseDir = join(getE2ETestDir(), "vscode-merge-sandbox");
	const vscodeDir = join(baseDir, ".vscode");
	const fsAdapter = new FileSystemAdapter();
	const display: DisplayAdapter = { show: () => {} };
	const policy = new MergeJsonPolicy();

	it("merges settings.json and extensions.json with user precedence and array union", async () => {
		await fs.mkdir(vscodeDir, { recursive: true });

		// Prepare target (existing) settings.json
		const targetSettings = join(vscodeDir, "settings.json");
		await fs.writeFile(
			targetSettings,
			JSON.stringify(
				{
					"files.autoSave": "off",
					"editor.wordWrap": "off",
					"cSpell.userWords": ["keepMe"],
				},
				null,
				2,
			),
		);

		// Prepare source (template) settings.json
		const sourceSettings = join(baseDir, "source.settings.json");
		await fs.writeFile(
			sourceSettings,
			JSON.stringify(
				{
					"files.autoSave": "afterDelay",
					"editor.minimap.enabled": false,
					"cSpell.userWords": ["aidd", "keepMe"],
				},
				null,
				2,
			),
		);

		const resultSettings = await policy.execute({
			source: sourceSettings,
			target: targetSettings,
			options: { dryRun: false, verbose: false, force: true },
			verbosity: "normal",
			policyOptions: { userFirst: true, arrayUnion: true },
			fs: fsAdapter,
			display,
		});

		expect(resultSettings.success).toBe(true);
		const mergedSettings = JSON.parse(
			await fs.readFile(targetSettings, "utf-8"),
		);
		expect(mergedSettings["files.autoSave"]).toBe("off"); // user precedence
		expect(mergedSettings["editor.minimap.enabled"]).toBe(false); // added from template
		expect(new Set(mergedSettings["cSpell.userWords"]).has("keepMe")).toBe(
			true,
		);
		expect(new Set(mergedSettings["cSpell.userWords"]).has("aidd")).toBe(true);

		// Prepare target (existing) extensions.json
		const targetExtensions = join(vscodeDir, "extensions.json");
		await fs.writeFile(
			targetExtensions,
			JSON.stringify(
				{
					recommendations: ["foo.bar"],
				},
				null,
				2,
			),
		);

		// Prepare source (template) extensions.json
		const sourceExtensions = join(baseDir, "source.extensions.json");
		await fs.writeFile(
			sourceExtensions,
			JSON.stringify(
				{
					recommendations: ["eamodio.gitlens", "foo.bar"],
					unwantedRecommendations: ["bad.plugin"],
				},
				null,
				2,
			),
		);

		const resultExtensions = await policy.execute({
			source: sourceExtensions,
			target: targetExtensions,
			options: { dryRun: false, verbose: false, force: true },
			verbosity: "normal",
			policyOptions: { userFirst: true, arrayUnion: true },
			fs: fsAdapter,
			display,
		});

		expect(resultExtensions.success).toBe(true);
		const mergedExtensions = JSON.parse(
			await fs.readFile(targetExtensions, "utf-8"),
		);
		const recs = new Set(mergedExtensions.recommendations || []);
		expect(recs.has("foo.bar")).toBe(true);
		expect(recs.has("eamodio.gitlens")).toBe(true);
		expect(Array.isArray(mergedExtensions.unwantedRecommendations)).toBe(true);
		expect(mergedExtensions.unwantedRecommendations[0]).toBe("bad.plugin");
	});
});
