#!/usr/bin/env bash
# Usage: ./infra/deploy.sh <staging|prod>
# Run from repo root. Requires: docker, gcloud authenticated with push access.

set -euo pipefail

ENV="${1:-staging}"
REGISTRY="europe-west2-docker.pkg.dev/tarsha-ai-491715/apps"
TAG="${ENV}"

echo "▶ Building and pushing images for environment: ${ENV}"

docker build -f apps/backend/Dockerfile -t "${REGISTRY}/backend:${TAG}" .
docker push "${REGISTRY}/backend:${TAG}"

docker build -f apps/worker/Dockerfile -t "${REGISTRY}/worker:${TAG}" .
docker push "${REGISTRY}/worker:${TAG}"

echo "✓ Images pushed:"
echo "  ${REGISTRY}/backend:${TAG}"
echo "  ${REGISTRY}/worker:${TAG}"
echo ""
echo "SSH into the VM and run:"
echo "  cd /opt/sgexpo"
echo "  REGISTRY=${REGISTRY} TAG=${TAG} docker compose -f infra/docker/docker-compose.prod.yml pull"
echo "  REGISTRY=${REGISTRY} TAG=${TAG} docker compose -f infra/docker/docker-compose.prod.yml up -d"
