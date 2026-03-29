#!/usr/bin/env bash
set -euo pipefail

docker compose up -d postgres zookeeper kafka redis minio

echo "Core dependencies are running."