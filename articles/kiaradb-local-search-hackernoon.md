# What If a Redis-Style Cache Could Answer SQL-Style Queries?

Key lookups are simple. Searching by status, score, tags, and ranges needs more machinery.
KiaraDB brings advanced filtering to prepared, in-memory data without composite indexes for each field combination.
Here is how per-field indexes and shared data structures avoid that combinatorial setup, with cache-like responsiveness as the goal.

![A schema becomes internal indexes that support several combinations of query conditions, with Java and TypeScript implementations.](./images/field-agnostic-java-ts.png)

## Ten fields, 1,023 possible combinations

A plain key-value lookup retrieves a known key. To support changing filters,
an application might maintain additional lookup keys: one for status, another
for status plus region, another for status plus score.

Suppose it materializes a separate lookup index for **every nonempty subset of
10 searchable fields**:

**2^10 - 1 = 1,023 combinations: 10 single-field and 1,013 multi-field.**

KiaraDB instead indexes those **10 searchable fields individually**, reusing
their structures across combinations. No 1,013 composite indexes to define or
maintain. This counts field subsets, not distinct values, index bytes, or a
measured memory-saving ratio.

That explosion is a consequence of the hypothetical per-combination design,
not a requirement of every key-value database. Alternatives include intersecting
per-field indexes; PostgreSQL documents both [index combination](https://www.postgresql.org/docs/current/indexes-bitmap-scans.html)
and [multicolumn index trade-offs](https://www.postgresql.org/docs/current/indexes-multicolumn.html).

And Redis is not limited to key lookup: [Redis Search](https://redis.io/docs/latest/develop/ai/search-and-query/)
already offers rich queries and secondary indexing. The title is an analogy
for KiaraDB's appeal: cache-oriented, in-memory access with SQL-style predicates,
not SQL syntax, joins, or proven Redis-equivalent latency.

## Per-field indexes, shared structures, no composite indexes

KiaraDB's indexing unit is the searchable field, not the combination. Think
**one logical index per field**, with type-specific supporting structures,
rather than one physical structure doing every job.

The Java implementation combines hash-based inverted indexes, a shared-prefix
trie, ordered keys, and specialized interval trees for range queries. Shared
trie prefixes avoid repeating common paths; range trees discard their temporary
loading arrays after preparation. These are concrete memory-conscious choices,
alongside avoiding per-combination lookup structures.

TypeScript 1.1.0 uses per-field maps, ordered numeric entries, range entries,
and a trie; it does not share all Java internals. Define types, load records,
and call `prepare()`. Fields are searchable unless marked `ignoreIndex`.

Both implementations remove manual composite-index design, not schema,
preparation time, or memory costs. This walkthrough uses the TypeScript API.

## Define once, ask different questions

Install `npm install @kapoorlabs/kiara-ts@1.1.0`, save as `combined-search.mjs`,
and run `node combined-search.mjs`. These fictional records demonstrate behavior,
not throughput.

```javascript
import {
  Store, NormalizationProfile, Operator,
  createCondition, defineSchema, textField, numberField,
} from "@kapoorlabs/kiara-ts";

const store = new Store(defineSchema([
  textField("id", { ignoreIndex: true }),
  textField("status", { caseInsensitive: true }),
  numberField("score"),
  textField("tags", { secondaryType: "commaSeparatedStrings" }),
  textField("window", { secondaryType: "numericRange" }),
]), { normalizationProfile: NormalizationProfile.NATIVE });
store.loadRows([
  { id: "a", status: "active", score: 85, tags: "audited,export", window: "10->30" },
  { id: "b", status: "active", score: 92, tags: "export", window: "10->30" },
  { id: "c", status: "archived", score: 98, tags: "audited,export", window: "10->30" },
]);
store.prepare();

const status = createCondition({ field: "status", values: ["ACTIVE"] });
const combined = [
  status,
  { field: "score", operator: Operator.BETWEEN, lowerValue: 80, upperValue: 95 },
  { field: "tags", operator: Operator.CONTAINS_ALL, values: ["audited", "export"] },
  { field: "window", operator: Operator.CONTAINS_EITHER, values: [20] },
];
console.log(JSON.stringify({
  byStatus: store.search([status]).map((row) => row.id),
  combined: store.searchProjection(combined, ["id", "score"]),
}));
```

Expected output:

```json
{"byStatus":["a","b"],"combined":[{"id":"a","score":85}]}
```

The second query adds three requirements to the first. No new index definition,
per-combination store, or custom tag parser appears between the searches.

The unindexed ID remains available in projections, not hidden by access control.

## The less obvious capabilities

Basic equality is only the starting point:

| Requirement | Capability |
|---|---|
| Require every selected tag, or just one | Collection ALL and ANY operators |
| Exclude a member | `NOT_CONTAINS`, rather than substring matching |
| Query a supported date or date-time | Typed temporal normalization and comparisons |
| Match a point inside a stored window | Numeric, date, and date-time range containment |
| Represent several allowed windows | Collections of ranges without expanding every point into a row |
| Accept incomplete source data deliberately | Explicit scalar null and supported null-aware collection queries |
| Return only what the caller needs | Typed projections and result limits |

Operators have field-specific semantics. In particular, containing two points
in separate intervals does not prove coverage of the gap between them.

TypeScript supports text, numbers, longs, booleans, and enums through schema
builders or standard decorators.

## Help users express the query

The TypeScript 1.1.0 `QueryInterpreter` adds another useful layer. It can
discover whole values across eligible fields, resolve declared aliases, convert
configured units, and turn explicit expressions into conditions.

If a value belongs to several fields, interpretation exposes ambiguity instead
of choosing one silently. Strict execution rejects unresolved fragments.

Separately, keyword retrieval supports English stemming and one-edit typo
correction alongside hard filters. Dictionary prefix suggestions help users
complete words; record retrieval remains a separate operation.

These are deterministic tools, not unrestricted natural-language understanding
or an interpreter API verified in Java.

## What the design asks you to trade

KiaraDB is a fit to evaluate for read-mostly, prepared datasets. Preparation is
not free, and the data and search structures must fit your memory budget.

The goal is advanced search with cache-like responsiveness. Establish that
for your workload: measure preparation, memory, latency, and returned-row counts.
A Redis comparison needs equivalent queries, datasets, deployment conditions,
and concurrency; a single-key GET is not a multi-condition search benchmark.

For a tiny list and one condition, a loop may be simpler. For transactional
writes, joins, durable storage, or access control, retain systems designed for
those responsibilities.

TypeScript `StoreLoader.replaceAll` can prepare a replacement while retaining
the previous store. Your application validates it and controls activation.
Worker APIs are available when browser execution needs to leave the UI thread;
they are an integration option, not the product's identity.

The TS library has zero runtime dependencies; the playground's UI and CSV
dependencies are separate.

## Evaluate the combination, not a slogan

Take one real dataset and add the filter combination your interface makes
awkward. Inspect the results and measure the cost: that is the useful test of
cache-oriented access with richer search.

Try your own CSV and the guided queries in the
[companion playground](https://github.com/kapoor-labs/kiara-ts-examples),
which links to the Java and TypeScript libraries.
