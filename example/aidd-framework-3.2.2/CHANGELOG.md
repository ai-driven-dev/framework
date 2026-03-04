# Changelog

## [3.2.2](https://github.com/ai-driven-dev/aidd-framework/compare/v3.2.1...v3.2.2) (2026-02-27)


### Bug Fixes

* update npm_update function to install latest pnpm using corepack ([fa6e313](https://github.com/ai-driven-dev/aidd-framework/commit/fa6e313be70fcb58b64ae784e97541061d8f3bfe))

## [3.2.1](https://github.com/ai-driven-dev/aidd-framework/compare/v3.2.0...v3.2.1) (2026-02-23)


### Bug Fixes

* add argument hint and scope section to test iterator prompt ([7f8c03a](https://github.com/ai-driven-dev/aidd-framework/commit/7f8c03aeab39c8d31a63fe0403aaea84f036567d))
* correct formatting in CATALOG.md for better readability ([d13da18](https://github.com/ai-driven-dev/aidd-framework/commit/d13da18732f73371e27f0340c83a700d43af9e06))
* improve formatting of commit type table in README.md for better readability ([aac2695](https://github.com/ai-driven-dev/aidd-framework/commit/aac269588f345dffe90bf7ca2697eb8881ac6f76))
* refine clarity checklist instructions and remove redundant steps ([f23123f](https://github.com/ai-driven-dev/aidd-framework/commit/f23123f6e75d4ebf8523761ba4eba7c80db9f185))
* remove outdated steps from coding assertions and update reference path ([55c2538](https://github.com/ai-driven-dev/aidd-framework/commit/55c2538abfbe64ba3942665c83296e638c6a3f26))
* update argument hints in CATALOG.md for clarity ([353a5e5](https://github.com/ai-driven-dev/aidd-framework/commit/353a5e5b30e234efaffe09defb60336d74ce8818))
* update coding assertions to include additional examples for clarity ([34f765b](https://github.com/ai-driven-dev/aidd-framework/commit/34f765bb0f58ff47c60654291f8513522a99d4d3))
* update links in documentation for clarity and consistency ([3b802c6](https://github.com/ai-driven-dev/aidd-framework/commit/3b802c67d322b1f720c1c0b16b971dface4cb6b3))


### Refactoring

* outsource PM, change folder structure ([856fe61](https://github.com/ai-driven-dev/aidd-framework/commit/856fe61407e0b20a913db69c575e1b031fe8f73a))

## [3.2.0](https://github.com/ai-driven-dev/aidd-framework/compare/v3.1.0...v3.2.0) (2026-02-20)


### Features

* add ASCII user journey diagram for improved understanding and validation in implementation plans ([a2587f0](https://github.com/ai-driven-dev/aidd-framework/commit/a2587f0d8ed4f006a806c1afc9e9e6682b55e35c))
* add assert_architecture command to verify code conformity with architecture standards ([5e02c67](https://github.com/ai-driven-dev/aidd-framework/commit/5e02c670699705924d21470f605e0b58280dfea9))
* add confidence level prompt to challenge output and update plan rules for configuration preparation ([6c5c8e1](https://github.com/ai-driven-dev/aidd-framework/commit/6c5c8e1bdb90d2e80f7e0ae43ecd827513f952b5))
* add generate_architecture command and establish command structure standards ([52cc952](https://github.com/ai-driven-dev/aidd-framework/commit/52cc9524817851c02c6d355848961188d1cdc6a3))
* add guideline to split phases based on responsibilities in plan generation ([09403fe](https://github.com/ai-driven-dev/aidd-framework/commit/09403febdf91ea49a4eacd9ba1594e0e192afa09))
* add JSONC comment stripping and .vscode/settings.json generation for Claude tool ([1ddac51](https://github.com/ai-driven-dev/aidd-framework/commit/1ddac51f1a9204e0f4a7f0896a5f0802970d2851))
* add lefthook child-to-parent delegation + auto-install ([6527e6d](https://github.com/ai-driven-dev/aidd-framework/commit/6527e6d4494fd6c484be219815472014a9a97ccc))
* enhance documentation for challenge skill and add mermaid generation rules ([2e3ab24](https://github.com/ai-driven-dev/aidd-framework/commit/2e3ab24f91e11509e70d77a8a541e9331946e922))
* enhance run_projection documentation to emphasize file architecture relevance ([f051c03](https://github.com/ai-driven-dev/aidd-framework/commit/f051c03f25d7ddc083cd437a19a424b31495e852))
* remove improve_prompt and isolate commands from the framework catalog ([b969e79](https://github.com/ai-driven-dev/aidd-framework/commit/b969e79dc2542fbb643fdf9789b9b227ba083347))


### Bug Fixes

* update mermaid diagram labels for clarity in README ([1680d7e](https://github.com/ai-driven-dev/aidd-framework/commit/1680d7ed4e338ad97d28392283749de134673f2a))


### Documentation

* add rules section to audit.md for codebase analysis ([bad8dc3](https://github.com/ai-driven-dev/aidd-framework/commit/bad8dc3d7dd81dcc95551ff5d4a26cd444f61f5b))


### Refactoring

* clarify correctness criteria and improve section headings in challenge documentation ([6958244](https://github.com/ai-driven-dev/aidd-framework/commit/695824430af7fbed2793f9794a33e8b578765670))
* enhance clarity in user journey documentation by adding warnings and task instructions ([fc9688d](https://github.com/ai-driven-dev/aidd-framework/commit/fc9688d719e4f68fcc5671fd90e13d170acbf4d8))
* enhance implementation guidelines by adding a decisive rule and clarifying agent usage ([c55ba37](https://github.com/ai-driven-dev/aidd-framework/commit/c55ba37a312b124a459f3c1102a2f672a46bd220))
* enhance user journey visualization by updating diagram syntax and improving task planning steps ([354a985](https://github.com/ai-driven-dev/aidd-framework/commit/354a985d1997a31f3e7a89e8c84002cd98f64ce4))
* improve VCS guidelines formatting and enhance clarity in plan generation steps ([c4e8bfa](https://github.com/ai-driven-dev/aidd-framework/commit/c4e8bfadb260d8a5b063fe846acd66fe499e3298))
* standardize naming convention for auto-accept command and enhance catalog documentation ([99c515f](https://github.com/ai-driven-dev/aidd-framework/commit/99c515f180e8cf786704f57e7f5382faee92d824))
* update descriptions and streamline instruction steps for Alexia and Auto-Implement agents ([a50eaf8](https://github.com/ai-driven-dev/aidd-framework/commit/a50eaf8ee806dd26ca3855ea01ec2b2302ac5efc))
* update documentation for Kent and Martin agents, enhance coding assertions, and improve implementation process clarity ([ba0ed37](https://github.com/ai-driven-dev/aidd-framework/commit/ba0ed379794d0825c134d97659dbef354216044b))
* update mcp.json structure and enhance config format validation in tests ([e5d8d41](https://github.com/ai-driven-dev/aidd-framework/commit/e5d8d416c727a74210939553939d375a71b6dffe))
* update paths in VSCode settings for instruction templates ([5772d76](https://github.com/ai-driven-dev/aidd-framework/commit/5772d76a7115046a1438f0e52886277af0d50b2c))


### Miscellaneous

* add node_modules/ and .specstory/ to .gitignore ([bb77d3a](https://github.com/ai-driven-dev/aidd-framework/commit/bb77d3a12b5b06e158a85bc47b61c4a8cfd80848))

## [3.1.0](https://github.com/ai-driven-dev/aidd-framework/compare/v3.0.1...v3.1.0) (2026-02-17)


### Features

* add scaffoldEmptyRuleCategories and brand prefix for commands ([3cc6dc4](https://github.com/ai-driven-dev/aidd-framework/commit/3cc6dc4a928888e47e0cfebf054f960e9bc19415))


### Documentation

* add aidd.sh script with aliases and utility functions for enhanced productivity ([7000eac](https://github.com/ai-driven-dev/aidd-framework/commit/7000eac7e22a1a11bb0cf4ea6c577bd6f9b34b34))
* add auto-accept command documentation and enhance VSCode settings ([2b6b37c](https://github.com/ai-driven-dev/aidd-framework/commit/2b6b37c54518ad7a4245c7a39a4e62cb53f399e1))
* add auto-accept command documentation and update CATALOG.md with framework content ([cb8ae2a](https://github.com/ai-driven-dev/aidd-framework/commit/cb8ae2adae98c4d3b6a938eac589a97026282898))
* clarify assertion listing in assert.md and add new audit.md for codebase analysis ([fbcd4d3](https://github.com/ai-driven-dev/aidd-framework/commit/fbcd4d313f3e3fd53509cdca2cc29be59c3721a9))
* enhance behavior guidelines in AGENTS.md for clarity and effectiveness ([14623f4](https://github.com/ai-driven-dev/aidd-framework/commit/14623f453f6f0345f44da96e6811b3053839db6a))
* simplify file path patterns in ide-mapping files for consistency ([1d01ae7](https://github.com/ai-driven-dev/aidd-framework/commit/1d01ae72f10226c9cbe0491a726824db4c51804c))
* update command reference and enhance feature building workflows in README ([b70b529](https://github.com/ai-driven-dev/aidd-framework/commit/b70b529c7eb937bce1e047c1f8f5f828cf16d68f))
* update file path patterns in ide-mapping files for consistency ([dcae122](https://github.com/ai-driven-dev/aidd-framework/commit/dcae1221b5a0decd923ae332f9f0705f0673dbe5))
* update generate_rules documentation for clarity and detail ([a1493dd](https://github.com/ai-driven-dev/aidd-framework/commit/a1493ddfafb59543fc42b7f103ce935be76a0dad))
* update README to enhance clarity and structure ([62d1292](https://github.com/ai-driven-dev/aidd-framework/commit/62d1292d3956404045d204c81911a8bfb76a0511))


### Refactoring

* codebase audit, remove PM ([9665604](https://github.com/ai-driven-dev/aidd-framework/commit/96656043f34f266db0c4bc079c381eb13baa1be6))
* consolidate templates into aidd_docs and rewrite README ([758a7ce](https://github.com/ai-driven-dev/aidd-framework/commit/758a7cea186192ca7eb624abb4b5b6d0d008495c))
* move sync-dist build into framework and add per-tool tarballs to release ([9949658](https://github.com/ai-driven-dev/aidd-framework/commit/994965874ae7575d1394b71a2d494d90fb50666d))

## [3.0.1](https://github.com/ai-driven-dev/aidd-framework/compare/v3.0.0...v3.0.1) (2026-02-12)


### Documentation

* add changelog and align versioning configuration ([9555e46](https://github.com/ai-driven-dev/aidd-framework/commit/9555e46f60e8272ad29eab8ecfe2a314dbaba520))
* add versioning and contribution guidelines ([a3d0c25](https://github.com/ai-driven-dev/aidd-framework/commit/a3d0c255e48db3358c48599f8480c86f25d1e6df))


### Miscellaneous

* remove config.yml ([e6aaa47](https://github.com/ai-driven-dev/aidd-framework/commit/e6aaa47a7f6df1fe35f3f4cc5c02b7f5c65b5c29))

## [3.0.0](https://github.com/ai-driven-dev/aidd-framework/releases/tag/v3.0.0) (2026-02-12)

Initial release of the AIDD Framework as a standalone repository with automated versioning.

### Features

* initial migration of AIDD Framework from monorepo ([1785eed](https://github.com/ai-driven-dev/aidd-framework/commit/1785eed37b34339aad0fb684e1994485e4c81406))
* add settings.json to configure Gitignore behavior ([180d0e9](https://github.com/ai-driven-dev/aidd-framework/commit/180d0e9fc87420c54cb2d9aa7d2bad7f77e2b349))
* update agent models to include new configurations ([6dcbc38](https://github.com/ai-driven-dev/aidd-framework/commit/6dcbc38eb19b3c43181652d196a58f4eac6eda84))
* add permissions configuration to settings.json for enhanced security ([0ced082](https://github.com/ai-driven-dev/aidd-framework/commit/0ced08248ba5aee4efa415e732453c05a3a92787))
* clarify header title definition in Mermaid generation rules ([3c2521c](https://github.com/ai-driven-dev/aidd-framework/commit/3c2521c61a24804a30fa97becfcd224064337871))
* remove optional context section from isolate command documentation ([ba61286](https://github.com/ai-driven-dev/aidd-framework/commit/ba61286e43bb56124c18b2e99e9c9af17417257d))
* add INSTALL_README.md template for per-tool dist ([0395c0e](https://github.com/ai-driven-dev/aidd-framework/commit/0395c0efb73de1dfa340e77de6ea5620f4894ac3))
* add .gitignore to exclude tool-specific directories ([fb7fc1c](https://github.com/ai-driven-dev/aidd-framework/commit/fb7fc1c46329c076bcea7c6e86731f1731fbc6b0))
* redraw aidd_docs/ ([494a0d3](https://github.com/ai-driven-dev/aidd-framework/commit/494a0d335921cec05d422e0b29a5d5edfee46dc6))
* new CATALOG and prompt templates ([a12e196](https://github.com/ai-driven-dev/aidd-framework/commit/a12e196e67637d6735350f595835c8cf05e16b59))
* add prompt template and update CATALOG reference ([ac57bf9](https://github.com/ai-driven-dev/aidd-framework/commit/ac57bf9af81feab4ce8fbe49fbb71ba81c8b20e5))
* revert prompts template and update CATALOG structure ([e2afdff](https://github.com/ai-driven-dev/aidd-framework/commit/e2afdfff32a63bb48f82c514a9a37d27e0d3f55f))
* add ticket_info command and remove jira_info command ([fb3e494](https://github.com/ai-driven-dev/aidd-framework/commit/fb3e494ed1d85780b1a647487af2ebd41c6bb604))

### Bug Fixes

* replace cross-repo relative links with full GitHub URLs ([a151ba5](https://github.com/ai-driven-dev/aidd-framework/commit/a151ba51914fc1b06022c1a3edc97710a146377d))
* align memory paths, development flows, and phantom command references ([dc68610](https://github.com/ai-driven-dev/aidd-framework/commit/dc68610d5d8decc91c90eade055d2720eb37d4e8))
* update paths for GitHub Copilot instruction templates ([b19430e](https://github.com/ai-driven-dev/aidd-framework/commit/b19430e6b8895643b01803e146c5fb7384cdc42f))
* update .gitignore to exclude all files in the dist directory ([6ef1499](https://github.com/ai-driven-dev/aidd-framework/commit/6ef149905596555c4ef079e3d0a6fa59e04b74c9))

### Documentation

* extract catalog, translate README and CONTRIBUTING to English ([e893bf0](https://github.com/ai-driven-dev/aidd-framework/commit/e893bf0a6aac75d19b7ac3a7d105f061224ac4a9))
* add versioning and contribution guidelines ([a3d0c25](https://github.com/ai-driven-dev/aidd-framework/commit/a3d0c2556e53e3da2e2f1b21e63e4efd8e1e90ee))

### Style

* reformat CATALOG.md table alignment ([2389e5f](https://github.com/ai-driven-dev/aidd-framework/commit/2389e5fdee6c2d871d81173239f1b251735fb835))

### Refactoring

* update descriptions and streamline user story templates ([4266090](https://github.com/ai-driven-dev/aidd-framework/commit/4266090f29a6ba19444fa110e2051c837e5d5499))
* update formatting and remove outdated sections in documentation ([3ed7064](https://github.com/ai-driven-dev/aidd-framework/commit/3ed7064848539b2e9f8dd5eb76731d3021682399))

### Breaking Changes

* move PM commands for approval ([ff6f7eb](https://github.com/ai-driven-dev/aidd-framework/commit/ff6f7ebec1ad533d7cbc45a583fc58ee1befa0ab))
