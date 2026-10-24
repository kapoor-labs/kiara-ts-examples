# Kiara TS Examples Playground

Interactive local playground for [`@kapoorlabs/kiara-ts`](https://www.npmjs.com/package/@kapoorlabs/kiara-ts).

When you start this repo locally, it opens a browser portal where you can:

- query all 5,043 movies or 7,698 airports from real CSV files,
- write a search script and run it immediately,
- learn from 44 guided query examples with explanations and expected results,
- get query-aware IntelliSense, JavaScript diagnostics, and field-name suggestions,
- try complete airport type-ahead and hierarchical runtime-configuration applications,
- explore seven business labs covering product discovery, keyword retrieval, sets,
  stored ranges, safe refresh, Web Workers, and local CSV import,
- inspect the result payload,
- import your own CSV or dataset JSON and run the same scripting flow.

## Quick start

```bash
npm install
npm run dev
```

Open the local URL shown by Vite (usually `http://localhost:5173`).
Use Node.js 24 or newer for the test and coverage commands. This project now
uses the local **1.1.1-search.0** optimized-search candidate from the
[vendored package](./vendor/kapoorlabs-kiara-ts-1.1.1-search.0.tgz). `npm install`
uses that tarball; it does not require an unpublished npm version to exist.
The package contains its execution/benchmark documentation. The
[implementation plan](./docs/kiara-ts-search-optimization-plan.md) records the
scope and compatibility requirements. No npm release is implied.

## Application examples and articles

Choose an application under **Application examples** in the sidebar. Selecting
a dataset returns to the existing query editor and its guided examples.

### Seven business feature labs

These examples demonstrate different capabilities rather than putting the same
filter form over seven datasets. Each includes a working interface, the actual
query/interpretation, a contextual code excerpt, and explicit application/library
boundaries.

| Sidebar example | Try it | What Kiara contributes |
|---|---|---|
| **E-commerce discovery** | `bag` with `price<5GBP sold>=100`: 115 products; try an observed market, sort, typo preset, or browse all | Keyword best-match combined with interpreted numeric clauses and collection conditions |
| **Typo-tolerant keyword search** | `latern` corrects to `lantern` (20 products); `decorating` matches decoration through English stemming (115 products) | Correction, stemming, and best positive token-match retrieval, with inspectable metadata |
| **Integration compatibility** | Require OAuth and Webhooks; toggle ALL to ANY; exclude On-prem agent | `CONTAINS_ALL`, `CONTAINS_EITHER`, and `NOT_CONTAINS` |
| **Operating-envelope finder** | Cover -40 through 125 Celsius (14 components); try 150 (one) or 200 (none) | Point containment in a stored numeric range, including both endpoints of a requested interval |
| **Safe catalog refresh** | Reject a broken replacement, prepare a valid price change, query the unchanged active store, then activate | `StoreLoader.replaceAll` prepares a distinct store; the application swaps the store and interpreter |
| **Main thread vs Web Worker** | Run the same repetition count in each mode; compare projections, elapsed time, and observed animation frames; cancel a worker run | Real `BrowserWorkerClient`, `attachBrowserWorkerHost`, progress events, and request cancellation |
| **Bring your own CSV** | Drop a CSV or load the entire retail sample, review types/indexing, prepare, search, select projected columns, export, or open the IntelliSense editor | Prepared typed stores, conditions, and projections |

The retail examples share a cached prepared store containing **3,788 genuine
product codes** derived from **541,909 UCI Online Retail transactions**.
It is an attributed CC BY 4.0 projection, not generated sample merchandise:
[provenance, transformations, and reproduction](./public/data/README-retail.md).
Prices are historical observed positive GBP minima/maxima from 2010-2011,
**not live prices**. Units sold are not stock, and observed countries are not
shipping availability. No product images, categories, or inventory are invented.
Keyword totals explicitly override Kiara's default 100-result keyword limit;
only the rendered cards/table are bounded. Product discovery rejects keyword
truncation and unresolved strict filters rather than showing partial answers.

The compatibility checker intentionally uses **eight authored fictional fixtures**,
not real vendor capabilities or a fabricated large dataset. The operating-range
demo retains all **16,802** source component rows, but only **15** have supported
temperature specifications; **16,787 remain missing**, not guessed or padded.
The source temperature text is retained. Covering both endpoints works here
because each parsed operating range is a single contiguous interval, not a
general scheduling/interval-overlap engine.

CSV import is local and memory-only, limited to **10 MiB, 50,000 rows, and 100
columns**. Review `text`, `number`, `boolean`, or comma-separated text collection
types and whether each column is indexed. Inference examines all rows and keeps
leading-zero and unsafe-integer identifiers as text. Invalid CSV, duplicate or
reserved headers, malformed values, and unsafe numeric conversions report errors.
Boolean columns require `true`/`false`; empty, `null`, and `\N` cells become null.
Changing the mapping requires preparation again. Opening the query editor
preserves the imported schema and provides field-aware IntelliSense.
CSV parsing, file handling, download/export, sorting, and DOM interactions are
application code, not database features. There is no upload or persistent storage.

Worker measurements exclude initial worker-store preparation but include message
round trips. They use the same conditions, projection, and genuine rows as the
main-thread adapter; no synthetic rows inflate the workload. The main-thread
animation may pause in background tabs. Worker execution is not promised to be
faster, and cancellation is not claimed to preempt arbitrary synchronous code.

The [business engines and import helpers](./src/business-demos.ts),
[interactive views](./src/business-demo-view.ts), and
[worker entry point](./src/retail.worker.ts) are separate from the original apps.
Run the focused engine coverage gate:

```bash
npm run test:business:coverage
```

It enforces **100% line, branch, and function coverage** for
`src/business-demos.ts`. Browser checks exercise the views and real worker
separately; this is not a claim of 100% DOM or worker-entry coverage.

Publication-ready roundup articles:
- [Medium: Tags, Dates, and Ranges: Build Richer Filters with KiaraDB](./articles/seven-business-features-with-kiara-medium.md)
- [LinkedIn: New Filter Combination? You Shouldn't Need a New Index.](./articles/seven-business-features-with-kiara-linkedin.md)

HackerNoon article:
- [Key-Value Lookups Break Down at 100 Attributes. Here's What I Built Instead.](./articles/kiaradb-local-search-hackernoon.md)

DEV-oriented tutorial draft (review platform rules before publishing):
- [10 Indexes, 1,023 Filter Combinations: Build the Numbered-Tree Trick in JavaScript](./articles/kiaradb-composable-filters-devto.md)

Campaign materials:
- [Evidence-backed capability inventory](./articles/campaign/capability-inventory.md)
- [Editorial plan and feature coverage](./articles/campaign/editorial-plan.md)
- [Publication recommendations and asset index](./articles/campaign/publishing-guide.md)

Article covers are supplied as publication-ready PNGs and editable SVGs in
[articles/images](./articles/images). Runnable article examples are verified by
`node --experimental-strip-types --test tests/articles.test.ts`.

### Filterless Parts Finder — Kiara 1.1.0

One input replaces hunting through a large parametric filter panel. The
[finder engine](./src/parts-finder.ts) uses the published `QueryInterpreter` and
`editQueryFragment` APIs; the [view](./src/parts-finder-view.ts) renders editable
chips, ambiguity choices, matching components, generated conditions, and
traditional controls backed by the same input state.

Try these queries or the preset buttons:

| Input | Demonstrates |
|---|---|
| `ceramic samsung X7R` | Cross-field value recognition and declared value aliases; 396 matches |
| `cap:10uF voltage>=25V` | Field alias, unit conversion, comparison; 272 matches |
| `cap:10000nF voltage>=25V` | Equivalent units produce the same 272 matches |
| `cap:1uF..10uF voltage>=25V` | Inclusive range; 1,233 matches |
| `25V` | Explicit choice of allowable, rated, or AC voltage |
| `stock<0` | Valid no-match query |

Keep fields, quantities, and operators contiguous; quote multiword values.
Bare `0603` can match either a package code or a stock quantity of 603, so it
requires confirmation. The UI materializes a confirmed choice as an explicit
field expression, preventing stale confirmations after edits.
Unknown/invalid fragments block the entire search, not just one clause.
Clear all returns the complete candidate set. At most 50 records are rendered;
the displayed match count covers the full store.

The underlying CSV contains **all 16,802 records** from a pinned historical
JLCParts category, with **22 fields, 18 searchable**. It does not invent 100
specifications or pad a smaller dataset. See the
[data provenance and normalization notes](./public/data/README-capacitors.md).
Stock is a **February 23, 2024 snapshot**, not live availability. Source outliers
and missing specifications do not establish component suitability.

Run the focused coverage gate:

```bash
npm run test:parts:coverage
```

It enforces **100% lines, branches, and functions** for the new finder engine,
including the shared traditional-filter and chip-expression helpers. The DOM
view is browser-smoke-tested separately; this is not a claim of 100% DOM coverage.

Publication-ready articles:
- [Medium: 500ms or 0.5s? Make Equivalent Queries Return the Same Results.](./articles/filterless-parts-finder-medium.md)
- [LinkedIn: Type the Value. Let KiaraDB Find the Field.](./articles/filterless-parts-finder-linkedin.md)

### Airport type-ahead

The [type-ahead engine](./src/typeahead.ts) loads all **7,698 airport CSV rows**
through the same prepared-store cache as the query playground. It builds reusable
word dictionaries for airport codes, names, countries, and their combined scope.
It completes the final whitespace-separated word, then tries one-edit correction
only when no prefix matches. Dictionary suggestions are words, not airport
records; selecting one separately runs `KeywordSearch.bestMatch`.

Try `lon`, `jfk`, `united sta`, and `londn`. Up/Down and Enter select a suggestion;
Escape or blur closes the list. Inputs are bounded to 128 characters and ten
whitespace-separated words, with limits of one through ten results.

Read the publication-ready tutorial:
[Fix the Typo, Keep the Filter: Better Text Search with KiaraDB](./articles/airport-typeahead-with-kiara-typescript.md).

### Runtime hierarchical configuration

The [configuration engine](./src/runtime-config.ts) implements the original
article's country/city/airline surcharge scenarios: its six code-example rules
plus the worldwide Delta rule described in its prose. These seven intentional
configuration rules are separate from the bulk CSV datasets.

Null dimensions are wildcards. Structured conditions retrieve applicable rules,
then the count of non-null dimensions determines specificity. Equal top scores
produce an explicit ambiguity, not an arbitrary winner. Missing optional context
only matches wildcard dimensions; no match is also explicit. Surcharge units are
application-defined.

Edit JSON, apply a complete validated replacement, inspect the candidate trace
and revision, or use the exact/fallback/global/no-match/tie presets.
`StoreLoader.replaceAll` prepares a new store before activation; rejected updates
retain the old store and revision. Updates live in page memory only, not durable
storage. The TypeScript keyword `minimumMatch` is deliberately not used as a
substitute for Java's different hierarchical matching behavior.

Read the publication-ready tutorial:
[Which Rule Won? Query, Explain, and Refresh Configuration with KiaraDB](./articles/runtime-config-with-kiara-typescript.md).

## Real CSV datasets

Both built-ins come from the [Java Kiara demo resources](https://github.com/kapoorlabs/kiara-demo/tree/master/src/main/resources),
pinned at revision `37b36c4031c8163a27293d044ca57fc84f53b8d7`.
The original CSV files are bundled unchanged, so no third-party service is
needed at runtime:

| Dataset | Local CSV | Records indexed |
|---|---|---:|
| Movies | [movie_metadata.csv](./public/data/movie_metadata.csv) | 5,043 |
| Airports | [airports.csv](./public/data/airports.csv) | 7,698 |

The bulk datasets contain no generated records, repeated records to inflate
counts, or sampled subsets. Source duplicates and missing values are
preserved. All rows are parsed and indexed; a script's `limit` only caps the
returned results. The schema inspector displays just the first three rows to
keep the UI manageable, and labels that preview explicitly.

CSV files are fetched locally when selected, parsed with Papa Parse (including
quoted commas, escaped quotes, and multiline cells), normalized to typed records,
and prepared by Kiara. Prepared stores are cached when switching datasets.
The UI shows loading/errors, the complete indexed record count, preparation
time, query time, and download/source links. HTTP errors, malformed CSV, missing
columns, invalid numbers, and unexpected record counts fail explicitly rather
than silently loading a partial dataset.

The upstream repository is Apache-2.0 licensed; its
[license is retained with the CSVs](./public/data/LICENSE-kiara-demo.txt).
Source provenance is the Java demo, not a claim of fresh data or independent
verification of every source fact. In particular, some airport names are city
labels: JFK is `New York` and LHR is `London` in this snapshot.

### CSV fields and derived teaching helpers

Movie query names remain convenient aliases, with `csvColumn` shown in the
schema inspector: `title` maps to `movie_title`, `year` to `title_year`,
`rating` to `imdb_score`, `tags` to `genres`, and `keywords` to `plot_keywords`.
All 23 original movie columns are represented, including actors, director,
country, language, color, budget, gross, votes, reviews, and the IMDb link.
Airport fields mirror the Java model: `airportName`, `countryName` (CSV
`country`), and `airportCode`.

To retain the full range/date learning path without inventing source facts,
each movie also has explicitly derived helper fields:

- `isColor`: derived from the source color enum; missing color remains null.
- `calendarYearStart` / `calendarYearStartTime`: January 1 of `title_year`.
- `calendarYearDates` / `calendarYearTimes`: the year's start and end.
- `calendarYearRange` / `calendarYearTimeRange`: the full calendar-year interval.
- `calendarHalfYearRanges` / `calendarHalfYearTimeRanges`: its two half-year
  intervals.
- `reviewCounts`: the available critic/user review counts;
  `reviewCountRange`: their minimum-to-maximum interval;
  `reviewCountRanges`: one singleton interval per actual count.
- `yearBand`: the source year represented as a prefixed interval such as
  `Y2009->2009`, demonstrating `numericStartPos`.

Calendar helpers express **year precision only**. They are not actual release
dates, release schedules, or travel windows. Missing years produce null helpers.
Review intervals are derived numeric representations, not additional observed
review counts. No additional rows are created by these transformations.

## Playground workflow

1. Select a dataset from the left menu.
2. Open **Field schema and sample data** to inspect field types, index options,
   and sample rows.
3. Select a **Guided query example** to load a lesson with an expected result.
   Selecting an example or dataset replaces the current script.
4. Edit the script in **Search script**. Press **Ctrl+Space** for suggestions:
   request properties, operations, `Operator` constants, and fields from the
   active dataset (including uploaded datasets).
5. Click **Run script** or press **Ctrl+Enter** (**Cmd+Enter** on macOS).
6. View formatted JSON output in the **Result** panel.

**Reset script** restores the selected example (or the dataset starter).
The Monaco editor provides syntax highlighting, hover information, bracket
matching, and validation of request/condition property types. Field suggestions
exclude ignored indexes for filters and keyword search, but include them for
projections. It does not statically validate every operator/field combination;
Kiara validates these when you run the script.

Scripts execute locally as JavaScript in the page, **not in a sandbox**. Only
run scripts and dataset-provided `defaultScript` values that you trust.

## Guided learning paths

| Dataset | Examples | What you learn |
|---|---:|---|
| Movies | 36 | All 11 operators, numeric boundaries, AND filters, source genre/actor collections, native decimal scores, projections, keyword scoring/correction/stemming, truncation, dictionary predictions, nulls, enums, booleans, long-valued gross, ignored indexes, diagnostics, and all date/range secondary types through labeled derived helpers |
| Airports | 8 | Exact IATA-code/country filters, AND conditions, projections, exclusions, keyword search, and dictionary autocomplete over thousands of real names |

All five field kinds and all twelve secondary types are represented. Every
lesson has an explanation and an expected result. The ignored-index movie
example deliberately throws a validation error to demonstrate what not to query.
Schema options such as `oneEditAway` and `predictable` are metadata; the dictionary
examples explicitly call dictionary APIs rather than presenting these flags as
record-search operators.

The movie store uses NATIVE normalization to preserve decimal ratings. The
airport store uses JAVA normalization, matching Kiara's default; its fields are
text. JAVA numeric normalization converts through JavaScript `Number` before
building long keys. Integers beyond `Number.MAX_SAFE_INTEGER` may share search
keys even if supplied as strings. The CSV long values used here are safe
integers; the examples do not promise arbitrary-precision long search.

## How playground requests map to Kiara

The editor returns a **playground request**, not a native Kiara API argument.
For example, the `search` request below is executed as:

```ts
const conditions = request.conditions.map((condition) =>
  createCondition(condition)
);
const rows = store.search(conditions, request.limit);
```

The playground creates a schema with `defineSchema` and field builders, loads the
selected dataset into a `Store`, and calls `prepare()` before any queries.
See [Kiara's usage guide](https://github.com/kapoorlabs/kiara-ts/blob/main/docs/usage.md)
for the library's TypeScript signatures and setup details.

The script receives `Operator` from Kiara and must `return` an object (or an
array of conditions).

## Script format

### Structured search

```js
return {
  operation: "search",
  limit: 10,
  conditions: [
    {
      field: "year",
      operator: Operator.BETWEEN,
      lowerValue: 1990,
      upperValue: 2010,
    },
    {
      field: "tags",
      operator: Operator.CONTAINS_EITHER,
      values: ["Adventure"],
    },
  ],
};
```

### Projection

```js
return {
  operation: "projection",
  fields: ["title", "rating"],
  conditions: [
    {
      field: "tags",
      operator: Operator.CONTAINS_EITHER,
      values: ["Sci-Fi"],
    },
  ],
};
```

### Keyword search

```js
return {
  operation: "keywordBestMatch",
  input: "apolo",
  keywordFields: ["title", "keywords"],
  limit: 5,
};
```

## Bring your own data (upload)

Use the **Bring your own data** button and upload a JSON file in this format:

```json
{
  "name": "Custom dataset",
  "description": "Optional description",
  "normalizationProfile": "native",
  "fields": [
    {
      "name": "title",
      "kind": "text",
      "options": {
        "caseInsensitive": true
      }
    },
    {
      "name": "year",
      "kind": "number"
    },
    {
      "name": "tags",
      "kind": "text",
      "options": {
        "secondaryType": "commaSeparatedStrings",
        "caseInsensitive": true
      }
    }
  ],
  "rows": [
    {
      "title": "Cast Away",
      "year": 2000,
      "tags": "survival,island"
    }
  ],
  "defaultScript": "return { operation: \"queryAll\", limit: 20 };"
}
```

### Supported field kinds

- `text`
- `number`
- `long`
- `boolean`
- `enum` (requires `enumValues`)

### Supported operations in script

| Playground operation | Kiara API |
|---|---|
| `queryAll` | `store.queryAll(limit)` |
| `search` (default) | `store.search(conditions, limit)` |
| `projection` | `store.searchProjection(conditions, fields, limit)` |
| `legacyProjection` | `store.searchLegacyProjection(conditions, fields, limit)` |
| `keywordBestMatch` | `new KeywordSearch(store, maxKeywords).bestMatch(input, options)` |
| `keywordMinimumMatch` | `new KeywordSearch(store, maxKeywords).minimumMatch(input, options)` |
| `predict` | Build a `DictionaryTrie` from selected text fields, then `predict(input, limit)` |
| `oneEditAway` | Build the same dictionary, then `getOneEditCandidate(input)` |
| `diagnostics` | Store state, loaded row count, schema, and the first 10,000 characters of diagnostic trie serialization, with explicit `trieLength` and `trieTruncated` metadata |

Structured searches and projections require at least one condition. Conditions
are ANDed; the default operator is `EQUAL`. `BETWEEN` uses inclusive
`lowerValue` and `upperValue`. Scalar enums use equality, not `CONTAINS_EITHER`.

Keyword requests accept a string or array of phrases in `input`, optional
`keywordFields`, `conditions`, `limit`, and `maxKeywords` (default 10).
`minimumMatch` selects rows with the **lowest positive score**, not a minimum
keyword threshold. Inspect `matchedKeywords`, `correctedKeywords`, `usedKeywords`,
and `truncated` in the result.

Dictionary requests accept a string `input`, optional `keywordFields`, and
optional structured `conditions`; `predict` also accepts `limit`. They return
words or a candidate/null, not matching records.

### Features used outside the query editor

Some Kiara features configure an application rather than describe a query:

- **Schemas and decorators:** this playground uses field builders for JSON
  datasets. Applications can instead decorate TypeScript classes, initialize
  decorator metadata, and pass `getEntitySchema(Model)` to `Store`.
- **Lifecycle and replacement:** call `prepare()` after loading. Loading into
  an already prepared store throws; `StoreLoader.replaceAll(rows)` returns a
  new prepared store atomically, while `beginLoading()` clears the current one.
  The playground prepares a complete store on first selection and reuses it
  when switching back to that dataset.
- **Workers:** `InMemoryWorkerAdapter` implements the worker protocol on the
  current thread. For background queries, register a store inside a module Web
  Worker and connect `attachBrowserWorkerHost` to `BrowserWorkerClient`.
  Query execution in this playground stays on the main thread; Monaco's language
  service runs in a locally bundled worker.
- **Errors and inspection:** Kiara errors expose `code`, `message`, and `details`.
  The UI reports failures in the Result panel. Diagnostics are inspection tools,
  not a persistence or reload format.

See the [library guide](https://github.com/kapoorlabs/kiara-ts/blob/main/docs/usage.md)
for complete worker, decorator, normalization, error, and lifecycle setup.

## Validation

Use Node.js 22.18+ (or a supported newer release) for Vite and native TypeScript
test execution.

```bash
npm test
npm run build
```

The regression tests parse and index both complete CSVs, check exact record
counts and source SHA-256 hashes, execute all 44 guided examples, and verify
source values, projections, keyword metadata, derived helper semantics,
dictionary behavior, malformed CSV handling, and every operator/secondary type.
Monaco and its workers are bundled locally; the editor does not require a CDN.

## Build

```bash
npm run build
```
