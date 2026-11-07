FROM ghcr.io/anomalyco/opencode:2.2.6@sha256:520b2d66e7bebad4548de65c8033ed44277dfe4163471c80fe729fe17f748d97

# Project-specific AIDD tools are installed at review time, not baked into the image.
RUN apk add --no-cache bash git
COPY review-prompt.txt /opt/aidd/review-prompt.txt
COPY Dockerfile /opt/aidd/source/base-Dockerfile
