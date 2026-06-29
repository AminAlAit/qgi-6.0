import json, os, sys
from collections import Counter
# usage: python _salvage.py <full-path-to-task.output> <wpNN>
# (the task .output path's session-dir changes per run, so pass it in full)
F = sys.argv[1]
WAVE = sys.argv[2]
D = r'<USER_HOME>/Desktop/trojan/qgi-6.0/qgi-ml/curation'
res = json.load(open(F, encoding='utf-8')).get('result', {}).get('results', [])
ledger = json.load(open(D + '/ledger.json', encoding='utf-8'))
parked = json.load(open(D + '/parked.json', encoding='utf-8'))
abst = json.load(open(D + '/abstained.json', encoding='utf-8'))
st = Counter(r.get('status') for r in res)
added = 0
for r in res:
    k = r['iso2'] + '-' + str(r['year'])
    if r['status'] in ('accept-first', 'accept-repair'):
        if k not in ledger:
            added += 1
        ledger[k] = {'iso2': r['iso2'], 'year': r['year'], 'country': r['country'], 'blurb': r.get('blurb'), 'sources': r.get('sources', []), 'confidence': r.get('confidence'), 'status': r['status'], 'wave': WAVE}
    elif r['status'] == 'park':
        parked[k] = {'iso2': r['iso2'], 'year': r['year'], 'country': r['country'], 'blurb': r.get('blurb'), 'status': 'park', 'wave': WAVE}
    elif r['status'] == 'null-shipped':
        abst[k] = {'iso2': r['iso2'], 'year': r['year'], 'country': r['country'], 'status': 'null', 'wave': WAVE}
json.dump(ledger, open(D + '/ledger.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
json.dump(parked, open(D + '/parked.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
json.dump(abst, open(D + '/abstained.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
out = {k: {'blurb': v['blurb'], 'sources': v.get('sources', []), 'confidence': v.get('confidence', 'high')} for k, v in ledger.items() if v.get('blurb')}
dst = r'<USER_HOME>/Desktop/trojan/qgi-6.0/qgi-frontend/data/curation/what-happened-next.json'
json.dump(out, open(dst, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
rem = 3440 - len(ledger) - len(parked) - len(abst)
print(WAVE, dict(st), "| merged", added, "| completed", len(res))
print("LEDGER", len(ledger), "| parked", len(parked), "| abstained", len(abst), "| remaining", rem, "|", round(len(ledger) / 3440 * 100, 1), "% done")
print("republished:", len(out), "blurbs", os.path.getsize(dst) // 1024, "KB")
print("sample:", ', '.join(r['iso2'] + '-' + str(r['year']) for r in res if r['status'] in ('accept-first', 'accept-repair'))[:120])
