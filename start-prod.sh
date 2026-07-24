#!/bin/bash
# Film Studio production start script for Linux server.

set -e

cd /home/honeycake/project/film-company

if [ ! -d node_modules ]; then
  echo "node_modules is missing. Run 'npm ci' before starting production." >&2
  exit 1
fi

npm run build
npm start
