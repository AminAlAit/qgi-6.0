#!/bin/bash
set -e

WORKSPACES=/workspaces

# ---------------------------------------------------------------------------
# Git + gh authentication with PAT.
#
# GH_PAT is injected from the "qgi-hub-codespace" Codespace user secret
# (github.com/settings/codespaces). It is needed to clone private sibling
# repos (qgi-infra, qgi-pipeline) and push across repos.
#
# Root cause of past failures: Codespaces always sets GITHUB_TOKEN in the
# environment, and `gh auth login --with-token` silently no-ops when
# GITHUB_TOKEN is present (gh prefers the env var). The git insteadOf URL
# rewrite is the reliable mechanism — it embeds the PAT directly in URLs so
# git clone/push work regardless of which token gh is using.
# ---------------------------------------------------------------------------
if [ -n "$GH_PAT" ]; then
  # Set git URL rewrite FIRST — this is what actually enables private clone/push.
  # Must be done before clone_or_pull is called.
  git config --global url."https://${GH_PAT}@github.com/".insteadOf "https://github.com/"
  echo "git configured to use GH_PAT for github.com URLs"

  # Also try to authenticate gh CLI (may no-op if GITHUB_TOKEN env var is set,
  # but doesn't harm anything — git config above is the real fix).
  unset GITHUB_TOKEN
  echo "$GH_PAT" | gh auth login --with-token 2>/dev/null && \
    echo "gh CLI authenticated via GH_PAT" || \
    echo "gh CLI kept GITHUB_TOKEN (read-only for gh commands; git ops use PAT via insteadOf)"
else
  echo "WARNING: GH_PAT secret not found — cannot clone private repos or push cross-repo"
  echo "  Fix: github.com/settings/codespaces → add GH_PAT secret scoped to qgi-aws-tf"
fi

clone_or_pull() {
  local repo=$1
  local dir="$WORKSPACES/$repo"
  if [ ! -d "$dir/.git" ]; then
    echo "Cloning AminAlAit/$repo..."
    git clone "https://github.com/AminAlAit/$repo.git" "$dir" 2>&1 || \
      echo "  WARNING: failed to clone AminAlAit/$repo — check GH_PAT secret and repo existence"
  else
    echo "$repo present — pulling..."
    git -C "$dir" pull --ff-only 2>/dev/null || echo "(pull skipped — local changes or diverged)"
  fi
}

# Sibling repos — all active repos that should be present in the hub Codespace
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
