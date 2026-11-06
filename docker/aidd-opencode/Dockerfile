FROM ghcr.io/anomalyco/opencode:2.2.5@sha256:1690aad69864d2f6714772d1e040918feebc6df5286d2bd7e181fbb35d12d4a9

# Project-specific AIDD tools are installed at review time, not baked into the image.
RUN apk add --no-cache bash git
COPY review-prompt.txt /opt/aidd/review-prompt.txt
COPY Dockerfile /opt/aidd/source/base-Dockerfile
