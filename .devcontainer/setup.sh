#!/bin/bash
set -e

WORKSPACES=/workspaces

clone_or_pull() {
  local repo=$1
  local dir="$WORKSPACES/$repo"
  if [ ! -d "$dir/.git" ]; then
    echo "Cloning AminAlAit/$repo..."
    git clone "https://github.com/AminAlAit/$repo.git" "$dir"
  else
    echo "$repo present — pulling..."
    git -C "$dir" pull --ff-only 2>/dev/null || echo "(pull skipped — local changes or diverged)"
  fi
}

# Sibling repos — add new repos here as they are created
clone_or_pull "qgi-infra"
clone_or_pull "qgi-pipeline"

echo ""
echo "Hub Codespace ready. /workspaces contents:"
ls "$WORKSPACES"
