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

DOCKERFILE_ABS_PATH="$SCRIPT_DIR/$DOCKERFILE_PATH"
if [[ ! -f "$DOCKERFILE_ABS_PATH" ]]; then
  echo "Dockerfile '$DOCKERFILE_PATH' tidak ditemukan di $SCRIPT_DIR" >&2
  exit 1
fi

BUILD_FLAGS=("--pull" "--file" "$DOCKERFILE_ABS_PATH" "--tag" "$IMAGE_NAME")
if [[ "${NO_CACHE,,}" == "true" ]]; then
  BUILD_FLAGS+=("--no-cache")
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

if [[ $# -gt 0 ]]; then
  CMD=("$@")
else
  # Bind to 0.0.0.0 and use APP_PORT; pass flags after -- to npm
  CMD=("npm" "run" "dev" "--" "-p" "${APP_PORT}" "-H" "0.0.0.0")
fi

echo "Menjalankan container '$CONTAINER_NAME'..."
docker run "${RUN_FLAGS[@]}" "$IMAGE_NAME" "${CMD[@]}"
