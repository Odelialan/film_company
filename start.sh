#!/bin/bash
# Film Studio development start script for Linux server.

set -e

cd /home/honeycake/project/film-company

npm run dev:server &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT INT TERM

npm run dev -- --host 127.0.0.1 --port 5173
