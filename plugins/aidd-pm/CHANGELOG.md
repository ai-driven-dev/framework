# Changelog

## [2.7.0](https://github.com/ai-driven-dev/framework/compare/aidd-pm-v2.6.1...aidd-pm-v2.7.0) (2026-11-26)


### Features

* **framework:** check every heading level of a template, not only level 2 ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([729c4a4](https://github.com/ai-driven-dev/framework/commit/729c4a45ade6cb457f22e0061cae0e6e18464112))
* **framework:** check framework content through contracts ([8922b9b](https://github.com/ai-driven-dev/framework/commit/8922b9be53cd946e09edf45d34a46a92d128cc29))
* **framework:** check written artifacts at turn end in plugins ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([2a3a53c](https://github.com/ai-driven-dev/framework/commit/2a3a53ce801c3f96d8da8e9de75247d8e4f1c4d1))
* **framework:** check written artifacts at turn end with a generated hook ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([aaf834c](https://github.com/ai-driven-dev/framework/commit/aaf834cfa352c5f1defb17884db54bcc12efcf29))
* **framework:** contracts declare the user-project scope of their artifacts ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([0164472](https://github.com/ai-driven-dev/framework/commit/0164472e77f7206799e597d2c0c39ad8014744e6))
* **framework:** file contracts report the real file and line of each hit ([34bb45f](https://github.com/ai-driven-dev/framework/commit/34bb45f5ca0095995150fd6d223657b4cde2a291))
* **framework:** skill rules replace name, link and sibling tests ([ab0bde0](https://github.com/ai-driven-dev/framework/commit/ab0bde0bbe90b1cd269935da0231d8e814bd3ab1))
* **framework:** validate manifests, marketplace and settings against the official schemas ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([629cd4d](https://github.com/ai-driven-dev/framework/commit/629cd4d0d67b587acad13ca46c13bf3fd5557f56))
* **framework:** validate rules, commands, stories and hook configs against contracts ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([b3e842c](https://github.com/ai-driven-dev/framework/commit/b3e842c0d0267e1d0dd3e941cfea202ce3bcc3c0))
* **scripts:** judge skills, agents and commands a shell command names ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([bf542c0](https://github.com/ai-driven-dev/framework/commit/bf542c06ecd23baa4222b9ab4bf034793d836f64))


### Bug Fixes

* **framework:** align five templates with what their writers produce ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([286b619](https://github.com/ai-driven-dev/framework/commit/286b6192ae7a64105715c3d13aed6a99c444d8f0))
* **framework:** keep each plugin's artifact hook state apart and survive bad entries ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([5c25dfe](https://github.com/ai-driven-dev/framework/commit/5c25dfe52b506d579d175e82005be017668a4809))
* **framework:** let a contract with no rules run ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([34482f6](https://github.com/ai-driven-dev/framework/commit/34482f60cb86ecffd4d439d3c9bf3774e6ce1b0a))
* **framework:** make artifact hook findings fixable on every host ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([de8c519](https://github.com/ai-driven-dev/framework/commit/de8c519c53089ea3fd268782dfe388b29ec81260))
* **framework:** mark the remaining template slots as {{...}} ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([bb11a8d](https://github.com/ai-driven-dev/framework/commit/bb11a8dfb09fc1ffec0165a461da38bf7bbc5815))
* **framework:** run repo-wide contracts when a scoped file is one they read ([382362f](https://github.com/ai-driven-dev/framework/commit/382362f84246768ccbcb4d92aac66daa781bb797))
* **framework:** show a slotted heading as a fill-in in its finding ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([0a0ecd9](https://github.com/ai-driven-dev/framework/commit/0a0ecd9066565fccbf72641ad743261c834911ff))
* **framework:** skip install-written artifacts in the shell scan and cap the Stop answer ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([81daa38](https://github.com/ai-driven-dev/framework/commit/81daa38d3b120ce5fdef3affcc2be6d28629d08b))
* **framework:** walk each artifact scope once at turn end ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([96d8b96](https://github.com/ai-driven-dev/framework/commit/96d8b96005daacc29b34da17a4acaa0b803053ca))
* **framework:** word a slotted missing heading as a shape, reset stack on 2nd title ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([30dbace](https://github.com/ai-driven-dev/framework/commit/30dbace4016bc4b935dc0b1a5271bd0229727662))
* **scripts:** make the unknown heading fix one instruction ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([2e2e849](https://github.com/ai-driven-dev/framework/commit/2e2e8498f353b42ff0358d5b2178f41b7335d300))
* **scripts:** say where an unknown template heading belongs ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([2a5e16a](https://github.com/ai-driven-dev/framework/commit/2a5e16a4ee33055d98b46f2bc6f78e02b7158b3c))


### Miscellaneous

* **framework:** merge feat/1149-artifact-hook ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([78e439e](https://github.com/ai-driven-dev/framework/commit/78e439e8e5cfdef47184869cd67dbc940fdc4e05))
* **framework:** merge feat/1149-artifact-hook ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([0bf6668](https://github.com/ai-driven-dev/framework/commit/0bf6668b35193985f0bef0b878e489d968f8edeb))
* **framework:** merge feat/1149-artifact-hook fix and finish the review notes ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([0306a19](https://github.com/ai-driven-dev/framework/commit/0306a19a4db20d9bd16a53b162744b7410fae4da))
* **framework:** merge feat/1149-artifact-hook into 1149-dev-contracts ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([e4b357a](https://github.com/ai-driven-dev/framework/commit/e4b357a97982e5d0db7d881bb5fcd432073eae3d))
* **framework:** merge feat/1149-artifact-hook into feat/1149-dev-contracts ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([91f67b6](https://github.com/ai-driven-dev/framework/commit/91f67b6eec40c2e0b216baea4b5405ae3c958240))
* **framework:** merge feat/1149-artifact-hook into feat/1149-dev-contracts ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([c893f72](https://github.com/ai-driven-dev/framework/commit/c893f7279e719fb6e2e354bc38acc69891c13f90))
* **framework:** merge feat/1149-artifact-hook into feat/1149-dev-contracts ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([92a2713](https://github.com/ai-driven-dev/framework/commit/92a2713f4308ea9a399c9669c1e3a539d0d74002))
* **framework:** merge feat/1149-contract-validation fix ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([24b504a](https://github.com/ai-driven-dev/framework/commit/24b504a00a06a8317f44c3af3e96ddbfcd4fb20f))
* **framework:** merge feat/1149-contract-validation into 1165-run-in-hooks ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([95c2fdf](https://github.com/ai-driven-dev/framework/commit/95c2fdfd6d7b3754bf796b957d40d986a6d147d5))
* **framework:** merge feat/1149-contract-validation into feat/1165-run-in-hooks ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([77ff1f4](https://github.com/ai-driven-dev/framework/commit/77ff1f4083719f9847904bdecbfeba2d28bd8fe8))
* **framework:** merge feat/1149-contract-validation into feat/1165-run-in-hooks ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([d38cb90](https://github.com/ai-driven-dev/framework/commit/d38cb90ba2d5f4fac910488e1947403a6c9a3733))
* **framework:** merge feat/1149-contract-validation into feat/1165-run-in-hooks ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([362cbd9](https://github.com/ai-driven-dev/framework/commit/362cbd93b00baf8360fb53ee8f951a7e32403104))
* **framework:** merge feat/1165-run-in-hooks ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([653669b](https://github.com/ai-driven-dev/framework/commit/653669b9e00a5f000b86e6fb803561c6ba920f6b))
* **framework:** merge feat/1165-run-in-hooks fix ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([90b76ad](https://github.com/ai-driven-dev/framework/commit/90b76ad47edf6a0e8017aa6b85c5b5d92564e152))
* **framework:** merge feat/1165-run-in-hooks into 1149-artifact-hook ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([6afd0fb](https://github.com/ai-driven-dev/framework/commit/6afd0fb1373411ac49502a5b98b411344ab9a11b))
* **framework:** merge feat/1165-run-in-hooks into feat/1149-artifact-hook ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([6f8e939](https://github.com/ai-driven-dev/framework/commit/6f8e939db6e2ddbec52e1dad0ad110af3562dcad))
* **framework:** merge feat/1165-run-in-hooks into feat/1149-artifact-hook ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([a6578b3](https://github.com/ai-driven-dev/framework/commit/a6578b3b2de16c980549a174e2d5abe5c2a31640))
* **framework:** merge feat/1165-run-in-hooks into feat/1149-artifact-hook ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([e4a6220](https://github.com/ai-driven-dev/framework/commit/e4a6220d75533404e7fcfc22e1ee7faab4332e9b))
* **framework:** sync contract ops copies ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([eb5b35f](https://github.com/ai-driven-dev/framework/commit/eb5b35fc84af24fc38e225b09378711f896bbfdf))
* **scripts:** re-sync engine copies ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([54e0725](https://github.com/ai-driven-dev/framework/commit/54e0725a0d10f000958e071198cd631ef58548c8))
* **scripts:** re-sync engine copies ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([909bc3b](https://github.com/ai-driven-dev/framework/commit/909bc3b6ddb634dbe617b1eff0af4f2752ffa9f7))


### Documentation

* **aidd-context:** word the validate step the same in every skill ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([f94654a](https://github.com/ai-driven-dev/framework/commit/f94654a095555005c3a3e7774682263b8f5ac757))
* **framework:** bound the validate loops and note baseline renames ([e40f4eb](https://github.com/ai-driven-dev/framework/commit/e40f4eba998d0999ff452972499bd8131c3adc0e))
* **framework:** mark every template slot as {{…}} ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([04119a5](https://github.com/ai-driven-dev/framework/commit/04119a5f9b8d2b91fbff6b8f1f721c1993e0b0c0))


### Refactoring

* **aidd-refine:** give shadow-areas a router, a report contract and one home per fact ([e4c1d4f](https://github.com/ai-driven-dev/framework/commit/e4c1d4f5cfa2817e97bc9e632f76c54fbca78ffe))
* **framework:** drop the unused scaffold engine file and its copies ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([54024d3](https://github.com/ai-driven-dev/framework/commit/54024d3fe314eb844c077c4a528a92d26fa1b9aa))
* **framework:** drop unused engine options and tighten contract loading ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([ab232ba](https://github.com/ai-driven-dev/framework/commit/ab232ba19d67f78b492e8b96214f69843f1d6143))
* **framework:** leave the continuation Stop guard to the host adapter ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([8b69f1e](https://github.com/ai-driven-dev/framework/commit/8b69f1e183e278246ea350807db94158e3cfa2ba))
* **framework:** match watch globs with the engine's glob ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([a4a3199](https://github.com/ai-driven-dev/framework/commit/a4a319955aeae0268c0de555f903fbc1a6cf0d7a))
* **framework:** move contract checks to scripts/check, contracts name their targets ([422923f](https://github.com/ai-driven-dev/framework/commit/422923f44849fb9910e7a4b542b9da5f36c6c491))
* **framework:** one hook engine per plugin, sync writes host.cjs ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([f6f68b5](https://github.com/ai-driven-dev/framework/commit/f6f68b57fd67508c31046d145cca5b090d4b681f))
* **framework:** surface crashes, tidy the engine, rename contract files ([972cbb1](https://github.com/ai-driven-dev/framework/commit/972cbb1979cb6f9d6628e859edb22a8e5ea106de))
* **scripts:** drop the dead retired key from the contract engine ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([1fb2a6f](https://github.com/ai-driven-dev/framework/commit/1fb2a6facb0dc2adb3827182110e90a3479a8cf6))

## [2.6.1](https://github.com/ai-driven-dev/framework/compare/aidd-pm-v2.6.0...aidd-pm-v2.6.1) (2026-11-13)


### Documentation

* rewrite the documentation set by audience ([#1131](https://github.com/ai-driven-dev/framework/issues/1131)) ([b90bffa](https://github.com/ai-driven-dev/framework/commit/b90bffada166c69f4e3952dd5e56abfcad540264))

## [2.6.0](https://github.com/ai-driven-dev/framework/compare/aidd-pm-v2.5.0...aidd-pm-v2.6.0) (2026-10-16)


### ⚠ BREAKING CHANGES

* the aidd telemetry commands, the aidd-telemetry hooks and skills, backlog-link.json and the AIDD-Session-Id commit trailer are removed; measurement returns, for Claude Code first, later on this branch.

### Features

* **telemetry:** deterministic claude code token measurement, release 1 ([#993](https://github.com/ai-driven-dev/framework/issues/993)) ([0a103e6](https://github.com/ai-driven-dev/framework/commit/0a103e6725cd9619a861d1ec3136b7534edabae3))


### Bug Fixes

* **aidd-pm:** give a spec gap one home, and refuse only one written elsewhere ([#969](https://github.com/ai-driven-dev/framework/issues/969)) ([22c541a](https://github.com/ai-driven-dev/framework/commit/22c541a70b9829305863a4c38ecac931b2914274))
* **cli:** preserve noninteractive git fetches with simple-git v4 ([4ffbc0a](https://github.com/ai-driven-dev/framework/commit/4ffbc0a2f96a679b403d5eaa3f9c74c36bc5138e))


### Documentation

* delete the cost-report and metrics contracts and aidd_docs/runs/, rewrite ([0a103e6](https://github.com/ai-driven-dev/framework/commit/0a103e6725cd9619a861d1ec3136b7534edabae3))

## [2.5.0](https://github.com/ai-driven-dev/framework/compare/aidd-pm-v2.4.2...aidd-pm-v2.5.0) (2026-09-09)


### Features

* **framework:** measurement that works on five tools, each proven by a session that ran ([#706](https://github.com/ai-driven-dev/framework/issues/706)) ([627408f](https://github.com/ai-driven-dev/framework/commit/627408fba964b30d22b57fc99241083da1e0f294))


### Miscellaneous

* back-merge main into next (conflicts) ([#641](https://github.com/ai-driven-dev/framework/issues/641)) ([7d2d390](https://github.com/ai-driven-dev/framework/commit/7d2d390057c2e93f5160f068d038adf306405a17))

## [2.4.2](https://github.com/ai-driven-dev/framework/compare/aidd-pm-v2.4.1...aidd-pm-v2.4.2) (2026-08-14)


### Refactoring

* **aidd-pm:** migrate ticket-info, prd, and spec to router contract ([#628](https://github.com/ai-driven-dev/framework/issues/628)) ([f6539e2](https://github.com/ai-driven-dev/framework/commit/f6539e2c1d6564edf55b6fea983acd6362d2dd7e))

## [2.4.1](https://github.com/ai-driven-dev/framework/compare/aidd-pm-v2.4.0...aidd-pm-v2.4.1) (2026-08-07)


### Refactoring

* **framework:** one home for the skill contract ([#601](https://github.com/ai-driven-dev/framework/issues/601)) ([415a777](https://github.com/ai-driven-dev/framework/commit/415a77706c84277036dc7470d6dc329f9abde1de))

## [2.4.0](https://github.com/ai-driven-dev/framework/compare/aidd-pm-v2.3.0...aidd-pm-v2.4.0) (2026-08-06)


### Features

* **aidd-pm:** keep a typed product backlog coherent whoever writes to it ([#582](https://github.com/ai-driven-dev/framework/issues/582)) ([fe0eebc](https://github.com/ai-driven-dev/framework/commit/fe0eebc5cf142e6668859f83dfe7ae4a38097435))


### Refactoring

* **plugins:** action citations use markdown links, not @ ([c5da712](https://github.com/ai-driven-dev/framework/commit/c5da7126ef30354e17d4665300bd88481fc7c816))

## [2.3.0](https://github.com/ai-driven-dev/framework/compare/aidd-pm-v2.2.1...aidd-pm-v2.3.0) (2026-07-31)


### Features

* **aidd-pm:** add evidence-bounded spike skill ([#543](https://github.com/ai-driven-dev/framework/issues/543)) ([16e5bfa](https://github.com/ai-driven-dev/framework/commit/16e5bfa59e70acc6692749089c2423c5a7efbe86)), closes [#412](https://github.com/ai-driven-dev/framework/issues/412)
* **aidd-pm:** add Product Brief discovery skill ([#551](https://github.com/ai-driven-dev/framework/issues/551)) ([d5e7224](https://github.com/ai-driven-dev/framework/commit/d5e72243f683bc57ea439f2571b410df8b332d69)), closes [#349](https://github.com/ai-driven-dev/framework/issues/349)

## [2.2.1](https://github.com/ai-driven-dev/framework/compare/aidd-pm-v2.2.0...aidd-pm-v2.2.1) (2026-07-10)


### Refactoring

* remove per-skill README.md mirrors ([#302](https://github.com/ai-driven-dev/framework/issues/302)) ([#396](https://github.com/ai-driven-dev/framework/issues/396)) ([1b94c3c](https://github.com/ai-driven-dev/framework/commit/1b94c3c0108c21eacfacf63f55fa7a24dc79d8dd))

## [2.2.0](https://github.com/ai-driven-dev/framework/compare/aidd-pm-v2.1.1...aidd-pm-v2.2.0) (2026-07-06)


### Features

* **framework:** read action files before running, across all skills ([#389](https://github.com/ai-driven-dev/framework/issues/389)) ([9d592a6](https://github.com/ai-driven-dev/framework/commit/9d592a6d8c1ca3d0ac8f8aaf54e30e7186a8eb48))

## [2.1.1](https://github.com/ai-driven-dev/framework/compare/aidd-pm-v2.1.0...aidd-pm-v2.1.1) (2026-07-01)


### Refactoring

* **framework:** strict anti-slop templates and review redesign ([153ba42](https://github.com/ai-driven-dev/framework/commit/153ba42faff9177c66ebb97de4ea8d7512fc5b85))

## [2.1.0](https://github.com/ai-driven-dev/framework/compare/aidd-pm-v2.0.0...aidd-pm-v2.1.0) (2026-06-30)


### Features

* **skills:** sync argument hints ([#296](https://github.com/ai-driven-dev/framework/issues/296)) ([5aa9216](https://github.com/ai-driven-dev/framework/commit/5aa92166cc80d74c79a1dab183224517c3fb1f49))


### Refactoring

* **aidd-dev:** redesign 01-plan into gather/explore/wireframe/plan ([#271](https://github.com/ai-driven-dev/framework/issues/271)) ([dba017e](https://github.com/ai-driven-dev/framework/commit/dba017e8e4c6ef9bc80325791495f1b5fe8c350b)), closes [#292](https://github.com/ai-driven-dev/framework/issues/292) [#265](https://github.com/ai-driven-dev/framework/issues/265) [#276](https://github.com/ai-driven-dev/framework/issues/276)
* conform remaining skills to the authoring contract ([#334](https://github.com/ai-driven-dev/framework/issues/334)) ([dcc232a](https://github.com/ai-driven-dev/framework/commit/dcc232a5a7a7bcdf0c477b36399fd4d412685022))
* **framework:** executor/checker agents + SDLC orchestration redesign ([#314](https://github.com/ai-driven-dev/framework/issues/314)) ([7df7a34](https://github.com/ai-driven-dev/framework/commit/7df7a34dab251cd4190f76bb1cb031584bdea5bd))

## [2.0.0](https://github.com/ai-driven-dev/framework/compare/aidd-pm-v1.0.2...aidd-pm-v2.0.0) (2026-06-19)


### ⚠ BREAKING CHANGES

* **framework:** auto-routing is removed. Skills are now manual-invoke only; the prompt-to-skill routing hint no longer runs.

### Features

* **framework:** remove evals system end-to-end ([#261](https://github.com/ai-driven-dev/framework/issues/261)) ([9a3c1b8](https://github.com/ai-driven-dev/framework/commit/9a3c1b8237359842f3200683732bc73b825582f6))


### Miscellaneous

* **framework:** rename repository URLs aidd-framework to framework ([#266](https://github.com/ai-driven-dev/framework/issues/266)) ([7cfc0a3](https://github.com/ai-driven-dev/framework/commit/7cfc0a3cf5fcd8eb068000744f2854d19624546f))
* **framework:** stop shipping .mcp.json, recommend MCP servers in README ([#263](https://github.com/ai-driven-dev/framework/issues/263)) ([e602fa0](https://github.com/ai-driven-dev/framework/commit/e602fa0c8d49fbbd7d0b65f85a0d5122ee8d9c6c))

## [1.0.2](https://github.com/ai-driven-dev/aidd-framework/compare/aidd-pm-v1.0.1...aidd-pm-v1.0.2) (2026-06-03)


### Bug Fixes

* **framework:** make all 31 skill names spec-compliant (kebab, folder-matched, no colons) ([#172](https://github.com/ai-driven-dev/aidd-framework/issues/172)) ([a47505f](https://github.com/ai-driven-dev/aidd-framework/commit/a47505f5d63e939db0bf28629adbafec888e28e6))

## [1.0.1](https://github.com/ai-driven-dev/aidd-framework/compare/aidd-pm-v1.0.0...aidd-pm-v1.0.1) (2026-05-29)


### Refactoring

* **aidd-context:** unify 03-context-generate on Model Y tool-resolution ([#155](https://github.com/ai-driven-dev/aidd-framework/issues/155)) ([09e3c56](https://github.com/ai-driven-dev/aidd-framework/commit/09e3c564a3c1c12e9915f85dff7902a613919a98))

## [1.0.0](https://github.com/ai-driven-dev/aidd-framework/compare/aidd-pm-v1.0.0...aidd-pm-v1.0.0) (2026-05-19)


### Features

* **aidd-pm:** scaffold RC skills with actions ([22fc883](https://github.com/ai-driven-dev/aidd-framework/commit/22fc88365631718e76e893e41e8789c1bb5da599))
* **framework:** refactor to marketplace plugin architecture and skills ([27128a9](https://github.com/ai-driven-dev/aidd-framework/commit/27128a96314904b7b57b0bc419e4d29b7a7edaf0))
* **framework:** relocate templates and conventions into skill assets ([6920182](https://github.com/ai-driven-dev/aidd-framework/commit/692018202f84cd6f5d885f5737f305f77f79ac5f))
* **framework:** scaffold 4-plugin marketplace catalog ([7be5466](https://github.com/ai-driven-dev/aidd-framework/commit/7be5466ae78f432a5477a6f35d23cbff56b7f2df))
* **framework:** split MCP and SessionStart hook into plugins ([527f9b8](https://github.com/ai-driven-dev/aidd-framework/commit/527f9b8c13ea1c7e45b277218569e6881559cadc))
* **framework:** update build script for plugin layout and regenerate catalogs ([ea18188](https://github.com/ai-driven-dev/aidd-framework/commit/ea1818850a6c9d8b39de2aa5bae2b6ecf6741ddd))


### Bug Fixes

* **framework:** correct slash command naming in docs ([adad60a](https://github.com/ai-driven-dev/aidd-framework/commit/adad60aacaa120f3abf55100625bed7a3a87a50a))
* **framework:** namespace frontmatter for relocated skills ([ea220a1](https://github.com/ai-driven-dev/aidd-framework/commit/ea220a19667da43cbe88c0dca87913b1d1c381cb))
* **framework:** wire SDLC contracts — namespace, plan paths, commit modes, validator semantics ([f5f14e0](https://github.com/ai-driven-dev/aidd-framework/commit/f5f14e01c6bb4a8c7952b6241b89a50816f636a6))


### Miscellaneous

* **ci:** SHA-pin every external action and add CodeQL workflow ([66d5fcf](https://github.com/ai-driven-dev/aidd-framework/commit/66d5fcf99776df2885a84b2ef70943ff63099748))
* **framework:** adopt release-please monorepo with per-plugin versioning ([9706606](https://github.com/ai-driven-dev/aidd-framework/commit/9706606207f1474033fb9b73ce089636362616c9))
* **framework:** bulk alignment — evals everywhere, em-dash purge, audit template, stale refs fixed ([0dfd79d](https://github.com/ai-driven-dev/aidd-framework/commit/0dfd79dac5ce7f15194b4aa9b58b5dd61fdf14b6))
* **framework:** bump aidd-pm to 1.0.0 and apply audit fixes ([97573bc](https://github.com/ai-driven-dev/aidd-framework/commit/97573bcf1b7624f6cf1acaa62791b9cdbe1b237b))
* **framework:** disable proposed MCP servers by default ([785293b](https://github.com/ai-driven-dev/aidd-framework/commit/785293b45eea542712031e326c18ac7454068cbf))
* **framework:** merge feat/plugin-content-tool-agnostic ([11cce19](https://github.com/ai-driven-dev/aidd-framework/commit/11cce1963826a1ed3e28837b9ccee8ed11fe2229))
* **framework:** merge origin/feat/plugin-architecture ([0082b4c](https://github.com/ai-driven-dev/aidd-framework/commit/0082b4cc7916fca6e3060362a0ce762c155a0e19))
* **framework:** regenerate plugin catalogs after audit sweep ([448b111](https://github.com/ai-driven-dev/aidd-framework/commit/448b111662335197c9e4e415db391fc4e8d5c79f))
* **framework:** release as 4.0.0 ([5b0fc9d](https://github.com/ai-driven-dev/aidd-framework/commit/5b0fc9d9116e37abe7ef5dbb5d06438f607475e8))
* **framework:** self-host summarize-markdown.mjs for per-plugin CATALOG ([ee62862](https://github.com/ai-driven-dev/aidd-framework/commit/ee6286237d3b1b97ebaf67aa68f8152015d61e90))
* **framework:** trigger ci recheck after history rewrite ([391760e](https://github.com/ai-driven-dev/aidd-framework/commit/391760e19eb69fe80e098c3aefc3c527cda2169a))
* **framework:** wave 1 audit fixes (schemas, gitignore, dependabot, links) ([4bcb670](https://github.com/ai-driven-dev/aidd-framework/commit/4bcb67069cd7af57f2a73fb55e19d89a583e2e7d))


### Documentation

* **aidd-pm:** sync CATALOG.md with current skill state ([44a398e](https://github.com/ai-driven-dev/aidd-framework/commit/44a398e558b20d80e0654a74cfeed58b8e6684c4))
* **framework:** add per-plugin CATALOG.md (auto-generated) ([d613282](https://github.com/ai-driven-dev/aidd-framework/commit/d61328242639bb77909055019629b1da3891bffc))
* **framework:** rewrite for plugin marketplace model ([9529d4c](https://github.com/ai-driven-dev/aidd-framework/commit/9529d4cbc8fef430354300e2bfcd8bff526c67a2))
* **framework:** sync READMEs and CATALOGs with current skills ([16c9372](https://github.com/ai-driven-dev/aidd-framework/commit/16c937268b27a6e80f4077da4989003be5d9d186))
* phase 1 critical audit fixes (skill invocations, catalog, templates) ([5b5342b](https://github.com/ai-driven-dev/aidd-framework/commit/5b5342b890ae0be4eb8302fd36e5a4d8882b9cbb))
* phase 2 high-severity audit fixes (security, lefthook, accuracy) ([95f29c3](https://github.com/ai-driven-dev/aidd-framework/commit/95f29c33c6a523166eaf09e0293000ee356a27dd))
* phase 3 medium/low audit fixes (OSS scaffolding, UX, accuracy) ([5e43650](https://github.com/ai-driven-dev/aidd-framework/commit/5e436502d7632b377f73129cfb73d312c3eea9ce))
* propagate per-skill README pattern across all plugins ([4427e3e](https://github.com/ai-driven-dev/aidd-framework/commit/4427e3ee7c096d03f7d7b30d418f3484e9d0541a))
* scrub cross-plugin references from skill READMEs ([9c23973](https://github.com/ai-driven-dev/aidd-framework/commit/9c2397396c16a80a04f66991a2ae6bd92dcce5d0))


### Refactoring

* **aidd-context:** restructure project init ([da90ed8](https://github.com/ai-driven-dev/aidd-framework/commit/da90ed8ac6c53aff7d1fae6d49477f4b1089a029))
* **aidd-dev:** rewrite SDLC as pure orchestrator with role-based agents ([dbc6edd](https://github.com/ai-driven-dev/aidd-framework/commit/dbc6edd360256154a14a82fb206b301b77684822))
* **aidd-pm:** restructure spec into build and refine actions, sync plugin docs ([107241e](https://github.com/ai-driven-dev/aidd-framework/commit/107241e76e444d6afeef8d767ed1501c972ef338))
* **framework:** align sdlc orchestrator and sub-skills around alex baseline ([92535cd](https://github.com/ai-driven-dev/aidd-framework/commit/92535cdf285effeee4cba9027dd7fd6a88c8c737))
* **framework:** canonical action shape, model-A rules, plugin audit sweep ([29ef579](https://github.com/ai-driven-dev/aidd-framework/commit/29ef579a683302c28f23de383acc1912ebcfe01e))
* **framework:** canonical template for aidd-pm skills + tighter SKILL.md descriptions ([0ea9b80](https://github.com/ai-driven-dev/aidd-framework/commit/0ea9b8021320778e64fb1c3806eb59eabfb6130c))
* **framework:** make content tool-agnostic and self-contained ([84165a9](https://github.com/ai-driven-dev/aidd-framework/commit/84165a917c9c36b6bca10599e9f4699908bd79ba))
* **framework:** remove embedded skill content for distribution-mode migration ([ee43a32](https://github.com/ai-driven-dev/aidd-framework/commit/ee43a323505791ffb7d41395539c7bc665e8a6c5))
* **framework:** rename skill folders from [X.X] to NN-name format ([c8968bc](https://github.com/ai-driven-dev/aidd-framework/commit/c8968bc79dd7f24976392a6bce0c7f30c35b2ede))
