# Build an Airport Type-Ahead Engine with Kiara and TypeScript

## Real CSV data, reusable word dictionaries, typo correction, and a keyboard-accessible search UI

A useful search box should help before the user has finished typing.

For a travel application, that might mean completing `lon` into `london`,
recognizing `jfk` as an airport code, or recovering from `londn`. Those look
like one feature, but they involve two different jobs: suggesting words and
finding records.

In this tutorial, we will keep those jobs separate and build both with
`@kapoorlabs/kiara-ts`. The companion playground loads **7,698 real airport
records from a CSV file**. It does not repeat a handful of sample rows to
make the dataset appear larger.

This is a TypeScript adaptation of the idea in
[Varun Kapoor's original Java type-ahead article](https://kapoorconsciousnes.medium.com/make-a-type-ahead-engine-with-kiara-in-5-minutes-456717441b40),
with an explicit dictionary lifecycle, field-specific suggestions, and a
working browser interface.

## Run the example first

Use a current Node.js release and clone the
[Kiara TypeScript examples project](https://github.com/kapoor-labs/kiara-ts-examples):

```bash
git clone https://github.com/kapoor-labs/kiara-ts-examples.git
cd kiara-ts-examples
npm install
npm run dev
```

Open the URL printed by Vite and select **Airport type-ahead** under
**Application examples**.

Start with these experiments:

| Search field | Input | What to look for |
|---|---|---|
| Airport name | `lon` | Several prefix suggestions |
| Airport code | `jf` | `jfk` and `jfr` |
| Country name | `UNITED sta` | `united states` |
| Airport name | `londn` | `london`, labeled as a one-edit correction |

Use Up/Down and Enter to select a suggestion, or select it with the pointer.
Escape closes the list. The record panel updates only after selection.

## The data is part of the lesson

The bundled airport CSV comes from the Java Kiara demo at revision
`37b36c4031c8163a27293d044ca57fc84f53b8d7`. The source file and its
Apache-2.0 license are retained in the examples project.

Every row is loaded, including source duplicates and missing values. The
application model exposes three text fields:

- `airportName`
- `countryName`, mapped from the CSV's `country` column
- `airportCode`

This is a historical snapshot, not a promise of current aviation data.
There is another useful detail: some airport names are city labels.
JFK is labeled `New York`, and LHR is labeled `London`. Searching for
`Heathrow` cannot retrieve a word that is absent from that source record.

Good search examples should teach the actual data, not quietly replace it
with more convenient facts.

## Build once, suggest repeatedly

The application follows this pipeline:

```text
Local CSV
   -> parse and validate every row
   -> prepare a Kiara Store
   -> build reusable DictionaryTrie instances
   -> suggest words while typing
   -> search airport records after selection
```

Kiara's `DictionaryTrie` is the word-completion primitive. A dictionary can
be populated from the already prepared store like this:

```typescript
import { DictionaryTrie } from "@kapoorlabs/kiara-ts";

const dictionary = new DictionaryTrie();
const fields = ["airportCode", "airportName", "countryName"] as const;

for (const row of store.queryAll()) {
  for (const field of fields) {
    const value = row[field];
    if (typeof value === "string") {
      dictionary.addText(value);
    }
  }
}
```

This is the dictionary-building core; `store` is the prepared airport
store. `addText` tokenizes text, so a country such as `United States`
contributes words rather than a complete country-record suggestion.
Null values are not added.

The application builds four dictionaries: one for all three fields, and
one for each field separately. They are cached in its `AirportTypeahead`
instance, not rebuilt on every input event. The prepared airport store is
also shared with the normal query playground.

The Java article uses `@Predictable` annotations. In this TypeScript
example, the application explicitly builds and uses `DictionaryTrie`;
schema metadata is not a substitute for wiring the suggestion behavior.

## Prefix completion first, correction second

The decision is small enough to inspect:

```typescript
const prefix = "londn";
const predictions = dictionary.predict(prefix, 5);
const correction = predictions.length
  ? null
  : dictionary.getOneEditCandidate(prefix);
```

If prefix predictions exist, we show them. Only an empty prefix result
triggers one-edit correction.

That ordering matters. A plausible but incomplete word should not be
replaced merely because another dictionary word is a short edit away.

There are limits to this correction API:

- It returns at most one correction candidate.
- Inputs of three characters or fewer are not corrected.
- It supports a single insertion, deletion, or substitution, not a
  transposition.
- Candidate ordering is not popularity ranking or a guarantee of intent.

These are product constraints worth exposing, not hiding behind the
phrase "fuzzy search."

## Complete the final word, not the whole query

The `AirportTypeahead` wrapper normalizes case and repeated whitespace,
then separates the final whitespace-delimited word from the preceding
words.

For example:

```text
Input:          UNITED sta
Normalized:     united sta
Preserved part: united
Prefix:         sta
Suggestion:     united states
```

The preceding words are preserved in the suggested value. They do not
filter the dictionary: this is final-word completion, not context-aware
phrase prediction.

The wrapper returns a small, explicit shape:

```json
[
  {
    "word": "states",
    "value": "united states",
    "kind": "prefix"
  }
]
```

`word` is the dictionary token. `value` is what goes into the input.
`kind` allows the UI to distinguish normal completion from correction.

## A complete, runnable walk-through

The following script uses the same dataset loader and engine as the UI.
Save it as `typeahead-demo.mjs` in the cloned repository's root. Use
Node.js 22.18 or newer for the TypeScript imports.

```javascript
import { readFileSync } from "node:fs";
import {
  BUILT_IN_DATASETS, buildStore, parseDatasetCsv,
} from "./src/datasets.ts";
import { AirportTypeahead } from "./src/typeahead.ts";

const definition = BUILT_IN_DATASETS.find((item) => item.id === "airports");
if (!definition) throw new Error("Airport dataset definition is missing.");

const csv = readFileSync(
  new URL("./public/data/airports.csv", import.meta.url),
  "utf8",
);
const dataset = parseDatasetCsv(definition, csv);
const engine = new AirportTypeahead(buildStore(dataset));

console.log(engine.recordCount);
// 7698

console.log(engine.suggest("UNITED sta", "countryName"));
// [{ word: "states", value: "united states", kind: "prefix" }]

console.log(engine.suggest("londn", "airportName"));
// [{ word: "london", value: "london", kind: "correction" }]

console.log(engine.search("JFK", "airportCode").results);
// [{ airportName: "New York", countryName: "United States", airportCode: "JFK" }]
```

Run it with:

```bash
node --experimental-strip-types typeahead-demo.mjs
```

`AirportTypeahead` is application code in this examples project. It is not
an additional class exported by the Kiara package.

## Word suggestions are not airport search results

Selecting a suggestion calls `KeywordSearch.bestMatch` against the
prepared store. The selected scope becomes its `fields` option:

```typescript
import { KeywordSearch } from "@kapoorlabs/kiara-ts";

const keywordSearch = new KeywordSearch(store);
const response = keywordSearch.bestMatch("london", {
  fields: ["airportName"],
  limit: 10,
});
```

The response contains records plus keyword-matching metadata. It is not
the same shape as a dictionary prediction.

Keyword best-match is token-scored. It is not an exact phrase filter,
and a multiword query does not imply that every returned record contains
the complete phrase. If the product requires exact airport-code equality
or mandatory country constraints, use Kiara's structured conditions
rather than pretending keyword ranking provides those guarantees.

Keeping completion and retrieval separate makes those choices visible.

## The UI matters too

The example uses a combobox input, a listbox of suggestions,
`aria-expanded`, and `aria-activedescendant`. Arrow keys move the active
option while focus stays in the input. Enter selects it; Escape or blur
closes the list. Options are not additional stops in the Tab sequence.

Other practical boundaries are explicit:

- Input is limited to 128 characters and ten whitespace-separated words.
- Suggestion and record limits must be integers from one through ten.
- Failed CSV loading shows an error and a retry action.
- Switching views aborts the old view's loading and event listeners.
- Keystrokes reuse local dictionaries instead of calling a remote
  search endpoint.

The controls support keyboard interaction, but a production accessibility
review should still include the screen readers and browsers you support.

## Verify before making performance claims

Run the project's checks:

```bash
npm test
npm run build
```

The tests cover the full CSV count, field scoping, final-word completion,
correction fallback, record retrieval, and input validation.

There is deliberately no universal latency promise here. Dataset size,
browser, hardware, tokenization, and initial preparation all matter.
For larger datasets, measure preparation and typing latency separately,
then consider a Web Worker or a server-side index.

The examples portal also includes Monaco for query education. A dedicated
production type-ahead application need not ship that editor.

## The takeaway

The useful abstraction is not "one magical search call." It is a small
pipeline with clear contracts:

**Load real records once. Build reusable dictionaries. Complete words.
Retrieve records separately.**

That separation makes the behavior easier to explain, test, and adapt
when your application's search requirements become more specific.

### Further reading

- [Kiara TypeScript on npm](https://www.npmjs.com/package/@kapoorlabs/kiara-ts)
- [Companion examples project](https://github.com/kapoor-labs/kiara-ts-examples)
- [Original Java type-ahead article](https://kapoorconsciousnes.medium.com/make-a-type-ahead-engine-with-kiara-in-5-minutes-456717441b40)
- [Pinned airport CSV source](https://github.com/kapoorlabs/kiara-demo/blob/37b36c4031c8163a27293d044ca57fc84f53b8d7/src/main/resources/airports.csv)
