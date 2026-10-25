#!/bin/sh
echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] Running daily seed + editorial generation + post..."
cd /app

echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] Seeding today's problems..."
npx tsx scripts/fetch-problems.ts 2>&1

echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] Generating editorials..."
# Covers today plus any recent day whose editorial failed on an earlier run.
npx tsx scripts/generate-editorials.ts --days 7 2>&1

echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] Done!"
