#!/bin/bash
set -e

WORKSPACES=/workspaces

# ---------------------------------------------------------------------------
# Authenticate gh CLI with PAT so cross-repo operations work.
# GH_PAT is injected automatically from the "qgi-hub-codespace" Codespace
# user secret (github.com/settings/codespaces). If missing, gh falls back
# to the read-only GITHUB_TOKEN — repo creation and cross-repo pushes will
# fail until the secret is set.
# ---------------------------------------------------------------------------
if [ -n "$GH_PAT" ]; then
  echo "$GH_PAT" | gh auth login --with-token
  echo "gh CLI authenticated via GH_PAT"
else
  echo "WARNING: GH_PAT secret not found — gh is read-only (GITHUB_TOKEN only)"
  echo "  Fix: github.com/settings/codespaces → add GH_PAT secret scoped to this repo"
fi

# Configure git to use the PAT for HTTPS pushes to any AminAlAit repo
if [ -n "$GH_PAT" ]; then
  git config --global url."https://${GH_PAT}@github.com/".insteadOf "https://github.com/"
fi

clone_or_pull() {
  local repo=$1
  local dir="$WORKSPACES/$repo"
  if [ ! -d "$dir/.git" ]; then
    echo "Cloning AminAlAit/$repo..."
    git clone "https://github.com/AminAlAit/$repo.git" "$dir" 2>&1 || \
      echo "  WARNING: AminAlAit/$repo not found (repo may not exist yet — see qgi-aws-tf issues #52/#54)"
  else
    echo "$repo present — pulling..."
    git -C "$dir" pull --ff-only 2>/dev/null || echo "(pull skipped — local changes or diverged)"
  fi
}

# Sibling repos — add new repos here as they are created (#52, #54)
clone_or_pull "qgi-infra"
clone_or_pull "qgi-pipeline"

# ---------------------------------------------------------------------------
# Restore Claude memory from source-controlled .claude/ so the next Claude
# instance has full context (preferences, project state, past decisions).
# ---------------------------------------------------------------------------
MEMORY_DIR="$HOME/.claude/projects/-workspaces-qgi-aws-tf/memory"
mkdir -p "$MEMORY_DIR"
for f in MEMORY.md user_amin.md project_qgi_state.md feedback_responsibilities.md; do
  if [ -f "/workspaces/qgi-aws-tf/.claude/$f" ]; then
    cp "/workspaces/qgi-aws-tf/.claude/$f" "$MEMORY_DIR/$f"
    echo "Restored Claude memory: $f"
  fi
done

echo ""
echo "Hub Codespace ready. /workspaces contents:"
ls "$WORKSPACES"
