# Changelog

## [1.0.0](https://github.com/ai-driven-dev/aidd-framework/compare/aidd-dev-v1.0.0...aidd-dev-v1.0.0) (2026-05-19)


### Features

* **aidd-dev:** add 02-implement skill, renumber downstream skills ([16fa5d6](https://github.com/ai-driven-dev/aidd-framework/commit/16fa5d61cac55f5e8223cb55ce9e213dfcb7fdb6))
* **aidd-dev:** add interactive mode to 00-sdlc orchestrator ([8f9e245](https://github.com/ai-driven-dev/aidd-framework/commit/8f9e245cf390f16906516e9a1ea4a5d77fdef2f7))
* **aidd-dev:** centralize agents ([7f77514](https://github.com/ai-driven-dev/aidd-framework/commit/7f7751407972c63accbf352b1a44f5ba89269757))
* **aidd-dev:** enhance pre-flight checklist with user input markers for unresolved dependencies ([a8f41c6](https://github.com/ai-driven-dev/aidd-framework/commit/a8f41c645c3eb3a7aaad171a2d16062a85be1a5c))
* **aidd-dev:** migrate commands to numbered actions ([8ef0f8e](https://github.com/ai-driven-dev/aidd-framework/commit/8ef0f8ed4349f77702d5f07704085382ce831e2a))
* **aidd-dev:** scan rules and project files modifications in plan template ([0509421](https://github.com/ai-driven-dev/aidd-framework/commit/05094211fc6f79cd033c08a3409d3b494e3fd8ce))
* **aidd-orchestrator:** branch enforcement, comment passthrough, skip routing ([4d3acc8](https://github.com/ai-driven-dev/aidd-framework/commit/4d3acc85713aa9f7a45c80db9ae2e571d76c69bb))
* **aidd-orchestrator:** branch enforcement, comment passthrough, skip routing ([3a5cec0](https://github.com/ai-driven-dev/aidd-framework/commit/3a5cec08dbed819472de85c933ab021ee0854855))
* **framework:** delete legacy commands/ directory ([dac60bb](https://github.com/ai-driven-dev/aidd-framework/commit/dac60bbb7c953abadf19f0cb239987c81c006376))
* **framework:** migrate 5 pre-refactored skills into plugins ([da2987c](https://github.com/ai-driven-dev/aidd-framework/commit/da2987c7c281d3b087e6c09f5079decf7e066bd2))
* **framework:** refactor to marketplace plugin architecture and skills ([27128a9](https://github.com/ai-driven-dev/aidd-framework/commit/27128a96314904b7b57b0bc419e4d29b7a7edaf0))
* **framework:** relocate templates and conventions into skill assets ([6920182](https://github.com/ai-driven-dev/aidd-framework/commit/692018202f84cd6f5d885f5737f305f77f79ac5f))
* **framework:** scaffold 4-plugin marketplace catalog ([7be5466](https://github.com/ai-driven-dev/aidd-framework/commit/7be5466ae78f432a5477a6f35d23cbff56b7f2df))
* **framework:** split MCP and SessionStart hook into plugins ([527f9b8](https://github.com/ai-driven-dev/aidd-framework/commit/527f9b8c13ea1c7e45b277218569e6881559cadc))
* **framework:** update build script for plugin layout and regenerate catalogs ([ea18188](https://github.com/ai-driven-dev/aidd-framework/commit/ea1818850a6c9d8b39de2aa5bae2b6ecf6741ddd))
* update agent descriptions for clarity and role specificity in CATALOG and agent files ([eabaf0f](https://github.com/ai-driven-dev/aidd-framework/commit/eabaf0f27e7764fb6f16f8d30f1ebf98cdc62dfa))


### Bug Fixes

* **aidd-dev:** enforce skill-in-agent rule — orchestrator never loads skills directly ([8957d1d](https://github.com/ai-driven-dev/aidd-framework/commit/8957d1dc4e2844128eb8ea8ceb68c27cbe41af28))
* **framework:** correct slash command naming in docs ([adad60a](https://github.com/ai-driven-dev/aidd-framework/commit/adad60aacaa120f3abf55100625bed7a3a87a50a))
* **framework:** repair broken @-paths, stale skill ref, and Ressources typo across plugins ([558bb34](https://github.com/ai-driven-dev/aidd-framework/commit/558bb347a6358240556e6c27d0ec09ff4b443bc0))
* **framework:** wire SDLC contracts — namespace, plan paths, commit modes, validator semantics ([f5f14e0](https://github.com/ai-driven-dev/aidd-framework/commit/f5f14e01c6bb4a8c7952b6241b89a50816f636a6))


### Miscellaneous

* **ci:** SHA-pin every external action and add CodeQL workflow ([66d5fcf](https://github.com/ai-driven-dev/aidd-framework/commit/66d5fcf99776df2885a84b2ef70943ff63099748))
* **framework:** adopt release-please monorepo with per-plugin versioning ([9706606](https://github.com/ai-driven-dev/aidd-framework/commit/9706606207f1474033fb9b73ce089636362616c9))
* **framework:** bulk alignment — evals everywhere, em-dash purge, audit template, stale refs fixed ([0dfd79d](https://github.com/ai-driven-dev/aidd-framework/commit/0dfd79dac5ce7f15194b4aa9b58b5dd61fdf14b6))
* **framework:** bump aidd-pm to 1.0.0 and apply audit fixes ([97573bc](https://github.com/ai-driven-dev/aidd-framework/commit/97573bcf1b7624f6cf1acaa62791b9cdbe1b237b))
* **framework:** bump marketplace to 4.0.0 and refresh aidd-dev SDLC docs ([073a4a6](https://github.com/ai-driven-dev/aidd-framework/commit/073a4a617f08841d950ae0d5ebd3b45fdcbb0f93))
* **framework:** disable proposed MCP servers by default ([785293b](https://github.com/ai-driven-dev/aidd-framework/commit/785293b45eea542712031e326c18ac7454068cbf))
* **framework:** merge feat/plugin-content-tool-agnostic ([11cce19](https://github.com/ai-driven-dev/aidd-framework/commit/11cce1963826a1ed3e28837b9ccee8ed11fe2229))
* **framework:** merge origin/feat/plugin-architecture ([0082b4c](https://github.com/ai-driven-dev/aidd-framework/commit/0082b4cc7916fca6e3060362a0ce762c155a0e19))
* **framework:** regenerate aidd-dev CATALOG.md after merge ([0639dc0](https://github.com/ai-driven-dev/aidd-framework/commit/0639dc0c5f8372ad6a238961cbf64ac3b2756ded))
* **framework:** regenerate plugin catalogs after aidd-context audit ([7b5907a](https://github.com/ai-driven-dev/aidd-framework/commit/7b5907ac00bc661b7ce0bd66f335d6980badfa31))
* **framework:** regenerate plugin catalogs after audit sweep ([448b111](https://github.com/ai-driven-dev/aidd-framework/commit/448b111662335197c9e4e415db391fc4e8d5c79f))
* **framework:** release as 4.0.0 ([5b0fc9d](https://github.com/ai-driven-dev/aidd-framework/commit/5b0fc9d9116e37abe7ef5dbb5d06438f607475e8))
* **framework:** self-host summarize-markdown.mjs for per-plugin CATALOG ([ee62862](https://github.com/ai-driven-dev/aidd-framework/commit/ee6286237d3b1b97ebaf67aa68f8152015d61e90))
* **framework:** trigger ci recheck after history rewrite ([391760e](https://github.com/ai-driven-dev/aidd-framework/commit/391760e19eb69fe80e098c3aefc3c527cda2169a))
* **framework:** wave 1 audit fixes (schemas, gitignore, dependabot, links) ([4bcb670](https://github.com/ai-driven-dev/aidd-framework/commit/4bcb67069cd7af57f2a73fb55e19d89a583e2e7d))


### Documentation

* **aidd-dev:** drop stale reference to 05-ship precondition in SDLC rule ([69853d7](https://github.com/ai-driven-dev/aidd-framework/commit/69853d70d51e4e36713306d92c52e30268909392))
* **framework:** add per-plugin CATALOG.md (auto-generated) ([d613282](https://github.com/ai-driven-dev/aidd-framework/commit/d61328242639bb77909055019629b1da3891bffc))
* **framework:** rewrite for plugin marketplace model ([9529d4c](https://github.com/ai-driven-dev/aidd-framework/commit/9529d4cbc8fef430354300e2bfcd8bff526c67a2))
* **framework:** sync READMEs and CATALOGs with current skills ([16c9372](https://github.com/ai-driven-dev/aidd-framework/commit/16c937268b27a6e80f4077da4989003be5d9d186))
* phase 1 critical audit fixes (skill invocations, catalog, templates) ([5b5342b](https://github.com/ai-driven-dev/aidd-framework/commit/5b5342b890ae0be4eb8302fd36e5a4d8882b9cbb))
* phase 3 medium/low audit fixes (OSS scaffolding, UX, accuracy) ([5e43650](https://github.com/ai-driven-dev/aidd-framework/commit/5e436502d7632b377f73129cfb73d312c3eea9ce))
* propagate per-skill README pattern across all plugins ([4427e3e](https://github.com/ai-driven-dev/aidd-framework/commit/4427e3ee7c096d03f7d7b30d418f3484e9d0541a))
* scrub cross-plugin references from skill READMEs ([9c23973](https://github.com/ai-driven-dev/aidd-framework/commit/9c2397396c16a80a04f66991a2ae6bd92dcce5d0))


### Refactoring

* **aidd-context:** restructure project init ([da90ed8](https://github.com/ai-driven-dev/aidd-framework/commit/da90ed8ac6c53aff7d1fae6d49477f4b1089a029))
* **aidd-dev:** restructure 00-sdlc as router with 5 atomic actions ([b9653b7](https://github.com/ai-driven-dev/aidd-framework/commit/b9653b75f8ba37e7c8fc1088ec393ce71e90d75d))
* **aidd-dev:** rewrite SDLC as pure orchestrator with role-based agents ([dbc6edd](https://github.com/ai-driven-dev/aidd-framework/commit/dbc6edd360256154a14a82fb206b301b77684822))
* **aidd-orchestrator:** observe-reality + YAML-owned lifecycle ([5b64b4a](https://github.com/ai-driven-dev/aidd-framework/commit/5b64b4aef9cb77898244ca8c81d539bc46473760))
* **aidd-orchestrator:** observe-reality verification + YAML-owned lifecycle ([d193b99](https://github.com/ai-driven-dev/aidd-framework/commit/d193b9935a5a8d318c6432aa1d587793c9d7114f))
* **framework:** align sdlc orchestrator and sub-skills around alex baseline ([92535cd](https://github.com/ai-driven-dev/aidd-framework/commit/92535cdf285effeee4cba9027dd7fd6a88c8c737))
* **framework:** canonical action shape, model-A rules, plugin audit sweep ([29ef579](https://github.com/ai-driven-dev/aidd-framework/commit/29ef579a683302c28f23de383acc1912ebcfe01e))
* **framework:** make content tool-agnostic and self-contained ([84165a9](https://github.com/ai-driven-dev/aidd-framework/commit/84165a917c9c36b6bca10599e9f4699908bd79ba))
* **framework:** remove embedded skill content for distribution-mode migration ([ee43a32](https://github.com/ai-driven-dev/aidd-framework/commit/ee43a323505791ffb7d41395539c7bc665e8a6c5))
* **framework:** rename skill folders from [X.X] to NN-name format ([c8968bc](https://github.com/ai-driven-dev/aidd-framework/commit/c8968bc79dd7f24976392a6bce0c7f30c35b2ede))
* **framework:** unify plan/status/tracking into living plan template ([180c504](https://github.com/ai-driven-dev/aidd-framework/commit/180c5047750f5aaf6093c425cec9ce6657ca3ad9))
