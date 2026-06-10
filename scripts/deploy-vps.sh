#!/usr/bin/env bash
set -euo pipefail

cd /opt/civium

exec 9>/var/lock/civium-deploy.lock
flock -n 9 || {
  echo "Another Civium deployment is already running"
  exit 1
}

git fetch --prune origin main
git reset --hard origin/main

docker compose config --quiet
docker compose build --pull
docker compose up -d --remove-orphans

for attempt in $(seq 1 30); do
  if curl --fail --silent http://127.0.0.1/api/health >/dev/null; then
    docker image prune -f
    echo "Civium deployment completed"
    exit 0
  fi
  sleep 2
done

docker compose ps
docker compose logs --tail=100
echo "Civium health check failed"
exit 1
