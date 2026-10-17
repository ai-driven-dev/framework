# Changelog

## [0.3.0](https://github.com/ai-driven-dev/framework/compare/aidd-telemetry-v0.2.1...aidd-telemetry-v0.3.0) (2026-10-16)


### ⚠ BREAKING CHANGES

* the aidd telemetry commands, the aidd-telemetry hooks and skills, backlog-link.json and the AIDD-Session-Id commit trailer are removed; measurement returns, for Claude Code first, later on this branch.

### Features

* **telemetry:** ask who is measured at opt-in ([#1034](https://github.com/ai-driven-dev/framework/issues/1034)) ([06dbb98](https://github.com/ai-driven-dev/framework/commit/06dbb980e2041267c3c20c8c4d236a63208213d6))
* **telemetry:** deterministic claude code token measurement, release 1 ([#993](https://github.com/ai-driven-dev/framework/issues/993)) ([0a103e6](https://github.com/ai-driven-dev/framework/commit/0a103e6725cd9619a861d1ec3136b7534edabae3))
* **telemetry:** filter the report by task, ticket, person and more ([#1033](https://github.com/ai-driven-dev/framework/issues/1033)) ([7084a88](https://github.com/ai-driven-dev/framework/commit/7084a88c009dca9fa422101dff789d410c9ec476))


### Bug Fixes

* **cli:** preserve noninteractive git fetches with simple-git v4 ([4ffbc0a](https://github.com/ai-driven-dev/framework/commit/4ffbc0a2f96a679b403d5eaa3f9c74c36bc5138e))
* **cli:** restore OpenCode plugins and verify Kilo runtime hooks ([#971](https://github.com/ai-driven-dev/framework/issues/971)) ([12777d0](https://github.com/ai-driven-dev/framework/commit/12777d03808cee29f611e18d3816ae62ebc5c969))


### Performance

* **telemetry:** a report reads its period, not the whole history ([#1032](https://github.com/ai-driven-dev/framework/issues/1032)) ([ae8705f](https://github.com/ai-driven-dev/framework/commit/ae8705f761671478bed9c66a1884fe8a2870e3e4))


### Documentation

* delete the cost-report and metrics contracts and aidd_docs/runs/, rewrite ([0a103e6](https://github.com/ai-driven-dev/framework/commit/0a103e6725cd9619a861d1ec3136b7534edabae3))

## [0.2.1](https://github.com/ai-driven-dev/framework/compare/aidd-telemetry-v0.2.0...aidd-telemetry-v0.2.1) (2026-09-24)


### Bug Fixes

* **telemetry:** opencode reads journal.cjs where the build puts it ([#812](https://github.com/ai-driven-dev/framework/issues/812)) ([ebd7fe9](https://github.com/ai-driven-dev/framework/commit/ebd7fe9d5f38178f01947579f9ee509d08506b8e))
* **telemetry:** resolve the repository from the host, not from payload.cwd ([#892](https://github.com/ai-driven-dev/framework/issues/892)) ([949642d](https://github.com/ai-driven-dev/framework/commit/949642dabda967cb94a3f8e2d9723899d1ed0612)), closes [#859](https://github.com/ai-driven-dev/framework/issues/859)


### Documentation

* **telemetry:** the README says what 00-init runs and what OpenCode cannot ([#871](https://github.com/ai-driven-dev/framework/issues/871)) ([83b0246](https://github.com/ai-driven-dev/framework/commit/83b0246e532d3f76491baabbc8b0b266f00e3590))

## [0.2.0](https://github.com/ai-driven-dev/framework/compare/aidd-telemetry-v0.1.0...aidd-telemetry-v0.2.0) (2026-09-09)


### Features

* **cli:** one shared framework source per machine, user scope and session telemetry ([#795](https://github.com/ai-driven-dev/framework/issues/795)) ([95bdbbc](https://github.com/ai-driven-dev/framework/commit/95bdbbc3328262b72f5fd2b8034bc9630bf02e2f))
* **cli:** the report answers the same from anywhere, and says how it knows ([#754](https://github.com/ai-driven-dev/framework/issues/754)) ([87af185](https://github.com/ai-driven-dev/framework/commit/87af18511a8dedf5e91f0099adda0bbde80dfbf7))
* **framework:** measurement that works on five tools, each proven by a session that ran ([#706](https://github.com/ai-driven-dev/framework/issues/706)) ([627408f](https://github.com/ai-driven-dev/framework/commit/627408fba964b30d22b57fc99241083da1e0f294))
* **telemetry:** a flow the tool named is a flow ([#768](https://github.com/ai-driven-dev/framework/issues/768)) ([37a6b2c](https://github.com/ai-driven-dev/framework/commit/37a6b2ce42bd598557baee8e41b8b9d8e98cda2d))
* **telemetry:** a prompt is an axis, and the only one complete by construction ([#757](https://github.com/ai-driven-dev/framework/issues/757)) ([18ed39b](https://github.com/ai-driven-dev/framework/commit/18ed39ba3fe87fd115e77acf88b1c4e56c6de70d))
* **telemetry:** a skill says when it is done, because nothing else can ([#756](https://github.com/ai-driven-dev/framework/issues/756)) ([cf66c22](https://github.com/ai-driven-dev/framework/commit/cf66c22856d3b00ad9ecc69582ad7b37f93e4401))


### Bug Fixes

* **cli:** a journal states the schema it was written in, and the reader reads it ([#776](https://github.com/ai-driven-dev/framework/issues/776)) ([5788ad8](https://github.com/ai-driven-dev/framework/commit/5788ad885958130cea4b7a2151bbdea75e03522d))
* **cli:** check says whether the host will load what aidd installed ([#748](https://github.com/ai-driven-dev/framework/issues/748)) ([919aee3](https://github.com/ai-driven-dev/framework/commit/919aee3004c5ad33bb6cca8726a1c26aebc2aad4))
* **cli:** the commit trailer survives a hook another tool regenerates, and check says whether it did ([#749](https://github.com/ai-driven-dev/framework/issues/749)) ([5b222a3](https://github.com/ai-driven-dev/framework/commit/5b222a36ccec5c5224ea366f145f49888bd9a8fb))
* **plugins:** a skill links only inside itself ([#772](https://github.com/ai-driven-dev/framework/issues/772)) ([1efb3d9](https://github.com/ai-driven-dev/framework/commit/1efb3d958897b88c9fde814d6e1e941f8978c519))
* **telemetry:** a record can predate its journal, and must say so ([#759](https://github.com/ai-driven-dev/framework/issues/759)) ([39a4e84](https://github.com/ai-driven-dev/framework/commit/39a4e84bd5828bf2be1cc6c64831a1682271ad54))
* **telemetry:** a second export is a second plugin ([#785](https://github.com/ai-driven-dev/framework/issues/785)) ([ba845f8](https://github.com/ai-driven-dev/framework/commit/ba845f86227599038be67fcf9c7736c4722a0502))
* **telemetry:** an agent row says who could be named ([#770](https://github.com/ai-driven-dev/framework/issues/770)) ([e4dc167](https://github.com/ai-driven-dev/framework/commit/e4dc16775f48c94f6a266471b0dab3bb466e1347))
* **telemetry:** an identity names the work it already did ([#761](https://github.com/ai-driven-dev/framework/issues/761)) ([38a5d43](https://github.com/ai-driven-dev/framework/commit/38a5d43501b2b14b3b65ae723cf137ca8931a590))


### Documentation

* **telemetry:** a prompt axis says what it cannot name ([#769](https://github.com/ai-driven-dev/framework/issues/769)) ([aee5721](https://github.com/ai-driven-dev/framework/commit/aee5721b32fb12d3a58b762ad8a9d37fe5cd6b02))

## Changelog
