import { execFile as execFileCallback } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { FileReader } from "../../../kernel/ports/file-reader.js";
import type { Hasher } from "../../../kernel/ports/hasher.js";
import { compareSemver, isSemver } from "../../../kernel/semver.js";
import type { AiToolId } from "../../../kernel/tool.js";
import { Marketplace } from "../../distribution/domain/marketplace.js";
import type { PluginCatalogRepository } from "../../distribution/domain/ports/plugin-catalog-repository.js";
import type { PluginFetcher } from "../../distribution/domain/ports/plugin-fetcher.js";
import { frameworkBuildModeFor } from "../../tools/domain/registry.js";
import { readGlobalPluginFiles } from "../application/ownership/global-plugin-files.js";
import type {
  PinnedUserFramework,
  PinnedUserFrameworkResult,
} from "../application/ownership/release/pinned-user-framework.js";
import type { FrameworkBuildFor } from "../application/shared/ensure-built-marketplace-use-case.js";
import { PLUGIN_NAME_REGEX } from "../domain/plugins/installed-plugin.js";
import {
  isOfficialReleasePluginSource,
  resolvePluginSourceFromMarketplace,
} from "../domain/plugins/plugin-source-resolver.js";
import type { PluginDistributionReader } from "../domain/ports/plugin-distribution-reader.js";

const execFile = promisify(execFileCallback);

interface Checkout {
  readonly path: string;
  readonly cache: string;
  readonly sha: string;
}

export class PinnedUserFrameworkAdapter implements PinnedUserFramework {
  constructor(
    private readonly fs: FileReader,
    private readonly hasher: Hasher,
    private readonly fetcher: PluginFetcher,
    private readonly catalogs: PluginCatalogRepository,
    private readonly plugins: PluginDistributionReader,
    private readonly buildFor: FrameworkBuildFor
  ) {}

  async build(
    ref: string,
    toolId: AiToolId,
    pluginName: string,
    sha?: string
  ): Promise<PinnedUserFrameworkResult> {
    return this.withSession((session) => session.build(ref, toolId, pluginName, sha));
  }

  async withSession<T>(action: (session: PinnedUserFramework) => Promise<T>): Promise<T> {
    const temporary = await mkdtemp(join(tmpdir(), "aidd-user-release-"));
    const checkouts = new Map<string, Promise<Checkout>>();
    const builds = new Map<string, Promise<string>>();
    try {
      return await action({
        build: (ref, toolId, pluginName, sha) =>
          this.buildInSession(temporary, checkouts, builds, ref, toolId, pluginName, sha),
      });
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  }

  private async buildInSession(
    temporary: string,
    checkouts: Map<string, Promise<Checkout>>,
    builds: Map<string, Promise<string>>,
    ref: string,
    toolId: AiToolId,
    pluginName: string,
    sha?: string
  ): Promise<PinnedUserFrameworkResult> {
    if (!ref.startsWith("v") || !isSemver(ref) || !PLUGIN_NAME_REGEX.test(pluginName))
      throw new Error("Expected a versioned official framework release and plugin name.");
    const source = {
      kind: "github",
      repo: "ai-driven-dev/framework",
      ref,
      ...(sha ? { sha } : {}),
    } as const;
    let pending = checkouts.get(ref);
    if (pending === undefined) {
      const cache = join(temporary, `source-${checkouts.size}`);
      pending = (async () => {
        const path = await this.fetcher.fetch(source, cache, { canonicalCheckout: true });
        const head = (await execFile("git", ["-C", path, "rev-parse", "HEAD"])).stdout.trim();
        if (!/^[a-f0-9]{40}$/.test(head) || (sha !== undefined && head !== sha))
          throw new Error("The framework checkout does not match the recorded release commit.");
        return { path, cache, sha: head };
      })();
      checkouts.set(ref, pending);
    } else {
      // Before each reuse, reject a changed checkout, even when the build is already cached.
      const prior = await pending;
      await this.fetcher.fetch({ ...source, sha: prior.sha }, prior.cache);
    }
    const acquired = await pending;
    if (sha !== undefined && acquired.sha !== sha)
      throw new Error("The framework checkout does not match the recorded release commit.");
    const checkout = acquired.path;
    const head = acquired.sha;
    const catalog = await this.catalogs.load(checkout);
    if (
      !catalog?.version ||
      !isSemver(catalog.version) ||
      compareSemver(catalog.version, ref) !== 0
    )
      throw new Error(`Release ${ref} has an invalid framework marketplace version.`);
    const entry = catalog.plugins.find((item) => item.name === pluginName);
    if (!entry) throw new Error(`Release ${ref} does not contain '${pluginName}'.`);
    const marketplace = Marketplace.create({
      name: "aidd-framework",
      source,
      scope: "project",
      addedAt: "1970-01-01T00:00:00.000Z",
    });
    const resolved = resolvePluginSourceFromMarketplace(entry.source, marketplace, checkout);
    if (!isOfficialReleasePluginSource(resolved, pluginName) || resolved.ref !== ref)
      throw new Error(`Release ${ref} has an unverified source for '${pluginName}'.`);
    const dist = await this.plugins.read(join(checkout, "plugins", pluginName));
    if (
      dist.manifest.name !== pluginName ||
      !isSemver(dist.manifest.version) ||
      (entry.version && entry.version !== dist.manifest.version)
    )
      throw new Error(`Release ${ref} has inconsistent metadata for '${pluginName}'.`);
    const mode = frameworkBuildModeFor(toolId);
    if (mode !== "flat")
      throw new Error(`${toolId}: this release update supports flat machine installations only.`);
    const buildKey = `${ref}\u0000${head}\u0000${toolId}`;
    let built = builds.get(buildKey);
    if (built === undefined) {
      const outDir = join(temporary, `build-${builds.size}`);
      built = (async () => {
        await mkdir(outDir);
        const build = this.buildFor(toolId, mode, outDir);
        if (!build) throw new Error(`${toolId}: no compatible framework build.`);
        await build.execute({ sourceDir: checkout, outDir, target: toolId, mode });
        return outDir;
      })();
      builds.set(buildKey, built);
    }
    const outDir = await built;
    const files = await readGlobalPluginFiles(this.fs, this.hasher, outDir, toolId, dist);
    await this.fetcher.fetch({ ...source, sha: head }, acquired.cache);
    return { sha: head, dist, files };
  }
}
