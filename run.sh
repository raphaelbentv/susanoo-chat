#!/usr/bin/env bash
set -e

# Detect current directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check NODE_ENV
if [ "$NODE_ENV" = "development" ]; then
  echo "Starting in development mode..."
  npm run dev
else
  echo "Starting in production mode..."
  if [ ! -d "dist" ]; then
    echo "Building project..."
    npm run build
  fi
  npm start
fi
