PLUGIN ?= all

.DEFAULT_GOAL := help
.PHONY: help setup doctor check reload

help: ## List targets
	@grep -hE '^[a-z-]+:.*##' $(MAKEFILE_LIST) | sed 's/:.*## /\t/' | sort

setup: ## Install deps, git hooks, and register+install the plugins in Claude/Codex
	pnpm install
	pnpm exec lefthook install
	scripts/dev-setup.sh

doctor: ## Check the local toolchain
	./scripts/doctor.sh

check: ## Run the pre-commit checks
	pnpm exec lefthook run pre-commit

reload: ## Dev: reinstall plugins into Claude+Codex from the checkout (PLUGIN="aidd-refine aidd-pm", default all)
	scripts/dev-sync.sh $(PLUGIN)
