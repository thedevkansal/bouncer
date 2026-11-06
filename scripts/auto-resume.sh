#!/usr/bin/env bash
# Restarts Claude Code after usage-limit resets until the deadline or docs/DONE exists.
set -u
cd "$(git rev-parse --show-toplevel)" || exit 1
mkdir -p logs
DEADLINE=$(node -e 'console.log(Math.floor(new Date("2026-11-07T07:30:00+05:30")/1000))')
RETRY_MIN=10
PROMPT="Resume work. Read CLAUDE.md, docs/HANDOFF.md and docs/PROGRESS.md, check git log and git status, \
then continue the exact next step. Commit and push after each step and keep all docs updated."
while [ "$(date +%s)" -lt "$DEADLINE" ]; do
  [ -f docs/DONE ] && echo "[auto-resume] DONE found, exiting." && exit 0
  echo "[auto-resume] $(date) starting session" | tee -a logs/auto-resume.log
  OUT=$(claude -p "$PROMPT" \
        --allowedTools "Read,Edit,Write,Glob,Grep,Bash(git:*),Bash(pnpm:*),Bash(node:*),Bash(npx:*),Bash(forge:*)" 2>&1)
  echo "$OUT" >> logs/auto-resume.log
  if echo "$OUT" | grep -qiE "usage limit|limit reached|rate limit|try again later|resets at"; then
    echo "[auto-resume] limit hit, sleeping ${RETRY_MIN}m" | tee -a logs/auto-resume.log
    sleep $((RETRY_MIN * 60))
  else
    sleep 60
  fi
done
echo "[auto-resume] deadline reached, exiting." | tee -a logs/auto-resume.log
