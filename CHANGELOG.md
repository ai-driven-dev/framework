# Changelog

## [2.2.0](https://github.com/ai-driven-dev/aidd-cli/compare/v2.1.0...v2.2.0) (2026-03-10)


### Features

* **pkg:** publish under @ai-driven-dev/cli ([0b082a4](https://github.com/ai-driven-dev/aidd-cli/commit/0b082a4d669a93e7dd1f3a31c8a2be4e919d8dda))

## [2.1.0](https://github.com/ai-driven-dev/aidd-cli/compare/v2.0.1...v2.1.0) (2026-03-09)


### Features

* **cli:** show contextual update banner on all commands ([6f8b5da](https://github.com/ai-driven-dev/aidd-cli/commit/6f8b5da984d5796ca1f5689e62c9ec09c1f52627))


### Bug Fixes

* **cli:** mention correct recovery commands in init re-init error ([0e56255](https://github.com/ai-driven-dev/aidd-cli/commit/0e5625507c8ac69200c6890ee360ae2e648165e8))

## [2.0.1](https://github.com/ai-driven-dev/aidd-cli/compare/aidd-cli-v2.0.0...aidd-cli-v2.0.1) (2026-03-09)


### Bug Fixes

* **ci:** remove duplicate pnpm version in release workflow ([ed79154](https://github.com/ai-driven-dev/aidd-cli/commit/ed79154e68a610661b75c7f4dc1f156a5682b53c))

## [2.0.0](https://github.com/ai-driven-dev/aidd-cli/compare/aidd-cli-v1.9.6...aidd-cli-v2.0.0) (2026-03-09)


### ⚠ BREAKING CHANGES

* CLI rebuilt from scratch; prior configurations are not compatible.

### Features

* add lefthook child-to-parent delegation + auto-install ([2e7cd87](https://github.com/ai-driven-dev/aidd-cli/commit/2e7cd87165da8646538bf3d420f526f50ecaae51))
* **catalog:** add catalog generation use case ([3949d88](https://github.com/ai-driven-dev/aidd-cli/commit/3949d88964a2263afded5e78373a7f9882f3a3bd))
* initial migration of AIDD CLI from monorepo ([1c67878](https://github.com/ai-driven-dev/aidd-cli/commit/1c67878402e3de17673e8ce3d0c0153c95e7aaa7))
* **m0:** migrate to 4-layer clean architecture skeleton ([2648039](https://github.com/ai-driven-dev/aidd-cli/commit/2648039c6ec51a92330d8fe81ec64444a0981cb3))
* **m1:** implement domain layer (tickets 010–016) ([25a376c](https://github.com/ai-driven-dev/aidd-cli/commit/25a376cf04e660db26da1cd08926ccc4a013d701))
* **m2:** implement infrastructure layer — HTTP, tar, cache, adapters ([ec862dc](https://github.com/ai-driven-dev/aidd-cli/commit/ec862dccbcc6a0570be0d4bd2699c71e0a1a9ee4))
* **m3:** implement init & install commands — CLI entry point, use cases, E2E tests ([5f89025](https://github.com/ai-driven-dev/aidd-cli/commit/5f89025e957ff92be3cd88b68564898beda2ba6f))
* **m4:** add clean, doctor, status, and uninstall commands and use cases ([bfd3a4f](https://github.com/ai-driven-dev/aidd-cli/commit/bfd3a4f0f47f50b825e1d5a8869da42268392a3c))
* relaunch as v2 — full architecture rewrite (M0–M5) ([5563d66](https://github.com/ai-driven-dev/aidd-cli/commit/5563d669a6c3f8cde993957f23046c28deb89fc8))


### Bug Fixes

* remove malicious payload ([b1799be](https://github.com/ai-driven-dev/aidd-cli/commit/b1799befa76251ea30fd3edcb08b196be880b468))
* replace cross-repo relative links with full GitHub URLs ([10b18cd](https://github.com/ai-driven-dev/aidd-cli/commit/10b18cd05d8ff2341dc46b6871de70598a43d1e2))
* restore CONTRIBUTING.md removed during repo migration ([30b0e7e](https://github.com/ai-driven-dev/aidd-cli/commit/30b0e7e5f462fd89120b5e0608e492ebecf3b7b5))
* update README to indicate CLI is outdated and improve formatting ([e90c180](https://github.com/ai-driven-dev/aidd-cli/commit/e90c18040b029b983ef72ef8eb5d10a32b9b278a))
