# 10 Indexes, 1,023 Filter Combinations: Build the Numbered-Tree Trick in JavaScript

Every field you add to a filter panel doubles the combinations users can pick. If your fast path is an exact key lookup, that means one key per combination. Databases avoid this by combining per-field indexes at query time.
This tutorial shows how to do that in-process with a numbered tree, and you'll build the core trick yourself.

*Disclosure: This article was drafted with AI assistance.*

![A filter panel with ten fields, three of them selected. Users can pick 1,023 combinations, while only ten per-field indexes are maintained.](./images/devto-filter-combinations.png)

*Technical illustration created with AI assistance.*

## Same wall, two companies

I first hit this problem at a global travel company, and again at a global
e-commerce company. Records carried many attributes, every new feature asked
for a different combination of them, and answers had to fit inside a
user-facing request. Both times, the fast path was an in-memory key-value
lookup: superb when you know the exact key, awkward when the key is whatever
combination a user just picked.

## How many indexes do 1,023 combinations need?

With `n` filter fields, users can pick `2^n - 1` nonempty combinations. How
many indexes that implies depends on the kind of index:

| Strategy | 10 fields | 20 fields | What limits it |
|---|---:|---:|---|
| Exact-key lookup (hash map, key-value cache) | 1,023 | 1,048,575 | A key on `(status, score)` can't answer `status` alone |
| Composite ordered indexes, used by leading columns | 252 | 184,756 | An index on `(a, b, c)` serves `a`, `(a, b)`, and `(a, b, c)` |
| One index per field, combined per query | 10 | 20 | Each query merges several index results |

The middle row is a lower bound for equality filters. No two five-field
combinations are nested, so each needs its own index. Real query planners
loosen this by scanning non-leading columns or filtering after one index.

So the explosion belongs to exact-key designs, not to databases in general.
Relational databases take the last row. PostgreSQL, for example,
[scans each relevant index, builds an in-memory bitmap of matching rows, and
ANDs the bitmaps together](https://www.postgresql.org/docs/current/indexes-bitmap-scans.html),
and its documentation recommends separate indexes plus index combination when
queries mix columns.

## Why not just use the database, then?

Often you should. My hot path didn't fit, for three reasons:

1. **Location.** A database is a separate service: a network round trip,
   query planning, and result serialization on every request. The in-memory
   lookups were there precisely to avoid that.
2. **Combination cost.** Merging per-field results costs work proportional to
   what each index matches, or to the rows a bitmap covers, even when the final
   answer is tiny. Compression helps, but the work still follows the data.
3. **Search features that live with the data.** Typeahead fires on every
   keystroke. Stemming, typo correction, and search by value alone (`active
   emea` with no field names) all reuse the same prepared in-memory structures.
   Databases offer full-text search too, but each keystroke would still pay
   the round trip.

I wanted per-field indexes **inside the application process**, combined
without building a per-row set for every condition. That became **KiaraDB**,
an in-memory engine for read-mostly data, available for Java and TypeScript.

## The idea in two sentences

Store records as paths in a tree, so records that share leading values share
nodes. Number every node during a depth-first walk, so "is this node underneath
that one?" becomes two integer comparisons, which is all you need to combine
conditions from different field indexes.

The payoff: a condition on a field near the top of the tree can match many
records through a handful of nodes, and nothing is collected per record until
results are read. Deeper fields have more nodes, so schema order matters: put
low-variety fields first and unique IDs last.

## Run it: one prepared store, many filter combinations

Install `@kapoorlabs/kiara-ts@1.1.0` from npm, save this as
`composable-search.mjs`, and run `node composable-search.mjs`. Each fictional row
fails for a different reason:

```javascript
import assert from "node:assert/strict";
import {
  Store, NormalizationProfile, Operator,
  createCondition, defineSchema, textField, numberField,
} from "@kapoorlabs/kiara-ts";

const rows = [
  { status: "active", score: 85.5, tags: "audited,export", window: "10->30", id: "a" },
  { status: "active", score: 91.25, tags: "export", window: "10->30", id: "b" },
  { status: "archived", score: 90, tags: "audited,export", window: "10->30", id: "c" },
  { status: "active", score: 79, tags: "audited,export", window: "10->30", id: "d" },
  { status: "active", score: 90, tags: "audited,export", window: "21->30", id: "e" },
  { status: "active", score: 90, tags: "audited,export,blocked", window: "10->30", id: "f" },
];
const store = new Store(defineSchema([
  textField("status", { caseInsensitive: true }),
  numberField("score"),
  textField("tags", { secondaryType: "commaSeparatedStrings" }),
  textField("window", { secondaryType: "numericRange" }),
  textField("id", { ignoreIndex: true }),
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

```json
{"allTags":[{"id":"a","score":85.5}],"eitherTag":[{"id":"a","score":85.5},{"id":"b","score":91.25}],"agreesWithScan":true}
```

The assertion checks the indexed query against a plain JavaScript filter first.

`a` passes everything. `b` lacks `audited`, so it
appears only when the tag rule switches from ALL to ANY. `c` is archived, `d`
scores too low, `e`'s window starts after 20, and `f` carries the excluded
`blocked` tag.

Between the two queries: no new index, no second `prepare()`, no reload.
Details worth knowing:

- Conditions combine with **AND**; ALL and ANY apply to the tag values only.
- `BETWEEN` includes both bounds, and the window check asks whether a stored
  range contains the point `20`.
- `NATIVE` keeps decimals such as `85.5` intact; the default profile mirrors
  the Java library's integer keys.

## Beyond filters: words, typos, and bare values

The same prepared data serves the search-box features from reason 3.
Append this to `composable-search.mjs`:

```javascript
import { DictionaryTrie, KeywordSearch, QueryInterpreter } from "@kapoorlabs/kiara-ts";

const catalog = new Store(defineSchema([
  textField("status"),
  textField("region"),
  textField("title", { stemmedIndex: true }),
  textField("sku", { ignoreIndex: true }),
]), { normalizationProfile: NormalizationProfile.NATIVE });
catalog.loadRows([
  { status: "active", region: "emea", title: "Wireless Lighting Kit", sku: "k1" },
  { status: "active", region: "amer", title: "Wireless Light Strip", sku: "k2" },
  { status: "archived", region: "emea", title: "Wired Desk Lamp", sku: "k3" },
]);
catalog.prepare();

const words = new DictionaryTrie();
for (const row of catalog.queryAll()) words.addText(row.title);
const keywords = new KeywordSearch(catalog);
const skus = (found) => found.map((row) => row.sku);
const typo = keywords.bestMatch("wirelss kit", { fields: ["title"] });

console.log(JSON.stringify({
  typeahead: words.predict("wir", 3),
  stemmed: skus(keywords.bestMatch("lights", { fields: ["title"] }).results),
  typo: skus(typo.results),
  corrected: typo.correctedKeywords,
  byValue: skus(new QueryInterpreter(catalog).search("active emea")),
}));
```

```json
{"typeahead":["wired","wireless"],"stemmed":["k1","k2"],"typo":["k1"],"corrected":{"wirelss":"wireless"},"byValue":["k1"]}
```

`wir` completes from a word trie. `lights` matches "Lighting" and "Light"
through English stemming. `wirelss` is one edit from `wireless`, and the
response reports the correction so a UI can show it. `active emea` names no
fields: the interpreter finds which field holds each value and turns them into
two equality conditions. Ambiguous values are reported, not guessed.
## Build the core trick yourself

The algorithm comes from my 2020 paper,
[Efficient Storage and Retrieval of In-Memory Static Data](https://journal.ut.ac.ir/article_76227_7508c12200be2eb3f9f16a97aac23a44.pdf).
Here is a stripped-down version you can run: two fields, equality only.

```javascript
const hotels = [
  { city: "Paris", cancellation: "free", id: "h1" },
  { city: "Paris", cancellation: "free", id: "h2" },
  { city: "Paris", cancellation: "none", id: "h3" },
  { city: "Rome", cancellation: "free", id: "h4" },
  { city: "Paris", cancellation: "none", id: "h5" },
];
const fields = ["city", "cancellation"];

// 1. Records become paths; equal leading values share a node.
const root = { children: new Map(), ids: [] };
for (const hotel of hotels) {
  let node = root;
  for (const field of fields) {
    const value = hotel[field];
    if (!node.children.has(value)) {
      node.children.set(value, { field, value, children: new Map(), ids: [] });
    }
    node = node.children.get(value);
  }
  node.ids.push(hotel.id);
}

// 2. A depth-first walk numbers every node.
// 3. Each field gets one index: value -> nodes, already sorted by start.
let clock = 0;
const index = new Map(fields.map((field) => [field, new Map()]));
(function walk(node) {
  node.start = clock++;
  if (node.field) {
    const byValue = index.get(node.field);
    if (!byValue.has(node.value)) byValue.set(node.value, []);
    byValue.get(node.value).push(node);
  }
  for (const child of node.children.values()) walk(child);
  node.end = clock++;
})(root);

// 4. Combine two conditions: keep descendants inside an ancestor's range.
function within(ancestors, descendants) {
  const result = [];
  for (const ancestor of ancestors) {
    let low = 0;
    let high = descendants.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (descendants[mid].start < ancestor.start) low = mid + 1;
      else high = mid;
    }
    for (let i = low; i < descendants.length && descendants[i].start < ancestor.end; i++) {
      result.push(descendants[i]);
    }
  }
  return result;
}

const paris = index.get("city").get("Paris");
const free = index.get("cancellation").get("free");
console.log(JSON.stringify({
  paris: paris.map((node) => [node.start, node.end]),
  free: free.map((node) => [node.start, node.end]),
  result: within(paris, free).flatMap((node) => node.ids),
}));
```

```json
{"paris":[[1,6]],"free":[[2,3],[8,9]],"result":["h1","h2"]}
```

The same tree, with the numbers your code just printed:

![A two-level hotel tree with depth-first numbers. Paris spans 1 to 6 and Rome spans 7 to 10. Free cancellation appears at 2 to 3 under Paris and 8 to 9 under Rome; only the node inside Paris survives.](./images/hackernoon-trie-bounds.png)

The city index returned one node, `[1, 6]`. All Paris hotels sit under it,
instead of in a list of IDs. The cancellation index returned two nodes, and
binary search found that only `[2, 3]` sits inside `[1, 6]`. Rome's branch was
never read, and nothing was built for "city + cancellation."

The real engine also lets either list be the shorter one, binary-searches
numeric bounds, uses interval trees for stored ranges, and stops early for limits.

## Does it beat intersecting ID sets?

An earlier TypeScript engine
kept one index per field but merged results as ID sets, rechecked candidates,
and scanned numeric and range entries linearly. The current tree engine ships
in [kiara-ts 1.2.0](https://github.com/kapoorlabs/kiara-ts/releases/tag/v1.2.0),
currently on GitHub rather than npm.

Synthetic 100,000-record dataset, four fields, Node 24, five isolated runs per
engine, median p95:

| Query | ID-set engine | Tree engine |
|---|---:|---:|
| Equality, one result | 16.6 ms | 0.014 ms |
| Two fields combined, 2 results | 21.3 ms | 0.032 ms |
| Exclusion, first 100 results | 36.6 ms | 8.8 ms |
| Every record returned | 90.3 ms | 39.0 ms |

Selective queries dropped far below a millisecond; queries returning many
records improved less because those records still have to be assembled.
Prepared memory was about 14% lower than the ID-set engine. [The benchmark report](https://github.com/kapoorlabs/kiara-ts/blob/v1.2.0/docs/search-execution.md)
has the method and raw runs.

These numbers compare two versions of one library. The ID-set engine used
JavaScript `Set`s, not compressed bitmaps, and neither was compared with a
database query planner.

## When to reach for it

Reach for it when data is **read-mostly**, fits in memory, has **many fields**,
and users combine them **unpredictably**: catalogs, inventories, reference
data, and layered configuration.

Skip it for durable storage, transactions, or thousands of writes per second.
Updates mean preparing a replacement snapshot and swapping it in. If your
database already answers fast enough, or the list is small, keep what you have.

## Try it

- TypeScript: [kapoorlabs/kiara-ts](https://github.com/kapoorlabs/kiara-ts)
- Java: [kapoorlabs/kiara](https://github.com/kapoorlabs/kiara)

Start with your awkward filter: the combination nobody planned an index for.
