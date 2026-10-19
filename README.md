# Kiara TS Examples Playground

Interactive local playground for [`@kapoorlabs/kiara-ts`](https://www.npmjs.com/package/@kapoorlabs/kiara-ts).

When you start this repo locally, it opens a browser portal where you can:

- query all 5,043 movies or 7,698 airports from real CSV files,
- write a search script and run it immediately,
- learn from 44 guided query examples with explanations and expected results,
- get query-aware IntelliSense, JavaScript diagnostics, and field-name suggestions,
- inspect the result payload,
- upload your own dataset JSON and run the same scripting flow.

## Quick start

```bash
npm install
npm run dev
```

Open the local URL shown by Vite (usually `http://localhost:5173`).

## Real CSV datasets

Both built-ins come from the [Java Kiara demo resources](https://github.com/kapoorlabs/kiara-demo/tree/master/src/main/resources),
pinned at revision `37b36c4031c8163a27293d044ca57fc84f53b8d7`.
The original CSV files are bundled unchanged, so no third-party service is
needed at runtime:

| Dataset | Local CSV | Records indexed |
|---|---|---:|
| Movies | [movie_metadata.csv](./public/data/movie_metadata.csv) | 5,043 |
| Airports | [airports.csv](./public/data/airports.csv) | 7,698 |

There are no small built-in fixtures, generated records, repeated records to
inflate counts, or sampled subsets. Source duplicates and missing values are
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
