#!/usr/bin/env node
/**
 * The YouTube title and description of the release video, in the layout of the published ones:
 * `node .claude/skills/release-video/assets/youtube-metadata.js --version 5.13 --tag v5.13.0 --repo <owner/repo> [--out release-video.json]`.
 */
const fs = require("node:fs");
const path = require("node:path");

const PLAN = path.resolve(__dirname, "../../../../aidd_docs/release-video/scenes.json");
const MAX_TITLE = 100;

const slash = (surface) => (surface.includes(":") ? `/${surface}` : surface);

function titleOf(plan, version) {
  const { themes } = plan.youtube;
  const list = themes.length > 1 ? `${themes.slice(0, -1).join(", ")} et ${themes.at(-1)}` : themes[0];
  return `Framework - Release ${version} : ${list}`;
}

function youtubeMetadata(plan, { version, tag, repo }) {
  const contributors = plan.scenes.find((scene) => scene.template === "contributors")?.logins?.length;
  const lines = [
    `Les nouveautés du framework AI-Driven Dev ${version}, démontrées de bout en bout.`,
    "",
    "Au programme :",
    ...plan.youtube.programme.map(({ surface, text }) => `- ${slash(surface)} : ${text}`),
    "",
  ];
  if (contributors) lines.push(`Version livrée par ${contributors} contributeurs (crédits dans les notes de version).`, "");
  lines.push(`Notes de version : https://github.com/${repo}/releases/tag/${tag}`, `Code source : https://github.com/${repo}`);
  return { title: titleOf(plan, version), description: lines.join("\n") };
}

/** What a plan lacks to be published: the block, a title that fits, a line for every scene's surface. */
function youtubeProblems(plan) {
  if (!plan.youtube) return ["youtube: missing"];
  const problems = [];
  const title = titleOf(plan, "0.0");
  if (title.length > MAX_TITLE) problems.push(`title: ${title.length} characters, ${MAX_TITLE} at most`);
  const covered = new Set(plan.youtube.programme.map((line) => line.surface));
  for (const surface of plan.scenes.flatMap((scene) => scene.surfaces ?? [])) {
    if (!covered.has(surface)) problems.push(`youtube programme: no line for ${surface}`);
  }
  return problems;
}

module.exports = { youtubeMetadata, youtubeProblems };

if (require.main === module) {
  const argument = (name) => process.argv[process.argv.indexOf(`--${name}`) + 1];
  const [version, tag, repo] = ["version", "tag", "repo"].map(argument);
  if (!version || !tag || !repo) throw new Error("Usage: youtube-metadata.js --version <x.y> --tag <tag> --repo <owner/repo> [--out <file>]");
  const plan = JSON.parse(fs.readFileSync(PLAN, "utf8"));
  const problems = youtubeProblems(plan);
  if (problems.length) throw new Error(problems.join("\n"));
  const out = path.resolve(process.argv.includes("--out") ? argument("out") : "release-video.json");
  fs.writeFileSync(out, `${JSON.stringify(youtubeMetadata(plan, { version, tag, repo }), null, 2)}\n`);
  console.log(`✅ ${out}`);
}
