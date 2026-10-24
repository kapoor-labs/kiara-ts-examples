# Beyond the Search Box: 7 Business Features Built with Kiara

## Real product data, explainable matching, safe refreshes, and browser-side querying with TypeScript

A database demo should answer a question more useful than "Can this query return
some rows?"

It should help a developer answer:

**"What could I ship in my application with this?"**

That was the goal behind seven new business examples built with **Kiara 1.1.0**.
Not seven versions of the same filter panel. Seven interactions that exercise
different capabilities: product discovery, typo-tolerant retrieval, set matching,
stored ranges, prepared-store replacement, Web Workers, and local CSV exploration.

The examples run in a TypeScript browser application. They show the results,
the conditions that produced them, and the boundary between the library and
the application.

Here is what each one demonstrates, and why it might belong in a business product.

## Start with data that can challenge the demo

The retail examples use **3,788 genuine product codes** derived from all
**541,909 transactions** in the UCI Online Retail dataset.

The importer selects positive, non-cancellation merchandise transactions with
usable product descriptions and prices, then groups them by stock code. It does
not generate extra merchandise to inflate the record count.

This is historical data from **2010-2011**:

- Price bounds are minimum and maximum observed positive unit prices in GBP.
- Units sold sum included positive quantities; they are not stock or net sales.
- Markets are countries observed in those transactions, not current shipping
  availability.

Customer and invoice identifiers are not included in the bundled projection.
The source attribution, CC BY 4.0 license, transformation rules, and checksums
are documented with the data.

The component example uses a separate, pinned historical JLCParts snapshot.
The compatibility example deliberately uses small fictional fixtures, because
its purpose is to make a truth table understandable, not to imply real vendor
certifications.

## 1. Product discovery: combine words with precise requirements

The first example is a gift-catalog storefront.

Enter a product keyword:

```text
bag
```

Then add strict filters in the adjacent specification input:

```text
price<5GBP sold>=100
```

The result is **115 matching products** in the bundled snapshot.

The keyword input performs lexical title matching. The strict input resolves
configured aliases and comparisons: `price` maps to `unitPrice`, and `sold`
maps to `unitsSold`.

An optional market facet adds a collection condition. The application renders
product cards and can sort the matching records by observed minimum price.

Those responsibilities are deliberately separate:

- **Kiara:** interpretation, structured conditions, collection matching, and
  keyword retrieval.
- **Application:** cards, controls, result presentation, and display sorting.

An unknown strict field or unresolved clause blocks the search. It is not
discarded while the page displays results for the remaining conditions.

One implementation detail is easy to miss: keyword retrieval defaults to a
100-result limit. The example explicitly requests up to the store's record count
before calculating totals. The UI then renders just the first 12 cards.

Otherwise, a convincing-looking result counter could quietly be wrong.

**Where this fits:** customer-facing catalogs and other discovery interfaces
that need both forgiving words and exact constraints.

## 2. Typo-tolerant search: show what happened to the query

The second example isolates lexical search so users can inspect its behavior.

Enter:

```text
latern
```

Kiara corrects the token to `lantern` and returns **20 product records**.

Enter:

```text
decorating
```

English stemming connects it to titles containing words such as `DECORATION`,
returning **115 records** without a typo correction.

The view exposes `usedKeywords`, `correctedKeywords`, `matchedKeywords`, and
whether the keyword input was truncated.

This is not semantic search. `bestMatch` selects the highest positive
query-token-match group; it does not understand the meaning of an arbitrary
customer question.

That narrower contract can still be useful. A user should not need perfect
spelling to locate an indexed product name, and a developer should be able to
explain why a result appeared.

**Where this fits:** product lookup, internal reference tools, and lexical
discovery over appropriately prepared business records.

## 3. Compatibility: "all" is different from "any"

Now consider a software connector that must support both OAuth and webhooks,
but must not require an on-premises agent.

This is a set-membership problem, not a substring search.

In the demo's eight fictional connector fixtures:

- **ALL** of OAuth and Webhooks, excluding On-prem agent: **2 matches**.
- **ANY** of OAuth and Webhooks, with the same exclusion: **4 matches**.

The structured conditions make the distinction explicit:

```typescript
const conditions = [
  {
    field: "capabilities",
    operator: Operator.CONTAINS_ALL,
    values: ["OAuth", "Webhooks"],
  },
  {
    field: "capabilities",
    operator: Operator.NOT_CONTAINS,
    values: ["On-prem agent"],
  },
];
```

This is a contextual excerpt: `Operator` comes from Kiara, and `capabilities`
is configured as a comma-separated string collection. Switching the first
operator to `CONTAINS_EITHER` changes the requirement from ALL to ANY.

**Where this fits:** connector selection, equipment compatibility, and
qualification workflows whose records carry sets of capabilities.

## 4. Operating envelopes: search the range stored in the record

A temperature specification often describes an interval, not one number.

The operating-envelope finder preserves the original component temperature
text and converts supported notation into a stored numeric range.

Users can request one temperature or an entire operating interval:

- Cover **-40 through 125 Celsius**: **14 matches**.
- Operate at **150 Celsius**: **1 match**.
- Operate at **200 Celsius**: **0 matches**.

There is an important data-quality detail: all **16,802 source records** are
retained, but only **15** have a supported temperature specification.
The other **16,787** remain missing. They are not assigned a plausible default.

For a single contiguous stored interval, requiring containment of both requested
endpoints establishes coverage of the complete requested interval. This is not
a claim of a general scheduling or arbitrary interval-overlap engine.

Search matches also do not certify engineering suitability. The source is
historical; authoritative specifications still need verification.

**Where this fits:** specification lookup involving operating temperatures and
other explicitly modeled numeric intervals.

## 5. Safe refresh: prepare first, activate second

A useful catalog cannot remain frozen forever. But a replacement should not
leave the application pointing at partially loaded data.

The refresh example makes the lifecycle visible:

1. Query active revision 1.
2. Try a replacement with an invalid price.
3. See the rejection while the active revision remains unchanged.
4. Prepare a valid replacement.
5. Confirm that queries still use the old active store.
6. Activate the prepared replacement and its new interpreter.

Kiara's `StoreLoader.replaceAll` creates a distinct prepared store. The
application validates the incoming records and controls the reference swap.

Old store references still represent the old snapshot.

This is not a distributed transaction system, background synchronization
service, or guarantee that synchronous preparation never occupies the UI thread.
It is a clear application-level contract for replacing a prepared dataset.

**Where this fits:** refreshed catalogs, imported lookup tables, and local
reference datasets.

## 6. Web Workers: measure responsiveness, not just query duration

Browser-side querying becomes less useful if the interface cannot respond while
work executes.

The worker example runs the same repeated projection query in two modes:

- Through Kiara's in-memory adapter on the main thread.
- Through a real `BrowserWorkerClient` connected to a worker host.

Both use the same **3,788 products**, conditions, 25-row projection, and selected
repetition count.

The view reports elapsed time, observed main-thread animation frames, and whether
the last returned projection matches the previous completed run. It also exposes
progress and lets users cancel a worker run.

There is intentionally no universal "workers are faster" claim. Message passing
has overhead. Timings exclude initial worker preparation, and animation frames
may pause in background tabs. Cancellation is not advertised as preempting
arbitrary synchronous JavaScript.

The point is to make the trade-off measurable on the actual workload.

**Where this fits:** interactive browser applications exploring prepared local
datasets while keeping query execution off the UI thread.

## 7. Bring your own CSV: let the visitor supply the business case

The strongest adoption moment may be when someone stops trying sample data and
loads their own export.

The CSV workbench lets a user:

- Drop a CSV or load the complete bundled retail projection.
- Review inferred text, number, boolean, and text-collection types.
- Decide which columns to index.
- Prepare a store and run a structured query.
- Select projected columns and export matching records as JSON.
- Open the imported schema in the existing IntelliSense-enabled query editor.

Inference examines the whole column. An identifier such as `00123` stays text.
Unsafe integer identifiers also stay text rather than being silently rounded.

The demo limits imports to **10 MiB, 50,000 rows, and 100 columns**. Malformed
CSV, duplicate or reserved headers, and invalid typed values produce explicit
errors. Empty, `null`, and `\N` cells become null; boolean columns require
`true` or `false`.

Chosen files are processed in the page's memory without uploading their contents.
There is no persistent storage. CSV parsing, mapping, and export are application
features built around Kiara's typed stores, conditions, and projections.

**Where this fits:** local investigation tools and a low-friction way to evaluate
Kiara against a dataset that actually matters to the developer.

## Try the real data first

With Node.js 24 or newer:

```bash
git clone https://github.com/kapoor-labs/kiara-ts-examples.git
cd kiara-ts-examples
npm install
npm run dev
```

Open Vite's local URL and choose any of the seven business labs in the sidebar.
Each shows the actual query or interpretation alongside the result and a
contextual implementation excerpt.

To reproduce the catalog, typo, and set-matching examples outside the UI, save
this as `business-demo.mjs` in the repository root:

```javascript
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { KeywordSearch } from "@kapoorlabs/kiara-ts";
import { buildStore, parseDatasetCsv } from "./src/datasets.ts";
import {
  RETAIL_DEFINITION, connectorStore, discoverProducts, matchConnectors,
} from "./src/business-demos.ts";

const csv = readFileSync(
  new URL("./public/data/retail-products.csv", import.meta.url),
  "utf8",
);
const store = buildStore(parseDatasetCsv(RETAIL_DEFINITION, csv));

const products = discoverProducts(store, "bag", "price<5GBP sold>=100");
assert.equal(products.status, "ready");
assert.equal(products.rows.length, 115);
console.log("Product discovery:", products.rows.length);

const typo = new KeywordSearch(store).bestMatch("latern", {
  fields: ["title"],
  limit: store.getLoadedRowCount(),
});
assert.equal(typo.correctedKeywords.latern, "lantern");
assert.equal(typo.results.length, 20);
console.log("Correction:", typo.correctedKeywords);

const connectors = connectorStore();
const required = ["OAuth", "Webhooks"];
const excluded = ["On-prem agent"];
assert.equal(matchConnectors(connectors, required, "all", excluded).rows.length, 2);
assert.equal(matchConnectors(connectors, required, "any", excluded).rows.length, 4);
console.log("Connector matching: ALL = 2; ANY = 4");
```

Run:

```bash
node --experimental-strip-types business-demo.mjs
```

`discoverProducts`, `connectorStore`, and `matchConnectors` are application
helpers in the examples repository, not package exports. `KeywordSearch`,
`QueryInterpreter`, the collection operators, and worker/store APIs are Kiara
capabilities.

## What was verified, and what was not claimed

The repository's **100-test suite passes**. A focused gate enforces **100% line,
branch, and function coverage** for the new business engine and import-helper
module:

```bash
npm run test:business:coverage
```

Browser checks separately exercise the seven interfaces, real worker execution,
cancellation and reuse, failed-load retry, local CSV processing without network
requests, and layouts at a 390-pixel viewport.

That is not a claim of 100% DOM coverage, a clean dependency security audit,
unlimited scale, or production readiness for every deployment.

Kiara handles querying over prepared data. Your application still owns
authorization, authoritative data delivery, business-specific ranking,
persistence, and transactional writes.

## The feature is the reason to try the library

These examples are not an argument that every business system should replace its
primary database.

They show a more focused opportunity: add useful discovery and decision-support
interactions over an appropriate prepared dataset, with visible query behavior
and explicit failure paths.

Start with the storefront if you want to explore the user experience.
Start with the CSV workbench if you want to answer a more personal question:

**"What happens when I try this with my data?"**

### Code and sources

- [Install Kiara from npm](https://www.npmjs.com/package/@kapoorlabs/kiara-ts)
- [Kiara TypeScript library and documentation](https://github.com/kapoorlabs/kiara-ts)
- [Run the companion examples](https://github.com/kapoor-labs/kiara-ts-examples)
- [UCI Online Retail: Chen, D. (2015), DOI 10.24432/C5BW33](https://doi.org/10.24432/C5BW33), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- [Pinned JLCParts component source](https://github.com/dougy83/jlcparts/tree/169e24011b0832d236a76f9a2504016373505db0/data), with MIT license and provenance retained in the examples
