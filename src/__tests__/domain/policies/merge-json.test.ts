import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MergeJsonPolicy } from "../../../domain/policies/primitives/merge-json.js";
import { createPolicyContext } from "./helpers.js";

describe("MergeJsonPolicy", () => {
	let baseDir: string;
	const policy = new MergeJsonPolicy();

	beforeEach(async () => {
		baseDir = await mkdtemp(join(tmpdir(), "merge-json-"));
	});

	afterEach(async () => {
		await rm(baseDir, { recursive: true, force: true });
	});

	describe("basic merging", () => {
		it("creates file when target does not exist", async () => {
			const source = join(baseDir, "source.json");
			const target = join(baseDir, "target.json");

			await writeFile(source, JSON.stringify({ key: "value" }));

			const result = await policy.execute(
				createPolicyContext(source, target, { force: false }),
			);

			expect(result.success).toBe(true);
			const content = JSON.parse(await readFile(target, "utf-8"));
			expect(content.key).toBe("value");
		});

		it("merges objects from source into existing target", async () => {
			const source = join(baseDir, "source.json");
			const target = join(baseDir, "target.json");

			await writeFile(source, JSON.stringify({ newKey: "new" }));
			await writeFile(target, JSON.stringify({ existingKey: "existing" }));

			const result = await policy.execute(
				createPolicyContext(source, target, { force: false }),
			);

			expect(result.success).toBe(true);
			const content = JSON.parse(await readFile(target, "utf-8"));
			expect(content.existingKey).toBe("existing");
			expect(content.newKey).toBe("new");
		});
	});

	describe("arrayUnion option", () => {
		it("merges arrays without duplicates when arrayUnion is true", async () => {
			const source = join(baseDir, "source.json");
			const target = join(baseDir, "target.json");

			await writeFile(source, JSON.stringify({ items: ["a", "b", "c"] }));
			await writeFile(target, JSON.stringify({ items: ["b", "d"] }));

			const ctx = createPolicyContext(source, target, { force: false });
			ctx.policyOptions = { arrayUnion: true };
			const result = await policy.execute(ctx);

			expect(result.success).toBe(true);
			const content = JSON.parse(await readFile(target, "utf-8"));
			expect(new Set(content.items)).toEqual(new Set(["a", "b", "c", "d"]));
		});

		it("concatenates arrays when arrayUnion is false", async () => {
			const source = join(baseDir, "source.json");
			const target = join(baseDir, "target.json");

			await writeFile(source, JSON.stringify({ items: ["a", "b"] }));
			await writeFile(target, JSON.stringify({ items: ["b", "c"] }));

			const ctx = createPolicyContext(source, target, { force: false });
			ctx.policyOptions = { arrayUnion: false };
			const result = await policy.execute(ctx);

			expect(result.success).toBe(true);
			const content = JSON.parse(await readFile(target, "utf-8"));
			expect(content.items).toEqual(["b", "c", "a", "b"]);
		});
	});

	describe("targetKey option", () => {
		it("wraps source under targetKey when merging into empty target", async () => {
			const source = join(baseDir, "server.json");
			const target = join(baseDir, "mcp.json");

			await writeFile(
				source,
				JSON.stringify({
					"n8n-mcp": { command: "npx", args: ["n8n-mcp"] },
				}),
			);

			const ctx = createPolicyContext(source, target, { force: true });
			ctx.policyOptions = { json: { targetKey: "mcpServers" } };
			const result = await policy.execute(ctx);

			expect(result.success).toBe(true);
			const content = JSON.parse(await readFile(target, "utf-8"));
			expect(content.mcpServers).toBeDefined();
			expect(content.mcpServers["n8n-mcp"]).toBeDefined();
			expect(content.mcpServers["n8n-mcp"].command).toBe("npx");
		});

		it("merges multiple sources under same targetKey", async () => {
			const target = join(baseDir, "mcp.json");

			const source1 = join(baseDir, "automation.json");
			await writeFile(
				source1,
				JSON.stringify({
					"n8n-mcp": { command: "npx", args: ["n8n-mcp"] },
				}),
			);

			const ctx1 = createPolicyContext(source1, target, { force: true });
			ctx1.policyOptions = { json: { targetKey: "mcpServers" } };
			await policy.execute(ctx1);

			const source2 = join(baseDir, "browse.json");
			await writeFile(
				source2,
				JSON.stringify({
					playwright: { command: "npx", args: ["@playwright/mcp"] },
				}),
			);

			const ctx2 = createPolicyContext(source2, target, { force: true });
			ctx2.policyOptions = { json: { targetKey: "mcpServers" } };
			await policy.execute(ctx2);

			const content = JSON.parse(await readFile(target, "utf-8"));
			expect(content.mcpServers["n8n-mcp"]).toBeDefined();
			expect(content.mcpServers.playwright).toBeDefined();
		});

		it("preserves existing keys when merging with targetKey", async () => {
			const source = join(baseDir, "new-server.json");
			const target = join(baseDir, "mcp.json");

			await writeFile(
				target,
				JSON.stringify({
					existingKey: "preserved",
					mcpServers: { existing: { command: "existing" } },
				}),
			);

			await writeFile(
				source,
				JSON.stringify({ "new-server": { command: "new" } }),
			);

			const ctx = createPolicyContext(source, target, { force: true });
			ctx.policyOptions = { json: { targetKey: "mcpServers" } };
			await policy.execute(ctx);

			const content = JSON.parse(await readFile(target, "utf-8"));
			expect(content.existingKey).toBe("preserved");
			expect(content.mcpServers.existing).toBeDefined();
			expect(content.mcpServers["new-server"]).toBeDefined();
		});

		it("works without targetKey (default behavior unchanged)", async () => {
			const source = join(baseDir, "source.json");
			const target = join(baseDir, "target.json");

			await writeFile(
				source,
				JSON.stringify({ mcpServers: { server: { cmd: "test" } } }),
			);

			const ctx = createPolicyContext(source, target, { force: true });
			ctx.policyOptions = {};
			await policy.execute(ctx);

			const content = JSON.parse(await readFile(target, "utf-8"));
			expect(content.mcpServers.server.cmd).toBe("test");
		});
	});

	describe("error handling", () => {
		it("returns error when source does not exist", async () => {
			const source = join(baseDir, "nonexistent.json");
			const target = join(baseDir, "target.json");

			const result = await policy.execute(
				createPolicyContext(source, target, { force: false }),
			);

			expect(result.success).toBe(false);
			expect(result.errors?.length).toBeGreaterThan(0);
		});

		it("returns error when source contains invalid JSON", async () => {
			const source = join(baseDir, "invalid.json");
			const target = join(baseDir, "target.json");

			await writeFile(source, "{ invalid json }");

			const result = await policy.execute(
				createPolicyContext(source, target, { force: false }),
			);

			expect(result.success).toBe(false);
		});
	});

	describe("dry run", () => {
		it("does not modify files in dry run mode", async () => {
			const source = join(baseDir, "source.json");
			const target = join(baseDir, "target.json");

			await writeFile(source, JSON.stringify({ key: "value" }));

			const ctx = createPolicyContext(source, target, { force: false });
			ctx.options.dryRun = true;
			const result = await policy.execute(ctx);

			expect(result.success).toBe(true);
			const { existsSync } = await import("node:fs");
			expect(existsSync(target)).toBe(false);
		});
	});
});
