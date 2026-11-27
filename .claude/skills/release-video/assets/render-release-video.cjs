#!/usr/bin/env node
/**
 * Renders the release video from `aidd_docs/release-video/scenes.json`, locally, with no AI tool
 * involved: `node .claude/skills/release-video/assets/render-release-video.cjs --version 5.13 [--plan <file>] [--music <file>] [--out <file>]`, which also writes the thumbnail next to the video as a `.png`.
 *
 * Needs `npx`, a network (fonts and avatars are local, GSAP and the avatars are fetched) and
 * ffmpeg + Chrome as Hyperframes does. The renderer is pinned: a new Hyperframes release
 * changes pixels, so it changes the video only when someone bumps it here.
 */

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../../../..");
const PLAN = path.join(ROOT, "aidd_docs/release-video/scenes.json");
const HYPERFRAMES = "hyperframes@0.8.162";
const INTRO = 5;
const INTRO_WITH_HIGHLIGHTS = 6.5;
const VERSION_TYPING_FROM = 0.8, VERSION_TYPING_SECONDS = 1.1;
const OUTRO = 4;

const CSS = `
@font-face { font-family: "Inter"; font-weight: 700; src: url("assets/fonts/inter-latin-700-normal.woff2") format("woff2"); }
@font-face { font-family: "Inter"; font-weight: 800; src: url("assets/fonts/inter-latin-800-normal.woff2") format("woff2"); }
@font-face { font-family: "JetBrains Mono"; font-weight: 500; src: url("assets/fonts/jetbrains-mono-latin-500-normal.woff2") format("woff2"); }
@font-face { font-family: "JetBrains Mono"; font-weight: 700; src: url("assets/fonts/jetbrains-mono-latin-700-normal.woff2") format("woff2"); }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 1920px; height: 1080px; overflow: hidden; background: #070726; }
#root { position: relative; width: 1920px; height: 1080px; overflow: hidden; color: #eef0ff; font-family: "Inter", sans-serif;
  background: radial-gradient(900px 600px at 12% 10%, rgba(40, 90, 120, 0.35), transparent 70%),
    radial-gradient(900px 700px at 92% 95%, rgba(110, 60, 200, 0.30), transparent 70%),
    linear-gradient(160deg, #0a0a30 0%, #070726 55%, #0d0b34 100%); }
.scene { position: absolute; inset: 0; }
.inner { position: absolute; inset: 0; padding: 78px 120px; display: flex; flex-direction: column; gap: 26px; }
.pill { align-self: flex-start; font-family: "JetBrains Mono", monospace; font-weight: 700; font-size: 30px; padding: 8px 26px;
  border-radius: 40px; color: #07072b; background: linear-gradient(90deg, #5ee6a8, #8aa6ff 55%, #ff8fa8); }
h2 { font-size: 78px; line-height: 1.08; letter-spacing: -0.02em; font-weight: 800; }
.g { background: linear-gradient(90deg, #5ee6a8, #8aa6ff 55%, #c88bff 80%, #ff8fa8); -webkit-background-clip: text; background-clip: text; color: transparent; }
.win { background: #0b0b36; border: 2px solid #26265f; border-radius: 22px; overflow: hidden; box-shadow: 0 30px 80px rgba(0, 0, 20, 0.5); }
.bar { display: flex; align-items: center; gap: 12px; padding: 16px 22px; border-bottom: 2px solid #1c1c4d; font-family: "JetBrains Mono", monospace; font-weight: 500; font-size: 24px; color: #8a8fc0; }
.bar i { width: 18px; height: 18px; border-radius: 50%; display: block; }
.body { padding: 30px 36px; display: flex; flex-direction: column; gap: 18px; font-family: "JetBrains Mono", monospace; font-weight: 500; font-size: 32px; line-height: 1.4; }
.dim { color: #8a8fc0; } .grn { color: #5ee6a8; } .blu { color: #8aa6ff; } .pnk { color: #ff8fa8; } .amb { color: #ffd37a; }
.row.del { color: #ff9aa8; background: rgba(255,107,107,.14); border-left: 4px solid #ff6b6b; padding-left: 14px; }
.row.add { color: #5ee6a8; background: rgba(94,230,168,.12); border-left: 4px solid #5ee6a8; padding-left: 14px; }
.diff .row { font-size: 27px; line-height: 1.35; }
.figs { display: flex; gap: 24px; margin-top: 18px; }
.fig { flex: 1; background: #0b0b36; border: 2px solid #26265f; border-radius: 16px; padding: 18px 28px; display: flex; flex-direction: column; gap: 6px; }
.fig b { font-size: 72px; font-weight: 800; line-height: 1; }
.fig .from { color: #ff9aa8; } .fig .arr { color: #8a8fc0; padding: 0 14px; } .fig .to { color: #5ee6a8; }
.fig small { font-family: "JetBrains Mono", monospace; font-size: 26px; color: #8a8fc0; }
.verdict { display: flex; align-items: center; gap: 24px; }
.verdict b { font-size: 44px; font-weight: 800; padding: 6px 30px; border: 3px solid currentColor; border-radius: 14px; }
.verdict span { color: #a6abe0; }
.row.red { color: #ff9aa8; background: rgba(255,107,107,.14); border-left: 4px solid #ff6b6b; padding-left: 14px; }
.note { font-family: "JetBrains Mono", monospace; font-size: 22px; color: #8a8fc0; }
.chips { display: flex; flex-wrap: wrap; gap: 18px; }
.chip { font-size: 34px; padding: 12px 26px; border-radius: 12px; border: 2px solid; }
.c1 { color: #5ee6a8; border-color: #2f7a60; } .c2 { color: #8aa6ff; border-color: #3b4c99; }
.c3 { color: #c88bff; border-color: #5f3d8c; } .c4 { color: #ff8fa8; border-color: #8a4057; }
table { border-collapse: collapse; width: 100%; font-size: 28px; }
th { text-align: left; color: #8a8fc0; font-weight: 500; padding: 8px 14px; border-bottom: 2px solid #1c1c4d; }
td { padding: 14px 14px; border-bottom: 2px solid #15153f; vertical-align: top; }
.done { color: #07072b; background: #5ee6a8; padding: 3px 14px; border-radius: 8px; font-weight: 700; font-size: 24px; }
.code { white-space: pre; font-size: 30px; line-height: 1.5; }
.check { display: flex; gap: 20px; align-items: baseline; }
.flow { display: flex; align-items: stretch; gap: 16px; margin-top: 14px; }
.step { flex: 1; background: #0b0b36; border: 2px solid #26265f; border-radius: 22px; padding: 34px 32px; display: flex; flex-direction: column; gap: 14px; }
.step .n { font-family: "JetBrains Mono", monospace; font-size: 26px; color: #8a8fc0; }
.step .t { font-size: 56px; font-weight: 800; }
.wbar { display: block; height: 8px; border-radius: 4px; background: #26265f; overflow: hidden; margin-top: 10px; }
.wbar i { display: block; height: 100%; background: #ffd37a; transform: scaleX(0); transform-origin: left; }
.wcell { display: grid; }
.wpend { display: flex; align-items: center; gap: 16px; }
.wpend .wbar { flex: none; width: 180px; margin: 0; }
.wlog { display: grid; font-family: "JetBrains Mono", monospace; font-size: 24px; color: #a6abe0; min-height: 106px; }
.wpend, .wres { grid-area: 1 / 1; }
.wrun { grid-area: 1 / 1; display: flex; flex-direction: column; gap: 6px; }
.wst { display: inline-grid; } .wst > span { grid-area: 1 / 1; } .wfail { opacity: 0; } .wres { opacity: 0; }
.step .t { display: flex; align-items: center; gap: 16px; }
.step .p { font-family: "JetBrains Mono", monospace; font-size: 26px; padding: 8px 16px; border-radius: 10px; align-self: flex-start; background: rgba(255, 211, 122, 0.12); color: #ffd37a; border: 2px solid #7a6530; }
.arrow { align-self: center; font-size: 44px; color: #5b60a0; display: inline-grid; }
.arrow > span { grid-area: 1 / 1; } .arrow .bk { opacity: 0; font-weight: 800; }
.pr { flex: none; width: 250px; background: rgba(94, 230, 168, 0.1); border-color: #2f7a60; }
.split { display: flex; gap: 34px; align-items: stretch; }
.split .win { min-width: 0; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px 24px; margin-top: 18px; }
.cell { background: #0b0b36; border: 2px solid #26265f; border-radius: 16px; padding: 32px 36px; display: flex; flex-direction: column; gap: 4px; }
.cell.wide { grid-column: span 2; }
.cell b { font-size: 44px; font-weight: 700; display: flex; align-items: center; gap: 18px; }
.ico { width: 48px; height: 48px; flex: none; fill: none; stroke: #5ee6a8; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.cell small { font-family: "JetBrains Mono", monospace; font-size: 30px; color: #8a8fc0; }
.avs { display: grid; grid-template-columns: repeat(2, 1fr); gap: 34px 60px; margin-top: 20px; }
.av { display: flex; align-items: center; gap: 22px; }
.av img { width: 110px; height: 110px; border-radius: 50%; border: 3px solid #3a3a80; display: block; }
.av span { font-family: "JetBrains Mono", monospace; font-size: 32px; font-weight: 700; }
#intro .inner { flex-direction: row; align-items: center; justify-content: center; gap: 90px; }
#intro-logo { width: 420px; height: 420px; border-radius: 50%; border: 2px solid #2a2a66; }
#thumb .inner { flex-direction: row; align-items: center; justify-content: center; gap: 110px; }
#thumb #intro-logo { width: 560px; height: 560px; }
#thumb #ver { font-size: 330px; }
#thumb .intro-text { min-width: 0; gap: 30px; }
.themes { font-family: "JetBrains Mono", monospace; font-size: 38px; font-weight: 700; color: #a6abe0; white-space: nowrap; }
.intro-text { display: flex; flex-direction: column; gap: 22px; min-width: 720px; }
.intro-top { display: flex; align-items: center; gap: 22px; }
.rel { font-family: "JetBrains Mono", monospace; font-size: 28px; letter-spacing: 0.12em; color: #8a8fc0; }
#ver { font-size: 250px; line-height: 1; font-weight: 800; letter-spacing: -0.03em; white-space: nowrap; }
#ver .dot { color: #5ee6a8; }
.tagline { font-family: "JetBrains Mono", monospace; font-size: 40px; color: #a6abe0; }
.tagline b { color: #fff; font-weight: 700; }
.hls { display: flex; flex-direction: column; align-items: flex-start; gap: 16px; margin-top: 10px; }
.hl { font-family: "JetBrains Mono", monospace; font-size: 42px; padding: 12px 28px; border-radius: 12px; border: 2px solid #3b4c99; color: #8aa6ff; }
.lead { font-size: 36px; line-height: 1.3; color: #a6abe0; max-width: 1500px; }
#outro .inner { align-items: center; justify-content: center; gap: 26px; }
.logo { width: 280px; height: 280px; border-radius: 50%; }
#outro h2 { font-size: 150px; text-align: center; }
.cmd { font-family: "JetBrains Mono", monospace; font-size: 34px; padding: 16px 30px; border: 2px solid #26265f; border-radius: 14px; background: #0b0b36; }
.url { font-family: "JetBrains Mono", monospace; font-size: 28px; color: #8a8fc0; }
[data-zone] { transition: none; } [data-focus="0"] { filter: brightness(0.42) saturate(0.6); }
[data-focus="1"] { outline: 3px solid #ffd37a; outline-offset: -3px; box-shadow: 0 0 40px rgba(255, 211, 122, 0.3); }
.gh { flex: 1; min-height: 0; display: flex; flex-direction: column; background: #0d1117; border: 2px solid #30363d; border-radius: 18px; overflow: hidden; color: #e6edf3; font-size: 26px; box-shadow: 0 30px 80px rgba(0, 0, 20, 0.5); }
.gh-url { flex: none; display: flex; align-items: center; gap: 12px; padding: 10px 22px; background: #161b22; border-bottom: 1px solid #30363d; font-family: "JetBrains Mono", monospace; font-size: 20px; color: #7d8590; }
.gh-url i { width: 14px; height: 14px; border-radius: 50%; display: block; } .gh-url span { margin-left: 18px; padding: 4px 18px; background: #0d1117; border-radius: 8px; }
.gh-run { margin-left: auto !important; color: #5ee6a8; background: rgba(94, 230, 168, 0.1) !important; border: 1px solid #2f7a60; }
.gh-head { flex: none; padding: 16px 30px 14px; border-bottom: 1px solid #30363d; } .gh-head h3 { font-size: 38px; font-weight: 700; } .gh-num { color: #7d8590; font-weight: 700; }
.gh-meta { display: flex; align-items: center; gap: 14px; margin-top: 8px; color: #7d8590; font-size: 22px; } .gh-meta b { color: #e6edf3; }
.gh-open { background: #238636; color: #fff; padding: 3px 16px; border-radius: 20px; font-weight: 700; }
.gh code, .ide code { font-family: "JetBrains Mono", monospace; font-size: 20px; color: #8aa6ff; background: rgba(56, 139, 253, 0.15); padding: 2px 8px; border-radius: 6px; }
.gh-cols { flex: 1; min-height: 0; display: grid; grid-template-columns: 1.7fr 1fr; gap: 26px; padding: 16px 28px; }
.gh-threads, .gh-side { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.gh-slot { display: grid; border-radius: 12px; } .gh-slot > div { grid-area: 1 / 1; }
.gh-full { border: 1px solid #30363d; border-radius: 12px; overflow: hidden; }
.gh-file, .gh-bar { display: flex; align-items: center; gap: 14px; padding: 8px 18px; background: #161b22; font-family: "JetBrains Mono", monospace; font-size: 20px; }
.gh-bar { align-self: start; border: 1px solid #8957e5; border-radius: 12px; opacity: 0; } .gh-ln { color: #7d8590; }
.gh-res { margin-left: auto; color: #a371f7; font-family: "Inter", sans-serif; font-weight: 800; font-size: 24px; }
.gh-slot[data-s="resolved"] .gh-full { opacity: 0; } .gh-slot[data-s="resolved"] .gh-bar { opacity: 1; }
.gh-c { display: flex; gap: 16px; padding: 9px 18px; align-items: flex-start; } .gh-c p { color: #c9d1d9; line-height: 1.25; font-size: 23px; } .gh-c b { font-size: 20px; }
.gh-reply { border-top: 1px solid #21262d; background: rgba(56, 139, 253, 0.07); }
.gh-av { flex: none; width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; font-weight: 800; font-size: 20px; color: #fff; }
.gh-summary { display: flex; gap: 14px; border-radius: 12px; } .gh-sbody { flex: 1; border: 1px solid #30363d; border-radius: 12px; overflow: hidden; }
.gh-shead { padding: 9px 18px; background: #161b22; color: #7d8590; font-size: 20px; } .gh-shead b { color: #e6edf3; }
.gh-sbody h4 { font-size: 34px; padding: 12px 18px 4px; } .gh-sbody h5 { font-size: 24px; padding: 8px 18px 2px; } .gh-sbody p, .gh-sbody ol { padding: 4px 18px 16px; color: #c9d1d9; font-size: 27px; }
.gh-sbody ol { padding-left: 46px; } .gh-link { color: #4493f8; }
.gh-merge { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px; padding: 16px 20px; border: 1px solid #30363d; border-radius: 12px; background: #161b22; font-size: 22px; font-weight: 700; }
.gh-ok { width: 34px; height: 34px; border-radius: 50%; background: #238636; display: grid; place-items: center; color: #fff; }
.gh-check { font-family: "JetBrains Mono", monospace; font-weight: 500; font-size: 20px; color: #7d8590; } .gh-check::before { content: "✓ "; color: #3fb950; }
.gh-check[data-s="fail"]::before { content: "✗ "; color: #f85149; } .gh-check[data-s="pending"]::before { content: "● "; color: #d29922; }
.ide { flex: 1; min-height: 0; display: flex; flex-direction: column; background: #0b0b36; border: 2px solid #26265f; border-radius: 18px; overflow: hidden; box-shadow: 0 30px 80px rgba(0, 0, 20, 0.5); }
.ide-bar { flex: none; display: flex; align-items: center; gap: 12px; padding: 10px 22px; border-bottom: 2px solid #1c1c4d; font-family: "JetBrains Mono", monospace; font-size: 20px; color: #8a8fc0; }
.ide-bar i { width: 14px; height: 14px; border-radius: 50%; display: block; }
.ide-main { flex: 1; min-height: 0; display: flex; }
.ide-tree { flex: none; width: 300px; list-style: none; padding: 12px 0; border-right: 2px solid #1c1c4d; font-family: "JetBrains Mono", monospace; font-size: 22px; color: #a6abe0; background: #09092e; }
.ide-tree li { padding: 5px 14px; white-space: nowrap; } .ide-head { color: #5b60a0; font-size: 17px; letter-spacing: 0.1em; } .ide-dir { color: #8a8fc0; }
.ide-file { border-left: 5px solid transparent; } .ide-file[data-s="red"] { color: #ff9aa8; background: rgba(255, 107, 107, 0.16); border-left-color: #ff6b6b; }
.ide-file[data-s="red"]::after { content: "  ✗"; } .ide-file[data-s="green"] { color: #5ee6a8; background: rgba(94, 230, 168, 0.14); border-left-color: #5ee6a8; } .ide-file[data-s="green"]::after { content: "  ✓"; }
.ide-editor { flex: 1; min-width: 0; display: grid; } .ide-editor > .ide-code { grid-area: 1 / 1; }
.ide-code { visibility: hidden; display: flex; flex-direction: column; min-width: 0; } .ide-code[data-s="open"] { visibility: visible; }
.ide-tab { align-self: flex-start; padding: 9px 24px; font-family: "JetBrains Mono", monospace; font-size: 21px; color: #eef0ff; background: #0b0b36; border-right: 2px solid #1c1c4d; border-top: 3px solid #8aa6ff; }
.ide-lines { flex: 1; padding: 12px 0; border-top: 2px solid #1c1c4d; font-family: "JetBrains Mono", monospace; font-size: 22px; line-height: 1.4; color: #c8cbf0; counter-reset: ln; overflow: hidden; }
.ide-line { display: block; white-space: pre; padding: 0 18px; } .ide-line::before { counter-increment: ln; content: counter(ln); display: inline-block; width: 36px; margin-right: 16px; text-align: right; color: #45497e; }
.ide-line.add { color: #5ee6a8; background: rgba(94, 230, 168, 0.13); }
.ide-chat { flex: none; width: 740px; display: flex; flex-direction: column; border-left: 2px solid #1c1c4d; background: #09092e; }
.ide-chead { padding: 10px 22px; border-bottom: 2px solid #1c1c4d; font-weight: 700; font-size: 21px; color: #ffb38a; }
.ide-feed { flex: 1; min-height: 0; overflow: hidden; display: flex; flex-direction: column; gap: 12px; padding: 14px 18px; font-family: "JetBrains Mono", monospace; font-size: 21px; line-height: 1.34; }
.ide-msg { color: #eef0ff; padding: 2px 6px; border-radius: 6px; } .ide-msg.user { padding: 8px 14px; border: 2px solid #26265f; border-radius: 10px; color: #c8cbf0; } .ide-msg.user::before { content: "> "; color: #5ee6a8; }
.ide-msg.agent::before { content: "● "; color: #eef0ff; } .ide-msg.tool::before { content: "● "; color: #5ee6a8; } .ide-msg.tool { color: #a6abe0; }
.ide-notice { display: flex; flex-direction: column; gap: 3px; padding: 8px 14px; border-left: 4px solid #5b60a0; background: rgba(138, 166, 255, 0.06); color: #a6abe0; border-radius: 4px; }
.ide-notice b { font-size: 17px; color: #8a8fc0; } .ide-notice em { font-style: normal; color: #eef0ff; }
.ide-notice.red { border-left-color: #ff6b6b; background: rgba(255, 107, 107, 0.12); } .ide-notice.red b, .ide-notice.red span { color: #ff9aa8; }
.ide-notice.amb { border-left-color: #ffd37a; background: rgba(255, 211, 122, 0.1); } .ide-notice.amb b { color: #ffd37a; }
.ide-notice.grn { border-left-color: #5ee6a8; } .ide-notice.grn b { color: #5ee6a8; }
.tg { flex: 1; display: grid; gap: 26px; align-content: center; }
.tg-win { background: #0b0b36; border: 2px solid #26265f; border-radius: 16px; overflow: hidden; }
.tg-bar { display: flex; gap: 10px; padding: 12px 18px; border-bottom: 2px solid #1c1c4d; } .tg-bar i { width: 14px; height: 14px; border-radius: 50%; display: block; }
.tg-body { padding: 22px 26px; display: flex; flex-direction: column; gap: 10px; } .tg-body b { font-size: 36px; font-weight: 800; color: #8a8fc0; }
.tg-body small { font-family: "JetBrains Mono", monospace; font-size: 22px; color: #5b60a0; }
.tg-fill { display: block; height: 8px; border-radius: 4px; background: #26265f; overflow: hidden; } .tg-fill i { display: block; height: 100%; background: #ffd37a; transform-origin: left; transform: scaleX(var(--fill, 0)); }
.tg-count { align-self: flex-start; font-family: "JetBrains Mono", monospace; font-weight: 700; font-size: 22px; padding: 4px 14px; border-radius: 8px; color: #5b60a0; border: 2px solid #26265f; }
.tg-win[data-s="on"] { border-color: #2f7a60; box-shadow: 0 0 40px rgba(94, 230, 168, 0.25); } .tg-win[data-s="on"] b { color: #eef0ff; } .tg-win[data-s="on"] small { color: #8a8fc0; }
.tg-win[data-s="on"] .tg-fill i { background: #5ee6a8; } .tg-win[data-s="on"] .tg-count { color: #07072b; background: #5ee6a8; border-color: #5ee6a8; }
.ab { flex: 1; position: relative; }
.ab-links { position: absolute; inset: 0; width: 100%; height: 100%; } .ab-links line { stroke: #3b4c99; stroke-width: 0.3; stroke-dasharray: 1; stroke-dashoffset: calc(1 - var(--fill, 0)); }
.ab-core { position: absolute; left: 50%; top: 50%; width: 300px; height: 300px; margin: -150px 0 0 -150px; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
  background: radial-gradient(circle at 50% 40%, #1d1d5e, #0b0b36); border: 3px solid #8aa6ff; box-shadow: 0 0 80px rgba(138, 166, 255, 0.35); }
.ab-core b { font-size: 64px; font-weight: 800; } .ab-count { font-family: "JetBrains Mono", monospace; font-size: 28px; color: #5ee6a8; } .ab-count span { font-size: 44px; font-weight: 700; }
.ab-block { position: absolute; translate: -50% -50%; }
.ab-block { min-width: 260px; padding: 18px 26px; background: #0b0b36; border: 2px solid #3b4c99; border-radius: 16px; display: flex; flex-direction: column; gap: 4px; text-align: center; }
.ab-block b { font-size: 34px; font-weight: 800; } .ab-block small { font-family: "JetBrains Mono", monospace; font-size: 20px; color: #8a8fc0; }
.inner:has(> .band) { padding: 50px 100px 40px; gap: 26px; }
.stage { position: relative; flex: 1; min-height: 0; }
.lr { display: grid; align-content: center; gap: 18px; }
.lr-tool { position: relative; display: flex; flex-direction: column; align-items: center; gap: 18px; }
.lr-card { width: 156px; height: 156px; border-radius: 34px; background: linear-gradient(160deg, #1a1a55, #0d0d3c); border: 2px solid #2d2d6e; display: grid; place-items: center; box-shadow: 0 20px 44px rgba(0, 0, 20, 0.5); }
.lr-logo { width: 96px; height: 96px; } .lr-logo.mono, .ms-logo.mono { filter: brightness(0) invert(1); }
.lr-tool b { font-size: 26px; font-weight: 700; text-align: center; }
.lr-new { position: absolute; top: -20px; right: 2px; background: #5ee6a8; color: #07072b; font-size: 22px; font-weight: 800; padding: 4px 14px; border-radius: 12px; }
.lr-tool.new .lr-card { border-color: #5ee6a8; box-shadow: 0 0 54px rgba(94, 230, 168, 0.5); }
.lr-burst { position: absolute; left: 50%; top: 78px; width: 340px; height: 340px; margin: -170px 0 0 -170px; border-radius: 50%; background: radial-gradient(circle, rgba(94, 230, 168, 0.6), transparent 65%); opacity: 0; }
.ms { display: flex; flex-direction: column; gap: 26px; }
.ms-term { flex: none; background: #0b0b36; border: 2px solid #26265f; border-radius: 18px; overflow: hidden; }
.ms-body { padding: 16px 28px 20px; font-family: "JetBrains Mono", monospace; font-weight: 500; font-size: 22px; line-height: 1.45; }
.ms-cmd { font-size: 28px; color: #eef0ff; margin-top: 4px; min-height: 1.45em; } .ms-line { color: #a6abe0; white-space: pre; }
.ms-cards { flex: 1; display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 22px; }
.ms-card { background: linear-gradient(160deg, #16165a, #0b0b36); border: 2px solid #3b4c99; border-radius: 20px; padding: 20px 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; text-align: center; }
.ms-role { font-family: "JetBrains Mono", monospace; font-weight: 700; font-size: 26px; color: #ffd37a; }
.ms-face { display: none; flex-direction: column; align-items: center; gap: 12px; } .ms-logo { width: 70px; height: 70px; }
.ms-face b { font-family: "JetBrains Mono", monospace; font-weight: 700; font-size: 22px; color: #eef0ff; overflow-wrap: anywhere; }
.ms-card[data-s="0"] > [data-face="0"], .ms-card[data-s="1"] > [data-face="1"], .ms-card[data-s="2"] > [data-face="2"], .ms-card[data-s="3"] > [data-face="3"] { display: flex; }
.cw { display: grid; align-content: center; justify-items: center; gap: 44px 30px; }
.cw-av { display: flex; flex-direction: column; align-items: center; gap: 14px; } .cw-av img { width: 160px; height: 160px; border-radius: 50%; border: 4px solid #3a3a80; display: block; box-shadow: 0 0 40px rgba(138, 166, 255, 0.3); }
.cw-av span { font-family: "JetBrains Mono", monospace; font-weight: 700; font-size: 24px; }
.gh-kind { margin-left: 12px; font-family: "JetBrains Mono", monospace; font-size: 18px; font-weight: 700; padding: 2px 10px; border-radius: 10px; border: 1px solid; vertical-align: 2px; }
.gh-kind[data-kind="done"] { color: #3fb950; } .gh-kind[data-kind="answer"] { color: #4493f8; } .gh-kind[data-kind="user-call"] { color: #d29922; } .gh-kind[data-kind="todo"] { color: #a371f7; }
.gh-sbody ul { padding: 4px 18px 16px 46px; color: #c9d1d9; font-size: 25px; }
.band { display: flex; flex-direction: column; gap: 6px; flex: none; }
.band-top { display: flex; align-items: center; gap: 30px; min-height: 92px; } .band-top h2 { font-size: 74px; white-space: nowrap; }
.sub-slot { display: grid; min-height: 48px; } .sub-slot > * { grid-area: 1 / 1; }
.cap, .sub { font-size: 38px; font-weight: 700; color: #a6abe0; } .cap { opacity: 0; }
.band .note { position: absolute; right: 100px; bottom: 12px; }
.ps { display: grid; } .ps-panel { grid-area: 1 / 1; height: 100%; display: flex; align-items: center; justify-content: center; }
.ps-panel.layers { flex-direction: column; gap: 0; }
.ps-panel.layers .ps-item { width: 1000px; height: 108px; border-radius: 18px; display: flex; align-items: center; justify-content: space-between; padding: 0 40px;
  background: linear-gradient(90deg, #191960, #0f0f44); border: 2px solid #3b4c99; box-shadow: 0 18px 40px rgba(0, 0, 20, 0.45); }
.ps-panel.layers .ps-item b { font-family: "JetBrains Mono", monospace; font-size: 38px; } .ps-panel.layers .ps-item span { font-size: 30px; color: #a6abe0; }
.ps-down { display: block; width: 4px; height: 34px; background: #5ee6a8; position: relative; } .ps-down::after { content: ""; position: absolute; left: -9px; bottom: -6px; border: 11px solid transparent; border-top: 13px solid #5ee6a8; border-bottom: 0; }
.ps-panel.grid { display: grid; grid-template-columns: repeat(5, 300px); gap: 26px; align-content: center; justify-content: center; }
.ps-panel.grid .ps-item { height: 150px; border-radius: 20px; display: grid; place-items: center; font-family: "JetBrains Mono", monospace; font-size: 28px;
  background: linear-gradient(160deg, #1a1a5c, #0d0d3c); border: 2px solid #3b4c99; box-shadow: 0 0 40px rgba(138, 166, 255, 0.25); }
.ps-panel.levels { flex-direction: column; gap: 18px; }
.ps-panel.levels .ps-item { width: 1200px; display: grid; grid-template-columns: 300px 1fr; align-items: center; gap: 30px; padding: 22px 36px; border-radius: 18px; background: #0d0d3c; border: 2px solid #2d2d6e; }
.ps-panel.levels .ps-item b { font-family: "JetBrains Mono", monospace; font-size: 36px; color: #5ee6a8; } .ps-panel.levels .ps-item span { font-size: 32px; color: #eef0ff; }
.gt-actor, .gt-target { position: absolute; top: 250px; width: 300px; height: 240px; border-radius: 24px; border: 2px solid #3b4c99; background: linear-gradient(160deg, #17175a, #0b0b36);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 24px 60px rgba(0, 0, 20, 0.5); }
.gt-actor { left: 20px; width: 260px; } .gt-target { left: 1420px; width: 280px; }
.gt-dot { width: 64px; height: 64px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #d9b3ff, #8a5cff 60%, #4b2aa8); box-shadow: 0 0 40px rgba(138, 92, 255, 0.6); }
.gt-actor b, .gt-target b { font-size: 42px; font-weight: 800; }
.gt-work, .gt-ok { font-style: normal; font-family: "JetBrains Mono", monospace; font-weight: 700; font-size: 24px; display: none; }
.gt-actor[data-s="working"] { border-color: #c88bff; } .gt-actor[data-s="working"] .gt-work { display: block; color: #c88bff; }
.gt-actor[data-s="fixed"] { border-color: #5ee6a8; } .gt-actor[data-s="fixed"] .gt-ok { display: block; color: #5ee6a8; }
.gt-note { position: absolute; top: -30px; right: -30px; background: #ffd37a; color: #07072b; font-size: 24px; font-weight: 800; padding: 8px 18px; border-radius: 10px; box-shadow: 0 10px 24px rgba(0, 0, 0, 0.4); opacity: 0; }
.gt-target[data-s="got"], .gt-target[data-s="done"] { border-color: #5ee6a8; box-shadow: 0 0 60px rgba(94, 230, 168, 0.35); }
.gt-gate { position: absolute; left: 640px; top: 150px; width: 440px; height: 440px; border-radius: 28px; background: linear-gradient(180deg, #14144d, #0a0a30); border: 2px solid #3b4c99;
  box-shadow: 0 30px 80px rgba(0, 0, 20, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.06); display: flex; flex-direction: column; align-items: center; padding: 30px; gap: 24px; }
.gt-head { display: flex; align-items: center; gap: 16px; } .gt-head b { font-size: 34px; font-weight: 800; letter-spacing: 0.04em; }
.gt-light { width: 26px; height: 26px; border-radius: 50%; background: #5b60a0; box-shadow: 0 0 0 6px rgba(91, 96, 160, 0.2); }
.gt-scan { width: 100%; height: 6px; border-radius: 3px; background: linear-gradient(90deg, transparent, #3b4c99, transparent); }
.gt-verdicts { display: grid; width: 100%; flex: 1; } .gt-verdict { grid-area: 1 / 1; display: none; flex-direction: column; align-items: center; justify-content: center; gap: 12px; text-align: center; }
.gt-verdict b { font-size: 52px; font-weight: 800; } .gt-verdict span { font-family: "JetBrains Mono", monospace; font-size: 24px; color: #a6abe0; }
.gt-gate[data-s="idle"] .gt-verdict.idle { display: flex; } .gt-verdict.idle b { color: #8a8fc0; }
.gt-gate[data-s="block"] [data-kind="block"], .gt-gate[data-s="inform"] [data-kind="inform"], .gt-gate[data-s="require"] [data-kind="require"], .gt-gate[data-s="pass"] [data-kind="pass"] { display: flex; }
.gt-gate[data-s="block"] { border-color: #ff6b6b; } .gt-gate[data-s="block"] .gt-light { background: #ff6b6b; box-shadow: 0 0 30px #ff6b6b; } [data-kind="block"] b { color: #ff8fa8; }
.gt-gate[data-s="inform"] { border-color: #ffd37a; } .gt-gate[data-s="inform"] .gt-light { background: #ffd37a; box-shadow: 0 0 30px #ffd37a; } [data-kind="inform"] b { color: #ffd37a; }
.gt-gate[data-s="require"] { border-color: #c88bff; } .gt-gate[data-s="require"] .gt-light { background: #c88bff; box-shadow: 0 0 30px #c88bff; } [data-kind="require"] b { color: #c88bff; }
.gt-gate[data-s="pass"] { border-color: #5ee6a8; } .gt-gate[data-s="pass"] .gt-light { background: #5ee6a8; box-shadow: 0 0 30px #5ee6a8; } [data-kind="pass"] b { color: #5ee6a8; }
.gt-action { position: absolute; z-index: 2; left: 300px; top: 335px; height: 70px; padding: 0 28px; border-radius: 35px; background: #8aa6ff; color: #07072b; font-family: "JetBrains Mono", monospace; font-weight: 700; font-size: 28px;
  display: flex; align-items: center; white-space: nowrap; box-shadow: 0 12px 30px rgba(0, 0, 20, 0.5); opacity: 0; }
.gt-fixed { display: none; } .gt-action[data-s="fixed"] { background: #5ee6a8; } .gt-action[data-s="fixed"] .gt-was { display: none; } .gt-action[data-s="fixed"] .gt-fixed { display: inline; }
.dl-doc { position: absolute; left: 300px; top: 10px; width: 1000px; height: 700px; background: #0b0b36; border: 2px solid #26265f; border-radius: 20px; overflow: hidden; box-shadow: 0 30px 80px rgba(0, 0, 20, 0.5); }
.dl-head { display: flex; align-items: center; gap: 24px; padding: 18px 30px; border-bottom: 2px solid #1c1c4d; font-family: "JetBrains Mono", monospace; font-weight: 700; font-size: 28px; }
.dl-status, .sq-status { display: inline-grid; padding: 6px 18px; border-radius: 10px; font-family: "JetBrains Mono", monospace; font-weight: 700; background: rgba(255, 211, 122, 0.12); color: #ffd37a; border: 2px solid #7a6530; }
.dl-face { grid-area: 1 / 1; visibility: hidden; } [data-s="0"] > .dl-face[data-face="0"], [data-s="1"] > .dl-face[data-face="1"] { visibility: visible; }
.dl-status[data-s="1"], .sq-status[data-s="1"] { color: #5ee6a8; border-color: #2f7a60; background: rgba(94, 230, 168, 0.12); }
.dl-new { display: flex; flex-direction: column; gap: 30px; padding: 34px 40px; } .dl-sec h4 { font-size: 30px; color: #8aa6ff; } .dl-sec p { font-size: 32px; color: #eef0ff; margin-top: 6px; }
.dl-seal { position: absolute; right: 40px; bottom: 40px; width: 190px; height: 190px; border-radius: 50%; border: 6px double #5ee6a8; color: #5ee6a8; display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: rgba(94, 230, 168, 0.08); opacity: 0; } .dl-seal b { font-size: 32px; font-weight: 800; } .dl-seal span { font-family: "JetBrains Mono", monospace; font-size: 22px; }
.dl-attempt { position: absolute; left: 1420px; top: 300px; padding: 16px 28px; border-radius: 34px; background: #ff8fa8; color: #07072b; font-family: "JetBrains Mono", monospace; font-weight: 700; font-size: 28px; white-space: nowrap; }
.dl-refusal { position: absolute; left: 300px; top: 728px; width: 1300px; font-family: "JetBrains Mono", monospace; font-size: 24px; color: #ff9aa8; }
.gh { position: relative; }
.gh-hero { position: absolute; z-index: 5; left: 50%; top: 54%; translate: -50% -50%; width: 1180px; display: flex; gap: 20px; padding: 28px; border-radius: 22px; background: #161b22; border: 2px solid #3d444d;
  box-shadow: 0 40px 120px rgba(0, 0, 0, 0.7); }
.gh-hero .gh-av { width: 56px; height: 56px; font-size: 26px; } .gh-hero .gh-sbody { border: none; } .gh-hero .gh-shead { background: none; padding: 4px 0 10px; font-size: 24px; }
.gh-hero .gh-sbody h4 { font-size: 46px; padding: 4px 0 12px; } .gh-hero .gh-sbody p { font-size: 32px; padding: 0 0 14px; } .gh-hero .gh-sbody h5 { font-size: 34px; padding: 10px 0 6px; }
.gh-hero .gh-sbody ol, .gh-hero .gh-sbody ul { font-size: 31px; padding: 0 0 10px 44px; line-height: 1.35; }
.band-top .pill { align-self: center; flex: none; white-space: nowrap; }
.badge { align-self: center; font-size: 26px; font-weight: 800; padding: 8px 18px; border-radius: 12px; color: #5ee6a8; border: 2px solid #2f7a60; background: rgba(94, 230, 168, 0.1); white-space: nowrap; }
.ps.row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 34px; align-items: stretch; }
.ps.row .ps-panel { grid-area: auto; height: auto; flex-direction: column; justify-content: flex-start; gap: 14px; padding: 30px; border-radius: 22px; background: rgba(11, 11, 54, 0.6); border: 2px solid #26265f; }
.ps.row .ps-panel > h4 { align-self: stretch; font-size: 36px; font-weight: 800; margin-bottom: 12px; color: #eef0ff; }
.ps.row .ps-panel.layers .ps-item { width: 100%; height: 86px; padding: 0 24px; } .ps.row .ps-panel.layers .ps-item b { font-size: 28px; } .ps.row .ps-panel.layers .ps-item span { font-size: 20px; }
.ps.row .ps-panel.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; align-content: start; } .ps.row .ps-panel.grid > h4 { grid-column: span 2; }
.ps.row .ps-panel.grid .ps-item { height: 70px; font-size: 22px; }
.ps.row .ps-panel.levels .ps-item { width: 100%; grid-template-columns: 210px 1fr; padding: 16px 20px; gap: 14px; } .ps.row .ps-panel.levels .ps-item b { font-size: 26px; } .ps.row .ps-panel.levels .ps-item span { font-size: 21px; }
.sq { display: flex; flex-direction: column; gap: 18px; } .sq-head { display: flex; align-items: center; gap: 20px; opacity: 0; }
.sq-file { font-family: "JetBrains Mono", monospace; font-weight: 700; font-size: 24px; color: #8a8fc0; }
.sq-status { display: inline-grid; padding: 6px 18px; border-radius: 10px; font-family: "JetBrains Mono", monospace; font-weight: 700; font-size: 24px; background: rgba(255, 211, 122, 0.12); color: #ffd37a; border: 2px solid #7a6530; }
.sq-status[data-s="1"] { color: #5ee6a8; border-color: #2f7a60; background: rgba(94, 230, 168, 0.12); }
.sq-rows { display: flex; flex-direction: column; gap: 14px; padding: 26px 36px; border-radius: 20px; background: #0b0b36; border: 2px solid #3b4c99; }
.sq-row { display: grid; grid-template-columns: 860px 1fr; gap: 40px; align-items: center; min-height: 96px; border-bottom: 1px solid #1c1c4d; } .sq-row:last-child { border-bottom: none; }
.sq-row > p { font-size: 36px; line-height: 1.4; color: #eef0ff; }
.sq-gap { position: relative; padding: 0 4px; } .sq-gap > span { position: relative; } .sq-fixed { display: none; }
.sq-mark { position: absolute; left: 0; right: 0; top: 10%; bottom: 6%; border-radius: 6px; background: rgba(255, 211, 122, 0.4); transform-origin: left; transform: scaleX(var(--fill, 0)); }
.sq-gap[data-s="filled"] .sq-mark { background: rgba(94, 230, 168, 0.3); } .sq-gap[data-s="filled"] .sq-was { display: none; } .sq-gap[data-s="filled"] .sq-fixed { display: inline; color: #5ee6a8; }
.sq-qs { display: flex; flex-direction: column; gap: 10px; }
.sq-q { position: relative; padding: 12px 22px; border-radius: 14px; background: #14144a; border: 2px solid #7a6530; }
.sq-q::before { content: ""; position: absolute; left: -40px; top: 50%; width: 40px; height: 2px; background: #ffd37a; }
.sq-cat { font-size: 18px; font-weight: 700; color: #ffd37a; text-transform: uppercase; letter-spacing: 0.06em; } .sq-q p { font-size: 28px; font-weight: 700; margin-top: 2px; }
.sq-q[data-s="closed"] { border-color: #2f7a60; } .sq-q[data-s="closed"]::before { background: #5ee6a8; } .sq-q[data-s="closed"] p { color: #a6abe0; } .sq-q[data-s="closed"] p::after { content: "  ✓"; color: #5ee6a8; }
.gh-hero { width: 1560px !important; top: 50% !important; padding: 26px 40px !important; } .gh-hero .gh-sbody h4 { font-size: 42px !important; padding: 0 0 8px !important; } .gh-hero .gh-sbody p { font-size: 30px !important; padding: 0 0 8px !important; }
.gh-hero .gh-sbody h5 { font-size: 30px !important; padding: 6px 0 2px !important; } .gh-hero .gh-sbody ol, .gh-hero .gh-sbody ul { font-size: 28px !important; padding-bottom: 4px !important; } .gh-hero-k { font-size: 28px !important; }
.ms-slot { width: 70px; height: 70px; border-radius: 16px; border: 3px dashed #3b4c99; display: block; }
.ms-card[data-s="0"] .ms-face b { color: #5b60a0; }
.cr { display: flex; flex-direction: column; gap: 14px; } .cr-file { font-family: "JetBrains Mono", monospace; font-weight: 700; font-size: 26px; color: #8a8fc0; }
.cr-rows { position: relative; flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 8px; }
.cr-rows::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 820px; border-radius: 20px; background: #0b0b36; border: 2px solid #3b4c99; }
.cr-beam { position: absolute; left: 0; width: 820px; top: 0; height: 100%; pointer-events: none; z-index: 2; }
.cr-beam::before { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 4px; background: #8aa6ff; box-shadow: 0 0 26px 8px rgba(138, 166, 255, 0.5); }
.cr-row { position: relative; display: grid; grid-template-columns: 820px 1fr; gap: 70px; align-items: center; min-height: 88px; }
.cr-row > p { padding: 10px 36px; font-size: 32px; color: #c8cbf0; border-left: 6px solid transparent; }
.cr-row[data-s="lit"] > p { color: #ffffff; background: rgba(138, 166, 255, 0.14); border-left-color: #8aa6ff; }
.cr-finding { position: relative; padding: 14px 24px; border-radius: 16px; background: #12123f; border-left: 8px solid; display: grid; grid-template-columns: auto 1fr; gap: 2px 18px; align-items: baseline; }
.cr-finding::before { content: ""; position: absolute; left: -70px; top: 50%; width: 62px; height: 3px; background: currentColor; }
.cr-finding b { font-size: 22px; text-transform: uppercase; letter-spacing: 0.05em; } .cr-finding span { font-size: 30px; font-weight: 700; color: #eef0ff; }
.cr-finding small { grid-column: 2; font-family: "JetBrains Mono", monospace; font-size: 21px; color: #a6abe0; } .cr-finding small::before { content: "evidence: "; }
.cr-finding.red { border-color: #ff6b6b; color: #ff8fa8; } .cr-finding.amb { border-color: #ffd37a; color: #ffd37a; } .cr-finding.blu { border-color: #8aa6ff; color: #8aa6ff; } .cr-finding.grn { border-color: #5ee6a8; color: #5ee6a8; }
.ch { display: grid; gap: 22px; align-items: center; position: relative; }
.ch::before { content: ""; position: absolute; left: 4%; right: 4%; top: 50%; height: 3px; background: #26265f; }
.ch-card { position: relative; height: 560px; display: flex; flex-direction: column; gap: 14px; padding: 24px 22px; border-radius: 24px; background: linear-gradient(170deg, #17175a, #0b0b36); border: 2px solid #2d2d6e; box-shadow: 0 24px 60px rgba(0, 0, 20, 0.5); }
.ch-card code { font-family: "JetBrains Mono", monospace; font-size: 18px; color: #5b60a0; } .ch-card > b { font-size: 34px; font-weight: 800; color: #8a8fc0; }
.ch-card[data-s="on"] { border-color: #ffd37a; box-shadow: 0 0 60px rgba(255, 211, 122, 0.35); } .ch-card[data-s="on"] code { color: #ffd37a; } .ch-card[data-s="on"] > b { color: #eef0ff; }
.ch-card[data-s="done"] { border-color: #2f7a60; } .ch-card[data-s="done"] > b { color: #eef0ff; } .ch-card[data-s="done"] code { color: #5ee6a8; }
.ch-vis { height: 190px; border-radius: 16px; background: rgba(255, 255, 255, 0.04); border: 1px solid #26265f; padding: 16px; display: flex; flex-wrap: wrap; gap: 10px; align-content: center; justify-content: center; }
.ch-keys { list-style: none; display: flex; flex-wrap: wrap; gap: 8px; margin-top: auto; } .ch-keys li { font-size: 21px; font-weight: 700; padding: 6px 12px; border-radius: 10px; background: rgba(138, 166, 255, 0.12); color: #c8cbf0; }
.ch-card[data-s="on"] .ch-keys li { background: rgba(255, 211, 122, 0.16); color: #ffd37a; }
.wireframe { flex-direction: column; align-items: stretch; flex-wrap: nowrap; } .wireframe i { display: block; height: 16px; border-radius: 4px; background: #a9adc4; opacity: 0.55; } .wireframe i.short { width: 55%; } .wireframe i.box { height: 60px; opacity: 0.3; }
.dir { display: flex; flex-direction: column; gap: 6px; padding: 10px; border-radius: 12px; border: 2px solid #26265f; opacity: 0.45; } .dir.kept { border-color: #5ee6a8; opacity: 1; }
.dir i { width: 26px; height: 26px; border-radius: 50%; } .dir i:nth-child(1) { background: #336699; } .dir i:nth-child(2) { background: #e8eef5; } .dir i:nth-child(3) { background: #d9480f; }
.sw { display: flex; gap: 8px; } .sw i { width: 34px; height: 34px; border-radius: 8px; } .sw i:nth-child(1) { background: #1e4f7c; } .sw i:nth-child(2) { background: #3d7ab8; } .sw i:nth-child(3) { background: #e8eef5; } .sw i:nth-child(4) { background: #1f6b43; }
.ramp { display: flex; align-items: baseline; gap: 10px; color: #eef0ff; } .ramp b:nth-child(1) { font-size: 40px; } .ramp b:nth-child(2) { font-size: 28px; } .ramp b:nth-child(3) { font-size: 18px; }
.components .btn { width: 140px; height: 34px; border-radius: 10px; background: #3d7ab8; } .components .btn.ghost { background: transparent; border: 3px solid #3d7ab8; } .components .crd { width: 170px; height: 46px; border-radius: 12px; background: #e8eef5; }
.scr { width: 130px; height: 100px; border-radius: 10px; background: #e8eef5; padding: 8px; display: flex; flex-direction: column; gap: 6px; } .scr.phone { width: 54px; } .screens { flex-wrap: nowrap; } .verdict { flex-direction: column; flex-wrap: nowrap; gap: 8px; } .components { flex-direction: column; flex-wrap: nowrap; }
.scr i { display: block; height: 14px; border-radius: 4px; background: #c4cfdc; } .scr i.bar { background: #1e4f7c; }
.vd { font-size: 24px; font-weight: 800; padding: 6px 14px; border-radius: 10px; border: 3px solid; } .vd.ok { color: #5ee6a8; } .vd.rev { color: #ffd37a; }
.ch-vis .pub { color: #07072b; } .pub { font-size: 20px; font-weight: 800; padding: 6px 16px; line-height: 1.2; white-space: nowrap; border-radius: 10px; background: #5ee6a8; color: #07072b; }
.ch-card { opacity: 0; }
.ms-kind { font-size: 16px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: #8a8fc0; padding: 2px 10px; border-radius: 8px; border: 1px solid #3b4c99; }
.gt-target { justify-content: flex-start !important; padding-top: 26px; gap: 14px !important; height: 300px !important; top: 220px !important; }
.gt-files { list-style: none; width: 84%; display: flex; flex-direction: column; gap: 8px; }
.gt-files li { font-family: "JetBrains Mono", monospace; font-size: 22px; padding: 8px 14px; border-radius: 10px; background: #12123f; border: 2px solid #26265f; color: #a6abe0; }
.gt-files li[data-s="written"] { border-color: #5ee6a8; color: #5ee6a8; background: rgba(94, 230, 168, 0.12); } .gt-files li[data-s="written"]::after { content: "  ✓"; }
.gt-files li[data-s="refused"] { border-color: #ff6b6b; color: #ff9aa8; } .gt-files li[data-s="refused"]::after { content: "  ✗ locked"; }
.gh-threads { display: grid !important; grid-template-columns: 1fr 1fr; gap: 12px 14px !important; align-content: start; }
.gh-cols { grid-template-columns: 1fr !important; } .gh-side { display: none !important; }
.gh-slot .gh-c { padding: 7px 16px; } .gh-slot .gh-c p { font-size: 22px; } .gh-slot .gh-file, .gh-slot .gh-bar { font-size: 18px; padding: 6px 14px; }
.gh-hero { flex-wrap: wrap; } .gh-hero-k { flex-basis: 100%; font-size: 30px; font-weight: 800; color: #ffd37a; letter-spacing: 0.02em; }
.gh-slot[data-s="resolved"] .gh-full { opacity: 0.4 !important; } .gh-slot[data-s="resolved"] .gh-file { visibility: hidden; } .gh-slot[data-s="resolved"] .gh-bar { opacity: 1; align-self: start; background: #1c1630; }
.ms-card.main { border-color: #5ee6a8; background: linear-gradient(160deg, #123a3a, #0b0b36); } .ms-card.main .ms-kind { color: #5ee6a8; border-color: #2f7a60; }
.ms-cards { min-height: 210px; } .ms-body { font-size: 19px !important; line-height: 1.35 !important; }
`;

const esc = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const half = (seconds) => Math.ceil(seconds * 2) / 2;

const cellBody = (value) => {
  if (value?.status) return { cls: "", html: `<span class="done">${esc(value.status)}</span>` };
  if (value?.dim) return { cls: "dim", html: esc(value.dim) };
  if (value?.tone) return { cls: value.tone, html: esc(value.text) };
  return { cls: "", html: esc(value) };
};

/** A bar that fills while its step or row works. */
const BAR = `<span class="wbar"><i></i></span>`;

const isWork = (value) => value?.checking !== undefined || value?.result !== undefined;

/** A checked cell shows "checking…", or its own `pending` text, until its row is done; a result cell
 * shows nothing until then. */
const cell = (value) => {
  if (isWork(value)) {
    const checking = value.checking !== undefined;
    const { cls, html } = cellBody(checking ? value.checking : value.result);
    return (
      `<td><div class="wcell"><span class="wpend${checking ? " dim" : ""}">${checking ? `${esc(value.pending ?? "checking…")}${BAR}` : ""}</span>` +
      `<span class="wres${cls ? ` ${esc(cls)}` : ""}">${html}</span></div></td>`
    );
  }
  const { cls, html } = cellBody(value);
  return `<td${cls ? ` class="${esc(cls)}"` : ""}>${html}</td>`;
};

const row = {
  prompt: (r) => `<div class="row"><span class="grn">&gt;</span> ${esc(r.prompt)}</div>`,
  text: (r) => `<div class="row ${esc(r.tone ?? "")}">${esc(r.text)}</div>`,
  chips: (r) =>
    `<div class="row chips">${r.chips.map((c, i) => `<span class="chip c${(i % 4) + 1}">${esc(c)}</span>`).join("")}</div>`,
  table: (r) =>
    `<table class="row">${r.table.head ? `<thead><tr>${r.table.head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>` : ""}<tbody>` +
    r.table.rows.map((cells) => `<tr${cells.some(isWork) ? " data-w" : ""}>${cells.map(cell).join("")}</tr>`).join("") +
    `</tbody></table>`,
  del: (r) => `<div class="row del">- ${esc(r.del)}</div>`,
  add: (r) => `<div class="row add">+ ${esc(r.add)}</div>`,
  code: (r) => `<div class="row code">${esc(r.code)}</div>`,
  verdict: (r) => `<div class="row verdict ${esc(r.tone ?? "grn")}"><b>${esc(r.verdict)}</b><span>${esc(r.detail ?? "")}</span></div>`,
  check: (r) =>
    `<div class="row check"><span class="${r.mark === "!" ? "amb" : "grn"}">${esc(r.mark ?? "✓")}</span><span>${esc(r.check)}</span></div>`,
};

function rowHtml(r) {
  const kind = Object.keys(row).find((k) => k in r);
  if (!kind) throw new Error(`Unknown row: ${JSON.stringify(r)}`);
  const html = row[kind](r);
  return r.afterWork ? html.replace(/class="row([^"]*)"/, 'class="row$1 later"') : html;
}

const DOTS =
  '<i style="background:#ff6b6b"></i><i style="background:#ffd37a"></i><i style="background:#5ee6a8"></i>';

const windowHtml = ({ label, rows = [], flex, afterWork }) =>
  `<div class="win ${afterWork ? "then" : "it"}"${flex ? ` style="flex:${flex}"` : ""}><div class="bar">${DOTS}<span>${esc(label)}</span></div>` +
  `<div class="body">${rows.map(rowHtml).join("")}</div></div>`;

/** What a step does each time it works: its own runs, or its one log. */
const runsOf = (step) => step.runs ?? [{ log: step.log ?? [] }];
const runHtml = (run, j, back) =>
  `<span class="wrun" data-run="${j}">${run.log.map((l) => `<span class="wl">${esc(l)}</span>`).join("")}` +
  (run.fail ? `<span class="wl pnk">↩ back to ${esc(back.title)}</span>` : "") +
  `</span>`;

const flowHtml = (steps) =>
  `<div class="flow">` +
  steps
    .map((s, i) => {
      const runs = runsOf(s);
      const goesBack = runs.some((r) => r.fail);
      const arrow = i === 0 ? "" : goesBack ? `<span class="arrow it"><span class="fwd">→</span><span class="bk pnk">←</span></span>` : `<span class="arrow it">→</span>`;
      const status = goesBack
        ? `<span class="wst"><span class="wfail pnk">✗ sent back</span><span class="wres grn">✓ done</span></span>`
        : `<span class="wres grn">✓ done</span>`;
      const box = s.final
        ? `<div class="step pr it"><span class="n">&nbsp;</span><span class="t grn">${esc(s.title)}</span></div>`
        : `<div class="step it" data-w><span class="n">${esc(s.n)} ${status}</span>` +
          `<span class="t">${iconHtml(s.icon)}${esc(s.title)}</span><span class="p">${esc(s.sub)}</span>` +
          (s.log || s.runs ? `<span class="wlog">${runs.map((r, j) => runHtml(r, j, steps[i - 1])).join("")}</span>` : "") +
          `${BAR}</div>`;
      return arrow + box;
    })
    .join("") +
  `</div>`;

const noteHtml = (s) => (s.note ? `<p class="note fin">${esc(s.note)}</p>` : "");

/** A checked table row is timed by its work, not as a row. */
const rowsIn = (rows = []) => rows.reduce((n, r) => n + (r.table ? 1 + r.table.rows.filter((c) => !c.some(isWork)).length : 1), 0);

/** Rows are revealed one by one; the note comes after the last. */
const windowsOf = (s) => (s.window ? [s.window] : s.panels ?? [s.before, s.after].filter(Boolean));
const rowElements = (s) => windowsOf(s).filter((w) => !w.afterWork).reduce((n, w) => n + (w.rows ?? []).filter((r) => !r.afterWork).length, 0);
/** The rows of the panels that open once the work is done, then the rows that follow it. */
const thenRows = (s) => windowsOf(s).filter((w) => w.afterWork).reduce((n, w) => n + (w.rows ?? []).length, 0);
const laterRows = (s) => thenRows(s) + windowsOf(s).filter((w) => !w.afterWork).reduce((n, w) => n + (w.rows ?? []).filter((r) => r.afterWork).length, 0);
const hasThen = (s) => windowsOf(s).some((w) => w.afterWork);

// ---- product surfaces: a fixed page that changes in place, beat by beat ----------------------------------

/** A beat is one thing that changes on a product surface, at `at` seconds after the scene opens: `in` fades an
 * element in where it already stands, `set` changes its state (`data-s`), `fill` fills its bar, `count` counts it
 * up to `value`, `focus` lights the elements `value` names and dims the rest, `cap` shows caption `value`. Nothing
 * moves and nothing enters or leaves the layout. Its sound plays at the same time; the scene's length, its sounds
 * and its animation all read the one list. */
const BEAT_FROM = 0.63;
/** Every beat of a product scene is spread by this much, so each screen is read before the next. */
const PACE = 1;
const MAX_CAPTIONS = 3;
const MAX_THREADS = 6;
const beat = (at, act, sel, sound, value) => ({ at: round2(at), act, sel, sound, ...(value === undefined ? {} : { value }) });
const focus = (at, sels, sound) => beat(at, "focus", "[data-zone]", sound, sels);
const caption = (at, k, sound) => beat(at, "cap", `[data-cap='${k}']`, sound, k);

/** The time a step stays on screen: long enough to read what it says. */
const readTime = (...texts) => {
  const words = texts.flat().reduce((n, x) => n + wordCount(x), 0);
  return round2(Math.min(3.4, Math.max(1.4, 1 + 0.1 * words)));
};
const wordCount = (text) => String(text ?? "").trim().split(/\s+/).filter(Boolean).length;

/** A person shown by an initial in a coloured disc: the render fetches no picture for a fictional login. */
const avatarHtml = (login) => {
  const hue = [...String(login)].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 360, 7);
  return `<span class="gh-av" style="background:hsl(${hue} 45% 42%)">${esc(String(login).slice(0, 1).toUpperCase())}</span>`;
};

const need = (ok, message) => {
  if (!ok) throw new Error(message);
};

/** A GitHub pull request page that never moves: its header, two review threads that each get their answer, the
 * settled ones collapsing to Resolved in their own slot, then the summary comment in its own slot. */
const githubPr = {
  captions: (s) => s.captions ?? [],
  body: (s) => {
    need(s.pr?.title, "github-pr has no pr.title");
    need(s.threads?.length, "github-pr has no threads");
    need(s.threads.length <= MAX_THREADS, `github-pr: ${s.threads.length} threads, ${MAX_THREADS} at most`);
    s.threads.forEach((th, i) => need(th.reply, `github-pr thread ${i + 1} has no reply`));
    const { pr } = s;
    const where = (th) => `<span class="gh-path">${esc(th.file)}</span>${th.line ? `<span class="gh-ln">line ${esc(th.line)}</span>` : ""}`;
    const thread = (th, i) =>
      `<div class="gh-slot" data-thread="${i}" data-s="open">` +
      `<div class="gh-full"><div class="gh-file">${where(th)}</div>` +
      `<div class="gh-c">${avatarHtml(th.author)}<div><b>${esc(th.author)}</b><p>${esc(th.comment)}</p></div></div>` +
      `<div class="gh-c gh-reply" data-reply="${i}">${avatarHtml(pr.author)}<div><b>${esc(pr.author)}</b>${th.kind ? `<span class="gh-kind" data-kind="${esc(th.kind)}">${esc(th.kind)}</span>` : ""}<p>${esc(th.reply)}</p></div></div></div>` +
      `<div class="gh-bar">${where(th)}<span class="gh-res">✓ Resolved</span></div>` +
      `</div>`;
    const summary = s.summary
      ? `<div class="gh-hero">${s.summary.kicker ? `<span class="gh-hero-k">${esc(s.summary.kicker)}</span>` : ""}${avatarHtml(pr.author)}<div class="gh-sbody"><div class="gh-shead"><b>${esc(pr.author)}</b> commented</div>` +
        `<h4>${esc(s.summary.title)}</h4>${(s.summary.lines ?? []).map((l) => `<p>${esc(l)}</p>`).join("")}` +
        (s.summary.sections ?? [])
          .map((sec) =>
            sec.list === "bullets"
              ? `<h5>${esc(sec.heading)}</h5><ul>${sec.items.map((x) => `<li>${esc(x)} <span class="gh-link">(thread)</span></li>`).join("")}</ul>`
              : `<h5>${esc(sec.heading)}</h5><ol>${sec.items.map((x) => `<li><b>${esc(x)}</b> <span class="gh-link">(thread)</span></li>`).join("")}</ol>`
          )
          .join("") +
        `</div></div>`
      : "";
    const checks = (pr.checks ?? []).map((c) => `<span class="gh-check" data-s="${esc(c.state ?? "pass")}">${esc(c.name)}</span>`).join("");
    return (
      `<div class="gh"><div class="gh-url">${DOTS}<span>github.com/${esc(pr.repo)}/pull/${esc(pr.number)}</span>${s.prompt ? `<span class="gh-run">&gt; ${esc(s.prompt)}</span>` : ""}</div>` +
      `<div class="gh-head"><h3>${esc(pr.title)} <span class="gh-num">#${esc(pr.number)}</span></h3>` +
      `<div class="gh-meta"><span class="gh-open">Open</span><span><b>${esc(pr.author)}</b> wants to merge into <code>${esc(pr.base)}</code> from <code>${esc(pr.branch)}</code></span></div></div>` +
      `<div class="gh-cols"><div class="gh-threads">${s.threads.map(thread).join("")}</div>` +
      `<div class="gh-side">${checks ? `<div class="gh-merge"><span class="gh-ok">✓</span><span>All checks have passed</span>${checks}</div>` : ""}</div></div>${summary}` +
      `</div>`
    );
  },
  beats: (s) => {
    const out = [beat(BEAT_FROM, "in", ".gh", "pop"), caption(BEAT_FROM, 0, "pop")];
    s.threads.forEach((_, i) => out.push(beat(0.9 + 0.1 * i, "in", `[data-thread='${i}']`, "click")));
    let at = 0.9 + 0.1 * s.threads.length + 0.7;
    s.threads.forEach((_, i) => out.push(beat(at + 0.3 * i, "in", `[data-reply='${i}']`, "pop")));
    at += 0.3 * s.threads.length + 1.6;
    const settled = s.threads.map((th, i) => (th.resolve ? i : -1)).filter((i) => i > -1);
    if (settled.length) {
      out.push(caption(at, 1, "tick"));
      settled.forEach((i) => out.push(beat(at, "set", `[data-thread='${i}']`, "tick", "resolved")));
      at += 2.2;
    }
    if (s.summary) out.push(beat(at, "in", ".gh-hero", "pop"), caption(at, 2, "pop"));
    return out.filter((x) => x.act !== "cap" || x.value < githubPr.captions(s).length);
  },
};

const IDE_STATES = ["red", "green"];

/** One editor frame that never moves: its file tree, its open file and its agent panel, playing `steps` in turn.
 * A step shows a message or a notice from the tool where it already stands, opens a file, adds lines in place,
 * or turns a file of the tree red or green; a step with a `caption` starts a new beat. */
const ideWindow = {
  captions: (s) => (s.steps ?? []).filter((st) => st.caption).map((st) => st.caption),
  body: (s) => {
    need(s.ide?.files?.length, "ide-window has no ide.files");
    need(s.steps?.length, "ide-window has no steps");
    const files = s.ide.files;
    const at = (p) => files.findIndex((f) => f.path === p);
    s.steps.forEach((st, i) => {
      const where = `ide-window step ${i + 1}`;
      if (st.state !== undefined) need(IDE_STATES.includes(st.state), `${where}: state "${st.state}", one of ${IDE_STATES.join(", ")}`);
      for (const p of [st.file, st.open].filter((x) => x !== undefined)) need(at(p) > -1, `${where}: no file "${p}"`);
    });
    const added = files.map(() => []);
    let open = -1;
    s.steps.forEach((st, i) => {
      if (st.open !== undefined) open = at(st.open);
      if (st.add) {
        need(open > -1, `ide-window step ${i + 1}: lines added with no open file`);
        added[open].push(...st.add.map((text) => ({ text, step: i })));
      }
    });
    const folders = new Set();
    const tree = files
      .map((f, k) => {
        const parts = f.path.split("/");
        let html = "";
        parts.slice(0, -1).forEach((dir, d) => {
          const key = parts.slice(0, d + 1).join("/");
          if (folders.has(key)) return;
          folders.add(key);
          html += `<li class="ide-dir" style="padding-left:${16 + d * 22}px">▾ ${esc(dir)}</li>`;
        });
        return html + `<li class="ide-file" data-file="${k}" data-zone data-s="none" style="padding-left:${16 + (parts.length - 1) * 22}px">${esc(parts.at(-1))}</li>`;
      })
      .join("");
    const panes = files
      .map(
        (f, k) =>
          `<div class="ide-code" data-pane="${k}" data-zone data-s="closed"><div class="ide-tab">${esc(f.path.split("/").at(-1))}</div><div class="ide-lines">` +
          (f.lines ?? []).map((l) => `<span class="ide-line">${esc(l)}</span>`).join("") +
          added[k].map((l) => `<span class="ide-line add" data-step="${l.step}">${esc(l.text)}</span>`).join("") +
          `</div></div>`
      )
      .join("");
    const msgs = s.steps
      .flatMap((st, i) => [
        st.user ? `<div class="ide-msg user" data-step="${i}" data-zone>${esc(st.user)}</div>` : "",
        st.tool ? `<div class="ide-msg tool" data-step="${i}" data-zone>${esc(st.tool)}</div>` : "",
        st.notice
          ? `<div class="ide-notice ${esc(st.notice.tone ?? "dim")}" data-step="${i}" data-zone><b>${esc(st.notice.label)}</b><span>${esc(st.notice.text)}</span>` +
            (st.notice.detail ? `<em>${esc(st.notice.detail)}</em>` : "") +
            `</div>`
          : "",
        st.agent ? `<div class="ide-msg agent" data-step="${i}" data-zone>${esc(st.agent)}</div>` : "",
      ])
      .join("");
    return (
      `<div class="ide"><div class="ide-bar">${DOTS}<span>${esc(s.ide.label)}</span></div><div class="ide-main">` +
      `<ul class="ide-tree"><li class="ide-head">EXPLORER</li>${tree}</ul>` +
      `<div class="ide-editor">${panes}</div>` +
      `<div class="ide-chat"><div class="ide-chead">${esc(s.ide.agent ?? "Claude Code")}</div><div class="ide-feed">${msgs}</div></div>` +
      `</div></div>`
    );
  },
  beats: (s) => {
    const files = s.ide.files;
    const at = (p) => files.findIndex((f) => f.path === p);
    const out = [beat(BEAT_FROM, "in", ".ide", "pop")];
    let t = 1.3;
    let open = -1;
    let caps = 0;
    s.steps.forEach((st, i) => {
      const sound = st.state || st.notice?.tone === "red" ? "pop" : "click";
      const lit = [];
      if (st.open !== undefined && at(st.open) !== open) {
        if (open > -1) out.push(beat(t, "set", `[data-pane='${open}']`, sound, "closed"));
        open = at(st.open);
        out.push(beat(t, "set", `[data-pane='${open}']`, sound, "open"));
      }
      if (st.user || st.tool || st.notice || st.agent) {
        out.push(beat(t, "in", `.ide-feed [data-step='${i}']`, sound));
        lit.push(`.ide-feed [data-step='${i}']`);
      }
      if (st.add) {
        out.push(beat(t, "in", `.ide-line[data-step='${i}']`, sound));
        lit.push(`[data-pane='${open}']`);
      }
      if (st.open !== undefined && !lit.includes(`[data-pane='${open}']`)) lit.push(`[data-pane='${open}']`);
      if (st.state) {
        out.push(beat(t, "set", `[data-file='${at(st.file)}']`, sound, st.state));
        lit.push(`[data-file='${at(st.file)}']`);
        if (at(st.file) === open && !lit.includes(`[data-pane='${open}']`)) lit.push(`[data-pane='${open}']`);
      }
      if (st.caption) out.push(caption(t, caps++, sound));
      if (lit.length) out.push(focus(t, lit, sound));
      t += readTime(st.user, st.tool, st.notice?.text, st.notice?.detail, st.agent, st.add ?? []);
    });
    return out;
  },
};

/** One window per tool, each lighting up in turn as it loads what AIDD installs in it. */
const toolGrid = {
  captions: (s) => s.captions ?? [],
  body: (s) => {
    need(s.tools?.length, "tool-grid has no tools");
    const columns = s.tools.length <= 4 ? s.tools.length : Math.ceil(s.tools.length / 2);
    return (
      `<div class="tg" style="grid-template-columns:repeat(${columns}, 1fr)">` +
      s.tools
        .map(
          (tool, k) =>
            `<div class="tg-win" data-tool="${k}" data-zone data-s="off"><div class="tg-bar">${DOTS}</div>` +
            `<div class="tg-body"><b>${esc(tool.name)}</b><small>${esc(tool.dir ?? "")}</small>` +
            `<span class="tg-fill"><i data-fill="${k}"></i></span><span class="tg-count">${esc(tool.count ?? "")}</span></div></div>`
        )
        .join("") +
      `</div>`
    );
  },
  beats: (s) => {
    const out = s.tools.map((_, k) => beat(BEAT_FROM + 0.12 * k, "in", `[data-tool='${k}']`, "click"));
    let t = BEAT_FROM + 0.12 * s.tools.length + 0.6;
    if (toolGrid.captions(s).length) out.push(caption(t, 0, "tick"));
    s.tools.forEach((_, k) => {
      out.push(beat(t, "fill", `[data-fill='${k}']`, "tick"));
      out.push(beat(t + 0.45, "set", `[data-tool='${k}']`, "pop", "on"));
      t += 0.55;
    });
    return out;
  },
};

/** Blocks that appear in place around a core, each tied to it, then a counter that counts up. */
const architectureBlocks = {
  captions: (s) => s.captions ?? [],
  body: (s) => {
    need(s.core, "architecture-blocks has no core");
    need(s.blocks?.length, "architecture-blocks has no blocks");
    need(Number.isFinite(s.counter?.to), "architecture-blocks has no counter.to");
    const spot = (k) => {
      const angle = -Math.PI / 2 + (2 * Math.PI * k) / s.blocks.length;
      return { x: round2(50 + 38 * Math.cos(angle)), y: round2(50 + 40 * Math.sin(angle)) };
    };
    const links = s.blocks.map((_, k) => `<line data-link="${k}" x1="50" y1="50" x2="${spot(k).x}" y2="${spot(k).y}" pathLength="1" />`).join("");
    return (
      `<div class="ab"><svg class="ab-links" viewBox="0 0 100 100" preserveAspectRatio="none">${links}</svg>` +
      `<div class="ab-core" data-zone><b>${esc(s.core)}</b><div class="ab-count"><span data-count>${esc(s.counter.from ?? 0)}</span> ${esc(s.counter.label ?? "")}</div></div>` +
      s.blocks
        .map(
          (b, k) =>
            `<div class="ab-block" data-block="${k}" data-zone style="left:${spot(k).x}%;top:${spot(k).y}%"><b>${esc(b.label)}</b>${b.detail ? `<small>${esc(b.detail)}</small>` : ""}</div>`
        )
        .join("") +
      `</div>`
    );
  },
  beats: (s) => {
    const out = [beat(BEAT_FROM, "in", ".ab-core", "pop")];
    if (architectureBlocks.captions(s).length) out.push(caption(1.3, 0, "pop"));
    s.blocks.forEach((_, k) => {
      const at = 1.3 + 0.4 * k;
      out.push(beat(at, "in", `[data-block='${k}']`, "pop"), beat(at, "fill", `[data-link='${k}']`, "pop"));
    });
    const counted = 1.3 + 0.4 * s.blocks.length + 0.4;
    out.push(beat(counted, "count", "[data-count]", "tick", s.counter.to), focus(counted, [".ab-core"], "tick"));
    if (architectureBlocks.captions(s).length > 1) out.push(caption(counted, 1, "tick"));
    return out;
  },
};

/** A logo from the pinned brand icon set, fetched at render: a name without `-color` is a one-colour mark, drawn white. */
const LOGO_SET = "https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.106.0/icons";
const logoHtml = (name, cls) => `<img class="${cls}${name.endsWith("-color") ? "" : " mono"}" src="assets/logo-${esc(name)}.svg" alt="" />`;

/** The logos a plan shows, which the render fetches from the icon set. */
function mediaOf(plan) {
  const logos = [];
  const add = (list, value) => value && !list.includes(value) && list.push(value);
  for (const s of plan.scenes ?? []) {
    (s.tools ?? []).forEach((tool) => add(logos, tool.logo));
    (s.cards ?? []).forEach((card) => (card.faces ?? []).forEach((face) => add(logos, face.logo)));
  }
  return { logos };
}

const PANEL_KINDS = ["layers", "grid", "levels"];

/** Panels shown one at a time in the centre, each with its subtitle: its items appear in turn, and it leaves when the
 * next one comes. A panel draws layers stacked, a grid of names, or levels each with what it proves. */
const panelSequence = {
  captions: (s) => s.captions ?? [],
  body: (s) => {
    need(s.panels?.length, "panel-sequence has no panels");
    s.panels.forEach((p, i) => need(PANEL_KINDS.includes(p.kind), `panel-sequence panel ${i + 1}: kind "${p.kind}", one of ${PANEL_KINDS.join(", ")}`));
    const item = (p, i, it, k) =>
      `<div class="ps-item" data-item="${i}-${k}"><b>${esc(it.label)}</b>${it.detail ? `<span>${esc(it.detail)}</span>` : ""}</div>` +
      (p.kind === "layers" && k < p.items.length - 1 ? `<i class="ps-down" data-item="${i}-${k}"></i>` : "");
    return (
      `<div class="stage ps${s.layout === "row" ? " row" : ""}">` +
      s.panels
        .map((p, i) => `<div class="ps-panel ${esc(p.kind)}" data-panel="${i}">${p.label ? `<h4>${esc(p.label)}</h4>` : ""}${p.items.map((it, k) => item(p, i, it, k)).join("")}</div>`)
        .join("") +
      `</div>`
    );
  },
  beats: (s) => {
    const out = [];
    let t = BEAT_FROM;
    if (s.layout === "row") {
      s.panels.forEach((_, i) => out.push(beat(BEAT_FROM + 0.25 * i, "in", `[data-panel='${i}']`, "pop")));
      return out;
    }
    s.panels.forEach((p, i) => {
      if (i) out.push(beat(t, "to", `[data-panel='${i - 1}']`, "tick", { opacity: 0, duration: 0.2 }));
      out.push(beat(t, "in", `[data-panel='${i}']`, "pop"), caption(t, i, "pop"));
      p.items.forEach((_, k) => out.push(beat(t + 0.3 + 0.22 * k, "in", `[data-item='${i}-${k}']`, "click")));
      t += 0.3 + 0.22 * p.items.length + 1.6;
    });
    return out;
  },
};

/** Tools shown by their logos in a row; each new one comes in from the right, one after another, and snaps onto the
 * end of the row with a click and a glow, the row closing up to stay centred. */
const logoRow = {
  captions: (s) => s.captions ?? [],
  body: (s) => {
    need(s.tools?.length, "logo-row has no tools");
    s.tools.forEach((tool) => need(tool.logo, `logo-row tool "${tool.name}" has no logo`));
    return (
      `<div class="stage lr" style="grid-template-columns:repeat(${s.tools.length}, 1fr)">` +
      s.tools
        .map(
          (tool, k) =>
            `<div class="lr-tool${tool.new ? " new" : ""}" data-tool="${k}" data-zone>${tool.new ? `<span class="lr-burst" data-burst="${k}"></span>` : ""}` +
            `<div class="lr-card">${logoHtml(tool.logo, "lr-logo")}</div><b>${esc(tool.name)}</b>${tool.new ? `<span class="lr-new">New</span>` : ""}</div>`
        )
        .join("") +
      `</div>`
    );
  },
  beats: (s) => {
    const slot = 1720 / s.tools.length;
    const fresh = s.tools.map((tool, k) => (tool.new ? k : -1)).filter((k) => k > -1);
    const old = s.tools.map((tool, k) => (tool.new ? -1 : k)).filter((k) => k > -1);
    // Until a new tool lands, the row is centred on the tools already there: shifted right by half a slot per tool to come.
    const shift = (left) => Math.round((left * slot) / 2);
    const out = [beat(BEAT_FROM, "in", ".lr", "pop"), caption(BEAT_FROM, 0, "pop")];
    old.forEach((k, i) => out.push(beat(BEAT_FROM + 0.12 * i, "fromto", `[data-tool='${k}']`, "click", { from: { x: shift(fresh.length), opacity: 0 }, to: { x: shift(fresh.length), opacity: 1, duration: 0.35 } })));
    let t = BEAT_FROM + 0.12 * old.length + 0.8;
    fresh.forEach((k, n) => {
      const left = fresh.length - n - 1;
      old.concat(fresh.slice(0, n)).forEach((o) => out.push(beat(t, "to", `[data-tool='${o}']`, "tick", { x: shift(left), duration: 0.6, ease: "power3.inOut" })));
      out.push(beat(t, "fromto", `[data-tool='${k}']`, "tick", { from: { x: 900, opacity: 0 }, to: { x: shift(left), opacity: 1, duration: 0.6, ease: "back.out(1.6)" } }));
      out.push(beat(t + 0.6, "from", `[data-burst='${k}']`, "pop", { scale: 0.2, opacity: 1, duration: 0.6 }), beat(t + 0.6, "pulse", `[data-tool='${k}']`, "pop"));
      t += 1.3;
    });
    s.tools.forEach((_, k) => out.push(beat(t + 0.2, "pulse", `[data-tool='${k}']`, "pop")));
    return out;
  },
};

const GATE_KINDS = ["block", "inform", "require"];

/** An AI and the project with a checkpoint panel between them. Each outcome is one beat: the action reaches the
 * checkpoint, its status light gives the verdict, and the action is refused, passes with a note the AI keeps for that
 * beat only, or is sent back until the AI fixes it and it passes. */
const gateScene = {
  captions: (s) => s.captions ?? [],
  body: (s) => {
    need(s.outcomes?.length, "gate has no outcomes");
    s.outcomes.forEach((o) => need(GATE_KINDS.includes(o.kind), `gate outcome "${o.kind}", one of ${GATE_KINDS.join(", ")}`));
    s.outcomes.forEach((o) => need(!o.file || (s.files ?? []).includes(o.file), `gate outcome "${o.label}": no file "${o.file}" in the project`));
    const verdicts = s.outcomes
      .map((o) => `<div class="gt-verdict" data-kind="${esc(o.kind)}"><b>${esc(o.label)}</b><span>${esc(o.detail ?? "")}</span></div>`)
      .join("");
    const actions = s.outcomes
      .map((o, k) => `<div class="gt-action" data-action="${k}" data-s="idle"><span class="gt-was">${esc(o.action)}</span><span class="gt-fixed">${esc(o.fixed ?? o.action)}</span></div>`)
      .join("");
    const note = s.outcomes.find((o) => o.kind === "inform")?.note;
    return (
      `<div class="stage gt"><div class="gt-actor" data-s="idle"><span class="gt-dot"></span><b>${esc(s.actor)}</b><em class="gt-work">working…</em><em class="gt-ok">✓ fixed</em>` +
      (note ? `<span class="gt-note">${esc(note)}</span>` : "") +
      `</div><div class="gt-gate" data-s="idle"><div class="gt-head"><span class="gt-light"></span><b>${esc(s.gate)}</b></div><div class="gt-scan"></div>` +
      `<div class="gt-verdicts"><div class="gt-verdict idle"><b>Watching</b><span>every action</span></div>${verdicts}<div class="gt-verdict" data-kind="pass"><b>Passed</b><span>all checks</span></div></div></div>` +
      `<div class="gt-target" data-s="idle"><b>${esc(s.target)}</b>` +
      ((s.files ?? []).length ? `<ul class="gt-files">${s.files.map((f, k) => `<li data-file="${k}" data-s="idle">${esc(f)}</li>`).join("")}</ul>` : "") +
      `</div>${actions}</div>`
    );
  },
  beats: (s) => {
    const GATE = 60;
    const TARGET = 820;
    const file = (o) => `[data-file='${(s.files ?? []).indexOf(o.file)}']`;
    const land = (o, a, at) =>
      o.file
        ? [beat(at, "to", a, "click", { x: TARGET, opacity: 0, duration: 0.5 }), beat(at + 0.5, "set", file(o), "pop", "written")]
        : [beat(at, "to", a, "click", { x: TARGET, duration: 0.5 })];
    const out = [beat(BEAT_FROM, "in", ".gt", "pop")];
    let t = 1.0;
    s.outcomes.forEach((o, k) => {
      const a = `[data-action='${k}']`;
      if (k) out.push(beat(t, "set", ".gt-gate", "tick", "idle"));
      out.push(caption(t, k, "pop"), beat(t, "in", a, "click"), beat(t + 0.3, "to", a, "click", { x: GATE, duration: 0.6 }), beat(t + 0.9, "set", ".gt-gate", "pop", o.kind));
      if (o.kind === "block") {
        out.push(beat(t + 1.1, "to", a, "tick", { x: 0, duration: 0.6, ease: "back.out(2)" }), beat(t + 1.1, "shake", ".gt-gate", "tick"));
        if (o.file) out.push(beat(t + 1.1, "set", file(o), "tick", "refused"));
      }
      if (o.kind === "inform") out.push(beat(t + 1.1, "fromto", ".gt-note", "tick", { from: { x: 480, opacity: 0 }, to: { x: 0, opacity: 1, duration: 0.5 } }), ...land(o, a, t + 1.1));
      if (o.kind === "require") {
        out.push(beat(t + 1.1, "to", a, "tick", { x: 0, duration: 0.6 }), beat(t + 1.7, "set", ".gt-actor", "pop", "working"));
        out.push(beat(t + 2.5, "set", ".gt-actor", "pop", "fixed"), beat(t + 2.5, "set", a, "pop", "fixed"));
        out.push(beat(t + 2.8, "to", a, "click", { x: GATE, duration: 0.5 }), beat(t + 3.3, "set", ".gt-gate", "pop", "pass"), ...land(o, a, t + 3.5));
        t += 2.0;
      }
      t += 2.6;
      if (o.kind === "inform") out.push(beat(t - 0.2, "to", ".gt-note", "tick", { opacity: 0, duration: 0.2 }));
      if (o.kind === "block") out.push(beat(t - 0.2, "to", a, "tick", { opacity: 0, duration: 0.2 }));
    });
    return out;
  },
};

/** A terminal that types each command and prints its real output, then every agent card flips together to the
 * provider's model, with the provider's logo. */
const modelSwitch = {
  captions: (s) => s.captions ?? [],
  body: (s) => {
    need(s.cards?.length, "model-switch has no cards");
    need(s.runs?.length, "model-switch has no runs");
    let face = 0;
    s.runs.forEach((run) => {
      if (!run.flip) return;
      face += 1;
      s.cards.forEach((card) => need(card.faces[face], `model-switch card "${card.role}" has no face ${face + 1}`));
    });
    const term = s.runs
      .map(
        (run, r) =>
          `<div class="ms-cmd" data-prompt="${r}"><span class="grn">$</span> <span data-cmd="${r}"></span></div>` +
          run.lines.map((line, k) => `<div class="ms-line" data-line="${r}-${k}">${esc(line.text)}</div>`).join("")
      )
      .join("");
    const cards = s.cards
      .map(
        (card, c) =>
          `<div class="ms-card${card.kind === "main" ? " main" : ""}" data-card="${c}" data-s="0"><span class="ms-kind">${esc(card.kind ?? "subagent")}</span><span class="ms-role">${esc(card.role)}</span>` +
          card.faces.map((f, k) => `<div class="ms-face" data-face="${k}">${f.logo ? logoHtml(f.logo, "ms-logo") : `<span class="ms-slot"></span>`}<b>${esc(f.model)}</b></div>`).join("") +
          `</div>`
      )
      .join("");
    return `<div class="stage ms"><div class="ms-term"><div class="bar">${DOTS}<span>${esc(s.terminal ?? "Terminal")}</span></div><div class="ms-body">${term}</div></div><div class="ms-cards">${cards}</div></div>`;
  },
  beats: (s) => {
    const out = [beat(BEAT_FROM, "in", ".ms", "pop")];
    s.cards.forEach((_, c) => out.push(beat(0.8 + 0.1 * c, "in", `[data-card='${c}']`, "click")));
    let t = 0.8 + 0.1 * s.cards.length + 0.4;
    let face = 0;
    s.runs.forEach((run, r) => {
      out.push(beat(t, "in", `[data-prompt='${r}']`, "tick"), beat(t, "type", `[data-cmd='${r}']`, "tick", run.command));
      t += round2(0.03 * run.command.length + 0.4);
      run.lines.forEach((_, k) => out.push(beat(t + 0.25 * k, "in", `[data-line='${r}-${k}']`, "click")));
      t += 0.25 * run.lines.length + 0.2;
      out.push(caption(t, r, "pop"));
      if (run.flip) {
        face += 1;
        s.cards.forEach((_, c) => out.push(beat(t, "flip", `[data-card='${c}']`, "pop", String(face))));
      }
      t += 1.6;
    });
    return out;
  },
};

/** A short document written section by section, whose status badge turns locked, then an edit that bounces off it
 * with the refusal, and nothing written. */
const docLock = {
  captions: (s) => s.captions ?? [],
  body: (s) => {
    need(s.sections?.length, "doc-lock has no sections");
    need(s.status?.length === 2, "doc-lock status is [before, after]");
    return (
      `<div class="stage dl"><div class="dl-doc" data-zone><div class="dl-head"><span class="dl-file">${esc(s.file)}</span>` +
      `<span class="dl-status" data-s="0">${s.status.map((x, f) => `<span class="dl-face" data-face="${f}">${esc(x)}</span>`).join("")}</span></div>` +
      `<div class="dl-new">${s.sections.map((sec, k) => `<div class="dl-sec" data-section="${k}"><h4>${esc(sec.heading)}</h4><p>${esc(sec.text)}</p></div>`).join("")}</div>` +
      `<div class="dl-seal"><b>Approved</b><span>locked</span></div></div>` +
      (s.attempt ? `<div class="dl-attempt">${esc(s.attempt.action)}</div><p class="dl-refusal">${esc(s.attempt.refusal)}</p>` : "") +
      `</div>`
    );
  },
  beats: (s) => {
    const out = [beat(BEAT_FROM, "in", ".dl-doc", "pop"), caption(BEAT_FROM, 0, "pop")];
    let t = 1.0;
    s.sections.forEach((_, k) => out.push(beat(t + 0.35 * k, "in", `[data-section='${k}']`, "click")));
    t += 0.35 * s.sections.length + 1.0;
    out.push(caption(t, 1, "pop"), beat(t, "flip", ".dl-status", "pop", "1"), beat(t + 0.3, "fromto", ".dl-seal", "pop", { from: { scale: 2.2, opacity: 0 }, to: { scale: 1, opacity: 1, duration: 0.45, ease: "back.out(2)" } }));
    t += 1.9;
    if (s.attempt) {
      out.push(caption(t, 2, "click"), beat(t, "in", ".dl-attempt", "click"), beat(t + 0.4, "to", ".dl-attempt", "tick", { x: -330, duration: 0.45, ease: "power2.in" }));
      out.push(beat(t + 0.85, "to", ".dl-attempt", "pop", { x: 0, duration: 0.5, ease: "back.out(3)" }), beat(t + 0.85, "shake", ".dl-doc", "pop"));
      out.push(beat(t + 1.1, "in", ".dl-refusal", "pop"));
    }
    return out;
  },
};

/** A spec on the left, swept by a scanner: each line it reaches lights up and spawns its finding on the right, linked
 * to it, in the colour of its report section, with its proof. */
const challengeReport = {
  captions: (s) => s.captions ?? [],
  body: (s) => {
    need(s.spec?.lines?.length, "challenge-report has no spec.lines");
    need(s.spec.lines.some((l) => l.finding), "challenge-report has no finding");
    return (
      `<div class="stage cr"><div class="cr-file">${esc(s.spec.file ?? "spec.md")}</div><div class="cr-rows"><span class="cr-beam"></span>` +
      s.spec.lines
        .map(
          (l, k) =>
            `<div class="cr-row" data-line="${k}" data-s="idle"><p>${esc(l.text)}</p>` +
            (l.finding
              ? `<div class="cr-finding ${esc(l.finding.tone ?? "red")}" data-finding="${k}"><b>${esc(l.finding.label ?? "")}</b><span>${esc(l.finding.text)}</span>${l.finding.evidence ? `<small>${esc(l.finding.evidence)}</small>` : ""}</div>`
              : "") +
            `</div>`
        )
        .join("") +
      `</div></div>`
    );
  },
  beats: (s) => {
    const SWEEP = 0.8 * s.spec.lines.length;
    const t = 1.2;
    const out = [beat(BEAT_FROM, "in", ".cr-rows", "pop"), caption(BEAT_FROM, 0, "pop"), beat(t, "to", ".cr-beam", "tick", { yPercent: 100, duration: SWEEP * PACE, ease: "none" })];
    let first = true;
    s.spec.lines.forEach((l, k) => {
      if (!l.finding) return;
      const at = round2(t + (SWEEP * (k + 0.5)) / s.spec.lines.length);
      out.push(beat(at, "set", `[data-line='${k}']`, "pop", "lit"), beat(at, "from", `[data-finding='${k}']`, "pop", { x: -40, opacity: 0, duration: 0.45 }));
      if (first) out.push(caption(at, 1, "pop"));
      first = false;
    });
    return out;
  },
};

const CHAIN_VISUALS = ["wireframe", "direction", "swatches", "components", "screens", "verdict"];
const VISUALS = {
  wireframe: `<i></i><i></i><i class="short"></i><i class="box"></i>`,
  direction: `<span class="dir"><i></i><i></i><i></i></span><span class="dir kept"><i></i><i></i><i></i></span><span class="dir"><i></i><i></i><i></i></span>`,
  swatches: `<span class="sw"><i></i><i></i><i></i><i></i></span><span class="ramp"><b>Aa</b><b>Aa</b><b>Aa</b></span>`,
  components: `<span class="btn"></span><span class="btn ghost"></span><span class="crd"></span>`,
  screens: `<span class="scr"><i class="bar"></i><i></i><i></i><i></i></span><span class="scr phone"><i class="bar"></i><i></i></span>`,
  verdict: `<span class="vd ok">OK</span><span class="vd rev">Revise</span><span class="pub">publish</span>`,
};

/** The steps of a design as a chain of stylised cards, left to right: each lights in turn with its skill, its design
 * keywords and a small abstract picture of what it makes. */
const chainCards = {
  captions: (s) => s.captions ?? [],
  body: (s) => {
    need(s.steps?.length, "chain-cards has no steps");
    s.steps.forEach((st, i) => need(CHAIN_VISUALS.includes(st.visual), `chain-cards step ${i + 1}: visual "${st.visual}", one of ${CHAIN_VISUALS.join(", ")}`));
    return (
      `<div class="stage ch" style="grid-template-columns:repeat(${s.steps.length}, 1fr)">` +
      s.steps
        .map(
          (st, k) =>
            `<div class="ch-card" data-card="${k}" data-s="off"><code>${esc(st.skill ?? "")}</code><b>${esc(st.label)}</b><div class="ch-vis ${esc(st.visual)}">${VISUALS[st.visual]}</div>` +
            `<ul class="ch-keys">${(st.keywords ?? []).map((w) => `<li>${esc(w)}</li>`).join("")}</ul></div>`
        )
        .join("") +
      `</div>`
    );
  },
  beats: (s) => {
    const out = [caption(BEAT_FROM, 0, "pop")];
    let t = BEAT_FROM + 0.3;
    s.steps.forEach((st, k) => {
      if (k) out.push(beat(t, "set", `[data-card='${k - 1}']`, "tick", "done"));
      out.push(beat(t, "in", `[data-card='${k}']`, "pop"), beat(t, "set", `[data-card='${k}']`, "pop", "on"));
      if (st.caption) out.push(caption(t, st.caption, "pop"));
      t += 1.2;
    });
    return out;
  },
};

/** A story that stays readable while its unclear phrases are highlighted; each question then appears on its phrase's
 * line, in story order, and closes once the author answers it. */
const scanQuestions = {
  captions: (s) => s.captions ?? [],
  body: (s) => {
    need(s.story?.length, "scan-questions has no story");
    need(s.gaps?.length, "scan-questions has no gaps");
    s.story.flat().forEach((seg) => {
      if (typeof seg === "object") need(s.gaps[seg.gap], `scan-questions passage "${seg.text}": no question ${seg.gap + 1}`);
    });
    const row = (segs, r) =>
      `<div class="sq-row" data-row="${r}"><p>${segs
        .map((seg) =>
          typeof seg === "string"
            ? esc(seg)
            : `<span class="sq-gap" data-gap="${seg.gap}" data-s="plain"><i class="sq-mark" data-mark="${seg.gap}"></i><span class="sq-was">${esc(seg.text)}</span><span class="sq-fixed">${esc(seg.fixed ?? seg.text)}</span></span>`
        )
        .join("")}</p><div class="sq-qs">${segs
        .filter((seg) => typeof seg === "object")
        .map((seg) => {
          const g = s.gaps[seg.gap];
          return `<div class="sq-q" data-q="${seg.gap}" data-s="open"><span class="sq-cat">${esc(g.category)}</span><p>${esc(g.question)}</p></div>`;
        })
        .join("")}</div></div>`;
    return (
      `<div class="stage sq"><div class="sq-head"><span class="sq-file">${esc(s.file ?? "story.md")}</span>` +
      `<span class="sq-status" data-s="0">${(s.status ?? []).map((x, f) => `<span class="dl-face" data-face="${f}">${esc(x)}</span>`).join("")}</span></div>` +
      `<div class="sq-rows">${s.story.map(row).join("")}</div></div>`
    );
  },
  beats: (s) => {
    const out = [beat(BEAT_FROM, "in", ".sq-rows", "pop"), caption(BEAT_FROM, 0, "pop")];
    const passages = s.story.flatMap((segs) => segs.filter((seg) => typeof seg === "object"));
    let t = 1.0;
    passages.forEach((seg, i) => out.push(beat(t + 0.45 * i, "fill", `[data-mark='${seg.gap}']`, "pop")));
    t = 3.7;
    out.push(beat(t, "in", ".sq-head", "pop"), caption(t, 1, "pop"));
    passages.forEach((seg, i) => {
      const at = t + 0.6 * i;
      out.push(beat(at, "pulse", `[data-gap='${seg.gap}']`, "pop"), beat(at, "from", `[data-q='${seg.gap}']`, "pop", { x: -40, opacity: 0, duration: 0.4 }));
    });
    t += 0.6 * passages.length + 1.2;
    out.push(caption(t, 2, "pop"));
    passages.forEach((seg, i) => out.push(beat(t + 0.3 * i, "set", `[data-gap='${seg.gap}']`, "pop", "filled"), beat(t + 0.3 * i, "set", `[data-q='${seg.gap}']`, "pop", "closed")));
    out.push(beat(t + 0.3 * passages.length, "flip", ".sq-status", "pop", "1"));
    return out;
  },
};


/** The people who shipped the release: their avatars arrive in a wave and settle into a mosaic, with their count. */
const contributorWave = {
  captions: (s) => s.captions ?? [],
  lead: (s) => `${(s.logins ?? []).length} contributors`,
  body: (s) => {
    need(s.logins?.length, "contributor-wave has no logins");
    const columns = Math.min(s.logins.length, s.logins.length > 10 ? Math.ceil(s.logins.length / 2) : s.logins.length);
    return (
      `<div class="stage cw" style="grid-template-columns:repeat(${columns}, 1fr)">` +
      s.logins.map((l, k) => `<div class="cw-av" data-login="${k}"><img src="assets/av-${esc(l)}.png" alt="" /><span>@${esc(l)}</span></div>`).join("") +
      `</div>`
    );
  },
  beats: (s) => {
    const out = [beat(BEAT_FROM, "in", ".cw", "pop"), caption(0.8, 0, "pop")];
    s.logins.forEach((_, k) => out.push(beat(1.0 + 0.16 * k, "from", `[data-login='${k}']`, "click", { y: 160, scale: 0.3, opacity: 0, duration: 0.7, ease: "back.out(1.8)" })));
    const t = 1.0 + 0.16 * s.logins.length + 0.8;
    s.logins.forEach((_, k) => out.push(beat(t + 0.06 * k, "pulse", `[data-login='${k}']`, k ? "click" : "pop")));
    return out;
  },
};

/** The beats of a scene drawn as a product surface, at the video's time. */
function sceneBeats(s, t) {
  const count = scene[s.template].captions(s).length;
  need(count <= MAX_CAPTIONS, `${s.template}: ${count} captions, ${MAX_CAPTIONS} at most`);
  return scene[s.template]
    .beats(s)
    .map((b) => ({ ...b, at: round2(t + b.at * PACE) }))
    .sort((x, y) => x.at - y.at);
}
const hasBeats = (s) => Boolean(scene[s.template]?.beats);

const scene = {
  "terminal-demo": {
    items: (s) => rowsIn(s.window?.rows) + (s.flow ? 2 : 0),
    body: (s) => windowHtml(s.window) + (s.flow ? flowHtml(s.flow) : "") + noteHtml(s),
  },
  "before-after": {
    items: (s) => (s.figures ?? []).length + rowsIn(s.before?.rows) + rowsIn(s.after?.rows),
    body: (s) =>
      `<div class="figs">` +
      (s.figures ?? [])
        .map(
          (f) =>
            `<div class="fig it"><b><span class="from">${esc(f.from)}</span><span class="arr">→</span><span class="to">${esc(f.to)}</span></b><small>${esc(f.label)}</small></div>`
        )
        .join("") +
      `</div>` +
      `<div class="split diff">${windowHtml({ ...s.before, flex: 1 })}${windowHtml({ ...s.after, flex: 1 })}</div>` +
      noteHtml(s),
  },
  "two-panels": {
    items: (s) => (s.panels ?? []).reduce((n, p) => n + rowsIn(p.rows), 0),
    body: (s) => `<div class="split">${s.panels.map(windowHtml).join("")}</div>${noteHtml(s)}`,
  },
  "bullet-grid": {
    items: (s) => (s.cells ?? []).length,
    body: (s) =>
      `<div class="grid">` +
      s.cells
        .map(
          (c) =>
            `<div class="cell it${c.wide ? " wide" : ""}"><b>${iconHtml(c.icon)}${esc(c.title)}</b><small>${esc(c.detail ?? "")}</small></div>`
        )
        .join("") +
      `</div>`,
  },
  contributors: {
    items: (s) => Math.ceil((s.logins ?? []).length / 2),
    body: (s) =>
      `<div class="avs">` +
      s.logins
        .map((l) => `<div class="av it"><img src="assets/av-${esc(l)}.png" /><span>@${esc(l)}</span></div>`)
        .join("") +
      `</div>`,
  },
  "github-pr": githubPr,
  "ide-window": ideWindow,
  "tool-grid": toolGrid,
  "architecture-blocks": architectureBlocks,
  "panel-sequence": panelSequence,
  "logo-row": logoRow,
  gate: gateScene,
  "model-switch": modelSwitch,
  "doc-lock": docLock,
  "challenge-report": challengeReport,
  "scan-questions": scanQuestions,
  "chain-cards": chainCards,
  "contributor-wave": contributorWave,
};

/** Head (2.5 s), a second to read the lead, a beat per item, and a closing pause. */
/** Each flow step and each checked row works in turn, once the scene is on screen: its bar fills,
 * then its result shows. */
const WORK = { step: { length: 1.6, fill: 1.2 }, row: { length: 0.75, fill: 0.55 }, together: 1.2 };
const WORK_MARK = / data-w(?=[ >])/g;

/** Each run in the order it plays, `k` the element it works on, numbered as the page draws them:
 * checked rows first, then flow steps. A failed run sends the work back to the step before it,
 * which runs again before the check retries. */
function workRuns(s) {
  const runs = [];
  let k = 0;
  for (const w of windowsOf(s))
    for (const r of w.rows ?? [])
      for (const cells of r.table?.rows ?? []) if (cells.some(isWork)) runs.push({ ...WORK.row, k: k++, together: Boolean(r.table.together) });
  const steps = (s.flow ?? []).filter((step) => !step.final).map((step) => ({ step, k: k++, next: 0 }));
  const go = (i) => {
    const { step, k: el } = steps[i];
    const run = steps[i].next++;
    const fail = Boolean(runsOf(step)[run]?.fail);
    if (!runsOf(step)[run]) throw new Error(`${step.title} has no run left`);
    runs.push({ ...WORK.step, k: el, run, fail });
    return fail;
  };
  for (let i = 0; i < steps.length; i++) while (go(i)) go(i - 1);
  return runs;
}

/** Each run with the time it starts at, one after the other. Rows installed together start at
 * once and end at once. */
const workPlan = (s, t) => {
  let at = workStart(s, t);
  let group = [];
  const plan = [];
  const close = () => {
    if (!group.length) return;
    group.forEach((run) => plan.push({ ...run, at: round2(at), fill: WORK.together }));
    at += WORK.together + 0.3;
    group = [];
  };
  for (const run of workRuns(s)) {
    if (run.together) {
      group.push(run);
      continue;
    }
    close();
    plan.push({ ...run, at: round2(at) });
    at += run.length;
  }
  close();
  return plan;
};
/** When the last run ends, or when the work would start if there is none. */
const workEnd = (s, t) => round2(Math.max(workStart(s, t), ...workPlan(s, t).map((r) => r.at + r.fill)));
const numberWork = (html) => {
  let k = 0;
  return html.replace(WORK_MARK, () => ` data-w="${k++}"`);
};

/** When the scene's work starts: after its last item and its last row are on screen. */
const workStart = (s, t) =>
  round2(t + Math.max(0.63 + 0.3 * itemsIn(scene[s.template].body(s)) + 0.4, 1.3 + 0.45 * rowElements(s) + 0.3));
/** A panel that follows the work opens once it is done, then its rows come one by one, then the
 * rows that follow the work. */
const laterAt = (s, t) => round2(workEnd(s, t) + 0.3);
const laterRowsAt = (s, t) => round2(laterAt(s, t) + (hasThen(s) ? 0.6 : 0));

/** A scene holds for a reading beat once its last item, row, note, run or later row is on screen. */
const READ = 2.5;
/** A product scene says less per beat than a terminal scene, so it holds a little less once it is all on screen. */
const READ_BEATS = 1.6;
function sceneDuration(s) {
  if (!scene[s.template]) throw new Error(`Unknown template: ${s.template}`);
  if (hasBeats(s)) return half(Math.max(...sceneBeats(s, 0).map((b) => b.at)) + READ_BEATS + (s.hold ?? 0) + (s.lead ? 0.5 : 0));
  const items = itemsIn(scene[s.template].body(s));
  const rows = rowElements(s);
  const shown = Math.max(
    items ? 0.63 + 0.3 * (items - 1) + 0.7 : 0,
    rows ? 1.3 + 0.45 * (rows - 1) + 0.5 : 0,
    s.note ? 1.3 + 0.45 * rows + 0.3 + 0.6 : 0,
    workPlan(s, 0).length ? workEnd(s, 0) : 0,
    laterRows(s) ? laterRowsAt(s, 0) + 0.45 * (laterRows(s) - 1) + 0.5 : 0
  );
  return half(shown + READ + (s.lead ? 0.5 : 0));
}

/** The icons a grid cell can show to say its intent, drawn on a 24-unit grid. */
const ICONS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5"/>',
  build: '<path d="M8 6l-6 6 6 6M16 6l6 6-6 6"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
  review: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
};

const iconHtml = (name) => {
  if (!name) return "";
  if (!ICONS[name]) throw new Error(`Unknown icon "${name}", one of ${Object.keys(ICONS).join(", ")}`);
  return `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;
};

/** The band that says a product scene's subject from its first frame to its last: the title, the gain, then one
 * numbered caption per beat, each shown in the same place while its beat plays. */
const bandHtml = (s, id) => {
  const captions = scene[s.template].captions(s);
  const lead = scene[s.template].lead?.(s) ?? s.lead;
  const sub = captions.length ? captions.map((c, k) => `<span class="cap" data-cap="${k}">${esc(c)}</span>`).join("") : lead ? `<p class="sub">${esc(lead)}</p>` : "";
  return (
    `<div class="band"><div class="band-top"><span class="pill" id="${id}-pill">${esc(s.pill)}</span>` +
    `<h2 id="${id}-h">${esc(s.title)}${s.accent ? ` <span class="g">${esc(s.accent)}</span>` : ""}</h2>${s.badge ? `<span class="badge">${esc(s.badge)}</span>` : ""}</div>` +
    `<div class="sub-slot">${sub}</div>${s.note ? `<p class="note">${esc(s.note)}</p>` : ""}</div>`
  );
};
const headHtml = (s, id) =>
  `<span class="pill" id="${id}-pill">${esc(s.pill)}</span>` +
  `<h2 id="${id}-h">${esc(s.title)}${s.accent ? ` <span class="g">${esc(s.accent)}</span>` : ""}</h2>` +
  (s.lead ? `<p class="lead" id="${id}-lead">${esc(s.lead)}</p>` : "");

/** An intro without tags or phrase opens on the thumbnail's themes, so the video starts as it is announced. */
const introThemes = (plan) => (plan.intro?.tagline || plan.intro?.highlights?.length ? [] : plan.youtube?.themes ?? []);

/** The tags say what the release brings; the phrase above them is optional, and only an intro with
 * neither tags nor themes keeps a default one. */
const hasTagline = (plan) => Boolean(plan.intro?.tagline) || (!plan.intro?.highlights?.length && !introThemes(plan).length);

/** The version is typed in by the timeline: until it starts, nothing of it is on screen. */
function introHtml(plan) {
  const intro = plan.intro ?? {};
  const themes = introThemes(plan);
  const tagline = intro.tagline ? esc(intro.tagline) : "What's new, <b>end to end.</b>";
  const highlights = (intro.highlights ?? []).map((h) => `<span class="hl it">${esc(h)}</span>`).join("");
  return (
    `<img id="intro-logo" src="assets/logo.png" alt="" /><div class="intro-text">` +
    `<div class="intro-top"><span class="pill" id="intro-pill">AIDD Framework</span><span class="rel" id="intro-rel">NEW RELEASE</span></div>` +
    `<div id="ver"><span id="ver-t"></span><span class="dot"></span><span id="ver-n"></span></div>` +
    (hasTagline(plan) ? `<p class="tagline" id="intro-tag">${tagline}</p>` : "") +
    (themes.length ? `<p class="themes" id="intro-themes">${themes.map(esc).join(" · ")}</p>` : "") +
    (highlights ? `<div class="hls">${highlights}</div>` : "") +
    `</div>`
  );
}

/** The fade lane sets the level itself: it is absolute, so it carries the music level too. */
const MUSIC_LEVEL = 0.5;

const musicHtml = (src, total) => {
  const lane = {
    version: 1,
    lanes: [
      {
        target: "volume",
        points: [
          { t: 0, v: 0 },
          { t: 0.3, v: MUSIC_LEVEL },
          { t: total - 1, v: MUSIC_LEVEL },
          { t: total, v: 0 },
        ],
      },
    ],
  };
  return `<audio id="music" src="${esc(src)}" data-start="0" data-duration="${total}" data-track-index="10" data-automation="${esc(JSON.stringify(lane))}"></audio>`;
};

/** The interface sounds sit well under the picture and the music. */
const SFX_LEVEL = 0.2;

const sfxHtml = (src, total) =>
  `<audio id="sfx" src="${esc(src)}" data-start="0" data-duration="${total}" data-track-index="11" data-volume="${SFX_LEVEL}"></audio>`;

const introSeconds = (plan) => (plan.intro?.highlights?.length ? INTRO_WITH_HIGHLIGHTS : INTRO);

const round2 = (x) => Math.round(x * 100) / 100;
const itemsIn = (html) => (html.match(/class="[^"]*\bit\b/g) ?? []).length;

/** One sound per thing that appears, at the time the timeline shows it: a whoosh as a scene
 * opens, a tick for its pill and lead, a pop for its title, window, items and note, a click per row,
 * a key tick per typed character. */
function soundCues(plan, { version }) {
  const cues = [];
  const cue = (kind, t) => cues.push({ kind, t: round2(t) });
  const chars = String(version).length + 1;
  cue("pop", 0.1);
  cue("tick", 0.4);
  cue("tick", 0.55);
  for (let k = 0; k < chars; k++) cue("key", 0.8 + (1.1 * k) / chars);
  if (hasTagline(plan) || introThemes(plan).length) cue("pop", 2.0);
  (plan.intro?.highlights ?? []).forEach((_, k) => cue("pop", (hasTagline(plan) ? 2.6 : 2) + 0.3 * k));

  let t = introSeconds(plan);
  for (const s of plan.scenes) {
    cue("whoosh", t);
    cue("tick", t + 0.14);
    cue("pop", t + 0.28);
    if (s.lead) cue("tick", t + 0.5);
    if (hasBeats(s)) {
      const seen = new Set();
      for (const b of sceneBeats(s, t)) if (!seen.has(b.at)) seen.add(b.at) && cue(b.sound, b.at);
      t += sceneDuration(s);
      continue;
    }
    for (let k = 0; k < itemsIn(scene[s.template].body(s)); k++) cue("pop", t + 0.63 + 0.3 * k);
    for (let k = 0; k < rowElements(s); k++) cue("click", t + 1.3 + 0.45 * k);
    if (s.note) cue("pop", t + 1.3 + 0.45 * rowElements(s) + 0.3);
    const plan = workPlan(s, t);
    plan.forEach((unit, i) => {
      if (i === 0 || plan[i - 1].at !== unit.at) cue("tick", unit.at);
      if (i === 0 || plan[i - 1].at + plan[i - 1].fill !== unit.at + unit.fill) cue("pop", unit.at + unit.fill);
    });
    if (laterRows(s)) {
      if (hasThen(s)) cue("pop", laterAt(s, t));
      for (let k = 0; k < laterRows(s); k++) cue("click", laterRowsAt(s, t) + 0.45 * k);
    }
    t += sceneDuration(s);
  }
  cue("pop", t + 0.07);
  cue("pop", t + 0.28);
  for (let k = 0; k < 2; k++) cue("pop", t + 0.63 + 0.2 * k);
  return cues.sort((a, b) => a.t - b.t);
}

const SFX_RATE = 44100;
const frames = (seconds) => Math.round(seconds * SFX_RATE);

/** Deterministic noise, so two renders of one plan sound the same. */
const noise = (seed) => {
  let x = seed;
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 2147483648 - 1;
  };
};

const onePole = (samples, hz) => {
  const a = 1 - Math.exp((-2 * Math.PI * hz) / SFX_RATE);
  let y = 0;
  return samples.map((v) => (y += a * (v - y)));
};

/** A soft struck tone: a sine and a short inharmonic partial, like glass. */
const ping = (hz, seconds, decay) =>
  Float64Array.from({ length: frames(seconds) }, (_, i) => {
    const x = i / SFX_RATE;
    const tone = Math.sin(2 * Math.PI * hz * x) + 0.35 * Math.sin(2 * Math.PI * hz * 2.76 * x) * Math.exp(-x * 30);
    return 0.5 * tone * Math.exp(-x * decay) * Math.min(1, x * 1000, (seconds - x) * 100);
  });

/** Air that turns from dark to bright while it swells and fades. */
const whoosh = () => {
  const seconds = 0.45;
  const random = noise(7);
  const air = Array.from({ length: frames(seconds) }, random);
  const dark = onePole(air, 900);
  const low = onePole(air, 1500);
  const bright = onePole(air.map((v, i) => v - low[i]), 7000);
  return Float64Array.from(air, (_, i) => {
    const u = i / air.length;
    return 0.9 * (dark[i] * (1 - u) + bright[i] * u) * Math.sin(Math.PI * u) ** 2;
  });
};

/** Each sound is a short soft tone or a breath of air, never a chip-tune blip. */
const SOUNDS = {
  key: () => ping(2600, 0.06, 60),
  tick: () => ping(2000, 0.09, 60),
  click: () => ping(1500, 0.08, 40),
  pop: () => ping(880, 0.3, 11),
  whoosh,
};

/** The sounds of the cues, laid on a silent mono 16-bit wav as long as the video. */
function soundTrack(plan, { version }) {
  const total = Math.round(totalDuration(plan) * SFX_RATE);
  const mix = new Float64Array(total);
  const made = {};
  for (const { kind, t } of soundCues(plan, { version })) {
    const sound = (made[kind] ??= SOUNDS[kind]());
    const from = Math.round(t * SFX_RATE);
    for (let i = 0; i < sound.length && from + i < total; i++) mix[from + i] += sound[i];
  }
  const wav = Buffer.alloc(44 + 2 * total);
  wav.write("RIFF", 0, "latin1");
  wav.writeUInt32LE(36 + 2 * total, 4);
  wav.write("WAVEfmt ", 8, "latin1");
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(SFX_RATE, 24);
  wav.writeUInt32LE(SFX_RATE * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36, "latin1");
  wav.writeUInt32LE(2 * total, 40);
  for (let i = 0; i < total; i++) {
    wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mix[i] * 0.8)) * 32767), 44 + 2 * i);
  }
  return wav;
}

/** What the root declares: the length a music track is cut to. */
const totalDuration = (plan) => introSeconds(plan) + plan.scenes.reduce((n, s) => n + sceneDuration(s), 0) + OUTRO;

function buildHtml(plan, { version, music, sfx }) {
  const sections = [];
  const script = [];
  let t = 0;
  const open = (id, duration, inner) =>
    sections.push(
      `<section id="${id}" class="scene clip" data-start="${t}" data-duration="${duration}" data-track-index="0"><div class="inner">${inner}</div></section>`
    );

  open("intro", introSeconds(plan), introHtml(plan));
  script.push(
    `enter("#intro-logo", 0.1, { y: 0, scale: 0.85, duration: 0.9 });`,
    `enter("#intro-pill", 0.4, { y: 20 });`,
    `enter("#intro-rel", 0.55, { y: 20 });`,
    `const typed = { n: 0 }; const full = ${JSON.stringify(String(version))};`,
    `tl.to(typed, { n: 1, duration: ${VERSION_TYPING_SECONDS}, ease: "none", onUpdate: () => { const len = Math.round(typed.n * (full.length + 1));` +
      ` const [a, b = ""] = full.split(".");` +
      ` document.getElementById("ver-t").textContent = ("v" + a).slice(0, Math.min(len, a.length + 1));` +
      ` document.querySelector("#ver .dot").textContent = len > a.length + 1 ? "." : "";` +
      ` document.getElementById("ver-n").textContent = len > a.length + 1 ? b.slice(0, len - a.length - 1) : ""; } }, ${VERSION_TYPING_FROM});`,
    ...(hasTagline(plan) ? [`enter("#intro-tag", 2.0, { y: 20 });`] : []),
    ...(introThemes(plan).length ? [`enter("#intro-themes", 2.0, { y: 20 });`] : []),
    `enter("#intro .hl", ${hasTagline(plan) ? 2.6 : 2}, { y: 16, duration: 0.5, stagger: 0.3 });`,
    `cut("intro", ${introSeconds(plan)});`
  );
  t += introSeconds(plan);

  plan.scenes.forEach((s, i) => {
    const id = `s${i + 1}`;
    const duration = sceneDuration(s);
    open(id, duration, hasBeats(s) ? bandHtml(s, id) + scene[s.template].body(s) : headHtml(s, id) + numberWork(scene[s.template].body(s)));
    script.push(
      `enter("#${id}-pill", ${t} + 0.14, { y: 20 });`,
      `enter("#${id}-h", ${t} + 0.28);`,
      ...(s.lead ? [`enter("#${id}-lead", ${t} + 0.5, { y: 20 });`] : []),
      ...(hasBeats(s)
        ? [...sceneBeats(s, t).map((b) => `b(${b.at}, "${b.act}", "#${id} ${b.sel}"${b.value === undefined ? "" : `, ${JSON.stringify(b.value)}`});`), `cut("${id}", ${t + duration});`]
        : []),
    );
    if (hasBeats(s)) {
      t += duration;
      return;
    }
    script.push(
      `enter("#${id} .it", ${t} + 0.63, { y: 30, duration: 0.7, stagger: 0.3 });`,
      `enter("#${id} .win:not(.then) .row:not(.later)", ${t} + 1.3, { y: 14, duration: 0.5, stagger: 0.45 });`,
      ...(s.note ? [`enter("#${id} .fin", ${Math.round((t + 1.3 + 0.45 * rowElements(s) + 0.3) * 100) / 100}, { y: 10 });`] : []),
      ...workPlan(s, t).map((unit) => `work("#${id}", ${unit.k}, ${unit.at}, ${unit.fill}, ${unit.run ?? 0}, ${Boolean(unit.fail)});`),
      ...(hasThen(s)
        ? [`enter("#${id} .then", ${laterAt(s, t)}, { y: 30, duration: 0.7 });`, `enter("#${id} .then .row", ${laterRowsAt(s, t)}, { y: 14, duration: 0.5, stagger: 0.45 });`]
        : []),
      ...(laterRows(s) > thenRows(s)
        ? [`enter("#${id} .row.later", ${round2(laterRowsAt(s, t) + 0.45 * thenRows(s))}, { y: 14, duration: 0.5, stagger: 0.45 });`]
        : []),
      `cut("${id}", ${t + duration});`
    );
    t += duration;
  });

  open(
    "outro",
    OUTRO,
    `<img class="logo" id="outro-logo" src="assets/logo.png" alt="" />` +
      `<h2 id="outro-h">AIDD <span class="g">v${esc(version)}</span></h2>` +
      `<div class="cmd it">$ npx @ai-driven-dev/cli@latest setup</div>` +
      `<p class="url it">github.com/ai-driven-dev/framework</p>`
  );
  script.push(
    `enter("#outro-logo", ${t} + 0.07, { y: 0, scale: 0.85, duration: 0.8 });`,
    `enter("#outro-h", ${t} + 0.28);`,
    `enter("#outro .it", ${t} + 0.63, { y: 14, stagger: 0.2 });`
  );
  t += OUTRO;
  script.push(`tl.to("#outro .inner", { opacity: 0, duration: 0.4, ease: "power1.in" }, ${t} - 0.4);`);

  return `<!doctype html>
<html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=1920, height=1080" />
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>${CSS}</style></head>
<body><div id="root" data-composition-id="main" data-start="0" data-duration="${t}" data-width="1920" data-height="1080">
${sections.join("\n")}
${music ? musicHtml(music, t) : ""}
${sfx ? sfxHtml(sfx, t) : ""}
</div>
<script>
const tl = gsap.timeline({ paused: true });
const ease = "power3.out";
const cut = (id, end) => tl.to("#" + id + " .inner", { opacity: 0, duration: 0.4, ease: "power1.in" }, end - 0.4);
const work = (scene, k, at, fill, run, fail) => {
  const unit = scene + ' [data-w="' + k + '"]';
  const all = (sel) => document.querySelectorAll(sel).length > 0;
  const before = document.querySelector(scene + ' .step[data-w="' + k + '"]')?.previousElementSibling;
  const back = before && before.querySelector(".bk") ? before : null;
  if (run > 0) {
    tl.set(unit + " .wbar i", { scaleX: 0, backgroundColor: "#ffd37a" }, at);
    tl.to(unit + ' .wrun[data-run="' + (run - 1) + '"]', { opacity: 0, duration: 0.2 }, at);
    if (all(unit + " .wfail")) tl.to(unit + " .wfail", { opacity: 0, duration: 0.2 }, at);
    if (all(unit + " .wres")) tl.to(unit + " .wres", { opacity: 0, duration: 0.2 }, at);
    if (back) tl.to(back.querySelector(".bk"), { opacity: 0, duration: 0.2 }, at);
    if (back) tl.to(back.querySelector(".fwd"), { opacity: 1, duration: 0.2 }, at);
  }
  if (all(unit + " .wbar i")) tl.to(unit + " .wbar i", { scaleX: 1, duration: fill, ease: "none" }, at);
  const lines = unit + ' .wrun[data-run="' + run + '"] .wl';
  const count = document.querySelectorAll(lines).length;
  if (count) tl.from(lines, { opacity: 0, x: -14, duration: 0.25, ease, stagger: fill / count }, at);
  if (all(unit + " .ico")) tl.to(unit + " .ico", { scale: 1.25, duration: fill / 4, yoyo: true, repeat: 3, ease: "sine.inOut" }, at);
  if (all(scene + ' .step[data-w="' + k + '"]')) {
    const color = fail ? "#ff8fa8" : "#5ee6a8";
    tl.to(scene + ' .step[data-w="' + k + '"]', { borderColor: "#ffd37a", duration: 0.2 }, at);
    tl.to(scene + ' .step[data-w="' + k + '"]', { borderColor: color, duration: 0.2 }, at + fill);
    tl.to(unit + " .wbar i", { backgroundColor: color, duration: 0.2 }, at + fill);
  }
  if (all(unit + " .wpend")) tl.to(unit + " .wpend", { opacity: 0, duration: 0.2 }, at + fill);
  if (fail && back) {
    tl.to(back.querySelector(".fwd"), { opacity: 0, duration: 0.2 }, at + fill);
    tl.to(back.querySelector(".bk"), { opacity: 1, duration: 0.2 }, at + fill);
    tl.fromTo(back.querySelector(".bk"), { x: 12 }, { x: -12, duration: 0.4, repeat: 3, yoyo: true, ease: "sine.inOut", immediateRender: false }, at + fill);
  }
  if (fail) tl.to(unit + " .wfail", { opacity: 1, duration: 0.3 }, at + fill);
  else if (all(unit + " .wres")) tl.fromTo(unit + " .wres", { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.3, ease, immediateRender: false }, at + fill);
};
const enter = (sel, at, extra = {}) => tl.from(sel, Object.assign({ opacity: 0, y: 40, duration: 0.6, ease }, extra), at);
const b = (at, act, sel, value) => {
  if (act === "in") return tl.fromTo(sel, { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, duration: 0.35, ease }, at);
  if (act === "set") {
    tl.set(sel, { attr: { "data-s": value } }, at);
    return tl.fromTo(sel, { scale: 1.02 }, { scale: 1, duration: 0.35, ease, immediateRender: false }, at);
  }
  if (act === "fill") return tl.fromTo(sel, { "--fill": 0 }, { "--fill": 1, duration: 0.45, ease: "power1.inOut" }, at);
  if (act === "count") {
    const node = document.querySelector(sel);
    const n = { v: Number(node.textContent) };
    return tl.to(n, { v: value, duration: 1.2, ease: "power2.out", onUpdate: () => { node.textContent = String(Math.round(n.v)); } }, at);
  }
  if (act === "focus") {
    const scene = sel.split(" ")[0];
    tl.set(scene + " [data-zone]", { attr: { "data-focus": value.length ? "0" : "" } }, at);
    return value.forEach((one) => tl.set(scene + " " + one, { attr: { "data-focus": "1" } }, at));
  }
  if (act === "from") return tl.from(sel, Object.assign({ duration: 0.7, ease }, value), at);
  if (act === "fromto") return tl.fromTo(sel, value.from, Object.assign({ duration: 0.6, ease }, value.to), at);
  if (act === "to") return tl.to(sel, Object.assign({ duration: 0.6, ease }, value), at);
  if (act === "pulse") return tl.fromTo(sel, { scale: 1 }, { scale: 1.12, duration: 0.22, yoyo: true, repeat: 1, ease: "sine.inOut", immediateRender: false }, at);
  if (act === "shake") return tl.fromTo(sel, { x: 0 }, { x: -12, duration: 0.07, yoyo: true, repeat: 5, ease: "sine.inOut", immediateRender: false }, at);
  if (act === "flip") {
    tl.to(sel, { scaleX: 0, duration: 0.18, ease: "power1.in" }, at);
    tl.set(sel, { attr: { "data-s": value } }, at + 0.18);
    return tl.to(sel, { scaleX: 1, duration: 0.22, ease: "power1.out" }, at + 0.18);
  }
  if (act === "type") {
    const node = document.querySelector(sel);
    const typed = { n: 0 };
    return tl.to(typed, { n: value.length, duration: 0.035 * value.length, ease: "none", onUpdate: () => { node.textContent = value.slice(0, Math.round(typed.n)); } }, at);
  }
  if (act === "cap") {
    const scene = sel.split(" ")[0];
    if (value > 0) tl.fromTo(scene + ' [data-cap="' + (value - 1) + '"]', { opacity: 1 }, { opacity: 0, duration: 0.15, immediateRender: false }, at);
    return tl.fromTo(sel, { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, duration: 0.25, ease, immediateRender: false }, at);
  }
};
${script.join("\n")}
window.__timelines = window.__timelines || {};
window.__timelines["main"] = tl;
tl.seek(0);
</script></body></html>
`;
}

const STEP = 0.5;
const HOOK_STARTS_WITHIN = 2;
const LOUD_ABOVE_MEDIAN = 3;

/** The ending is the last stretch of a track before it falls silent, as long as the outro it opens: small, never louder than a hook. */
const ENDING_SECONDS = 4;
const SILENT_BELOW = -55;

/** Where a track is loud at its start (a hook, after at most two quiet seconds) and where its small
 * ending is, from its energy in dB per half second. Null when it has no hook: such a track is only
 * looped. */
function musicSections(rms) {
  const sorted = [...rms].sort((a, b) => a - b);
  const loud = (v) => v > sorted[Math.floor(sorted.length / 2)] + LOUD_ABOVE_MEDIAN;
  const first = rms.findIndex(loud);
  let end = first;
  while (end < rms.length && loud(rms[end])) end += 1;
  const tailEnd = (rms.map((v) => v > SILENT_BELOW).lastIndexOf(true) + 1) * STEP;
  const tailStart = tailEnd - ENDING_SECONDS;
  if (first < 0 || first * STEP > HOOK_STARTS_WITHIN || tailStart <= end * STEP) return null;
  return { headStart: first * STEP, headEnd: end * STEP, tailStart, tailEnd };
}

/** The hook whole from the start, so no phrase is cut where a short intro ends; the bed under the
 * scenes and the outro, the small ending last. */
function musicSegments(sections, { total }) {
  const head = { part: "head", from: sections.headStart, length: sections.headEnd - sections.headStart, at: 0 };
  const tail = { part: "tail", from: sections.tailStart, length: sections.tailEnd - sections.tailStart };
  tail.at = total - tail.length;
  const body = { part: "body", from: sections.headEnd, length: tail.at - head.length, at: head.length };
  return [head, body, tail];
}

function measureRms(source) {
  const run = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-loglevel", "error", "-i", source, "-af",
      "aresample=48000,asetnsamples=n=24000:p=0,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-",
      "-f", "null", "-"],
    { encoding: "utf8" }
  );
  return [...run.stdout.matchAll(/RMS_level=(-?[\d.]+|-inf)/g)].map((m) => (m[1] === "-inf" ? -100 : Number(m[1])));
}

const ffmpeg = (args) => {
  const run = spawnSync("ffmpeg", ["-loglevel", "error", "-y", ...args], { stdio: "inherit" });
  if (run.status !== 0) throw new Error(`ffmpeg failed (${run.status})`);
};

/** The track shaped to the video: its hook under the intro, its bed looped under the scenes and the
 * outro, its small ending closing the video. A track with no such structure is only looped to the video's length. */
function fitMusic(source, target, plan) {
  const total = totalDuration(plan);
  const sections = musicSections(measureRms(source));
  if (!sections) {
    ffmpeg(["-stream_loop", "-1", "-i", source, "-t", String(total), "-c:a", "libmp3lame", "-q:a", "2", target]);
    return;
  }
  const [head, body, tail] = musicSegments(sections, { total });
  const bed = sections.tailStart - sections.headEnd;
  const cut = (seg, label, fades) =>
    `[0:a]aresample=48000,atrim=start=${seg.from}:duration=${seg.length},asetpts=PTS-STARTPTS${fades}[${label}]`;
  const loopedBed =
    `[0:a]aresample=48000,atrim=start=${body.from}:duration=${Math.min(bed, body.length)},asetpts=PTS-STARTPTS,` +
    `aloop=loop=-1:size=${Math.ceil(bed * 48000)},atrim=duration=${body.length},asetpts=PTS-STARTPTS[b]`;
  const filter = [
    cut(head, "h", `,afade=t=in:d=0.05`),
    loopedBed,
    cut(tail, "t", `,afade=t=in:d=0.05`),
    `[h][b][t]concat=n=3:v=0:a=1,apad=whole_dur=${total},atrim=duration=${total}[a]`,
  ].join(";");
  ffmpeg(["-i", source, "-filter_complex", filter, "-map", "[a]", "-c:a", "libmp3lame", "-q:a", "2", target]);
}

/** What a Hyperframes project needs around its page: the fonts, the logo and the project files. */
function writeShell(dir) {
  fs.mkdirSync(path.join(dir, "assets"), { recursive: true });
  fs.cpSync(path.join(__dirname, "fonts"), path.join(dir, "assets/fonts"), { recursive: true });
  fs.copyFileSync(path.join(__dirname, "logo.png"), path.join(dir, "assets/logo.png"));
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ name: "release-video", private: true, type: "module" })
  );
  fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify({ id: "release-video", name: "release-video" }));
  fs.writeFileSync(path.join(dir, "hyperframes.json"), JSON.stringify({ paths: { assets: "assets" } }));
}

function writeProject(dir, plan, version, musicSource) {
  writeShell(dir);
  let music;
  if (musicSource) {
    music = "assets/music-fit.mp3";
    fitMusic(musicSource, path.join(dir, music), plan);
  }
  const sfx = "assets/sfx.wav";
  fs.writeFileSync(path.join(dir, sfx), soundTrack(plan, { version }));
  fs.writeFileSync(path.join(dir, "index.html"), buildHtml(plan, { version, music, sfx }));
}

async function fetchAvatars(dir, plan) {
  const logins = plan.scenes.flatMap((s) => s.logins ?? []);
  for (const login of new Set(logins)) {
    const target = path.join(dir, "assets", `av-${login}.png`);
    const response = await fetch(`https://github.com/${encodeURIComponent(login)}.png?size=240`);
    if (response.ok) {
      fs.writeFileSync(target, Buffer.from(await response.arrayBuffer()));
    } else {
      console.warn(`⚠️ Avatar of ${login}: HTTP ${response.status}, logo used`);
      fs.copyFileSync(path.join(dir, "assets", "logo.png"), target);
    }
  }
}

/** The logos a plan names from the pinned icon set. */
async function fetchMedia(dir, plan) {
  const { logos } = mediaOf(plan);
  for (const logo of logos) {
    const response = await fetch(`${LOGO_SET}/${encodeURIComponent(logo)}.svg`);
    if (!response.ok) throw new Error(`Logo ${logo}: HTTP ${response.status}`);
    fs.writeFileSync(path.join(dir, "assets", `logo-${logo}.svg`), Buffer.from(await response.arrayBuffer()));
  }
}

function argument(name) {
  const at = process.argv.indexOf(`--${name}`);
  return at > -1 ? process.argv[at + 1] : undefined;
}

async function main() {
  const version = argument("version");
  if (!version) throw new Error("Usage: render-release-video.cjs --version <x.y> [--plan <file>] [--music <file>] [--out <file>]");
  const plan = JSON.parse(fs.readFileSync(path.resolve(argument("plan") ?? PLAN), "utf8"));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "release-video-"));

  const kitMusic = path.join(__dirname, "music.mp3");
  const musicSource = argument("music") ?? (fs.existsSync(kitMusic) ? kitMusic : undefined);
  writeProject(dir, plan, version, musicSource);
  await fetchAvatars(dir, plan);
  await fetchMedia(dir, plan);

  const render = spawnSync("npx", ["--yes", HYPERFRAMES, "render", "--output", "release-video.mp4"], {
    cwd: dir,
    stdio: "inherit",
  });
  if (render.status !== 0) throw new Error(`Hyperframes render failed (${render.status})`);

  const out = path.resolve(argument("out") ?? "release-video.mp4");
  fs.copyFileSync(path.join(dir, "release-video.mp4"), out);
  console.log(`✅ ${out}`);

  const still = fs.mkdtempSync(path.join(os.tmpdir(), "release-thumbnail-"));
  writeShell(still);
  fs.writeFileSync(path.join(still, "index.html"), thumbnailHtml(plan, { version }));
  // A lossless frame at full size: an encoded and downscaled one blurs the logo and the type.
  const stillRender = spawnSync("npx", ["--yes", HYPERFRAMES, "render", "--format", "png-sequence", "--output", "frames"], { cwd: still, stdio: "inherit" });
  if (stillRender.status !== 0) throw new Error(`Hyperframes render of the thumbnail failed (${stillRender.status})`);
  const [first] = fs.readdirSync(path.join(still, "frames")).filter((f) => f.endsWith(".png")).sort();
  if (!first) throw new Error("The thumbnail render wrote no frame");
  const thumbnail = out.replace(/\.mp4$/, ".png");
  fs.copyFileSync(path.join(still, "frames", first), thumbnail);
  console.log(`✅ ${thumbnail}`);

  const probe = spawnSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=bit_rate", "-of", "csv=p=0", out], { encoding: "utf8" });
  const bitrate = Number(probe.stdout.trim());
  if (!bitrate) throw new Error("The bitrate of the video could not be read");
  const posted = out.replace(/\.mp4$/, ".poster.mp4");
  const withPoster = spawnSync("ffmpeg", posterArgs({ video: out, poster: thumbnail, out: posted, bitrate, duration: totalDuration(plan) }), { stdio: "inherit" });
  if (withPoster.status !== 0) throw new Error(`The thumbnail could not be put first (${withPoster.status})`);
  fs.renameSync(posted, out);
}

/** The picture a video is announced with, drawn as its own still composition rather than taken from a frame
 * of the video: the logo, the release and the whole version, then the themes. */
function thumbnailHtml(plan, { version }) {
  const [major, minor = ""] = String(version).split(".");
  const themes = plan.youtube?.themes ?? [];
  const inner =
    `<img id="intro-logo" src="assets/logo.png" alt="" /><div class="intro-text">` +
    `<div class="intro-top"><span class="pill">AIDD Framework</span><span class="rel">NEW RELEASE</span></div>` +
    `<div id="ver"><span id="ver-t">v${esc(major)}</span><span class="dot">${minor ? "." : ""}</span><span id="ver-n">${esc(minor)}</span></div>` +
    (themes.length ? `<p class="themes">${themes.map(esc).join(" · ")}</p>` : "") +
    `</div>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=1920, height=1080" />
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>${CSS}</style></head>
<body><div id="root" data-composition-id="main" data-start="0" data-duration="1" data-width="1920" data-height="1080">
<section id="thumb" class="scene clip" data-start="0" data-duration="1" data-track-index="0"><div class="inner">${inner}</div></section>
</div>
<script>
window.__timelines = window.__timelines || {};
window.__timelines["main"] = gsap.timeline({ paused: true });
</script></body></html>
`;
}

/** Discord refuses a bot upload over 10 MiB on a guild without boosts: the video stays under 9 MiB, sound included. */
const SIZE_BUDGET_BYTES = 9 * 1024 * 1024;
const AUDIO_KBPS = 128;

/** The video opens on its thumbnail for one frame: a chat shows a video's first frame as its preview, and the
 * intro starts on the bare background. The video is encoded again at its own bitrate, lowered when that would take
 * it over the size budget, and its sound is delayed by that frame. */
function posterArgs({ video, poster, out, bitrate, duration }) {
  const budget = duration ? Math.floor((SIZE_BUDGET_BYTES * 8) / duration / 1000) - AUDIO_KBPS : Infinity;
  const kbps = Math.min(Math.round(bitrate / 1000), budget);
  return [
    "-y", "-v", "error",
    "-loop", "1", "-framerate", "30", "-t", "0.0334", "-i", poster,
    "-i", video,
    "-filter_complex",
    "[0:v]scale=1920:1080:out_color_matrix=bt709:out_range=tv,setsar=1,fps=30,format=yuv420p[p];[1:v]setsar=1,fps=30,format=yuv420p[v];[p][v]concat=n=2:v=1:a=0[vo];[1:a]adelay=34|34[ao]",
    "-map", "[vo]", "-map", "[ao]",
    "-c:v", "libx264", "-profile:v", "high", "-b:v", `${kbps}k`, "-maxrate", `${Math.round(kbps * 1.25)}k`, "-bufsize", `${kbps * 2}k`, "-preset", "slow",
    // At the video's mean bitrate x264 starves the poster and the intro's fade, and the opening looks blocky: the first
    // second and a half gets a quality of its own.
    "-x264-params", "zones=0,45,q=12",
    "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
    "-c:a", "aac", "-b:a", `${AUDIO_KBPS}k`, "-movflags", "+faststart",
    out,
  ];
}

module.exports = { buildHtml, sceneBeats, mediaOf, measureRms, musicSections, musicSegments, sceneDuration, soundCues, posterArgs, soundTrack, thumbnailHtml, totalDuration };

if (require.main === module) {
  main().catch((error) => {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  });
}
