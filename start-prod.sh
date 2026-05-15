#!/bin/bash
# Film Studio production start script for Linux server.

set -e

cd /home/honeycake/project/film-company
npm install
npm run build
npm start
