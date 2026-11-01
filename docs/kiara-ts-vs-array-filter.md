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

We compared both approaches across 86 exact-query scenarios: real retail data
and deterministic synthetic catalogs and schedules. Each engine ran in three
isolated processes, with warmup queries before measurement. All shared results
agreed on matching IDs, counts, and source order.

| Dataset | Rows | Aggregate query speedup with kiara-ts |
|---|---:|---:|
| Retail | 3,788 | 8.9x |
| Catalog | 10,000 | 7.1x |
| Catalog | 100,000 | 5.8x |
| Schedule | 10,000 | 3.7x |
| Schedule | 100,000 | 3.5x |

These are geometric means of median-latency ratios, not guarantees for each
query. Preparation time is excluded.

For a concrete example, filtering 100,000 products by status, region, and brand
returned 299 records in **0.351 ms with kiara-ts versus 18.57 ms with the array
baseline**.

But `Array.filter` was faster in **15 of the 86 scenarios**. On the same catalog,
selecting active products in the pro tier returned 17,605 records in
**12.50 ms with the array versus 28.96 ms with kiara-ts**. Even a more selective
rating-and-stars query favored the array: 7.65 ms versus 16.58 ms.
An index does not make every query cheaper.

## Should the advantage grow with more records?

**Saving more milliseconds is not the same as achieving a higher speedup
ratio.** For `brand = brand-07`, the measurements were:

| Records | kiara-ts | Array.filter | Time saved | Speedup |
|---|---:|---:|---:|---:|
| 10,000 | 0.099 ms | 0.777 ms | 0.678 ms | 7.8x |
| 100,000 | 1.789 ms | 8.699 ms | 6.910 ms | 4.9x |

The absolute saving grew about tenfold, even though the ratio fell.

The larger catalog also produced more matches: **206 became 2,018**. These
datasets keep similar value distributions, so increasing the record count
increases candidate and result counts too. An index can narrow the search,
but processing candidates and constructing results still takes work. Indexed
execution is not automatically constant-time.

Some bounded queries showed the expected growing advantage. Returning the
first 20 active products went from **22x to 108x faster**; returning the first
100 products in either of two regions went from **4.4x to 23x**. However, the
array baseline scans everything before applying its limit. A custom loop that
stops after enough matches could substantially reduce those advantages.

There are also scaling concerns that result counts alone cannot explain.
The query "tags contain gift or premium, first 100" returned 100 records at
both sizes, but kiara-ts latency grew from **0.248 to 4.033 ms**, roughly 16x
for 10x more data. The array grew from **1.729 to 18.585 ms**, roughly 11x.
Some range and combined-condition queries also scaled poorly, pulling down
the aggregate speedup.

These timings identify behavior, not its internal cause. Candidate processing,
allocations, ordering, and garbage collection would need profiling; none is
established as the explanation here. Build time is excluded from these ratios.

The measured conclusion is narrower than "bigger datasets mean bigger
speedups": **absolute savings often grow, while relative gains depend on the
query**. A dedicated scaling benchmark should separate fixed match counts,
fixed match percentages, and limited results rather than combine them.

## What those faster queries cost

The 100,000-product store took approximately **3.54 seconds to prepare** and
retained **453 MB of additional heap**. The 100,000-event schedule took
**6.47 seconds and 804 MB**.

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

Measurements used the local `1.1.1-search.0` candidate on Node.js 26.13.0, Windows,
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
