#!/bin/bash
# Film Studio development start script for Linux server.

set -e

cd /home/honeycake/project/film-company
npm install
npm run dev -- --host 0.0.0.0 --port 4080
