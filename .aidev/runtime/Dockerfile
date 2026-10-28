# The image AIDEV runs this project's suites in (`environment.image` in
# .aidev/project.yaml). Suites run with `--network none` and the caller's uid, so
# everything they need is in the image:
#
# * common-ci-configuration's node-test-tools, the hive-wide Node (the one
#   NODE_VERSION of ccc's docker-bake.hcl) and its build tools; this file names
#   no Node version of its own;
# * a pnpm store filled from pnpm-lock.yaml by `pnpm fetch` (/opt/pnpm-store, the
#   image's npm_config_store_dir; no lifecycle scripts run), so
#   `pnpm install --frozen-lockfile --offline` works in the sandbox, with the pnpm
#   node-test-tools carries;
# * make and g++ (the base has python3), and node-gyp's Node headers for that Node
#   in /opt/node-gyp (npm_config_devdir),
#   so a native module's install script can build without a download.
#
# The suites never start Electron: ELECTRON_SKIP_BINARY_DOWNLOAD makes electron's
# install script skip the binary, so the image carries no Electron download.
#
# Build and pin it with .aidev/runtime/build.sh --push; see .aidev/README.md.
ARG BASE_IMAGE=registry.gitlab.syncad.com/hive/common-ci-configuration/node-test-tools:develop
FROM ${BASE_IMAGE}
USER root
ENV HOME=/tmp \
    npm_config_store_dir=/opt/pnpm-store \
    npm_config_update_notifier=false \
    npm_config_devdir=/opt/node-gyp \
    DISABLE_OPENCOLLECTIVE=1 \
    ADBLOCK=1 \
    ELECTRON_SKIP_BINARY_DOWNLOAD=1 \
    HUSKY=0 \
    DO_NOT_TRACK=1
RUN apt-get update \
    && apt-get install -y --no-install-recommends make g++ \
    && apt-get clean && rm -rf /var/lib/apt/lists/* \
    && npx --yes node-gyp@11 install \
    && ls /opt/node-gyp
COPY . /tmp/deps/
RUN cd /tmp/deps \
    && pnpm fetch --frozen-lockfile \
    && cd / && rm -rf /tmp/deps /tmp/.cache /tmp/.local \
    && chmod -R a+rwX /opt/pnpm-store /opt/node-gyp
