import json
d = json.load(open("results/p2_results.json"))
pc = d["candidates"]["credit_growth_3y_fd"]["per_country_positive_prob_delta_candidate_minus_baseline"]
deltas = [(c, v["mean_prob_delta"], v["n"]) for c, v in pc.items()]
pos = [x for x in deltas if x[1] > 0]
neg = [x for x in deltas if x[1] < 0]
print(f"n countries with positive delta (candidate better): {len(pos)}")
print(f"n countries with negative delta (candidate worse): {len(neg)}")
print(f"sum of positive deltas: {sum(x[1] for x in pos):.3f}")
print(f"sum of negative deltas: {sum(x[1] for x in neg):.3f}")
print(f"net sum: {sum(x[1] for x in deltas):.3f}")

# check concentration: does removing the single worst country flip the sign of net sum?
deltas_sorted = sorted(deltas, key=lambda x: x[1])
print("\n5 most negative:", deltas_sorted[:5])
print("5 most positive:", deltas_sorted[-5:])

# leave-worst-3-out net sum
without_worst3 = deltas_sorted[3:]
print(f"\nnet sum excluding 3 most-negative countries: {sum(x[1] for x in without_worst3):.3f} (of {len(without_worst3)} countries)")
