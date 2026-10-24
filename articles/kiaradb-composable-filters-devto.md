# 10 Fields, 1,023 Combinations: How KiaraDB Handles Changing Filters

Adding another filter should not mean designing another lookup key. This tutorial uses KiaraDB to combine equality, numeric bounds, tags, and stored intervals after one preparation step.
You'll work through the indexing math, run the queries, and check the results against a plain JavaScript filter.

*Disclosure: This article was drafted with AI assistance.*

![Declared fields are prepared into reusable internal indexes, then combined into queries. KiaraDB has Java and TypeScript implementations.](./images/field-agnostic-java-ts.png)

*Technical illustration created with AI assistance.*

## The problem with a lookup for every combination

A key-value lookup is straightforward when you know the key. Requirements become
more interesting when someone asks for:

- Records with a particular status.
- That status **and** a score within a band.
- Those conditions **and** every required tag.
- Everything above, excluding a tag, with a point inside a stored interval.

One possible design is to maintain a separate lookup index for each combination.
If there are `n` independently selectable fields, the number of nonempty subsets
is `2^n - 1`.

For **10 fields**, that is **1,023 combinations: 10 single-field and 1,013
multi-field**. The calculation counts field subsets, not values, sort orders,
memory usage, or actual indexes required by a database.

You do not have to choose that design. Per-field indexes can be reused across
queries; PostgreSQL, for example, supports [combining multiple indexes](https://www.postgresql.org/docs/current/indexes-bitmap-scans.html).

KiaraDB uses searchable fields as its indexing unit. You define a schema and
prepare the data, rather than defining a composite index for every new
combination. **Automatic indexing is not the absence of indexes.**

## Where hashes, tries, and trees fit

KiaraDB has Java and TypeScript implementations, but their internals differ:

| Implementation | Relevant structures |
|---|---|
| Java | Hash-based inverted indexes, a shared-prefix trie, ordered keys, and specialized interval trees |
| TypeScript 1.1.0 | Per-field maps, ordered numeric entries, range entries, and a trie |

Java's shared trie prefixes avoid repeating common paths. Its interval-tree
preparation also releases temporary loading arrays. Those are concrete
memory-conscious choices, not evidence of a fixed compression ratio.

"One logical index per field" can still involve several supporting structures.
The saving is avoiding a separately materialized lookup for every combination,
not reducing the whole dataset to ten tiny objects.

The example below uses the TypeScript library from JavaScript. It needs no
TypeScript compiler.

## Run it: one preparation, two filter combinations

Install `@kapoorlabs/kiara-ts@1.1.0` with npm. Save the following as
`composable-search.mjs` and run `node composable-search.mjs`.

The six fictional rows deliberately isolate different reasons for rejection.
`NATIVE` normalization preserves fractional scores; the default Java-compatible
numeric profile truncates fractional numeric keys.

```javascript
import assert from "node:assert/strict";
import {
  Store, NormalizationProfile, Operator,
  createCondition, defineSchema, textField, numberField,
} from "@kapoorlabs/kiara-ts";

const rows = [
  { id: "a", status: "active", score: 85.5, tags: "audited,export", window: "10->30" },
  { id: "b", status: "active", score: 91.25, tags: "export", window: "10->30" },
  { id: "c", status: "archived", score: 90, tags: "audited,export", window: "10->30" },
  { id: "d", status: "active", score: 79, tags: "audited,export", window: "10->30" },
  { id: "e", status: "active", score: 90, tags: "audited,export", window: "21->30" },
  { id: "f", status: "active", score: 90, tags: "audited,export,blocked", window: "10->30" },
];
const store = new Store(defineSchema([
  textField("id", { ignoreIndex: true }),
  textField("status", { caseInsensitive: true }),
  numberField("score"),
  textField("tags", { secondaryType: "commaSeparatedStrings" }),
  textField("window", { secondaryType: "numericRange" }),
]), { normalizationProfile: NormalizationProfile.NATIVE });
store.loadRows(rows);
store.prepare();

const common = [
  createCondition({ field: "status", values: ["ACTIVE"] }),
  { field: "score", operator: Operator.BETWEEN, lowerValue: 80.5, upperValue: 95.5 },
  { field: "tags", operator: Operator.NOT_CONTAINS, values: ["blocked"] },
  { field: "window", operator: Operator.CONTAINS_EITHER, values: [20] },
];
const required = ["audited", "export"];
const allTags = store.searchProjection([
  ...common,
  { field: "tags", operator: Operator.CONTAINS_ALL, values: required },
], ["id", "score"]);
const eitherTag = store.searchProjection([
  ...common,
  { field: "tags", operator: Operator.CONTAINS_EITHER, values: required },
], ["id", "score"]);

const reference = rows.filter((row) => {
  const tags = row.tags.split(",");
  const [lower, upper] = row.window.split("->").map(Number);
  return row.status.toLowerCase() === "active"
    && row.score >= 80.5 && row.score <= 95.5
    && !tags.includes("blocked")
    && lower <= 20 && 20 <= upper
    && required.every((tag) => tags.includes(tag));
}).map(({ id, score }) => ({ id, score }));

assert.deepEqual(allTags, reference);
console.log(JSON.stringify({ allTags, eitherTag, agreesWithScan: true }));
```

Expected output:

```json
{"allTags":[{"id":"a","score":85.5}],"eitherTag":[{"id":"a","score":85.5},{"id":"b","score":91.25}],"agreesWithScan":true}
```

The assertion runs before the success flag is printed. If the query and the
reference filter disagree, execution fails.

## What the result actually demonstrates

`a` satisfies every requirement. `b` lacks `audited`, so it appears only when
the tag condition changes from ALL to ANY. The remaining rows fail status,
score, range containment, or the explicit exclusion.

Notice what **does not** happen between the queries: no additional `prepare()`,
composite-index declaration, or data reload.

Several details are worth keeping:

- Conditions are combined with **AND**. ANY applies to the selected tag values,
  not to the entire query.
- `BETWEEN` includes both bounds. A stored range containing `20` is a point
  containment test, not a general interval-overlap operation.
- `createCondition` supplies the equality default. Raw condition objects should
  specify their operator.
- `ignoreIndex` excludes `id` from filtering, but projections can still return
  it. That is not an access-control mechanism.
- The reference scan assumes these clean fixture strings. It is a correctness
  check for the example, not a replacement parser for arbitrary source data.

## Beyond this example

The structured API also handles supported dates, date-times, collections, and
collections of ranges. Choose operators according to the field's type.

Separately, the TypeScript `QueryInterpreter` can discover whole values across
eligible fields, resolve configured aliases and units, and expose ambiguous
matches instead of guessing. That is a query-input layer, not unrestricted
natural-language understanding or an API assumed to exist in Java.

## Measure before calling it cache-speed search

SQL-style predicates over in-memory data are an appealing combination. They do
not make KiaraDB a SQL engine or prove Redis-equivalent speed.
[Redis Search](https://redis.io/docs/latest/develop/ai/search-and-query/) already
supports rich querying; a single-key GET is not a fair comparison for this example.

For a real evaluation, measure:

1. Loading and preparation separately from query execution.
2. Memory after preparation and while replacing a snapshot.
3. Latency for selective queries **and** queries returning many rows.
4. Result correctness against a trusted baseline.

Use comparable datasets, predicates, deployment conditions, and concurrency.
Six rows establish semantics, not throughput.

For a small list, the reference filter may be all you need. For durable storage,
transactions, or joins, retain systems designed for those jobs. KiaraDB's
prepared-store model is a candidate for read-mostly search, not a replacement
for every data layer.

The reusable lesson is to separate **which fields are indexed** from **which
conditions a query combines**. Test the changing questions, not just the
first lookup.
