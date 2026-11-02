# KiaraDB vs Array.filter: When a Prepared Index Pays Off, and When It Doesn't

`Array.filter` is the right default for searching data in memory. KiaraDB, an open-source search engine for TypeScript and Java, makes the opposite trade: it spends seconds preparing per-field indexes so later queries can skip most rows. Across 86 benchmark queries it was 8.6× to 22× faster overall, and when the data grew tenfold, the time it saved grew 11- to 22-fold. It also lost twice.

![KiaraDB versus Array.filter: times faster at 10,000 and 100,000 records. First 20 of 70,072 rose from 69 to 748 times faster, three fields equal from 72 to 122, one field equal stayed near 9, broad matches near 2, and on two stored ranges Array.filter was 2.2 times faster at 100,000 records. Preparing 100,000 products took 4.0 seconds and 477 MB.](./images/kiaradb-vs-array-filter.png)

*Written by KiaraDB's creator with AI assistance. Every number comes from an open benchmark you can rerun with one command.*

## Same question, two approaches

Find active products priced 20 to 40 that are not tagged clearance:

```javascript
import {
  Store, NormalizationProfile, Operator, createCondition, defineSchema, textField, numberField,
} from "@kapoorlabs/kiara-ts";

const products = [
  { id: "p1", status: "active", price: 25, tags: "gift,premium" },
  { id: "p2", status: "active", price: 55, tags: "gift" },
  { id: "p3", status: "archived", price: 30, tags: "premium" },
  { id: "p4", status: "active", price: 35, tags: "clearance" },
  { id: "p5", status: "active", price: 22, tags: null },
  { id: "p6", status: "active", price: 40, tags: "premium,eco" },
];

// Array.filter: no setup; every query scans every product.
const scanned = products.filter((p) => p.status === "active"
  && p.price >= 20 && p.price <= 40
  && !(p.tags ?? "").split(",").includes("clearance"));

// KiaraDB: declare fields and prepare once; later queries reuse the indexes.
const store = new Store(defineSchema([
  textField("status"),
  numberField("price"),
  textField("tags", { secondaryType: "commaSeparatedStrings", nullable: true }),
  textField("id", { ignoreIndex: true }),
]), { normalizationProfile: NormalizationProfile.NATIVE });
store.loadRows(products);
store.prepare();
const indexed = store.search([
  createCondition({ field: "status", values: ["active"] }),
  { field: "price", operator: Operator.BETWEEN, lowerValue: 20, upperValue: 40 },
  { field: "tags", operator: Operator.NOT_CONTAINS, values: ["clearance"] },
]);

console.log(JSON.stringify({
  scanned: scanned.map((p) => p.id),
  indexed: indexed.map((p) => p.id),
}));
```

```json
{"scanned":["p1","p5","p6"],"indexed":["p1","p5","p6"]}
```

Both return the same products, including `p5`, whose tags are missing. KiaraDB defines how missing lists, inclusive bounds, and exclusions behave once, in the schema, instead of in every callback.

## How the benchmark was run

- **86 exact-filter scenarios** over 3,788 real retail products and synthetic catalogs and schedules of 10,000 and 100,000 records.
- **One generic Array.filter baseline** with the same missing-value and range rules, then `slice` for limits; no index, no early exit.
- **Checked before timed:** identical IDs, count, and order. Medians of three isolated Node.js runs; preparation timed separately.

## The results

| Dataset | Records | Array.filter, all queries | KiaraDB, all queries | Saved | Typical speedup | Prepare | Extra memory |
|---|---:|---:|---:|---:|---:|---:|---:|
| Retail | 3,788 | 4.3 ms | 0.6 ms | 3.7 ms | 8.6× | 0.35 s | 15 MB |
| Catalog | 10,000 | 25 ms | 2.5 ms | 22 ms | 14× | 0.45 s | 52 MB |
| Catalog | 100,000 | 276 ms | 27 ms | 249 ms | 22× | 4.0 s | 477 MB |
| Schedule | 10,000 | 23 ms | 4.8 ms | 18 ms | 11× | 0.67 s | 85 MB |
| Schedule | 100,000 | 487 ms | 75 ms | 412 ms | 21× | 6.7 s | 761 MB |

"All queries" sums the median latency of every scenario in the dataset (6 to 21 queries). Typical speedup is the geometric mean of per-query ratios. Array.filter needed no preparation and almost no memory.

KiaraDB was faster in 84 of 86 scenarios and at least 20× faster in 32.

## Savings grow with the data

Ten times more records made Array.filter 11 to 21 times slower across each query set. Selective KiaraDB queries stayed well under a millisecond, so the milliseconds saved grew even faster than the data:

| Query (Array.filter → KiaraDB) | 10,000 records | 100,000 records |
|---|---:|---:|
| Active, in EMEA, one brand | 1.7 → 0.02 ms | 19.1 → 0.16 ms |
| One start date | 0.60 → 0.02 ms | 20.6 → 0.32 ms |
| First 20 active products | 0.96 → 0.01 ms | 11.8 → 0.02 ms |

Across the whole query sets, savings grew from 22 to 249 ms on catalogs and from 18 to 412 ms on schedules. We measured up to 100,000 records. Because a scan pays for every row and a selective index lookup mostly does not, the gap should keep widening with larger data, but measure your own.

## Where KiaraDB shines

**Selective filters across several fields.** Active EMEA products from one brand (299 of 100,000) matched 122× faster; the per-field indexes skip the other 99,701 rows. That makes it a fit for filter panels and dashboards that ask a new question on every click.

**Small result limits.** The first 20 of 70,072 active products came back 748× faster, because KiaraDB stops at 20 while Array.filter scans everything first. A hand-written loop that stops early would close much of that gap.

**Dates and lists.** Matching one start date among 100,000 events was 64× faster; events open on two given dates, 41×.

**Search beyond filters.** The same store adds typo correction, stemming, prefix completion, and a query interpreter, none of which were compared here.

## When to stay with Array.filter

**Small or one-off data.** Scanning 10,000 records took about 0.6 to 2 ms. If that is fast enough, a library adds little.

**Data that changes constantly.** Changing one record means rebuilding the prepared store: 4.0 seconds for 100,000 products. If data changes more often than it is queried, the scan wins.

**Tight memory budgets.** The 100,000-event store retained 761 MB beyond the source data. On low-end phones that can decide it.

**Broad matches.** Selecting 17,605 of 100,000 products with two broad conditions was only 1.8× faster (6.4 against 11.5 ms); indexes help less when much of the data matches.

**Stored ranges at scale.** Array.filter won both of its scenarios here, on 100,000 events: capacity ranges containing both 100 and 900 (9.3 against 20.6 ms in KiaraDB), and a four-condition query mixing two stored ranges (20.7 against 27.5 ms).

## Does the build pay for itself?

Preparing 100,000 products took about 4 seconds. The three-field query above saves 18.9 ms each time, so the build pays for itself after about 210 such queries; a one-field query saving 7.4 ms needs about 540. A busy filter interface gets there in one session. A nightly report never does. Build it in a Web Worker to keep the page responsive.

## A quick checklist

Reach for KiaraDB when most of these hold:

- The same dataset answers many queries.
- Queries combine several fields and usually return a small share of records.
- Filters include lists, ranges, dates, or missing values.
- Seconds of preparation and hundreds of megabytes per 100,000 records are acceptable.

Otherwise, `Array.filter` is simpler and probably fast enough.

## Reproduce it

```bash
git clone https://github.com/kapoor-labs/kiara-ts-examples
cd kiara-ts-examples && npm install && npm run bench:native
```

The [full report](https://github.com/kapoor-labs/kiara-ts-examples/blob/main/docs/native-filter-comparison.md) lists all 86 scenarios with p50 and p95 latency, and the [Array.filter baseline](https://github.com/kapoor-labs/kiara-ts-examples/blob/main/scripts/native-filter.ts) is one short file. Results come from one machine (Node.js 26, AMD EPYC 7763), not a browser, measured on [kiara-ts 1.2.1](https://www.npmjs.com/package/@kapoorlabs/kiara-ts/v/1.2.1).
