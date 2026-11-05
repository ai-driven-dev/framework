FROM node:24-bookworm-slim@sha256:c86ecead9e55a5210ac1727de38a4ca840bf03dcaf34dc9749addbf383b1920c AS framework

ARG FRAMEWORK_COMMIT=ef2dae421c89aeb7c52461539b78c6b53bfdf988
ADD https://github.com/ai-driven-dev/framework/archive/${FRAMEWORK_COMMIT}.tar.gz /framework.tar.gz
RUN mkdir /src && tar -xzf /framework.tar.gz -C /src --strip-components=1

WORKDIR /src/cli
RUN corepack enable && pnpm install --frozen-lockfile && pnpm build
RUN mkdir /out && node dist/cli.js translate /src --to opencode --as flat --out /out

FROM ghcr.io/anomalyco/opencode:2.2.5@sha256:1690aad69864d2f6714772d1e040918feebc6df5286d2bd7e181fbb35d12d4a9

# Hooks and MCP servers are intentionally not activated by this image.
RUN apk add --no-cache bash git
COPY --from=framework /out/.opencode/agents/ /root/.config/opencode/agents/
# OpenCode reads global Claude-compatible skills before project skill sources.
COPY --from=framework /out/.opencode/skills/ /root/.claude/skills/
COPY review-prompt.txt /opt/aidd/review-prompt.txt
COPY Dockerfile /opt/aidd/source/base-Dockerfile
