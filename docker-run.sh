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

echo "Membangun image Docker '$IMAGE_NAME'..."
docker build "${BUILD_FLAGS[@]}" "$BUILD_CONTEXT"

if docker ps -a --format '{{.Names}}' | grep -Eq "^${CONTAINER_NAME}$"; then
  echo "Container lama '$CONTAINER_NAME' ditemukan, menghapusnya terlebih dahulu..."
  docker rm -f "$CONTAINER_NAME" >/dev/null
fi

RUN_FLAGS=("--rm" "-p" "${HOST_PORT}:${APP_PORT}" "--name" "$CONTAINER_NAME")

if [[ -f "$SCRIPT_DIR/.env" ]]; then
  RUN_FLAGS+=("--env-file" "$SCRIPT_DIR/.env")
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
  CMD=("npm" "run" "dev")
fi

echo "Menjalankan container '$CONTAINER_NAME'..."
docker run "${RUN_FLAGS[@]}" "$IMAGE_NAME" "${CMD[@]}"
