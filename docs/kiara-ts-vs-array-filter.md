# kiara-ts vs Array.filter: When Is an Index Worth It?

`Array.filter` is a good default for searching an in-memory collection. It is
readable, needs no dependency, and works immediately. Why use kiara-ts instead?

The useful distinction is not TypeScript versus JavaScript. Both run on the
same JavaScript engine. It is **scanning the data for each query versus preparing
indexes that subsequent queries can reuse**.

## What changes with an index?

`Array.filter` visits every row, even when only a few records match. A prepared
kiara-ts store can use indexes to narrow the candidates before returning results.
That can help when users repeatedly change filters over the same dataset.

There is also a code-maintenance difference. Equality checks are easy to write;
combinations of numeric bounds, list membership, missing values, and stored
ranges need more care. kiara-ts provides those query semantics through a schema
and conditions. Arrays can express them too; the library saves you from
implementing and maintaining that query layer yourself.

## What the benchmark found

These figures were measured on kiara-ts **1.2.1**. Earlier reports for
pre-release engines are kept in the repository history rather than silently
replaced.

We compared both approaches across 86 exact-query scenarios: real retail data
and deterministic synthetic catalogs and schedules. Each engine ran in three
isolated processes, with warmup queries before measurement. All shared results
agreed on matching IDs, counts, and source order.

| Dataset | Rows | Aggregate query speedup with kiara-ts |
|---|---:|---:|
| Retail | 3,788 | 8.6x |
| Catalog | 10,000 | 14x |
| Catalog | 100,000 | 22x |
| Schedule | 10,000 | 11x |
| Schedule | 100,000 | 21x |

These are geometric means of median-latency ratios, not guarantees for each
query. Preparation time is excluded.

For a concrete example, filtering 100,000 products by status, region, and brand
returned 299 records in **0.156 ms with kiara-ts versus 19.07 ms with the array
baseline**.

`Array.filter` was still faster in **2 of the 86 scenarios**, both on the
100,000-event schedule with stored-range conditions. Asking which capacity
ranges contain both 100 and 900 returned 4,431 events in **9.31 ms with the
array versus 20.55 ms with kiara-ts**. A four-condition query combining kind,
city, a season range, and a capacity range favored the array too: 20.67 ms
versus 27.48 ms. Broad matches also narrow the gap: selecting 17,605 active pro
products was only 1.8x faster (6.4 versus 11.5 ms). An index does not make
every query cheaper.

## Does the advantage grow with more records?

Mostly, yes. From 10,000 to 100,000 records the aggregate speedup rose from
14x to 22x on catalogs and from 11x to 21x on schedules.

The clearest gains come from **result limits**. Returning the first 20 active
products went from **69x to 748x faster**, and the first 100 products tagged
gift or premium from **23x to 271x**. kiara-ts latency for that tag query stayed
flat (0.071 versus 0.067 ms) while the array grew from 1.63 to 18.18 ms. Note
that the array baseline scans everything before applying its limit; a custom
loop that stops early would narrow those gaps.

Queries that return a fixed share of the data scale differently. For
`brand = brand-07`, the speedup stayed near 9-10x (10x, then 8.9x), but the time
saved per query grew tenfold, from 0.69 to 7.4 ms. The larger catalog has ten
times more matches (206 became 2,018), and returning them still takes work.

Stored-range queries scaled worst. "Capacity range contains 100 and 900" took
kiara-ts 0.55 ms at 10,000 events and 20.55 ms at 100,000, about 37 times
longer for 10 times the data, while the array grew about 12 times. That is
where the two remaining losses come from.

These timings identify behavior, not its internal cause; candidate processing,
allocations, and garbage collection would need profiling.

## What those faster queries cost

The 100,000-product store took approximately **4.0 seconds to prepare** and
retained **477 MB of additional heap**. The 100,000-event schedule took
**6.7 seconds and 761 MB**.

The array baseline needed essentially no preparation or additional retained
state beyond the already-loaded dataset. Those figures do not mean arrays use
no memory: the source data is excluded from both measurements, and filtering
allocates results during execution.

Kiara's build also included configured keyword, trie, and interpreter
preparation, although only exact queries were compared. These are full-build
costs, not a filter-only minimum.

## What this comparison does not establish

The baseline uses native `Array.filter` with a **generic, schema-aware
predicate**, including normalization and missing-value handling. It is not a
hand-tuned callback for every query. Specialized predicates or pre-normalized
data could narrow the gap.

Measurements used kiara-ts 1.2.1 on Node.js 26.13.0, Windows,
and an AMD EPYC 7763. They are not browser measurements or a promise about other
versions. Fuzzy search and query interpretation are outside the shared comparison.

## A practical way to choose

Start with `Array.filter` for small collections, occasional queries, or data
that changes so often that rebuilding an index would dominate the work.

Consider kiara-ts when the same dataset serves many queries, filter combinations
are becoming complex, and measured query savings justify preparation and memory.

The reason to choose it is not that arrays are inadequate. It is that **paying
once to prepare a reusable query structure can be worthwhile when you search
the same data repeatedly**.

---

[Full methodology and per-query results](./native-filter-comparison.md) |
[Raw measurements](../benchmarks/native-filter-comparison.json) |
[Array.filter implementation](../scripts/native-filter.ts)

Reproduce the benchmark with `npm run bench:native`.
