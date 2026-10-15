#!/usr/bin/env bash
# forge handover <name> [--from-tree] [<worktree>]: start .forge/handoffs/<name>-handover.md with the sections
# of ../templates/handover.md and the worktree's git state, then print the file's path.
#   --from-tree   the lead writes it for a lane that has stopped, so the file goes to the main checkout.
# Without it the file goes to the worktree's own checkout: Claude Code keeps a lane out of the main checkout,
# and the hook copies the lane's handover there when the lane stops.
set -euo pipefail

name="${1:?usage: forge handover <name> [--from-tree] [<worktree>]}"
shift
writer=agent tree=.
while (( $# )); do
  if [[ "$1" == --from-tree ]]; then writer=lead-from-tree; else tree="$1"; fi
  shift
done

checkout="$(git -C "$tree" rev-parse --show-toplevel)"
if [[ "$writer" == lead-from-tree ]]; then
  checkout="$(git -C "$checkout" worktree list --porcelain | sed -n '1s/^worktree //p')"
fi
file="$checkout/.forge/handoffs/$name-handover.md"
sections="$(dirname "${BASH_SOURCE[0]}")/../templates/handover.md"
base="origin/${FORGE_BASE_BRANCH:-dev}"   # forge handover passes the project's branches.base

changes="$(git -C "$tree" status --short | head -n 40 || true)"
diffstat="$(git -C "$tree" diff --stat "$base...HEAD" 2>/dev/null | tail -n 15 || true)"
mkdir -p "$(dirname "$file")"
{
  printf '# %s — handover (%s)\n\n' "$name" "$(date '+%Y-%m-%d %H:%M')"
  printf 'Written by: %s. Branch `%s` @ `%s` in `%s`.\n\n' \
    "$writer" "$(git -C "$tree" rev-parse --abbrev-ref HEAD)" "$(git -C "$tree" rev-parse --short HEAD)" "$tree"
  if [[ -f "$sections" ]]; then sed '1,/^---$/d' "$sections"; fi
  printf '\n## Git facts at handover\n```\n'
  printf 'git status --short:\n%s\n\n' "${changes:-<clean>}"
  printf 'diff --stat vs %s:\n%s\n```\n' "$base" "${diffstat:-<none>}"
} > "$file"
echo "$file"
