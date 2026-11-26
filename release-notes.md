:robot: I have created a release *beep* *boop*
---


<details><summary>5.15.0</summary>

## [5.15.0](https://github.com/ai-driven-dev/framework/compare/v5.14.0...v5.15.0) (2026-11-26)


### Features

* **aidd-context:** carry artifact findings on the single Stop answer ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([ada1172](https://github.com/ai-driven-dev/framework/commit/ada1172bb00634b3e41101499cfde79780c9bf45))
* **aidd-context:** judge agents and commands of every host the contract fits ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([5b41e16](https://github.com/ai-driven-dev/framework/commit/5b41e168ee9c789704f307689706178ac16a16ac))
* **aidd-dev:** check the review, assert and audit files by a contract ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([4789423](https://github.com/ai-driven-dev/framework/commit/47894232d29e8df882e32cfd5b7c5b0f8e5d5248))
* **aidd-dev:** check the review, assert and audit files by a contract ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([184747b](https://github.com/ai-driven-dev/framework/commit/184747b92258d3d24db2218f8bb0d6371ea7100d))
* **aidd-qa:** publish evidence in review requests ([#1201](https://github.com/ai-driven-dev/framework/issues/1201)) ([9090f2c](https://github.com/ai-driven-dev/framework/commit/9090f2c3a943b0305eb88135c34f2aa37951f728))
* **aidd-refine:** challenge without a confidence score ([b8a4629](https://github.com/ai-driven-dev/framework/commit/b8a4629425ae1deb52d329d98449a54a8110ccb8))
* **aidd-refine:** challenge without a confidence score, its report checked through a contract ([5d2400d](https://github.com/ai-driven-dev/framework/commit/5d2400ddf4ff8749206c704fe763b44ecce5556d))
* **aidd-refine:** check the challenge report through a contract ([f3b56d3](https://github.com/ai-driven-dev/framework/commit/f3b56d32f9f7002d632f85603d2e7733883b2286))
* **aidd-refine:** check the persisted brainstorm brief and link each action to the next ([503859d](https://github.com/ai-driven-dev/framework/commit/503859d65727d2937ed0546dcf90ca4b66a4cfc3))
* **aidd-refine:** check the persisted brainstorm brief and link each action to the next ([#1084](https://github.com/ai-driven-dev/framework/issues/1084)) ([60b0f41](https://github.com/ai-driven-dev/framework/commit/60b0f4142e2c3e753ef8f1efc6f36e65bfca5566))
* **aidd-refine:** give the challenge attacks aimed at failure paths, state and claims ([c5dcfb0](https://github.com/ai-driven-dev/framework/commit/c5dcfb09fae8af2d1e40764fe059b41361f676c3))
* **aidd-refine:** keep each challenge round in the task folder ([13e75b0](https://github.com/ai-driven-dev/framework/commit/13e75b0bfcf9da5e87f186c675a6908ec38e441d))
* **aidd-refine:** lay the challenge report out like review and check it with the template op ([f378a73](https://github.com/ai-driven-dev/framework/commit/f378a738103b3f3e9dc7a220ed39560aab08021f))
* **aidd-vcs:** answer pull and merge request review comments ([#1128](https://github.com/ai-driven-dev/framework/issues/1128)) ([75659db](https://github.com/ai-driven-dev/framework/commit/75659dbcebd63e43358a051e092719fe6d52aba1))
* **cli:** run the main session and the agents on a chosen provider's models ([#1119](https://github.com/ai-driven-dev/framework/issues/1119)) ([a27436e](https://github.com/ai-driven-dev/framework/commit/a27436e06dde4abdb5f8e9714670a115841c9e2f))
* **framework:** add the generic contract engine and its vendoring ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([fb9413f](https://github.com/ai-driven-dev/framework/commit/fb9413ffe10d9a1d90f4420866038a149980ac3e))
* **framework:** check every heading level of a template, not only level 2 ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([729c4a4](https://github.com/ai-driven-dev/framework/commit/729c4a45ade6cb457f22e0061cae0e6e18464112))
* **framework:** check framework content through contracts ([8922b9b](https://github.com/ai-driven-dev/framework/commit/8922b9be53cd946e09edf45d34a46a92d128cc29))
* **framework:** check only the given files' artifacts, and regenerate with --fix ([75314b3](https://github.com/ai-driven-dev/framework/commit/75314b344bf312e488485cc6d4ce72f9e10430aa))
* **framework:** check written artifacts at turn end in plugins ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([2a3a53c](https://github.com/ai-driven-dev/framework/commit/2a3a53ce801c3f96d8da8e9de75247d8e4f1c4d1))
* **framework:** check written artifacts at turn end with a generated hook ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([aaf834c](https://github.com/ai-driven-dev/framework/commit/aaf834cfa352c5f1defb17884db54bcc12efcf29))
* **framework:** contracts declare the user-project scope of their artifacts ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([0164472](https://github.com/ai-driven-dev/framework/commit/0164472e77f7206799e597d2c0c39ad8014744e6))
* **framework:** file contracts report the real file and line of each hit ([34bb45f](https://github.com/ai-driven-dev/framework/commit/34bb45f5ca0095995150fd6d223657b4cde2a291))
* **framework:** flag a plugin whose hooks.json skips the generated artifacts hook ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([5660eab](https://github.com/ai-driven-dev/framework/commit/5660eabf39d8f03ed3d6cf213f7e88af00c9efdf))
* **framework:** generate plugin catalogs and README counts from run.cjs ([e06a9d1](https://github.com/ai-driven-dev/framework/commit/e06a9d18b642889efd9bcf014583d39dd9481998))
* **framework:** hooks status message and plan test scope rules replace tests ([b32e212](https://github.com/ai-driven-dev/framework/commit/b32e2127486024bec3b1e105ec3bbebcd620c9d8))
* **framework:** port content scripts into the DOC contract (DOC-01 to DOC-06) ([e6d7b8e](https://github.com/ai-driven-dev/framework/commit/e6d7b8e2bade260166a9cd2d976c3214a0e2231b))
* **framework:** port local-paths, JSON and hook-copy checks into REPO-04 to REPO-06 ([c1afc5c](https://github.com/ai-driven-dev/framework/commit/c1afc5c726d6e2c6f4254257bf8b0987219f5e67))
* **framework:** repo contract replaces severity, release and demo tests ([4db5aa4](https://github.com/ai-driven-dev/framework/commit/4db5aa4ae44bfddf76e8cd5cc7241990fa504efd))
* **framework:** report contract replaces the task report shape test ([7291ada](https://github.com/ai-driven-dev/framework/commit/7291ada8799cefd5c0e08480d651eddcc7cc681e))
* **framework:** run every contract over the tree and block new findings in CI ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([2ad2d4c](https://github.com/ai-driven-dev/framework/commit/2ad2d4cf2d0f4055021df7bafcf953ca55d7cf7a))
* **framework:** skill rules replace name, link and sibling tests ([ab0bde0](https://github.com/ai-driven-dev/framework/commit/ab0bde0bbe90b1cd269935da0231d8e814bd3ab1))
* **framework:** validate manifests, marketplace and settings against the official schemas ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([629cd4d](https://github.com/ai-driven-dev/framework/commit/629cd4d0d67b587acad13ca46c13bf3fd5557f56))
* **framework:** validate plans and implementation state against contracts ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([00303c4](https://github.com/ai-driven-dev/framework/commit/00303c470c5951bf0eb3a02282dab6c63c98f9fe))
* **framework:** validate rules, commands, stories and hook configs against contracts ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([b3e842c](https://github.com/ai-driven-dev/framework/commit/b3e842c0d0267e1d0dd3e941cfea202ce3bcc3c0))
* **framework:** validate skills and agents against a contract ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([8d29227](https://github.com/ai-driven-dev/framework/commit/8d29227d9eb81b979f70acbbd984cfa04953cd1a))
* **lefthook:** run the contract check in hooks and CI ([b7fd022](https://github.com/ai-driven-dev/framework/commit/b7fd02279485f1509876213831b69d5f8fd39499))
* **lefthook:** run the framework content check once through run.cjs ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([04b13c5](https://github.com/ai-driven-dev/framework/commit/04b13c509380927e65a860aff55ceb7d63a6d6cb))
* **scripts:** judge skills, agents and commands a shell command names ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([bf542c0](https://github.com/ai-driven-dev/framework/commit/bf542c06ecd23baa4222b9ab4bf034793d836f64))


### Bug Fixes

* **aidd-context:** avoid temporary skill plans and redundant rules ([7fbef3a](https://github.com/ai-driven-dev/framework/commit/7fbef3a6f63aa6367f9331ffdcedef14d6be4e58))
* **aidd-context:** avoid temporary skill plans and redundant rules ([a4837d8](https://github.com/ai-driven-dev/framework/commit/a4837d8d0f093cde9817425ae07419f57fd10c2a))
* **aidd-context:** fix the generator defects small-model trials exposed ([#1273](https://github.com/ai-driven-dev/framework/issues/1273)) ([b2a1877](https://github.com/ai-driven-dev/framework/commit/b2a187738cd45dae07aa313e34f4090c729ef281))
* **aidd-context:** keep memory's turn-end answer when the artifact check throws ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([1a07f63](https://github.com/ai-driven-dev/framework/commit/1a07f63c06a46a1944a8c5e44d82106813e1a844))
* **aidd-context:** keep skill rules on one line and drop redundant stop edges ([#1231](https://github.com/ai-driven-dev/framework/issues/1231)) ([8d67ae9](https://github.com/ai-driven-dev/framework/commit/8d67ae942fd61e36daca9b1f28a25ad065ca26c9))
* **aidd-context:** make the lean skill contract hold on small models in skill-generate ([#1249](https://github.com/ai-driven-dev/framework/issues/1249)) ([356784f](https://github.com/ai-driven-dev/framework/commit/356784f76abcd8dbeb1f7d6f6113ac24554f7e65))
* **aidd-context:** make the skill generator's scripts robust to CRLF, unsafe slugs and crashes ([#1228](https://github.com/ai-driven-dev/framework/issues/1228)) ([d99d97a](https://github.com/ai-driven-dev/framework/commit/d99d97a13896b4e85004467035349bafa84d5161))
* **aidd-context:** retry a held rename and sweep stale memory temp files ([#1018](https://github.com/ai-driven-dev/framework/issues/1018)) ([93227ef](https://github.com/ai-driven-dev/framework/commit/93227ef1110fc23835a5ecd6c3781ec4275d20de))
* **aidd-context:** write project memory through a temp file and rename ([bbb4f28](https://github.com/ai-driven-dev/framework/commit/bbb4f28d6eb3d69390a1926a4de244fd013078a8))
* **aidd-context:** write project memory through a temp file and rename ([#1018](https://github.com/ai-driven-dev/framework/issues/1018)) ([1315216](https://github.com/ai-driven-dev/framework/commit/131521645f76ea3571c09e6646016380f842ae0d))
* **aidd-dev:** let plan and phase status follow the lifecycle ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([bf0574f](https://github.com/ai-driven-dev/framework/commit/bf0574f7fea0eef837bd225a1f48fdea33d26504))
* **aidd-qa:** keep one sentence per item in acceptance QA ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([d261445](https://github.com/ai-driven-dev/framework/commit/d261445ca1a8f58ab027b200f3a96cf2c37c1a80))
* **aidd-refine:** answer with the challenge report alone and keep test results out of holds ([4ae0317](https://github.com/ai-driven-dev/framework/commit/4ae0317eaaf22422d355c6336fc400528fc84200))
* **aidd-refine:** answer with the challenge report as kept, without the read-back details ([2ed73f7](https://github.com/ai-driven-dev/framework/commit/2ed73f7c0cdf76eb361daba40c81473ebfeae5af))
* **aidd-refine:** drop findings that need an input no real use reaches before classifying the rest ([390e5ca](https://github.com/ai-driven-dev/framework/commit/390e5ca9eb3b6f97318e1b30e20b418e45fc8dbf))
* **aidd-refine:** drop from the challenge action what its links and its check already say ([8166ded](https://github.com/ai-driven-dev/framework/commit/8166dedc5228f1ddacfcb87dabc4b5be2c1e89dc))
* **aidd-refine:** drop the brief's approval status and the stop rule the diagram already draws ([#1084](https://github.com/ai-driven-dev/framework/issues/1084)) ([8b16d58](https://github.com/ai-driven-dev/framework/commit/8b16d582fc29bf9222e97406efc031ce1f626f43))
* **aidd-refine:** keep the stop rule in the router, where a model applies it on every turn ([#1084](https://github.com/ai-driven-dev/framework/issues/1084)) ([4a09c5b](https://github.com/ai-driven-dev/framework/commit/4a09c5b1a2d688f7ee2e2319a9ec0984a92bfc50))
* **aidd-refine:** let a stop end the questions where they are asked ([#1084](https://github.com/ai-driven-dev/framework/issues/1084)) ([65b8ec9](https://github.com/ai-driven-dev/framework/commit/65b8ec9ce910540d0365e7acf0f6918180fb990a))
* **aidd-refine:** link the brief check and keep its step to the authoring form ([#1084](https://github.com/ai-driven-dev/framework/issues/1084)) ([b6f4273](https://github.com/ai-driven-dev/framework/commit/b6f4273fe53734eae24ce09af2a69cb9aa4e35db))
* **aidd-refine:** link the challenge check and keep its step to the authoring form ([efa8a9e](https://github.com/ai-driven-dev/framework/commit/efa8a9e289d866062effe95ba2564939e2c4c76b))
* **aidd-refine:** run the challenge report's check before answering ([453b380](https://github.com/ai-driven-dev/framework/commit/453b3801e40e004c95b114e47eaf579368d71779))
* **aidd-refine:** run the challenge report's check before answering ([34e7df5](https://github.com/ai-driven-dev/framework/commit/34e7df5f3949ebe4fc9e689fefc206a770dd34aa))
* **aidd-refine:** state challenge's input in one line and select techniques where they are applied ([31a764e](https://github.com/ai-driven-dev/framework/commit/31a764efb8f7ca0d6cdc1215bb874ad4ca4fca43))
* **aidd-refine:** stop the brief check after three passes, as the other report checks do ([#1084](https://github.com/ai-driven-dev/framework/issues/1084)) ([99f8940](https://github.com/ai-driven-dev/framework/commit/99f8940f534d6402e3d3d7deca4403417bf5af09))
* **cli:** drop the comments that cited a removed reference ([#1257](https://github.com/ai-driven-dev/framework/issues/1257)) ([28cdb8c](https://github.com/ai-driven-dev/framework/commit/28cdb8c08d1f54ff6f186a62117fab71c758300e))
* **framework:** align five templates with what their writers produce ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([286b619](https://github.com/ai-driven-dev/framework/commit/286b6192ae7a64105715c3d13aed6a99c444d8f0))
* **framework:** exit 2 when a contract mapping matches no file ([4c24aeb](https://github.com/ai-driven-dev/framework/commit/4c24aebc5cae9705b35b233788f77f8b94a841ec))
* **framework:** keep each plugin's artifact hook state apart and survive bad entries ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([5c25dfe](https://github.com/ai-driven-dev/framework/commit/5c25dfe52b506d579d175e82005be017668a4809))
* **framework:** keep the recipe template on the slot form the CLI validator reads ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([7871e11](https://github.com/ai-driven-dev/framework/commit/7871e11996dcdbc807f4a23e79e7ba752ae75c2f))
* **framework:** key the contract baseline on the finding and make it a ratchet ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([9fcca4a](https://github.com/ai-driven-dev/framework/commit/9fcca4ad19b38fee11349adcbe4d3cfdc9e04689))
* **framework:** let --update-baseline only shrink the baseline ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([e6dabf9](https://github.com/ai-driven-dev/framework/commit/e6dabf96e7d4c8fc32ab3470995d2d8ead21cc54))
* **framework:** let a contract with no rules run ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([34482f6](https://github.com/ai-driven-dev/framework/commit/34482f60cb86ecffd4d439d3c9bf3774e6ce1b0a))
* **framework:** make artifact hook findings fixable on every host ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([de8c519](https://github.com/ai-driven-dev/framework/commit/de8c519c53089ea3fd268782dfe388b29ec81260))
* **framework:** mark the remaining template slots as {{...}} ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([bb11a8d](https://github.com/ai-driven-dev/framework/commit/bb11a8dfb09fc1ffec0165a461da38bf7bbc5815))
* **framework:** report posix paths on Windows and clear CodeQL test alerts ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([5395abb](https://github.com/ai-driven-dev/framework/commit/5395abb5ff23ab9a12ded3caa996e3cbb835623e))
* **framework:** run repo-wide contracts when a scoped file is one they read ([382362f](https://github.com/ai-driven-dev/framework/commit/382362f84246768ccbcb4d92aac66daa781bb797))
* **framework:** show a slotted heading as a fill-in in its finding ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([0a0ecd9](https://github.com/ai-driven-dev/framework/commit/0a0ecd9066565fccbf72641ad743261c834911ff))
* **framework:** skip install-written artifacts in the shell scan and cap the Stop answer ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([81daa38](https://github.com/ai-driven-dev/framework/commit/81daa38d3b120ce5fdef3affcc2be6d28629d08b))
* **framework:** walk each artifact scope once at turn end ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([96d8b96](https://github.com/ai-driven-dev/framework/commit/96d8b96005daacc29b34da17a4acaa0b803053ca))
* **framework:** word a slotted missing heading as a shape, reset stack on 2nd title ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([30dbace](https://github.com/ai-driven-dev/framework/commit/30dbace4016bc4b935dc0b1a5271bd0229727662))
* **hooks:** stage only the generated docs the hook rewrote ([#1165](https://github.com/ai-driven-dev/framework/issues/1165)) ([53dc3d7](https://github.com/ai-driven-dev/framework/commit/53dc3d7c2a180fe96f0b2dcc0fc50543b2c5acd4))
* **lefthook:** stage the generated outputs run.cjs --fix writes ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([847aa17](https://github.com/ai-driven-dev/framework/commit/847aa1768c6049fa3e4784a81d8957fe0ce1e27e))
* **refine:** clarify conversation review recommendations ([#1161](https://github.com/ai-driven-dev/framework/issues/1161)) ([de9fd10](https://github.com/ai-driven-dev/framework/commit/de9fd101f1594e6e11114fb5638458c7bffbab6a))
* **scripts:** make the unknown heading fix one instruction ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([2e2e849](https://github.com/ai-driven-dev/framework/commit/2e2e8498f353b42ff0358d5b2178f41b7335d300))
* **scripts:** say where an unknown template heading belongs ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([2a5e16a](https://github.com/ai-driven-dev/framework/commit/2a5e16a4ee33055d98b46f2bc6f78e02b7158b3c))
* **scripts:** skip the generated .aidd cache in the link check ([81041b0](https://github.com/ai-driven-dev/framework/commit/81041b07aed3334b031b7198517ea2dc1ca0a4dd))
* **scripts:** skip the generated .aidd cache in the link check ([#1112](https://github.com/ai-driven-dev/framework/issues/1112)) ([5c2c3d6](https://github.com/ai-driven-dev/framework/commit/5c2c3d61d1ce2fa190d3056a431245d257cbe2b1))


### Miscellaneous

* **aidd-dev:** sync the engine copies of assert, audit and review ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([149c46b](https://github.com/ai-driven-dev/framework/commit/149c46beee9961f7d563280bdb5908318bb5f5cc))
* **aidd-refine:** move the challenge hook onto the plugin's shared engine ([4547b80](https://github.com/ai-driven-dev/framework/commit/4547b80adba758059d535b97b368b18739edf1c2))
* **aidd-refine:** sync the challenge contract's engine copies ([54b77ef](https://github.com/ai-driven-dev/framework/commit/54b77ef615276d946f673a22f1a00b168a77c358))
* **aidd-refine:** sync the challenge contract's engine copies ([472b6d1](https://github.com/ai-driven-dev/framework/commit/472b6d1302f441337a7472ae1fb2f8a6792fcbb6))
* **deps:** bump @inquirer/prompts from 8.7.5 to 8.8.0 in /cli ([#1267](https://github.com/ai-driven-dev/framework/issues/1267)) ([ff215aa](https://github.com/ai-driven-dev/framework/commit/ff215aa4a6f308d1aff8aa315ff79f27b71a8f57))
* **deps:** bump commander from 15.0.0 to 15.1.0 in /cli ([#1268](https://github.com/ai-driven-dev/framework/issues/1268)) ([184d2f8](https://github.com/ai-driven-dev/framework/commit/184d2f882a5091092e67b24f2042c27238b4dff8))
* **deps:** bump commander from 15.0.0 to 15.1.0 in /kanban ([#1269](https://github.com/ai-driven-dev/framework/issues/1269)) ([cb4c104](https://github.com/ai-driven-dev/framework/commit/cb4c10489289e14f4a43bf2527aaeda9955f02a7))
* **deps:** bump simple-git from 4.0.2 to 4.1.0 in /cli ([#1327](https://github.com/ai-driven-dev/framework/issues/1327)) ([95d67b6](https://github.com/ai-driven-dev/framework/commit/95d67b6f679abd6f88d469991855c35c5b9cd73e))
* **framework:** merge feat/1149-artifact-hook ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([0c0a8e3](https://github.com/ai-driven-dev/framework/commit/0c0a8e38f6b3d40a8780a0df1f72e04ddd061c5f))
* **framework:** merge feat/1149-artifact-hook ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([78e439e](https://github.com/ai-driven-dev/framework/commit/78e439e8e5cfdef47184869cd67dbc940fdc4e05))
* **framework:** merge feat/1149-artifact-hook ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([0bf6668](https://github.com/ai-driven-dev/framework/commit/0bf6668b35193985f0bef0b878e489d968f8edeb))
* **framework:** merge feat/1149-artifact-hook fix and finish the review notes ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([0306a19](https://github.com/ai-driven-dev/framework/commit/0306a19a4db20d9bd16a53b162744b7410fae4da))
* **framework:** merge feat/1149-artifact-hook into 1149-dev-contracts ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([e4b357a](https://github.com/ai-driven-dev/framework/commit/e4b357a97982e5d0db7d881bb5fcd432073eae3d))
* **framework:** merge feat/1149-artifact-hook into feat/1149-dev-contracts ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([6e866b8](https://github.com/ai-driven-dev/framework/commit/6e866b87c431085ed8cf1a9dd5b5baf85cd07d4c))
* **framework:** merge feat/1149-artifact-hook into feat/1149-dev-contracts ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([91f67b6](https://github.com/ai-driven-dev/framework/commit/91f67b6eec40c2e0b216baea4b5405ae3c958240))
* **framework:** merge feat/1149-artifact-hook into feat/1149-dev-contracts ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([c893f72](https://github.com/ai-driven-dev/framework/commit/c893f7279e719fb6e2e354bc38acc69891c13f90))
* **framework:** merge feat/1149-artifact-hook into feat/1149-dev-contracts ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([92a2713](https://github.com/ai-driven-dev/framework/commit/92a2713f4308ea9a399c9669c1e3a539d0d74002))
* **framework:** merge feat/1149-artifact-hook into feat/1149-dev-contracts ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([0d4b0d0](https://github.com/ai-driven-dev/framework/commit/0d4b0d012108cbe6ab28899e89e0c3491463efc8))
* **framework:** merge feat/1149-contract-validation fix ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([24b504a](https://github.com/ai-driven-dev/framework/commit/24b504a00a06a8317f44c3af3e96ddbfcd4fb20f))
* **framework:** merge feat/1149-contract-validation into 1165-run-in-hooks ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([95c2fdf](https://github.com/ai-driven-dev/framework/commit/95c2fdfd6d7b3754bf796b957d40d986a6d147d5))
* **framework:** merge feat/1149-contract-validation into feat/1165-run-in-hooks ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([77ff1f4](https://github.com/ai-driven-dev/framework/commit/77ff1f4083719f9847904bdecbfeba2d28bd8fe8))
* **framework:** merge feat/1149-contract-validation into feat/1165-run-in-hooks ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([d38cb90](https://github.com/ai-driven-dev/framework/commit/d38cb90ba2d5f4fac910488e1947403a6c9a3733))
* **framework:** merge feat/1149-contract-validation into feat/1165-run-in-hooks ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([362cbd9](https://github.com/ai-driven-dev/framework/commit/362cbd93b00baf8360fb53ee8f951a7e32403104))
* **framework:** merge feat/1149-contract-validation into feat/1165-run-in-hooks ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([e2e5457](https://github.com/ai-driven-dev/framework/commit/e2e5457bf448bf666fb592263925dc7e6e1552b4))
* **framework:** merge feat/1165-run-in-hooks ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([653669b](https://github.com/ai-driven-dev/framework/commit/653669b9e00a5f000b86e6fb803561c6ba920f6b))
* **framework:** merge feat/1165-run-in-hooks fix ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([90b76ad](https://github.com/ai-driven-dev/framework/commit/90b76ad47edf6a0e8017aa6b85c5b5d92564e152))
* **framework:** merge feat/1165-run-in-hooks into 1149-artifact-hook ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([6afd0fb](https://github.com/ai-driven-dev/framework/commit/6afd0fb1373411ac49502a5b98b411344ab9a11b))
* **framework:** merge feat/1165-run-in-hooks into feat/1149-artifact-hook ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([6f8e939](https://github.com/ai-driven-dev/framework/commit/6f8e939db6e2ddbec52e1dad0ad110af3562dcad))
* **framework:** merge feat/1165-run-in-hooks into feat/1149-artifact-hook ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([a6578b3](https://github.com/ai-driven-dev/framework/commit/a6578b3b2de16c980549a174e2d5abe5c2a31640))
* **framework:** merge feat/1165-run-in-hooks into feat/1149-artifact-hook ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([e4a6220](https://github.com/ai-driven-dev/framework/commit/e4a6220d75533404e7fcfc22e1ee7faab4332e9b))
* **framework:** merge feat/1165-run-in-hooks into feat/1149-artifact-hook ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([edbcba0](https://github.com/ai-driven-dev/framework/commit/edbcba0c438a761dd3d0473fafe1cbf35422f5a2))
* **framework:** merge next into contract validation ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([789c554](https://github.com/ai-driven-dev/framework/commit/789c55471d75f7ec72af2dc0ba609818be54c636))
* **framework:** sync contract ops copies ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([8b5a15a](https://github.com/ai-driven-dev/framework/commit/8b5a15a520ebd41a6064d7cb0e9f6e00ac39aa7c))
* **framework:** sync contract ops copies ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([eb5b35f](https://github.com/ai-driven-dev/framework/commit/eb5b35fc84af24fc38e225b09378711f896bbfdf))
* **scripts:** re-sync engine copies ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([d47324b](https://github.com/ai-driven-dev/framework/commit/d47324b4c83b489c6d5585d405832a2d8405265e))
* **scripts:** re-sync engine copies ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([54e0725](https://github.com/ai-driven-dev/framework/commit/54e0725a0d10f000958e071198cd631ef58548c8))
* **scripts:** re-sync engine copies ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([448d650](https://github.com/ai-driven-dev/framework/commit/448d65043b8499576df6a0458000b40dc802f510))
* **scripts:** re-sync engine copies ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([909bc3b](https://github.com/ai-driven-dev/framework/commit/909bc3b6ddb634dbe617b1eff0af4f2752ffa9f7))


### Documentation

* **aidd-context:** shorten scaffold instruction ([b57918d](https://github.com/ai-driven-dev/framework/commit/b57918d16c97379a2562b2307ed771f243475c3a))
* **aidd-context:** word the validate step the same in every skill ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([f94654a](https://github.com/ai-driven-dev/framework/commit/f94654a095555005c3a3e7774682263b8f5ac757))
* **aidd-dev:** word the assert and review validate step like the others ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([d85dc61](https://github.com/ai-driven-dev/framework/commit/d85dc61efebd88464f04a09cff631d4cda626547))
* **framework:** accept the shell-turn hand-edit limit in the artifact hook spec ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([eca159f](https://github.com/ai-driven-dev/framework/commit/eca159ff8f84c617906c3cb5528b3482ef96bd1d))
* **framework:** add a challenge pass over every check before wiring ([23bf946](https://github.com/ai-driven-dev/framework/commit/23bf9462467f93867f467e44c2ca71e0e378ba6c))
* **framework:** bound the validate loops and note baseline renames ([e40f4eb](https://github.com/ai-driven-dev/framework/commit/e40f4eba998d0999ff452972499bd8131c3adc0e))
* **framework:** document shell false and the template-contract pairing ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([d3f1b07](https://github.com/ai-driven-dev/framework/commit/d3f1b0777d8979df8b30342419268e06ee2b94a2))
* **framework:** list every template of the slot conversion ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([7d7b54b](https://github.com/ai-driven-dev/framework/commit/7d7b54b48af65b3cdb88168bd572d4592ec92d60))
* **framework:** mark every template slot as {{&}} ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([04119a5](https://github.com/ai-driven-dev/framework/commit/04119a5f9b8d2b91fbff6b8f1f721c1993e0b0c0))
* **framework:** name the hook copies sync.cjs generates ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([ee10343](https://github.com/ai-driven-dev/framework/commit/ee103436bdee49e6abdb877ee2ce8a1cf12ea116))
* **framework:** name where contracts live and what generates their copies ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([17f0593](https://github.com/ai-driven-dev/framework/commit/17f059325491e05f9c47fd03d7f5ce372b947d94))
* **framework:** plan artifact validation tranche 1 ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([d6eedb6](https://github.com/ai-driven-dev/framework/commit/d6eedb62661ba1674a1f3228c425624ec8d28bc3))
* **framework:** plan the turn-end artifact check in three phases ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([48641c2](https://github.com/ai-driven-dev/framework/commit/48641c2ae587c903d4303760adc98ee8267b97e5))
* **framework:** point the hooks references at PR [#1316](https://github.com/ai-driven-dev/framework/issues/1316), not the unrelated [#1165](https://github.com/ai-driven-dev/framework/issues/1165) ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([f50cb77](https://github.com/ai-driven-dev/framework/commit/f50cb77229882ca7a5880b49eef1ffaa2cde28e4))
* **framework:** re-measure the artifact hook timing after the walk fix ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([614f875](https://github.com/ai-driven-dev/framework/commit/614f87549fc35377422b7b1bcc4b5664414bc2fb))
* **framework:** record the artifact hook run and close its plan ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([1314470](https://github.com/ai-driven-dev/framework/commit/1314470cd412bc180d871a8a14db7046c2465f24))
* **framework:** say how to add a contract for a new artifact kind ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([2d90673](https://github.com/ai-driven-dev/framework/commit/2d90673f4dd7508e78c2556f13b9cc5796e0bfd8))
* **framework:** spec and plan to unify framework checks behind contracts ([79e6c23](https://github.com/ai-driven-dev/framework/commit/79e6c23159313e26b682ffdd0448c558e24fae1c))
* **framework:** spec artifact validation tranche 1 ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([07ae3cd](https://github.com/ai-driven-dev/framework/commit/07ae3cd481e4480d563ad859c1ac302888a79240))
* **framework:** spec the turn-end artifact check plugins ship to users ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([27a2da3](https://github.com/ai-driven-dev/framework/commit/27a2da3126ff689a0c4a625d5e276b38709c3d84))


### Refactoring

* **aidd-context:** apply the lean skill contract to agent-generate ([#1233](https://github.com/ai-driven-dev/framework/issues/1233)) ([d43935a](https://github.com/ai-driven-dev/framework/commit/d43935a2658d15aae9fe165428b1d4184f62552d))
* **aidd-context:** apply the lean skill contract to command-generate ([#1243](https://github.com/ai-driven-dev/framework/issues/1243)) ([2d0ed46](https://github.com/ai-driven-dev/framework/commit/2d0ed4613ed4fe742f9608f703490e5ca4e62018))
* **aidd-context:** apply the lean skill contract to hook-generate ([#1248](https://github.com/ai-driven-dev/framework/issues/1248)) ([a693b26](https://github.com/ai-driven-dev/framework/commit/a693b26cb3cf28d904dab27b87fc9e96406424f6))
* **aidd-context:** apply the lean skill contract to rule-generate ([#1226](https://github.com/ai-driven-dev/framework/issues/1226)) ([0604eaf](https://github.com/ai-driven-dev/framework/commit/0604eaf1a94be04b966c989052ef0edbf09aa719))
* **aidd-context:** rewrite learn in the generator skill format ([#1271](https://github.com/ai-driven-dev/framework/issues/1271)) ([d5c6141](https://github.com/ai-driven-dev/framework/commit/d5c61413020629f1e26829ff7f85a28286591dd4))
* **aidd-context:** route context-generate through a diagram ([#1256](https://github.com/ai-driven-dev/framework/issues/1256)) ([62df139](https://github.com/ai-driven-dev/framework/commit/62df13905d60c839ffd20b597b90d153cf48ae13))
* **aidd-context:** streamline skill generation and validation ([#1092](https://github.com/ai-driven-dev/framework/issues/1092)) ([99958de](https://github.com/ai-driven-dev/framework/commit/99958de8e1e26dfd55fdead871e5450b1b350697))
* **aidd-dev:** drop the plan Test Scope rule the template already holds ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([2c32195](https://github.com/ai-driven-dev/framework/commit/2c32195eec441f12ae65a43bed792c5b99362f15))
* **aidd-dev:** regenerate the review skill in the lean format ([#1200](https://github.com/ai-driven-dev/framework/issues/1200)) ([af4b511](https://github.com/ai-driven-dev/framework/commit/af4b511b618fce47727628e53b390838cf4e709e))
* **aidd-refine:** attack duplication and give the challenge decision its own reference ([5673d88](https://github.com/ai-driven-dev/framework/commit/5673d8845add324bbb859ef89cf35f7b5668330e))
* **aidd-refine:** fit the challenge skill to the skill authoring rules ([e757f94](https://github.com/ai-driven-dev/framework/commit/e757f9450d4c14288cb96da35f493255238a4477))
* **aidd-refine:** give shadow-areas a router, a report contract and one home per fact ([e4c1d4f](https://github.com/ai-driven-dev/framework/commit/e4c1d4f5cfa2817e97bc9e632f76c54fbca78ffe))
* **aidd-refine:** give shadow-areas a router, a report contract and one home per fact ([4d34d93](https://github.com/ai-driven-dev/framework/commit/4d34d93a2ab2164c5dc79b40b5b8bdb3383c7590))
* **aidd-refine:** lean the challenge skill to the skill authoring format ([ad12762](https://github.com/ai-driven-dev/framework/commit/ad12762be801d56cacb1d9e3e544af79b8612560))
* **aidd-refine:** write the brainstorm skill in the skill generator's format ([#1084](https://github.com/ai-driven-dev/framework/issues/1084)) ([b2cad96](https://github.com/ai-driven-dev/framework/commit/b2cad96fdba1e8a82b53983a4b9fa639f93c42b4))
* **framework:** delete the content scripts the contracts replaced ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([522d4b9](https://github.com/ai-driven-dev/framework/commit/522d4b9809160148a5965d6f27ee0188a28c6838))
* **framework:** drop memory-skill-files, covered by MEMORY-03, 06, 07 ([c6a2f18](https://github.com/ai-driven-dev/framework/commit/c6a2f18ae40034e3959685ad08be009c5a3f9793))
* **framework:** drop memory-templates, covered by MEMORY-04, 05, 06 ([c8a6404](https://github.com/ai-driven-dev/framework/commit/c8a6404b8282fceff654126c57ef3634fca1e260))
* **framework:** drop the rules another rule covers ([f0a3a74](https://github.com/ai-driven-dev/framework/commit/f0a3a7427a62f4430836f4761b7f27d93282c052))
* **framework:** drop the unused scaffold engine file and its copies ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([54024d3](https://github.com/ai-driven-dev/framework/commit/54024d3fe314eb844c077c4a528a92d26fa1b9aa))
* **framework:** drop unused engine options and tighten contract loading ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([ab232ba](https://github.com/ai-driven-dev/framework/commit/ab232ba19d67f78b492e8b96214f69843f1d6143))
* **framework:** generators never write without fix, doc links skip skills ([f893128](https://github.com/ai-driven-dev/framework/commit/f8931280fd2c559a0923ec287377421ff93a87de))
* **framework:** key the baseline on file and rule, counted ([3675edf](https://github.com/ai-driven-dev/framework/commit/3675edf0471fe02453fd49b4760da51c7d3d669d))
* **framework:** leave the continuation Stop guard to the host adapter ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([8b69f1e](https://github.com/ai-driven-dev/framework/commit/8b69f1e183e278246ea350807db94158e3cfa2ba))
* **framework:** match watch globs with the engine's glob ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([a4a3199](https://github.com/ai-driven-dev/framework/commit/a4a319955aeae0268c0de555f903fbc1a6cf0d7a))
* **framework:** move contract checks to scripts/check, contracts name their targets ([422923f](https://github.com/ai-driven-dev/framework/commit/422923f44849fb9910e7a4b542b9da5f36c6c491))
* **framework:** move the hooks contract out of 08-hook-generate ([ad63ad5](https://github.com/ai-driven-dev/framework/commit/ad63ad5cbc0d75cea16999e6a38023a7f85c0e62))
* **framework:** move the model-selection content case to the repo rule REPO-08 ([0a9a22a](https://github.com/ai-driven-dev/framework/commit/0a9a22a375812cd20480fb3e34f049706f71afdf))
* **framework:** one hook engine per plugin, sync writes host.cjs ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([f6f68b5](https://github.com/ai-driven-dev/framework/commit/f6f68b57fd67508c31046d145cca5b090d4b681f))
* **framework:** one source for hook status messages and plugin manifest fields ([49cf1a5](https://github.com/ai-driven-dev/framework/commit/49cf1a53d4d6f52db3af684b1fe6d1c9f1d09fe9))
* **framework:** replace architecture-doc-matches-the-tree with a generator and DOC-07 ([670fae5](https://github.com/ai-driven-dev/framework/commit/670fae5560a4958bb7a43a176abcb48014ee2e20))
* **framework:** replace memory-rules-table with the memory contract ([60e7e48](https://github.com/ai-driven-dev/framework/commit/60e7e488efbf586cf11fcb1c59496a94e7e17228))
* **framework:** replace source-stays-text with the repo rule REPO-07 ([d070a7b](https://github.com/ai-driven-dev/framework/commit/d070a7bdd642222a9647ca3815f9795549222e25))
* **framework:** run one memory template lint rule over every template ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([b7a3c15](https://github.com/ai-driven-dev/framework/commit/b7a3c1522a238e111a2b65c65c0b8369285d6efb))
* **framework:** sdlc-demo checks cited skills only, hook copies drop majority vote ([adcec73](https://github.com/ai-driven-dev/framework/commit/adcec73c4b6425f8c8250029ae83bfb2d3ad54d4))
* **framework:** surface crashes, tidy the engine, rename contract files ([972cbb1](https://github.com/ai-driven-dev/framework/commit/972cbb1979cb6f9d6628e859edb22a8e5ea106de))
* **scripts:** drop the dead retired key from the contract engine ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([1fb2a6f](https://github.com/ai-driven-dev/framework/commit/1fb2a6facb0dc2adb3827182110e90a3479a8cf6))
</details>

<details><summary>aidd-context: 2.12.0</summary>

## [2.12.0](https://github.com/ai-driven-dev/framework/compare/aidd-context-v2.11.0...aidd-context-v2.12.0) (2026-11-26)


### Features

* **aidd-context:** carry artifact findings on the single Stop answer ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([ada1172](https://github.com/ai-driven-dev/framework/commit/ada1172bb00634b3e41101499cfde79780c9bf45))
* **aidd-context:** judge agents and commands of every host the contract fits ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([5b41e16](https://github.com/ai-driven-dev/framework/commit/5b41e168ee9c789704f307689706178ac16a16ac))
* **framework:** check every heading level of a template, not only level 2 ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([729c4a4](https://github.com/ai-driven-dev/framework/commit/729c4a45ade6cb457f22e0061cae0e6e18464112))
* **framework:** check framework content through contracts ([8922b9b](https://github.com/ai-driven-dev/framework/commit/8922b9be53cd946e09edf45d34a46a92d128cc29))
* **framework:** check written artifacts at turn end in plugins ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([2a3a53c](https://github.com/ai-driven-dev/framework/commit/2a3a53ce801c3f96d8da8e9de75247d8e4f1c4d1))
* **framework:** check written artifacts at turn end with a generated hook ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([aaf834c](https://github.com/ai-driven-dev/framework/commit/aaf834cfa352c5f1defb17884db54bcc12efcf29))
* **framework:** contracts declare the user-project scope of their artifacts ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([0164472](https://github.com/ai-driven-dev/framework/commit/0164472e77f7206799e597d2c0c39ad8014744e6))
* **framework:** file contracts report the real file and line of each hit ([34bb45f](https://github.com/ai-driven-dev/framework/commit/34bb45f5ca0095995150fd6d223657b4cde2a291))
* **framework:** skill rules replace name, link and sibling tests ([ab0bde0](https://github.com/ai-driven-dev/framework/commit/ab0bde0bbe90b1cd269935da0231d8e814bd3ab1))
* **framework:** validate manifests, marketplace and settings against the official schemas ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([629cd4d](https://github.com/ai-driven-dev/framework/commit/629cd4d0d67b587acad13ca46c13bf3fd5557f56))
* **framework:** validate rules, commands, stories and hook configs against contracts ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([b3e842c](https://github.com/ai-driven-dev/framework/commit/b3e842c0d0267e1d0dd3e941cfea202ce3bcc3c0))
* **framework:** validate skills and agents against a contract ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([8d29227](https://github.com/ai-driven-dev/framework/commit/8d29227d9eb81b979f70acbbd984cfa04953cd1a))
* **lefthook:** run the contract check in hooks and CI ([b7fd022](https://github.com/ai-driven-dev/framework/commit/b7fd02279485f1509876213831b69d5f8fd39499))
* **scripts:** judge skills, agents and commands a shell command names ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([bf542c0](https://github.com/ai-driven-dev/framework/commit/bf542c06ecd23baa4222b9ab4bf034793d836f64))


### Bug Fixes

* **aidd-context:** avoid temporary skill plans and redundant rules ([7fbef3a](https://github.com/ai-driven-dev/framework/commit/7fbef3a6f63aa6367f9331ffdcedef14d6be4e58))
* **aidd-context:** avoid temporary skill plans and redundant rules ([a4837d8](https://github.com/ai-driven-dev/framework/commit/a4837d8d0f093cde9817425ae07419f57fd10c2a))
* **aidd-context:** fix the generator defects small-model trials exposed ([#1273](https://github.com/ai-driven-dev/framework/issues/1273)) ([b2a1877](https://github.com/ai-driven-dev/framework/commit/b2a187738cd45dae07aa313e34f4090c729ef281))
* **aidd-context:** keep memory's turn-end answer when the artifact check throws ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([1a07f63](https://github.com/ai-driven-dev/framework/commit/1a07f63c06a46a1944a8c5e44d82106813e1a844))
* **aidd-context:** keep skill rules on one line and drop redundant stop edges ([#1231](https://github.com/ai-driven-dev/framework/issues/1231)) ([8d67ae9](https://github.com/ai-driven-dev/framework/commit/8d67ae942fd61e36daca9b1f28a25ad065ca26c9))
* **aidd-context:** make the lean skill contract hold on small models in skill-generate ([#1249](https://github.com/ai-driven-dev/framework/issues/1249)) ([356784f](https://github.com/ai-driven-dev/framework/commit/356784f76abcd8dbeb1f7d6f6113ac24554f7e65))
* **aidd-context:** make the skill generator's scripts robust to CRLF, unsafe slugs and crashes ([#1228](https://github.com/ai-driven-dev/framework/issues/1228)) ([d99d97a](https://github.com/ai-driven-dev/framework/commit/d99d97a13896b4e85004467035349bafa84d5161))
* **aidd-context:** retry a held rename and sweep stale memory temp files ([#1018](https://github.com/ai-driven-dev/framework/issues/1018)) ([93227ef](https://github.com/ai-driven-dev/framework/commit/93227ef1110fc23835a5ecd6c3781ec4275d20de))
* **aidd-context:** write project memory through a temp file and rename ([bbb4f28](https://github.com/ai-driven-dev/framework/commit/bbb4f28d6eb3d69390a1926a4de244fd013078a8))
* **aidd-context:** write project memory through a temp file and rename ([#1018](https://github.com/ai-driven-dev/framework/issues/1018)) ([1315216](https://github.com/ai-driven-dev/framework/commit/131521645f76ea3571c09e6646016380f842ae0d))
* **framework:** align five templates with what their writers produce ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([286b619](https://github.com/ai-driven-dev/framework/commit/286b6192ae7a64105715c3d13aed6a99c444d8f0))
* **framework:** keep each plugin's artifact hook state apart and survive bad entries ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([5c25dfe](https://github.com/ai-driven-dev/framework/commit/5c25dfe52b506d579d175e82005be017668a4809))
* **framework:** keep the recipe template on the slot form the CLI validator reads ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([7871e11](https://github.com/ai-driven-dev/framework/commit/7871e11996dcdbc807f4a23e79e7ba752ae75c2f))
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

* **aidd-context:** shorten scaffold instruction ([b57918d](https://github.com/ai-driven-dev/framework/commit/b57918d16c97379a2562b2307ed771f243475c3a))
* **aidd-context:** word the validate step the same in every skill ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([f94654a](https://github.com/ai-driven-dev/framework/commit/f94654a095555005c3a3e7774682263b8f5ac757))
* **framework:** bound the validate loops and note baseline renames ([e40f4eb](https://github.com/ai-driven-dev/framework/commit/e40f4eba998d0999ff452972499bd8131c3adc0e))
* **framework:** mark every template slot as {{&}} ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([04119a5](https://github.com/ai-driven-dev/framework/commit/04119a5f9b8d2b91fbff6b8f1f721c1993e0b0c0))


### Refactoring

* **aidd-context:** apply the lean skill contract to agent-generate ([#1233](https://github.com/ai-driven-dev/framework/issues/1233)) ([d43935a](https://github.com/ai-driven-dev/framework/commit/d43935a2658d15aae9fe165428b1d4184f62552d))
* **aidd-context:** apply the lean skill contract to command-generate ([#1243](https://github.com/ai-driven-dev/framework/issues/1243)) ([2d0ed46](https://github.com/ai-driven-dev/framework/commit/2d0ed4613ed4fe742f9608f703490e5ca4e62018))
* **aidd-context:** apply the lean skill contract to hook-generate ([#1248](https://github.com/ai-driven-dev/framework/issues/1248)) ([a693b26](https://github.com/ai-driven-dev/framework/commit/a693b26cb3cf28d904dab27b87fc9e96406424f6))
* **aidd-context:** apply the lean skill contract to rule-generate ([#1226](https://github.com/ai-driven-dev/framework/issues/1226)) ([0604eaf](https://github.com/ai-driven-dev/framework/commit/0604eaf1a94be04b966c989052ef0edbf09aa719))
* **aidd-context:** rewrite learn in the generator skill format ([#1271](https://github.com/ai-driven-dev/framework/issues/1271)) ([d5c6141](https://github.com/ai-driven-dev/framework/commit/d5c61413020629f1e26829ff7f85a28286591dd4))
* **aidd-context:** route context-generate through a diagram ([#1256](https://github.com/ai-driven-dev/framework/issues/1256)) ([62df139](https://github.com/ai-driven-dev/framework/commit/62df13905d60c839ffd20b597b90d153cf48ae13))
* **aidd-context:** streamline skill generation and validation ([#1092](https://github.com/ai-driven-dev/framework/issues/1092)) ([99958de](https://github.com/ai-driven-dev/framework/commit/99958de8e1e26dfd55fdead871e5450b1b350697))
* **aidd-refine:** give shadow-areas a router, a report contract and one home per fact ([e4c1d4f](https://github.com/ai-driven-dev/framework/commit/e4c1d4f5cfa2817e97bc9e632f76c54fbca78ffe))
* **framework:** delete the content scripts the contracts replaced ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([522d4b9](https://github.com/ai-driven-dev/framework/commit/522d4b9809160148a5965d6f27ee0188a28c6838))
* **framework:** drop the rules another rule covers ([f0a3a74](https://github.com/ai-driven-dev/framework/commit/f0a3a7427a62f4430836f4761b7f27d93282c052))
* **framework:** drop the unused scaffold engine file and its copies ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([54024d3](https://github.com/ai-driven-dev/framework/commit/54024d3fe314eb844c077c4a528a92d26fa1b9aa))
* **framework:** drop unused engine options and tighten contract loading ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([ab232ba](https://github.com/ai-driven-dev/framework/commit/ab232ba19d67f78b492e8b96214f69843f1d6143))
* **framework:** leave the continuation Stop guard to the host adapter ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([8b69f1e](https://github.com/ai-driven-dev/framework/commit/8b69f1e183e278246ea350807db94158e3cfa2ba))
* **framework:** match watch globs with the engine's glob ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([a4a3199](https://github.com/ai-driven-dev/framework/commit/a4a319955aeae0268c0de555f903fbc1a6cf0d7a))
* **framework:** move contract checks to scripts/check, contracts name their targets ([422923f](https://github.com/ai-driven-dev/framework/commit/422923f44849fb9910e7a4b542b9da5f36c6c491))
* **framework:** move the hooks contract out of 08-hook-generate ([ad63ad5](https://github.com/ai-driven-dev/framework/commit/ad63ad5cbc0d75cea16999e6a38023a7f85c0e62))
* **framework:** one hook engine per plugin, sync writes host.cjs ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([f6f68b5](https://github.com/ai-driven-dev/framework/commit/f6f68b57fd67508c31046d145cca5b090d4b681f))
* **framework:** surface crashes, tidy the engine, rename contract files ([972cbb1](https://github.com/ai-driven-dev/framework/commit/972cbb1979cb6f9d6628e859edb22a8e5ea106de))
* **scripts:** drop the dead retired key from the contract engine ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([1fb2a6f](https://github.com/ai-driven-dev/framework/commit/1fb2a6facb0dc2adb3827182110e90a3479a8cf6))
</details>

<details><summary>aidd-dev: 2.9.0</summary>

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
* **framework:** mark every template slot as {{&}} ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([04119a5](https://github.com/ai-driven-dev/framework/commit/04119a5f9b8d2b91fbff6b8f1f721c1993e0b0c0))


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
</details>

<details><summary>aidd-vcs: 2.6.0</summary>

## [2.6.0](https://github.com/ai-driven-dev/framework/compare/aidd-vcs-v2.5.1...aidd-vcs-v2.6.0) (2026-11-26)


### Features

* **aidd-vcs:** answer pull and merge request review comments ([#1128](https://github.com/ai-driven-dev/framework/issues/1128)) ([75659db](https://github.com/ai-driven-dev/framework/commit/75659dbcebd63e43358a051e092719fe6d52aba1))
* **framework:** check framework content through contracts ([8922b9b](https://github.com/ai-driven-dev/framework/commit/8922b9be53cd946e09edf45d34a46a92d128cc29))


### Bug Fixes

* **framework:** mark the remaining template slots as {{...}} ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([bb11a8d](https://github.com/ai-driven-dev/framework/commit/bb11a8dfb09fc1ffec0165a461da38bf7bbc5815))


### Documentation

* **framework:** mark every template slot as {{&}} ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([04119a5](https://github.com/ai-driven-dev/framework/commit/04119a5f9b8d2b91fbff6b8f1f721c1993e0b0c0))


### Refactoring

* **aidd-refine:** give shadow-areas a router, a report contract and one home per fact ([e4c1d4f](https://github.com/ai-driven-dev/framework/commit/e4c1d4f5cfa2817e97bc9e632f76c54fbca78ffe))
</details>

<details><summary>aidd-pm: 2.7.0</summary>

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
* **framework:** mark every template slot as {{&}} ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([04119a5](https://github.com/ai-driven-dev/framework/commit/04119a5f9b8d2b91fbff6b8f1f721c1993e0b0c0))


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
</details>

<details><summary>aidd-refine: 3.3.0</summary>

## [3.3.0](https://github.com/ai-driven-dev/framework/compare/aidd-refine-v3.2.0...aidd-refine-v3.3.0) (2026-11-26)


### Features

* **aidd-refine:** challenge without a confidence score ([b8a4629](https://github.com/ai-driven-dev/framework/commit/b8a4629425ae1deb52d329d98449a54a8110ccb8))
* **aidd-refine:** challenge without a confidence score, its report checked through a contract ([5d2400d](https://github.com/ai-driven-dev/framework/commit/5d2400ddf4ff8749206c704fe763b44ecce5556d))
* **aidd-refine:** check the challenge report through a contract ([f3b56d3](https://github.com/ai-driven-dev/framework/commit/f3b56d32f9f7002d632f85603d2e7733883b2286))
* **aidd-refine:** check the persisted brainstorm brief and link each action to the next ([503859d](https://github.com/ai-driven-dev/framework/commit/503859d65727d2937ed0546dcf90ca4b66a4cfc3))
* **aidd-refine:** check the persisted brainstorm brief and link each action to the next ([#1084](https://github.com/ai-driven-dev/framework/issues/1084)) ([60b0f41](https://github.com/ai-driven-dev/framework/commit/60b0f4142e2c3e753ef8f1efc6f36e65bfca5566))
* **aidd-refine:** give the challenge attacks aimed at failure paths, state and claims ([c5dcfb0](https://github.com/ai-driven-dev/framework/commit/c5dcfb09fae8af2d1e40764fe059b41361f676c3))
* **aidd-refine:** keep each challenge round in the task folder ([13e75b0](https://github.com/ai-driven-dev/framework/commit/13e75b0bfcf9da5e87f186c675a6908ec38e441d))
* **aidd-refine:** lay the challenge report out like review and check it with the template op ([f378a73](https://github.com/ai-driven-dev/framework/commit/f378a738103b3f3e9dc7a220ed39560aab08021f))
* **framework:** check framework content through contracts ([8922b9b](https://github.com/ai-driven-dev/framework/commit/8922b9be53cd946e09edf45d34a46a92d128cc29))


### Bug Fixes

* **aidd-refine:** answer with the challenge report alone and keep test results out of holds ([4ae0317](https://github.com/ai-driven-dev/framework/commit/4ae0317eaaf22422d355c6336fc400528fc84200))
* **aidd-refine:** answer with the challenge report as kept, without the read-back details ([2ed73f7](https://github.com/ai-driven-dev/framework/commit/2ed73f7c0cdf76eb361daba40c81473ebfeae5af))
* **aidd-refine:** drop findings that need an input no real use reaches before classifying the rest ([390e5ca](https://github.com/ai-driven-dev/framework/commit/390e5ca9eb3b6f97318e1b30e20b418e45fc8dbf))
* **aidd-refine:** drop from the challenge action what its links and its check already say ([8166ded](https://github.com/ai-driven-dev/framework/commit/8166dedc5228f1ddacfcb87dabc4b5be2c1e89dc))
* **aidd-refine:** drop the brief's approval status and the stop rule the diagram already draws ([#1084](https://github.com/ai-driven-dev/framework/issues/1084)) ([8b16d58](https://github.com/ai-driven-dev/framework/commit/8b16d582fc29bf9222e97406efc031ce1f626f43))
* **aidd-refine:** keep the stop rule in the router, where a model applies it on every turn ([#1084](https://github.com/ai-driven-dev/framework/issues/1084)) ([4a09c5b](https://github.com/ai-driven-dev/framework/commit/4a09c5b1a2d688f7ee2e2319a9ec0984a92bfc50))
* **aidd-refine:** let a stop end the questions where they are asked ([#1084](https://github.com/ai-driven-dev/framework/issues/1084)) ([65b8ec9](https://github.com/ai-driven-dev/framework/commit/65b8ec9ce910540d0365e7acf0f6918180fb990a))
* **aidd-refine:** link the brief check and keep its step to the authoring form ([#1084](https://github.com/ai-driven-dev/framework/issues/1084)) ([b6f4273](https://github.com/ai-driven-dev/framework/commit/b6f4273fe53734eae24ce09af2a69cb9aa4e35db))
* **aidd-refine:** link the challenge check and keep its step to the authoring form ([efa8a9e](https://github.com/ai-driven-dev/framework/commit/efa8a9e289d866062effe95ba2564939e2c4c76b))
* **aidd-refine:** run the challenge report's check before answering ([453b380](https://github.com/ai-driven-dev/framework/commit/453b3801e40e004c95b114e47eaf579368d71779))
* **aidd-refine:** run the challenge report's check before answering ([34e7df5](https://github.com/ai-driven-dev/framework/commit/34e7df5f3949ebe4fc9e689fefc206a770dd34aa))
* **aidd-refine:** state challenge's input in one line and select techniques where they are applied ([31a764e](https://github.com/ai-driven-dev/framework/commit/31a764efb8f7ca0d6cdc1215bb874ad4ca4fca43))
* **aidd-refine:** stop the brief check after three passes, as the other report checks do ([#1084](https://github.com/ai-driven-dev/framework/issues/1084)) ([99f8940](https://github.com/ai-driven-dev/framework/commit/99f8940f534d6402e3d3d7deca4403417bf5af09))
* **framework:** mark the remaining template slots as {{...}} ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([bb11a8d](https://github.com/ai-driven-dev/framework/commit/bb11a8dfb09fc1ffec0165a461da38bf7bbc5815))
* **refine:** clarify conversation review recommendations ([#1161](https://github.com/ai-driven-dev/framework/issues/1161)) ([de9fd10](https://github.com/ai-driven-dev/framework/commit/de9fd101f1594e6e11114fb5638458c7bffbab6a))


### Miscellaneous

* **aidd-refine:** move the challenge hook onto the plugin's shared engine ([4547b80](https://github.com/ai-driven-dev/framework/commit/4547b80adba758059d535b97b368b18739edf1c2))
* **aidd-refine:** sync the challenge contract's engine copies ([54b77ef](https://github.com/ai-driven-dev/framework/commit/54b77ef615276d946f673a22f1a00b168a77c358))
* **aidd-refine:** sync the challenge contract's engine copies ([472b6d1](https://github.com/ai-driven-dev/framework/commit/472b6d1302f441337a7472ae1fb2f8a6792fcbb6))


### Documentation

* **framework:** mark every template slot as {{&}} ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([04119a5](https://github.com/ai-driven-dev/framework/commit/04119a5f9b8d2b91fbff6b8f1f721c1993e0b0c0))


### Refactoring

* **aidd-refine:** attack duplication and give the challenge decision its own reference ([5673d88](https://github.com/ai-driven-dev/framework/commit/5673d8845add324bbb859ef89cf35f7b5668330e))
* **aidd-refine:** fit the challenge skill to the skill authoring rules ([e757f94](https://github.com/ai-driven-dev/framework/commit/e757f9450d4c14288cb96da35f493255238a4477))
* **aidd-refine:** give shadow-areas a router, a report contract and one home per fact ([e4c1d4f](https://github.com/ai-driven-dev/framework/commit/e4c1d4f5cfa2817e97bc9e632f76c54fbca78ffe))
* **aidd-refine:** give shadow-areas a router, a report contract and one home per fact ([4d34d93](https://github.com/ai-driven-dev/framework/commit/4d34d93a2ab2164c5dc79b40b5b8bdb3383c7590))
* **aidd-refine:** lean the challenge skill to the skill authoring format ([ad12762](https://github.com/ai-driven-dev/framework/commit/ad12762be801d56cacb1d9e3e544af79b8612560))
* **aidd-refine:** write the brainstorm skill in the skill generator's format ([#1084](https://github.com/ai-driven-dev/framework/issues/1084)) ([b2cad96](https://github.com/ai-driven-dev/framework/commit/b2cad96fdba1e8a82b53983a4b9fa639f93c42b4))
</details>

<details><summary>aidd-ui: 0.4.0-alpha.0</summary>

## [0.4.0-alpha.0](https://github.com/ai-driven-dev/framework/compare/aidd-ui-v0.3.0-alpha.0...aidd-ui-v0.4.0-alpha.0) (2026-11-26)


### Features

* **lefthook:** run the contract check in hooks and CI ([b7fd022](https://github.com/ai-driven-dev/framework/commit/b7fd02279485f1509876213831b69d5f8fd39499))


### Refactoring

* **aidd-refine:** give shadow-areas a router, a report contract and one home per fact ([e4c1d4f](https://github.com/ai-driven-dev/framework/commit/e4c1d4f5cfa2817e97bc9e632f76c54fbca78ffe))
* **framework:** delete the content scripts the contracts replaced ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([522d4b9](https://github.com/ai-driven-dev/framework/commit/522d4b9809160148a5965d6f27ee0188a28c6838))
</details>

<details><summary>aidd-qa: 1.2.0</summary>

## [1.2.0](https://github.com/ai-driven-dev/framework/compare/aidd-qa-v1.1.0...aidd-qa-v1.2.0) (2026-11-26)


### Features

* **aidd-qa:** publish evidence in review requests ([#1201](https://github.com/ai-driven-dev/framework/issues/1201)) ([9090f2c](https://github.com/ai-driven-dev/framework/commit/9090f2c3a943b0305eb88135c34f2aa37951f728))
* **framework:** check framework content through contracts ([8922b9b](https://github.com/ai-driven-dev/framework/commit/8922b9be53cd946e09edf45d34a46a92d128cc29))


### Bug Fixes

* **aidd-qa:** keep one sentence per item in acceptance QA ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([d261445](https://github.com/ai-driven-dev/framework/commit/d261445ca1a8f58ab027b200f3a96cf2c37c1a80))


### Miscellaneous

* **framework:** merge feat/1149-artifact-hook into feat/1149-dev-contracts ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([0d4b0d0](https://github.com/ai-driven-dev/framework/commit/0d4b0d012108cbe6ab28899e89e0c3491463efc8))
* **framework:** merge feat/1149-contract-validation into feat/1165-run-in-hooks ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([e2e5457](https://github.com/ai-driven-dev/framework/commit/e2e5457bf448bf666fb592263925dc7e6e1552b4))
* **framework:** merge feat/1165-run-in-hooks into feat/1149-artifact-hook ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([edbcba0](https://github.com/ai-driven-dev/framework/commit/edbcba0c438a761dd3d0473fafe1cbf35422f5a2))
* **framework:** merge next into contract validation ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([789c554](https://github.com/ai-driven-dev/framework/commit/789c55471d75f7ec72af2dc0ba609818be54c636))


### Refactoring

* **aidd-refine:** give shadow-areas a router, a report contract and one home per fact ([e4c1d4f](https://github.com/ai-driven-dev/framework/commit/e4c1d4f5cfa2817e97bc9e632f76c54fbca78ffe))
</details>

<details><summary>cli: 5.8.0</summary>

## [5.8.0](https://github.com/ai-driven-dev/framework/compare/cli-v5.7.0...cli-v5.8.0) (2026-11-26)


### Features

* **cli:** run the main session and the agents on a chosen provider's models ([#1119](https://github.com/ai-driven-dev/framework/issues/1119)) ([a27436e](https://github.com/ai-driven-dev/framework/commit/a27436e06dde4abdb5f8e9714670a115841c9e2f))
* **framework:** check written artifacts at turn end in plugins ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([2a3a53c](https://github.com/ai-driven-dev/framework/commit/2a3a53ce801c3f96d8da8e9de75247d8e4f1c4d1))


### Bug Fixes

* **cli:** drop the comments that cited a removed reference ([#1257](https://github.com/ai-driven-dev/framework/issues/1257)) ([28cdb8c](https://github.com/ai-driven-dev/framework/commit/28cdb8c08d1f54ff6f186a62117fab71c758300e))


### Miscellaneous

* **deps:** bump @inquirer/prompts from 8.7.5 to 8.8.0 in /cli ([#1267](https://github.com/ai-driven-dev/framework/issues/1267)) ([ff215aa](https://github.com/ai-driven-dev/framework/commit/ff215aa4a6f308d1aff8aa315ff79f27b71a8f57))
* **deps:** bump commander from 15.0.0 to 15.1.0 in /cli ([#1268](https://github.com/ai-driven-dev/framework/issues/1268)) ([184d2f8](https://github.com/ai-driven-dev/framework/commit/184d2f882a5091092e67b24f2042c27238b4dff8))
* **deps:** bump simple-git from 4.0.2 to 4.1.0 in /cli ([#1327](https://github.com/ai-driven-dev/framework/issues/1327)) ([95d67b6](https://github.com/ai-driven-dev/framework/commit/95d67b6f679abd6f88d469991855c35c5b9cd73e))
* **framework:** merge feat/1149-artifact-hook ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([0c0a8e3](https://github.com/ai-driven-dev/framework/commit/0c0a8e38f6b3d40a8780a0df1f72e04ddd061c5f))
* **framework:** merge feat/1149-artifact-hook into feat/1149-dev-contracts ([#1149](https://github.com/ai-driven-dev/framework/issues/1149)) ([6e866b8](https://github.com/ai-driven-dev/framework/commit/6e866b87c431085ed8cf1a9dd5b5baf85cd07d4c))


### Refactoring

* **aidd-context:** apply the lean skill contract to rule-generate ([#1226](https://github.com/ai-driven-dev/framework/issues/1226)) ([0604eaf](https://github.com/ai-driven-dev/framework/commit/0604eaf1a94be04b966c989052ef0edbf09aa719))
* **aidd-refine:** give shadow-areas a router, a report contract and one home per fact ([e4c1d4f](https://github.com/ai-driven-dev/framework/commit/e4c1d4f5cfa2817e97bc9e632f76c54fbca78ffe))
</details>

---
This PR was generated with [Release Please](https://github.com/googleapis/release-please). See [documentation](https://github.com/googleapis/release-please#release-please).