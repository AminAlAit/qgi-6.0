"""Resume the fleet audit — run only the trends NOT yet in results/fleet_audit.json, append
incrementally. Single canonical seed (12345) for the remaining big-N tail: it's ~3x faster
(so it can finish between machine sleeps) and the PRIMARY honest number already anchors on
seed 12345 anyway — only the multi-seed fragility footnote is skipped for these. Docker-only.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import audit_fleet as a

a.SEEDS = [12345]


def main() -> int:
    rows = json.loads(a.OUT_PATH.read_text(encoding="utf-8"))
    done = {r["trend"] for r in rows}
    rem = []
    for f in sorted(a.CARDS_DIR.glob("*.card.json")):
        d = json.load(open(f, encoding="utf-8"))
        t = f.name.replace(".card.json", "")
        if (d.get("stats", {}) or {}).get("loco_auc") is None or t in done:
            continue
        rem.append((t, d))
    rem.sort(key=lambda x: -(x[1].get("stats", {}) or {}).get("loco_auc", 0))
    print(f"resuming {len(rem)} trends (seed=12345)")
    for i, (t, card) in enumerate(rem, 1):
        try:
            r = a.audit_trend(t, card)
        except Exception as e:  # noqa: BLE001
            r = {"trend": t, "verdict": "ERROR", "error": repr(e)}
        rows.append(r)
        d = r.get("delta")
        print(f"[{i}/{len(rem)}] {t:30s} ship={r.get('shipped')} honest={r.get('honest')} "
              f"d={d:+.3f} {r.get('verdict')}" if d is not None
              else f"[{i}/{len(rem)}] {t:30s} {r.get('verdict')}")
        a.OUT_PATH.write_text(json.dumps(rows, indent=2, default=str), encoding="utf-8")
    print("==== RESUME DONE ====")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
