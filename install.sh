#!/usr/bin/env bash
set -euo pipefail

# ROCANIIRU M1: preserve upstream implementation below for comparison, but do
# not install packages, write backups, patch/restart a host, or run inference.
printf '%s\n' 'HUMAN_GATE_CLOSED: current host compatibility and live acceptance are not complete. See MILESTONE-1.md.' >&2
exit 2

cd "$(dirname "${BASH_SOURCE[0]}")"

for command in node bun git; do
  if ! command -v "${command}" >/dev/null 2>&1; then
    printf 'ERROR: required command is missing: %s\n' "${command}" >&2
    exit 1
  fi
done

printf '%s\n' 'Installing locked dependencies...'
bun install --frozen-lockfile --ignore-scripts

printf '%s\n' 'Building and checking the router...'
bun run check

printf '%s\n' 'Linking the management command...'
bun link --ignore-scripts

printf '%s\n' 'Installing the host patch and control service...'
grok-codex-router install

printf '%s\n' 'Verifying the direct cached tool round-trip...'
grok-codex-router verify

printf '\n%s\n' 'Grok Codex Router is ready.'
printf '%s\n' 'Control UI: http://127.0.0.1:21371'
grok-codex-router status
