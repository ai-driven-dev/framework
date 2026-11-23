.DEFAULT_GOAL := help
.PHONY: help setup doctor check validate reload check-hosts

help: ## List targets
	@grep -hE '^[a-z-]+:.*##' $(MAKEFILE_LIST) | sed 's/:.*## /\t/' | sort

setup: ## Install deps, git hooks, and register+install the plugins in Claude/Codex
	pnpm install --ignore-scripts
	pnpm exec lefthook install --force
	scripts/dev-setup.sh

doctor: ## Check the local toolchain
	./scripts/doctor.sh

check: ## Run the pre-commit checks
	pnpm exec lefthook run pre-commit

validate: ## Check the framework content against its contracts and baseline
	node scripts/check/run.cjs

reload: ## Dev: reload all plugins into Claude, Codex, OpenCode, Kilo, Copilot, and Cursor via aidd setup --global
	pnpm --dir cli build
	scripts/dev-sync.sh

check-hosts: ## Dev: table what each installed tool really loads of the plugins
	node scripts/check-hosts.cjs
