import pandas as pd, numpy as np
p = pd.read_parquet("experiments/banking-enrichment/p1/candidates/credit_growth_3y_fd/credit_growth_3y_fd.parquet")
print("rows:", len(p), "countries:", p['country'].nunique())
print(p['value'].describe())
print("NaN count:", p['value'].isna().sum())
print("inf count:", np.isinf(p['value']).sum())
print(p.head(10))
print(p.dtypes)

# check dupes
print("dup (country,year):", p.duplicated(subset=['country','year']).sum())

# Spot check: South Korea around 1997 (should show credit boom pre-crisis)
sk = p[p['country']=='South Korea'].sort_values('year')
print("\nSouth Korea credit_growth_3y_fd:")
print(sk[(sk['year']>=1990)&(sk['year']<=2000)])

th = p[p['country']=='Thailand'].sort_values('year')
print("\nThailand credit_growth_3y_fd:")
print(th[(th['year']>=1990)&(th['year']<=2000)])
