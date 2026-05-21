#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGE_NAME="${IMAGE_NAME:-fe-task-management}"
CONTAINER_NAME="${CONTAINER_NAME:-fe-task-management}"
HOST_PORT="${HOST_PORT:-3000}"
APP_PORT="${APP_PORT:-3000}"
DOCKERFILE_PATH="${DOCKERFILE:-Dockerfile}"
BUILD_CONTEXT="${BUILD_CONTEXT:-$SCRIPT_DIR}"
NO_CACHE="${NO_CACHE:-true}"
BUILDKIT="${BUILDKIT:-0}"
USE_BUILDX="${USE_BUILDX:-false}"
PRUNE_BEFORE_BUILD="${PRUNE_BEFORE_BUILD:-false}"
PROGRESS="${PROGRESS:-auto}" # auto|plain|tty
MOUNT_SRC="${MOUNT_SRC:-false}"
NODE_MODULES_VOLUME="${NODE_MODULES_VOLUME:-fe-task-management_node_modules}"
NEXT_CACHE_VOLUME="${NEXT_CACHE_VOLUME:-fe-task-management_next}"

DOCKERFILE_ABS_PATH="$SCRIPT_DIR/$DOCKERFILE_PATH"
if [[ ! -f "$DOCKERFILE_ABS_PATH" ]]; then
  echo "Dockerfile '$DOCKERFILE_PATH' tidak ditemukan di $SCRIPT_DIR" >&2
  exit 1
fi

BUILD_FLAGS=("--pull" "--file" "$DOCKERFILE_ABS_PATH" "--tag" "$IMAGE_NAME")
if [[ "${NO_CACHE,,}" == "true" ]]; then
  BUILD_FLAGS+=("--no-cache")
fi

# When mounting source for HMR, skip npm install during build to avoid network failures
if [[ "${MOUNT_SRC,,}" == "true" ]]; then
  BUILD_FLAGS+=("--build-arg" "SKIP_INSTALL=true")
fi

if [[ -n "${DOCKER_BUILD_ARGS:-}" ]]; then
  # shellcheck disable=SC2206
  EXTRA_BUILD_ARGS=(${DOCKER_BUILD_ARGS})
  BUILD_FLAGS+=("${EXTRA_BUILD_ARGS[@]}")
fi

if [[ "${PRUNE_BEFORE_BUILD,,}" == "true" ]]; then
  echo "Membersihkan cache builder dan images dangling..."
  docker builder prune -af >/dev/null 2>&1 || true
  docker image prune -f >/dev/null 2>&1 || true
fi

echo "Membangun image Docker '$IMAGE_NAME'..."
if [[ "${USE_BUILDX,,}" == "true" ]]; then
  # buildx supports --progress
  docker buildx build --load --progress="${PROGRESS}" "${BUILD_FLAGS[@]}" "$BUILD_CONTEXT"
else
  # If legacy builder (BUILDKIT=0), don't pass --progress (not supported)
  if [[ "${BUILDKIT}" == "0" ]]; then
    DOCKER_BUILDKIT=0 docker build "${BUILD_FLAGS[@]}" "$BUILD_CONTEXT"
  else
    DOCKER_BUILDKIT=1 docker build --progress="${PROGRESS}" "${BUILD_FLAGS[@]}" "$BUILD_CONTEXT"
  fi
fi

if docker ps -a --format '{{.Names}}' | grep -Eq "^${CONTAINER_NAME}$"; then
  echo "Container lama '$CONTAINER_NAME' ditemukan, menghapusnya terlebih dahulu..."
  docker rm -f "$CONTAINER_NAME" >/dev/null
fi

RUN_FLAGS=("--rm" "-p" "${HOST_PORT}:${APP_PORT}" "--name" "$CONTAINER_NAME")

# Ensure container can resolve the host's IP as host.docker.internal (Linux needs this)
RUN_FLAGS+=("--add-host=host.docker.internal:host-gateway")

# Load environment files: .env then .env.local (later overrides earlier)
if [[ -f "$SCRIPT_DIR/.env" ]]; then
  RUN_FLAGS+=("--env-file" "$SCRIPT_DIR/.env")
fi
if [[ -f "$SCRIPT_DIR/.env.local" ]]; then
  RUN_FLAGS+=("--env-file" "$SCRIPT_DIR/.env.local")
fi

# Default runtime envs for Next.js in Docker (can be overridden by env-files)
RUN_FLAGS+=("-e" "HOSTNAME=0.0.0.0")
RUN_FLAGS+=("-e" "HOST=0.0.0.0")
RUN_FLAGS+=("-e" "PORT=${APP_PORT}")

# Internal base URL for SSR calls hitting the host's Laravel on 8000
if [[ -z "${INTERNAL_API_BASE_URL:-}" ]]; then
  RUN_FLAGS+=("-e" "INTERNAL_API_BASE_URL=http://host.docker.internal:8000")
fi

# Optional: mount source code and persistent caches for hot reload without rebuild
if [[ "${MOUNT_SRC,,}" == "true" ]]; then
  echo "Mounting source for HMR (MOUNT_SRC=true) ..."
  # Bind-mount project into /app
  RUN_FLAGS+=("-v" "${SCRIPT_DIR}:/app")
  # Named volumes for node_modules and .next to avoid permission issues
  docker volume inspect "${NODE_MODULES_VOLUME}" >/dev/null 2>&1 || docker volume create "${NODE_MODULES_VOLUME}" >/dev/null
  RUN_FLAGS+=("-v" "${NODE_MODULES_VOLUME}:/app/node_modules")
  docker volume inspect "${NEXT_CACHE_VOLUME}" >/dev/null 2>&1 || docker volume create "${NEXT_CACHE_VOLUME}" >/dev/null
  RUN_FLAGS+=("-v" "${NEXT_CACHE_VOLUME}:/app/.next")
  # Polling helps file watching on some host filesystems
  RUN_FLAGS+=("-e" "CHOKIDAR_USEPOLLING=1")
  RUN_FLAGS+=("-e" "WATCHPACK_POLLING=true")
  RUN_FLAGS+=("-e" "WATCHPACK_POLLING_INTERVAL=1000")
fi

if [[ -n "${DOCKER_RUN_ARGS:-}" ]]; then
  # shellcheck disable=SC2206
  EXTRA_RUN_ARGS=(${DOCKER_RUN_ARGS})
  RUN_FLAGS+=("${EXTRA_RUN_ARGS[@]}")
fi

if [[ -t 0 && -t 1 ]]; then
  RUN_FLAGS+=("-it")
elif [[ -t 0 || -t 1 ]]; then
  RUN_FLAGS+=("-i")
fi

# When mounting source, run container as root to avoid host volume permission issues
if [[ "${MOUNT_SRC,,}" == "true" ]]; then
  RUN_FLAGS+=("--user" "0:0")
fi

if [[ $# -gt 0 ]]; then
  CMD=("$@")
else
  # If mounting source, install deps at runtime when node_modules is empty, then start dev
  if [[ "${MOUNT_SRC,,}" == "true" ]]; then
    CMD=("sh" "-lc" "mkdir -p .next && ([ -d node_modules ] && [ \"\$(ls -A node_modules || true)\" ] || npm install) && npx next dev -p ${APP_PORT} -H 0.0.0.0")
  else
    # Run Next directly (default webpack dev)
    CMD=("sh" "-lc" "mkdir -p .next && npx next dev -p ${APP_PORT} -H 0.0.0.0")
  fi
fi

echo "Menjalankan container '$CONTAINER_NAME'..."
docker run "${RUN_FLAGS[@]}" "$IMAGE_NAME" "${CMD[@]}"
