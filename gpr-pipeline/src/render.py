#!/usr/bin/env python3
"""
QGI-GPR render — movers.json (+ grounding.json) -> 3 gpr_movers v6 cards.

Assembles the mixed / risers / fallers gpr_movers copy.json entries (the "copy-complete"
card type, v6-cards-playbook §7F) and drives the existing v6 engine (build.mjs -> cGprMovers)
to produce 3 PNG + 3 captions. Honesty: GPR = movement in risk-flagged NEWS COVERAGE, not
conflict; weekly noisier than monthly; artifacts tagged "no clear event"; no forecast.
"""
from __future__ import annotations
import argparse, json, os, re, subprocess, sys
from datetime import date

ENGINE = os.environ.get("ENGINE_DIR",
    r"/workspace/qgi-6.0/qgi-docs/internal/outreach/twitter-x/engine")
NODE = os.environ.get("NODE_BIN", "node")
FOOT = "GPR is movement in the risk signal, not its level. Not a forecast."


def human_week(iso: str) -> str:
    d = date.fromisoformat(iso)
    return d.strftime("%b %-d") if os.name != "nt" else d.strftime("%b ") + str(d.day)


def prior_iso(iso: str) -> str:
    d = date.fromisoformat(iso)
    return (d.replace(day=d.day)).isoformat()


def items(movers, top, ground_by, headline_name):
    out = []
    for m in movers[:top]:
        it = {"rank": m["rank"], "name": m["name"], "pct": m["pct"], "tier": m["tier"]}
        if m["name"] == headline_name:      # highlight follows the headline, never contradicts the copy
            it["highlight"] = True
        ev = ground_by.get(m["name"], {}).get("event")
        if ev and ev.strip().lower() == "no clear event":
            it["tag"] = "no clear event"
        out.append(it)
    return out


def move_phrase(name, ev, verb):
    """'<name> <verb> amid <event>' when grounded; honest 'with no clear driver' when not."""
    if ev and ev.strip().lower() != "no clear event":
        return f"{name} {verb} amid {ev}"
    return f"{name} {verb}, with no clear driver behind the move"


def clip(s, n=280):
    return s if len(s) <= n else s[: n - 1].rsplit(" ", 1)[0] + "."


def build_copy(movers, ground):
    lw, pw = movers["latest_week"], movers["prior_week"]
    wk, pwk = human_week(lw), human_week(pw)
    axis = f"QGI-GPR change, week of {wk} vs {pwk}, {lw[:4]}"
    note = "44 validated countries · weekly share of risk-flagged news coverage · weekly moves are noisier than the monthly signal"
    gr = {g["name"]: g for g in ground.get("risers", [])}
    gf = {g["name"]: g for g in ground.get("fallers", [])}
    # HEADLINE = the biggest mover (rank 1), always. Never route around it to a tidier story;
    # if it has no grounded driver, say so honestly. So highlight == headline == copy subject.
    hr = movers["risers"][0]["name"]
    hf = movers["fallers"][0]["name"]
    hr_ev = gr.get(hr, {}).get("event", "")
    hf_ev = gf.get(hf, {}).get("event", "")

    def seg(t, c=None, glue=False):
        d = {"t": t}
        if c: d["c"] = c
        if glue: d["glue"] = True
        return d

    def tail(ev, verb):   # "amid <event>" or ", with no clear driver behind the move"
        return f" amid {ev}" if ev and ev.strip().lower() != "no clear event" else ", with no clear driver behind the move"

    mixed_sub = [
        seg(f"QGI-GPR, the week of {wk}."),
        seg(hr, "teal"), seg(f"rose most{tail(hr_ev,'')};"),
        seg(hf, "red"), seg(f"fell most{tail(hf_ev,'')}. These track risk-flagged news coverage, not conflict."),
    ]
    mixed_cap = clip(f"{hr}'s risk signal rose most of the 44 countries tracked the week of {wk}{tail(hr_ev,'')}. "
                     f"{hf}'s fell most{tail(hf_ev,'')}. Not a forecast. qgintelligence.com")

    r_sub = [seg(f"Where the QGI-GPR signal rose most, the week of {wk}."),
             seg(hr, "teal"), seg(f"led{tail(hr_ev,'')}. A read on risk news, not conflict itself.")]
    r_cap = clip(f"{hr} led the world's risk risers the week of {wk}{tail(hr_ev,'')}. "
                 f"QGI-GPR tracks risk-flagged news coverage, not conflict. Not a forecast. qgintelligence.com")

    f_sub = [seg(f"Where the QGI-GPR signal fell most, the week of {wk}."),
             seg(hf, "red"), seg(f"fell most{tail(hf_ev,'')}. Weekly falls can reflect a shift in coverage mix, not real de-escalation.")]
    f_cap = clip(f"{hf}'s risk signal fell most of the 44 countries tracked the week of {wk}{tail(hf_ev,'')}. "
                 f"A fall is a smaller share of risk-flagged coverage, not necessarily lower real risk. Not a forecast. qgintelligence.com")

    return {
        "gpr-movers-week": {"type": "gpr_movers", "title": f"{hr} jumps, {hf} eases this week",
            "subSegments": mixed_sub, "items": items(movers["risers"], 5, gr, hr) + items(movers["fallers"], 5, gf, hf),
            "split_after": 5, "axis": axis, "note": note, "foot": FOOT, "caption": mixed_cap},
        "gpr-risers-week": {"type": "gpr_movers", "title": f"{hr} leads the week's risk risers",
            "subSegments": r_sub, "items": items(movers["risers"], 10, gr, hr),
            "axis": axis, "note": note, "foot": FOOT, "caption": r_cap},
        "gpr-fallers-week": {"type": "gpr_movers", "title": f"{hf} leads the week's risk fallers",
            "subSegments": f_sub, "items": items(movers["fallers"], 10, gf, hf),
            "axis": axis, "note": note.replace("weekly moves are noisier than the monthly signal",
                                              "a fall is a smaller share of risk-flagged coverage, not necessarily lower real risk"),
            "foot": FOOT, "caption": f_cap},
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--movers", default="C:/tmp/qgi-gpr-pipeline/data/movers.json")
    ap.add_argument("--ground", default="C:/tmp/qgi-gpr-pipeline/data/grounding.json")
    ap.add_argument("--out", default="C:/tmp/qgi-gpr-pipeline/out")
    a = ap.parse_args()
    movers = json.load(open(a.movers, encoding="utf-8"))
    ground = json.load(open(a.ground, encoding="utf-8")) if os.path.exists(a.ground) else {}
    os.makedirs(a.out, exist_ok=True)
    copy = build_copy(movers, ground)
    cp = os.path.join(a.out, "copy.json")
    json.dump(copy, open(cp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    for name, e in copy.items():
        over = len(e["caption"]) > 280
        print(f"  {name:<18} cap={len(e['caption'])}{' OVER' if over else ''} items={len(e['items'])}")
    # dash guard (honesty gate)
    dash = [n for n, e in copy.items() if re.search(r"[—–]", json.dumps(e, ensure_ascii=False))]
    if dash: print("  WARNING em/en-dash in:", dash)
    print("running v6 build...")
    r = subprocess.run([NODE, os.path.join(ENGINE, "v6", "build.mjs"), "--copy", cp, "--out", a.out],
                       cwd=ENGINE, capture_output=True, text=True)
    print(r.stdout[-500:] or r.stderr[-500:])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
