FROM node:24-bookworm-slim@sha256:c86ecead9e55a5210ac1727de38a4ca840bf03dcaf34dc9749addbf383b1920c AS opencode
ARG TARGETARCH
RUN case "$TARGETARCH" in amd64) arch=x64 ;; arm64) arch=arm64 ;; *) exit 1 ;; esac \
 && npm pack --silent --pack-destination /tmp "@opencode/cli-linux-$arch@2.2.5" \
 && mkdir /opencode && tar -xzf /tmp/*.tgz -C /opencode --strip-components=1

FROM aidd-opencode:local AS aidd

FROM debian:bookworm-slim@sha256:99c0b25c46d0214d5a2091092e7908907dcaecd6a962cde0ac700acee222b6f3
ARG TARGETARCH
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl git jq gh sudo libicu72 libssl3 libkrb5-3 zlib1g liblttng-ust1 \
 && apt-get clean \
 && useradd --create-home --uid 1001 runner \
 && useradd --create-home --home-dir /home/aidd --uid 1002 reviewer \
 && groupadd aidd-review \
 && usermod -a -G aidd-review runner \
 && usermod -a -G aidd-review reviewer \
 && install -d -o runner -g runner -m 0700 /var/lib/aidd-review/inbox \
 && install -d -o runner -g runner -m 0700 /home/runner/.local/state/aidd-pr-review \
 && install -d -o root -g root -m 0755 /var/lib/aidd-review/jobs \
 && install -d -o reviewer -g reviewer -m 0700 /home/aidd/.local/share/opencode \
 && mkdir /home/runner/actions-runner \
 && case "$TARGETARCH" in \
      amd64) arch=x64; checksum=baebf204307bac6193480852732f0aba2ae97b6c5597c244f4d5558390147c40 ;; \
      arm64) arch=arm64; checksum=670adb2f268fe21dcbb58b3db0e0aa9d5b3bddfe2c651481336e561ff86de945 ;; \
      *) exit 1 ;; \
    esac \
 && curl -fsSL -o /tmp/runner.tgz "https://github.com/actions/runner/releases/download/v2.338.2/actions-runner-linux-$arch-2.338.2.tar.gz" \
 && echo "$checksum  /tmp/runner.tgz" | sha256sum -c - \
 && tar -xzf /tmp/runner.tgz -C /home/runner/actions-runner \
 && unlink /tmp/runner.tgz \
 && chown -R runner:runner /home/runner/actions-runner
RUN chown reviewer:reviewer /home/aidd/.local /home/aidd/.local/share
COPY --from=opencode /opencode/bin/opencode /usr/local/bin/opencode
COPY --from=aidd /root/.config/opencode/agents/ /home/aidd/.config/opencode/agents/
COPY --from=aidd /root/.claude/skills/ /home/aidd/.claude/skills/
COPY --from=aidd /opt/aidd/review-prompt.txt /opt/aidd/review-prompt.txt
COPY scripts/pr-review/model.sh /opt/aidd/model.sh
COPY docker/aidd-opencode/runner/policy.json /etc/opencode/opencode.json
COPY docker/aidd-opencode/runner/run-review.sh /opt/aidd/run-review
COPY docker/aidd-opencode/runner/dispatch.sh /opt/aidd/dispatch
COPY docker/aidd-opencode/runner/runner.sh /opt/aidd/runner
COPY --from=aidd /opt/aidd/source/base-Dockerfile /opt/aidd/source/base-Dockerfile
COPY docker/aidd-opencode/runner/Dockerfile /opt/aidd/source/runner-Dockerfile
COPY docker/aidd-opencode/runner/Dockerfile.dockerignore /opt/aidd/source/runner-Dockerfile.dockerignore
RUN chmod 0555 /opt/aidd/model.sh /opt/aidd/run-review /opt/aidd/dispatch /opt/aidd/runner \
 && printf 'runner ALL=(root) NOPASSWD: /opt/aidd/dispatch ""\n' > /etc/sudoers.d/aidd-review \
 && chmod 0440 /etc/sudoers.d/aidd-review
USER runner
WORKDIR /home/runner/actions-runner
ENV RUNNER_MANUALLY_TRAP_SIG=1
ENTRYPOINT ["/opt/aidd/runner"]
