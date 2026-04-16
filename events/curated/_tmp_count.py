import json
from collections import Counter
with open('<USER_HOME>/Desktop/trojan/qgi-6.0/qgi-data/events/curated/belarus.json') as f:
    events = json.load(f)
cats = Counter(e['category'] for e in events)
print('Total events:', len(events))
print('Year range:', min(e['year'] for e in events), '-', max(e['year'] for e in events))
print('Top categories:')
for cat, count in cats.most_common(8):
    print(' ', cat, count)
print('All verified False:', all(e['verified'] == False for e in events))
print('All source None:', all(e['verification_source'] is None for e in events))
