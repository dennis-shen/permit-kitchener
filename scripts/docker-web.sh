#!/bin/sh
# Starts the web app in Docker. Builds only when there is no build yet or web code/data changed since.
set -e
corepack enable
pnpm install --prefer-offline
BUILD_ID=apps/web/.next/BUILD_ID
if [ ! -f "$BUILD_ID" ] || [ -n "$(find apps/web/app apps/web/components apps/web/lib packages/*/src data -type f -newer "$BUILD_ID" | head -n 1)" ]; then
  pnpm --filter @permit/web build
else
  echo "Web build is up to date, skipping build."
fi
exec pnpm --filter @permit/web start -H 0.0.0.0
