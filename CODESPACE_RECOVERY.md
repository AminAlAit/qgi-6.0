# Codespace Recovery — Read This First

> **This file exists because the Codespace was previously launching in recovery mode.**
> A fix has been applied. Your first job is to determine if it worked.

---

## Step 1 — Did the Codespace open normally (not in recovery mode)?

**Yes, it opened normally → the fix worked. Delete this file and push:**

```bash
git rm CODESPACE_RECOVERY.md
git commit -m "chore: remove CODESPACE_RECOVERY.md — codespace issue resolved"
git push origin main
```

Done. No further action needed.

---

## Step 2 — If it opened in recovery mode again, diagnose

The fix applied was: swap base image from `mcr.microsoft.com/devcontainers/universal:2`
(~10 GB, caused "no space left on device") to `mcr.microsoft.com/devcontainers/python:1-3.13`
(~1-2 GB). Commit: `3d93a79`.

Check if the fix actually took effect:

```bash
# Is the new base image in the Dockerfile?
head -1 .devcontainer/Dockerfile
# Expected: FROM mcr.microsoft.com/devcontainers/python:1-3.13

# Is the Python feature gone from devcontainer.json?
grep -c "python" .devcontainer/devcontainer.json
# Expected: 0
```

If both look correct but recovery mode persists, capture a new creation log:

```bash
# In a Codespace terminal, the log is at:
cat /workspaces/.codespaces/.persistedshare/creation.log 2>/dev/null \
  || cat /tmp/creation.log 2>/dev/null \
  || echo "log not found — check GitHub Codespaces UI → three-dot menu → View creation log"
```

### Known failure modes and fixes

| Symptom in log | Cause | Fix |
|---|---|---|
| `no space left on device` during image pull | Base image still too large | Switch to an even smaller base, e.g. `mcr.microsoft.com/devcontainers/base:ubuntu` and install Python via feature |
| `no space left on device` during feature install | A feature (Terraform, AWS CLI) is pulling a large binary | Pin versions instead of `latest`; or pre-bake into Dockerfile |
| `failed to register layer` on a specific `.pyc` file | Python packages in base image exhausting disk | Remove Python from base; use `ghcr.io/devcontainers/features/python:1` with explicit version |
| Build succeeds but container OOMs on start | Machine type too small | Upgrade Codespace machine type to 4-core / 16 GB |
| Error code `1302` | Generic container creation failure — check lines above it in the log | Look for the real error 10-20 lines before the 1302 line |

### Escalation path

If disk space is genuinely exhausted even with the lean image:

1. Check Codespace machine type — minimum 4-core recommended for this hub
2. Consider pre-building the devcontainer image via GitHub Actions + `devcontainer.json` `image:` field pointing to GHCR, so Codespace just pulls a cached image instead of building from scratch
3. File a GitHub issue in `AminAlAit/qgi-aws-tf` with label `infrastructure` + `claude` and attach the new creation log

---

*Written 2026-03-28. Delete once the issue is confirmed resolved.*
