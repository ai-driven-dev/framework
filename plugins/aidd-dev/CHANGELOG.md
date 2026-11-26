# Changelog

## [2.9.0](https://github.com/ai-driven-dev/framework/compare/aidd-dev-v2.8.0...aidd-dev-v2.9.0) (2026-11-26)


### Features

* **aidd-dev:** check the review, assert and audit files by a contract ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([4789423](https://github.com/ai-driven-dev/framework/commit/47894232d29e8df882e32cfd5b7c5b0f8e5d5248))
* **aidd-dev:** check the review, assert and audit files by a contract ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([184747b](https://github.com/ai-driven-dev/framework/commit/184747b92258d3d24db2218f8bb0d6371ea7100d))
* **framework:** check every heading level of a template, not only level 2 ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([729c4a4](https://github.com/ai-driven-dev/framework/commit/729c4a45ade6cb457f22e0061cae0e6e18464112))
* **framework:** check framework content through contracts ([8922b9b](https://github.com/ai-driven-dev/framework/commit/8922b9be53cd946e09edf45d34a46a92d128cc29))
* **framework:** check written artifacts at turn end in plugins ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([2a3a53c](https://github.com/ai-driven-dev/framework/commit/2a3a53ce801c3f96d8da8e9de75247d8e4f1c4d1))
* **framework:** check written artifacts at turn end with a generated hook ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([aaf834c](https://github.com/ai-driven-dev/framework/commit/aaf834cfa352c5f1defb17884db54bcc12efcf29))
* **framework:** contracts declare the user-project scope of their artifacts ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([0164472](https://github.com/ai-driven-dev/framework/commit/0164472e77f7206799e597d2c0c39ad8014744e6))
* **framework:** file contracts report the real file and line of each hit ([34bb45f](https://github.com/ai-driven-dev/framework/commit/34bb45f5ca0095995150fd6d223657b4cde2a291))
* **framework:** hooks status message and plan test scope rules replace tests ([b32e212](https://github.com/ai-driven-dev/framework/commit/b32e2127486024bec3b1e105ec3bbebcd620c9d8))
* **framework:** skill rules replace name, link and sibling tests ([ab0bde0](https://github.com/ai-driven-dev/framework/commit/ab0bde0bbe90b1cd269935da0231d8e814bd3ab1))
* **framework:** validate manifests, marketplace and settings against the official schemas ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([629cd4d](https://github.com/ai-driven-dev/framework/commit/629cd4d0d67b587acad13ca46c13bf3fd5557f56))
* **framework:** validate plans and implementation state against contracts ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([00303c4](https://github.com/ai-driven-dev/framework/commit/00303c470c5951bf0eb3a02282dab6c63c98f9fe))
* **framework:** validate rules, commands, stories and hook configs against contracts ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([b3e842c](https://github.com/ai-driven-dev/framework/commit/b3e842c0d0267e1d0dd3e941cfea202ce3bcc3c0))
* **scripts:** judge skills, agents and commands a shell command names ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([bf542c0](https://github.com/ai-driven-dev/framework/commit/bf542c06ecd23baa4222b9ab4bf034793d836f64))


### Bug Fixes

* **aidd-dev:** let plan and phase status follow the lifecycle ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([bf0574f](https://github.com/ai-driven-dev/framework/commit/bf0574f7fea0eef837bd225a1f48fdea33d26504))
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

* **aidd-dev:** sync the engine copies of assert, audit and review ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([149c46b](https://github.com/ai-driven-dev/framework/commit/149c46beee9961f7d563280bdb5908318bb5f5cc))
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
* **framework:** sync contract ops copies ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([8b5a15a](https://github.com/ai-driven-dev/framework/commit/8b5a15a520ebd41a6064d7cb0e9f6e00ac39aa7c))
* **framework:** sync contract ops copies ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([eb5b35f](https://github.com/ai-driven-dev/framework/commit/eb5b35fc84af24fc38e225b09378711f896bbfdf))
* **scripts:** re-sync engine copies ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([d47324b](https://github.com/ai-driven-dev/framework/commit/d47324b4c83b489c6d5585d405832a2d8405265e))
* **scripts:** re-sync engine copies ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([54e0725](https://github.com/ai-driven-dev/framework/commit/54e0725a0d10f000958e071198cd631ef58548c8))
* **scripts:** re-sync engine copies ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([448d650](https://github.com/ai-driven-dev/framework/commit/448d65043b8499576df6a0458000b40dc802f510))
* **scripts:** re-sync engine copies ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([909bc3b](https://github.com/ai-driven-dev/framework/commit/909bc3b6ddb634dbe617b1eff0af4f2752ffa9f7))


### Documentation

* **aidd-context:** word the validate step the same in every skill ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([f94654a](https://github.com/ai-driven-dev/framework/commit/f94654a095555005c3a3e7774682263b8f5ac757))
* **aidd-dev:** word the assert and review validate step like the others ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([d85dc61](https://github.com/ai-driven-dev/framework/commit/d85dc61efebd88464f04a09cff631d4cda626547))
* **framework:** mark every template slot as {{…}} ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([04119a5](https://github.com/ai-driven-dev/framework/commit/04119a5f9b8d2b91fbff6b8f1f721c1993e0b0c0))


### Refactoring

* **aidd-dev:** drop the plan Test Scope rule the template already holds ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([2c32195](https://github.com/ai-driven-dev/framework/commit/2c32195eec441f12ae65a43bed792c5b99362f15))
* **aidd-dev:** regenerate the review skill in the lean format ([#1200](https://github.com/ai-driven-dev/framework/issues/1200)) ([af4b511](https://github.com/ai-driven-dev/framework/commit/af4b511b618fce47727628e53b390838cf4e709e))
* **aidd-refine:** give shadow-areas a router, a report contract and one home per fact ([e4c1d4f](https://github.com/ai-driven-dev/framework/commit/e4c1d4f5cfa2817e97bc9e632f76c54fbca78ffe))
* **framework:** drop the unused scaffold engine file and its copies ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([54024d3](https://github.com/ai-driven-dev/framework/commit/54024d3fe314eb844c077c4a528a92d26fa1b9aa))
* **framework:** drop unused engine options and tighten contract loading ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([ab232ba](https://github.com/ai-driven-dev/framework/commit/ab232ba19d67f78b492e8b96214f69843f1d6143))
* **framework:** leave the continuation Stop guard to the host adapter ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([8b69f1e](https://github.com/ai-driven-dev/framework/commit/8b69f1e183e278246ea350807db94158e3cfa2ba))
* **framework:** match watch globs with the engine's glob ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([a4a3199](https://github.com/ai-driven-dev/framework/commit/a4a319955aeae0268c0de555f903fbc1a6cf0d7a))
* **framework:** move contract checks to scripts/check, contracts name their targets ([422923f](https://github.com/ai-driven-dev/framework/commit/422923f44849fb9910e7a4b542b9da5f36c6c491))
* **framework:** one hook engine per plugin, sync writes host.cjs ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([f6f68b5](https://github.com/ai-driven-dev/framework/commit/f6f68b57fd67508c31046d145cca5b090d4b681f))
* **framework:** surface crashes, tidy the engine, rename contract files ([972cbb1](https://github.com/ai-driven-dev/framework/commit/972cbb1979cb6f9d6628e859edb22a8e5ea106de))
* **scripts:** drop the dead retired key from the contract engine ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([1fb2a6f](https://github.com/ai-driven-dev/framework/commit/1fb2a6facb0dc2adb3827182110e90a3479a8cf6))

## [2.8.0](https://github.com/ai-driven-dev/framework/compare/aidd-dev-v2.7.1...aidd-dev-v2.8.0) (2026-11-13)


### Features

* **aidd-context:** lint memory files and hand a write's own errors back to the model ([2e808b6](https://github.com/ai-driven-dev/framework/commit/2e808b6444aa7872383630a55d794d3dc8a41b9a))
* **framework:** ship generic sub-agents across six hosts ([#1027](https://github.com/ai-driven-dev/framework/issues/1027)) ([7c67ca3](https://github.com/ai-driven-dev/framework/commit/7c67ca37a19dc30b8ba8933f7561f79e91736e2b))


### Bug Fixes

* **aidd-context:** report only what a shell write wrote, and list .cjs hooks ([4b1c773](https://github.com/ai-driven-dev/framework/commit/4b1c773eb8e128c350210715693aae2dd3582c57)), closes [#1141](https://github.com/ai-driven-dev/framework/issues/1141)
* **aidd-dev:** check plan file operations across phases, not per phase ([4f9a04d](https://github.com/ai-driven-dev/framework/commit/4f9a04d466e760e1ab4cba7d6937381d505c142a))
* **aidd-dev:** count a job skipped for want of input as not run ([b9450fe](https://github.com/ai-driven-dev/framework/commit/b9450fedffc95ed9eda88d8a2848a84ad16d13b8))
* **aidd-dev:** drop the assert rule on skipped jobs, the exact command already prevents them ([bf4e3ca](https://github.com/ai-driven-dev/framework/commit/bf4e3ca2a53bb566572ceed965c1b58c492ad163))
* **aidd-dev:** run assert checks in full and catch files recreated after deletion ([a9006cd](https://github.com/ai-driven-dev/framework/commit/a9006cdd166632487b7dd8bcece04c2500069a91))
* **aidd-dev:** run each assert check exactly as written, counting skips as not run ([1e9d9cf](https://github.com/ai-driven-dev/framework/commit/1e9d9cf2263a413e13dc9f99e50a6dbfb5e0348f))


### Documentation

* rewrite the documentation set by audience ([#1131](https://github.com/ai-driven-dev/framework/issues/1131)) ([b90bffa](https://github.com/ai-driven-dev/framework/commit/b90bffada166c69f4e3952dd5e56abfcad540264))


### Refactoring

* **aidd-dev:** lean the implement skill for small models ([#1126](https://github.com/ai-driven-dev/framework/issues/1126)) ([6ec74db](https://github.com/ai-driven-dev/framework/commit/6ec74db56fc7060514ac38516e8472f9c0255a1b))
* **aidd-dev:** make assert a judge and route sdlc through plan, implement and assert ([#1135](https://github.com/ai-driven-dev/framework/issues/1135)) ([65b54db](https://github.com/ai-driven-dev/framework/commit/65b54dbe0573da5542a20d5bd8abd380cfa70c03))
* **aidd-dev:** make review three steps with its axes as references ([#1136](https://github.com/ai-driven-dev/framework/issues/1136)) ([6b1e091](https://github.com/ai-driven-dev/framework/commit/6b1e091d03188037af648d10e7568e039c5d3917))

## [2.7.1](https://github.com/ai-driven-dev/framework/compare/aidd-dev-v2.7.0...aidd-dev-v2.7.1) (2026-10-26)


### Refactoring

* **aidd-dev:** lean the plan skill for small models ([#1080](https://github.com/ai-driven-dev/framework/issues/1080)) ([b7763ea](https://github.com/ai-driven-dev/framework/commit/b7763ea7c87694ad48f6330176e57860edf50d37))

## [2.7.0](https://github.com/ai-driven-dev/framework/compare/aidd-dev-v2.6.0...aidd-dev-v2.7.0) (2026-10-16)


### ⚠ BREAKING CHANGES

* the aidd telemetry commands, the aidd-telemetry hooks and skills, backlog-link.json and the AIDD-Session-Id commit trailer are removed; measurement returns, for Claude Code first, later on this branch.

### Features

* **aidd-dev:** rename todo to batch and report each agent's outcome ([#984](https://github.com/ai-driven-dev/framework/issues/984)) ([eeb9b21](https://github.com/ai-driven-dev/framework/commit/eeb9b2140578accfd09abe74c4f4d94f9ac987c2))
* **telemetry:** deterministic claude code token measurement, release 1 ([#993](https://github.com/ai-driven-dev/framework/issues/993)) ([0a103e6](https://github.com/ai-driven-dev/framework/commit/0a103e6725cd9619a861d1ec3136b7534edabae3))


### Bug Fixes

* **aidd-dev:** a review appends a round and scores the whole plan ([#977](https://github.com/ai-driven-dev/framework/issues/977)) ([b25ae36](https://github.com/ai-driven-dev/framework/commit/b25ae36a9215d9fddc6dfb8b645b2be47e79d99f)), closes [#858](https://github.com/ai-driven-dev/framework/issues/858)
* **aidd-dev:** a review never checks a runtime criterion from the code ([#995](https://github.com/ai-driven-dev/framework/issues/995)) ([3f91201](https://github.com/ai-driven-dev/framework/commit/3f91201402d0def02709f9f7ecaec6604e05119d)), closes [#976](https://github.com/ai-driven-dev/framework/issues/976)
* **aidd-dev:** name one severity scale across assert, audit and refactor ([#997](https://github.com/ai-driven-dev/framework/issues/997)) ([3710dd3](https://github.com/ai-driven-dev/framework/commit/3710dd3446cf6182dd13f1d9d27bce1abbfe3f73))
* **aidd-dev:** validate all CI failures before repushing ([d8ad9e6](https://github.com/ai-driven-dev/framework/commit/d8ad9e6a2237726fd2ddf113c60cd531e60efb82))
* **aidd-dev:** validate all CI failures before repushing ([8ddd2cc](https://github.com/ai-driven-dev/framework/commit/8ddd2cc619772cc39379a37d58a7e1f596d91e5d))
* **cli:** preserve noninteractive git fetches with simple-git v4 ([4ffbc0a](https://github.com/ai-driven-dev/framework/commit/4ffbc0a2f96a679b403d5eaa3f9c74c36bc5138e))
* **framework:** leave model selection to the user ([#989](https://github.com/ai-driven-dev/framework/issues/989)) ([41e9169](https://github.com/ai-driven-dev/framework/commit/41e91691b5837a8c27475d0115725131bb53bf41))


### Documentation

* **aidd-dev:** simplify implementation rules and require workflow evidence ([#950](https://github.com/ai-driven-dev/framework/issues/950)) ([bad23d1](https://github.com/ai-driven-dev/framework/commit/bad23d1ea71301101a92ab0480a3f8a2706c7558))
* delete the cost-report and metrics contracts and aidd_docs/runs/, rewrite ([0a103e6](https://github.com/ai-driven-dev/framework/commit/0a103e6725cd9619a861d1ec3136b7534edabae3))

## [2.6.0](https://github.com/ai-driven-dev/framework/compare/aidd-dev-v2.5.0...aidd-dev-v2.6.0) (2026-09-24)


### Features

* **aidd-qa:** create an implementation-independent QA plugin ([#917](https://github.com/ai-driven-dev/framework/issues/917)) ([ca7828d](https://github.com/ai-driven-dev/framework/commit/ca7828d995b9ca7369d8ca4c8da7dd540b82c986))
* **framework:** refuse an AI edit that breaks a named architecture rule ([#885](https://github.com/ai-driven-dev/framework/issues/885)) ([822f178](https://github.com/ai-driven-dev/framework/commit/822f1786d7569770c08233d9104794078b10e489))

## [2.5.0](https://github.com/ai-driven-dev/framework/compare/aidd-dev-v2.4.1...aidd-dev-v2.5.0) (2026-09-09)


### Features

* **framework:** measurement that works on five tools, each proven by a session that ran ([#706](https://github.com/ai-driven-dev/framework/issues/706)) ([627408f](https://github.com/ai-driven-dev/framework/commit/627408fba964b30d22b57fc99241083da1e0f294))
* **telemetry:** a skill says when it is done, because nothing else can ([#756](https://github.com/ai-driven-dev/framework/issues/756)) ([cf66c22](https://github.com/ai-driven-dev/framework/commit/cf66c22856d3b00ad9ecc69582ad7b37f93e4401))


### Bug Fixes

* **plugins:** a skill links only inside itself ([#772](https://github.com/ai-driven-dev/framework/issues/772)) ([1efb3d9](https://github.com/ai-driven-dev/framework/commit/1efb3d958897b88c9fde814d6e1e941f8978c519))


### Miscellaneous

* back-merge main into next (conflicts) ([#610](https://github.com/ai-driven-dev/framework/issues/610)) ([a923d56](https://github.com/ai-driven-dev/framework/commit/a923d5661bb63cccc53bad7e6744b27cbbdc0a05))

## [2.4.1](https://github.com/ai-driven-dev/framework/compare/aidd-dev-v2.4.0...aidd-dev-v2.4.1) (2026-08-07)


### Bug Fixes

* **framework:** leave a fenced block alone when normalising Process steps ([#604](https://github.com/ai-driven-dev/framework/issues/604)) ([019486f](https://github.com/ai-driven-dev/framework/commit/019486f5bc3ab0d91f43a527c05f9a16e322f03a))


### Refactoring

* **framework:** one home for the skill contract ([#601](https://github.com/ai-driven-dev/framework/issues/601)) ([415a777](https://github.com/ai-driven-dev/framework/commit/415a77706c84277036dc7470d6dc329f9abde1de))

## [2.4.0](https://github.com/ai-driven-dev/framework/compare/aidd-dev-v2.3.1...aidd-dev-v2.4.0) (2026-08-06)


### Features

* **framework:** add QA and communication evaluations ([#512](https://github.com/ai-driven-dev/framework/issues/512)) ([871d192](https://github.com/ai-driven-dev/framework/commit/871d1926e9944af231b15951d54bfe6364234536))


### Refactoring

* **orchestrator:** replace SDLC actions with protocols ([#517](https://github.com/ai-driven-dev/framework/issues/517)) ([ed81604](https://github.com/ai-driven-dev/framework/commit/ed816044709b2b7081cc00ad2103a8571bf0ad6c))
* **plugins:** action citations use markdown links, not @ ([c5da712](https://github.com/ai-driven-dev/framework/commit/c5da7126ef30354e17d4665300bd88481fc7c816))

## [2.3.1](https://github.com/ai-driven-dev/framework/compare/aidd-dev-v2.3.0...aidd-dev-v2.3.1) (2026-07-10)


### Documentation

* **framework:** rework the documentation — install-first, concise, emoji-styled ([#407](https://github.com/ai-driven-dev/framework/issues/407)) ([6c0914a](https://github.com/ai-driven-dev/framework/commit/6c0914ad507ba2930a2bcc502e99825ae780747c))


### Refactoring

* remove per-skill README.md mirrors ([#302](https://github.com/ai-driven-dev/framework/issues/302)) ([#396](https://github.com/ai-driven-dev/framework/issues/396)) ([1b94c3c](https://github.com/ai-driven-dev/framework/commit/1b94c3c0108c21eacfacf63f55fa7a24dc79d8dd))

## [2.3.0](https://github.com/ai-driven-dev/framework/compare/aidd-dev-v2.2.1...aidd-dev-v2.3.0) (2026-07-06)


### Features

* **framework:** read action files before running, across all skills ([#389](https://github.com/ai-driven-dev/framework/issues/389)) ([9d592a6](https://github.com/ai-driven-dev/framework/commit/9d592a6d8c1ca3d0ac8f8aaf54e30e7186a8eb48))

## [2.2.1](https://github.com/ai-driven-dev/framework/compare/aidd-dev-v2.2.0...aidd-dev-v2.2.1) (2026-07-01)


### Bug Fixes

* **dev:** close review report contract gaps ([29d99c6](https://github.com/ai-driven-dev/framework/commit/29d99c68f8b519a6d0a828005feb76fc1a0034e8))
* **dev:** critical functional severity and skipped-axis visibility ([810be09](https://github.com/ai-driven-dev/framework/commit/810be0978023509d8742af59d1967436d4d653d8))
* **dev:** make functional findings and verdict rules consistent ([4c0ac84](https://github.com/ai-driven-dev/framework/commit/4c0ac845ec4d6ab3793a604bc61f52a5e237b742))

## [2.2.0](https://github.com/ai-driven-dev/framework/compare/aidd-dev-v2.1.0...aidd-dev-v2.2.0) (2026-07-01)


### Features

* **dev:** enforce the review report section set with a validator ([befe416](https://github.com/ai-driven-dev/framework/commit/befe416ae8dc36cdb0f49f546d2a194bfa5fb9a8))


### Refactoring

* **framework:** strict anti-slop templates and review redesign ([153ba42](https://github.com/ai-driven-dev/framework/commit/153ba42faff9177c66ebb97de4ea8d7512fc5b85))

## [2.1.0](https://github.com/ai-driven-dev/framework/compare/aidd-dev-v2.0.0...aidd-dev-v2.1.0) (2026-06-30)


### Features

* **aidd-dev:** route deletions to refactor cleanup with orphan sweep ([#328](https://github.com/ai-driven-dev/framework/issues/328)) ([2c75d0d](https://github.com/ai-driven-dev/framework/commit/2c75d0d7924b1b249c25fc121091387f0c373a7f))
* **skills:** sync argument hints ([#296](https://github.com/ai-driven-dev/framework/issues/296)) ([5aa9216](https://github.com/ai-driven-dev/framework/commit/5aa92166cc80d74c79a1dab183224517c3fb1f49))


### Documentation

* **framework:** add dominance checks to review and rules ([#313](https://github.com/ai-driven-dev/framework/issues/313)) ([80daf0d](https://github.com/ai-driven-dev/framework/commit/80daf0d5e6276417a1b61fadf63a3d5025d6fc32))


### Refactoring

* **aidd-dev:** redesign 01-plan into gather/explore/wireframe/plan ([#271](https://github.com/ai-driven-dev/framework/issues/271)) ([dba017e](https://github.com/ai-driven-dev/framework/commit/dba017e8e4c6ef9bc80325791495f1b5fe8c350b)), closes [#292](https://github.com/ai-driven-dev/framework/issues/292) [#265](https://github.com/ai-driven-dev/framework/issues/265) [#276](https://github.com/ai-driven-dev/framework/issues/276)
* conform remaining skills to the authoring contract ([#334](https://github.com/ai-driven-dev/framework/issues/334)) ([dcc232a](https://github.com/ai-driven-dev/framework/commit/dcc232a5a7a7bcdf0c477b36399fd4d412685022))
* **framework:** executor/checker agents + SDLC orchestration redesign ([#314](https://github.com/ai-driven-dev/framework/issues/314)) ([7df7a34](https://github.com/ai-driven-dev/framework/commit/7df7a34dab251cd4190f76bb1cb031584bdea5bd))
* **skills:** forbid colon and em dash in descriptions, codify in R5 ([1407a9a](https://github.com/ai-driven-dev/framework/commit/1407a9a996b4d705d8586512c533659d8c44d445))

## [2.0.0](https://github.com/ai-driven-dev/framework/compare/aidd-dev-v1.2.1...aidd-dev-v2.0.0) (2026-06-19)


### ⚠ BREAKING CHANGES

* **framework:** auto-routing is removed. Skills are now manual-invoke only; the prompt-to-skill routing hint no longer runs.

### Features

* **aidd-context:** per-artifact context generators (skill, rule, agent, command, hook) ([#264](https://github.com/ai-driven-dev/framework/issues/264)) ([647fe5a](https://github.com/ai-driven-dev/framework/commit/647fe5afed81c27e9201bd3f0ae119f422e75fb6))
* **aidd-dev:** add 10-todo skill for parallel todo fan-out ([#262](https://github.com/ai-driven-dev/framework/issues/262)) ([c086e05](https://github.com/ai-driven-dev/framework/commit/c086e05e7564f1be1414ebf1a6956e74cd4d7903))
* **aidd-dev:** track plan lifecycle status in frontmatter ([#251](https://github.com/ai-driven-dev/framework/issues/251)) ([3f63ae2](https://github.com/ai-driven-dev/framework/commit/3f63ae20a2a04eb44caed53bf9ddb79c29f951d0))
* **framework:** remove evals system end-to-end ([#261](https://github.com/ai-driven-dev/framework/issues/261)) ([9a3c1b8](https://github.com/ai-driven-dev/framework/commit/9a3c1b8237359842f3200683732bc73b825582f6))


### Miscellaneous

* **framework:** rename repository URLs aidd-framework to framework ([#266](https://github.com/ai-driven-dev/framework/issues/266)) ([7cfc0a3](https://github.com/ai-driven-dev/framework/commit/7cfc0a3cf5fcd8eb068000744f2854d19624546f))
* **framework:** stop shipping .mcp.json, recommend MCP servers in README ([#263](https://github.com/ai-driven-dev/framework/issues/263)) ([e602fa0](https://github.com/ai-driven-dev/framework/commit/e602fa0c8d49fbbd7d0b65f85a0d5122ee8d9c6c))


### Documentation

* **framework:** streamline README, add recipes, extract marketplace doc ([#280](https://github.com/ai-driven-dev/framework/issues/280)) ([a139b52](https://github.com/ai-driven-dev/framework/commit/a139b523143000dc3229194a9269f0eca4194bea))

## [1.2.1](https://github.com/ai-driven-dev/aidd-framework/compare/aidd-dev-v1.2.0...aidd-dev-v1.2.1) (2026-06-04)


### Miscellaneous

* reviewing rules ([6cd310a](https://github.com/ai-driven-dev/aidd-framework/commit/6cd310a18a60b25839e84e7b909d553d318f289d))

## [1.2.0](https://github.com/ai-driven-dev/aidd-framework/compare/aidd-dev-v1.1.0...aidd-dev-v1.2.0) (2026-06-03)


### Features

* **aidd-dev:** expand refactor into a 4-axis router with push-only audit handoff ([#169](https://github.com/ai-driven-dev/aidd-framework/issues/169)) ([5c5272e](https://github.com/ai-driven-dev/aidd-framework/commit/5c5272e0c8f978b20404c48f33badef60e4d3227))


### Bug Fixes

* **aidd-dev:** enforce mandatory SDLC steps so weak-model hosts cannot skip review ([#171](https://github.com/ai-driven-dev/aidd-framework/issues/171)) ([7037fdb](https://github.com/ai-driven-dev/aidd-framework/commit/7037fdb53ef3b40e10b6f135cfde61d8e9f1762c))
* **aidd-dev:** make review coherent - dedup templates, 3-level severity, read-only identity ([#170](https://github.com/ai-driven-dev/aidd-framework/issues/170)) ([a022a1a](https://github.com/ai-driven-dev/aidd-framework/commit/a022a1a46664dc846b88e6d1097372be1a06c86d))
* **framework:** make all 31 skill names spec-compliant (kebab, folder-matched, no colons) ([#172](https://github.com/ai-driven-dev/aidd-framework/issues/172)) ([a47505f](https://github.com/ai-driven-dev/aidd-framework/commit/a47505f5d63e939db0bf28629adbafec888e28e6))


### Miscellaneous

* **framework:** prepare repository for open-source launch ([35b20ae](https://github.com/ai-driven-dev/aidd-framework/commit/35b20ae5c5b4000d6f2773790b6abd8b7600a97d))

## [1.1.0](https://github.com/ai-driven-dev/aidd-framework/compare/aidd-dev-v1.0.1...aidd-dev-v1.1.0) (2026-05-29)


### Features

* **aidd-dev:** restructure audit into a read-only 7-pillar router ([#164](https://github.com/ai-driven-dev/aidd-framework/issues/164)) ([4b3a37b](https://github.com/ai-driven-dev/aidd-framework/commit/4b3a37b65ee678db7580c35d26bd33ffcbf91950))


### Bug Fixes

* **aidd-dev:** add routing dispatch to choice-router skills for weak-model hosts ([#163](https://github.com/ai-driven-dev/aidd-framework/issues/163)) ([148b6e3](https://github.com/ai-driven-dev/aidd-framework/commit/148b6e3faf650165017b4ae146fadaa394d47b6e))


### Refactoring

* **aidd-context:** unify 03-context-generate on Model Y tool-resolution ([#155](https://github.com/ai-driven-dev/aidd-framework/issues/155)) ([09e3c56](https://github.com/ai-driven-dev/aidd-framework/commit/09e3c564a3c1c12e9915f85dff7902a613919a98))

## [1.0.1](https://github.com/ai-driven-dev/aidd-framework/compare/aidd-dev-v1.0.0...aidd-dev-v1.0.1) (2026-05-21)


### Documentation

* fix coherence defects in README, docs, and plugin READMEs ([7bb04ac](https://github.com/ai-driven-dev/aidd-framework/commit/7bb04ac7f2fe922cdc2dc2402b592d5346e18166))
* fix coherence defects in README, docs, and plugin READMEs ([afcbca3](https://github.com/ai-driven-dev/aidd-framework/commit/afcbca3babc6c64714b826a83937d74ebbf2317c))

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
