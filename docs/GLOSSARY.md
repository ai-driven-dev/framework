# Glossary

Plain definitions for the words used across this framework. Read this once - every other doc assumes you know these terms and links back here instead of re-explaining them.

## Plugin

A folder of related features you install into your AI tool, like an app from an app store. Example: `aidd-dev` bundles everything for planning, writing, and reviewing code. Each plugin updates and versions on its own.

## Marketplace

A GitHub repository that lists installable plugins. Running `/plugin marketplace add ai-driven-dev/framework` tells Claude Code to read this repo's plugin list, so you can install from it. This repo (`aidd-framework`) is one marketplace among possibly several you register.

## Skill

One workflow inside a plugin, for example "write a commit message" or "review this diff." You trigger it by describing what you want in plain language, or by naming it directly, for example `aidd-vcs:01-commit` (format: `plugin:NN-name`).

## Action

A single step inside a skill. You never call an action directly - the skill picks the right one(s) for your request.

## Agent

A separate AI worker that a skill can dispatch for one focused sub-task, for example writing the code for one part of a plan. It works in its own space and reports back only a result. Today, agents ship only in `aidd-dev`.

## Rule

A coding standard your AI tool applies automatically while it writes code, for example "always add tests for new functions." Rules describe *how* to write code; skills describe *what* to do.

## Hook

Automation that runs at a specific moment, like right after a commit, without the AI needing to remember to trigger it.

## Memory bank

Project-specific files under `aidd_docs/memory/` (architecture, conventions, decisions) that your AI tool reads at the start of every conversation, so it always has the right context. Built and refreshed by the `aidd-context` plugin.

## Router-based skill

The technical pattern behind every skill here: a small entry file (`SKILL.md`) reads your request and picks which action(s) to run, carrying no logic itself. You do not need this to *use* the framework - it matters when you build your own skill; see [`CREATE_PLUGIN.md`](CREATE_PLUGIN.md).

## Bracket ID

A short tag like `[2.1]` used in a plugin's Skills table to reference a specific skill (here, `aidd-dev:01-plan`) without spelling out the full name each time.

## See also

- [`../README.md`](../README.md) - overview, plugin list, install steps.
- [`ARCHITECTURE.md`](ARCHITECTURE.md) - how plugins, skills, and agents fit together.
