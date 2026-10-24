# Stop Making Users Find the Right Filter

## Building a single-input parts finder with Kiara 1.1.0, explainable queries, and 16,802 real component records

An engineer usually knows the specification they need.

The harder part is finding where a website has hidden the corresponding filter.

Capacitance might be halfway down a sidebar. Voltage could have several similarly
named controls. Package size is somewhere else. Stock requires another field.
Every new specification adds another interaction.

What if users could start with the values they already know?

```text
cap:10uF voltage>=25V
```

And what if the interface translated that input into visible, editable filters
instead of treating it as a vague text search?

That is the idea behind **Filterless Parts Finder**, an example built with
**Kiara 1.1.0**.

The name is a little provocative. The filters have not disappeared. The work of
finding and operating each filter has moved out of the user's way.

## A real catalog, not a convincing-looking fixture

The demo loads **16,802 component records** from a pinned JLCParts multilayer
ceramic capacitor category and joins its historical stock snapshot by component
ID. All source records are retained.

The bundled CSV has **22 fields, 18 searchable**. It does not invent a hundred
attributes to make a "100 filters" headline work.

The data is a **February 23, 2024 snapshot**, not live inventory or a certified
engineering reference. Missing specifications and source outliers remain
visible. Component selection still requires checking authoritative manufacturer
specifications.

That distinction matters: demonstrating useful retrieval is not the same as
certifying that a component is suitable for a circuit.

## One input, several ways to express a requirement

Here are actual results from the bundled snapshot:

| Input | Result |
|---|---|
| `ceramic samsung X7R` | 396 matches |
| `cap:10uF voltage>=25V` | 272 matches |
| `cap:10000nF voltage>=25V` | The same 272 matches |
| `cap:1uF..10uF voltage>=25V` | 1,233 matches |
| `25V` | Requires a field choice |
| `stock<0` | Zero matches |

These examples exercise different capabilities.

**Values without field names.** `samsung` is a configured alias for
`Samsung Electro-Mechanics`. `X7R` is discovered as a complete dielectric value.
`ceramic` is an alias for the source category label.

**Field aliases.** `cap` refers to `capacitance`.

**Unit conversion.** `10uF` and `10000nF` both become the same canonical
capacitance in farads.

**Explicit comparisons.** `voltage>=25V` means a lower bound, not a keyword
containing the characters "25V."

**Ranges.** The two endpoints in `1uF..10uF` are converted independently and
used as an inclusive numeric range.

Conditions are combined with AND. This is a small, deterministic query language,
not unrestricted natural-language understanding.

## The important change: interpretation becomes a first-class result

The architecture is straightforward:

```text
Bundled CSV
    -> validated records in a prepared Kiara Store
    -> schema-aware QueryInterpreter
    -> resolved filters and unresolved choices
    -> structured search
    -> matching component records
```

The `QueryInterpreter` is part of Kiara 1.1.0. Its configuration declares the
domain knowledge the interpreter needs.

For example, this excerpt shows how the application configures capacitance:

```typescript
const interpreter = new QueryInterpreter(store, {
  fields: {
    capacitance: {
      aliases: ["cap"],
      canonicalUnit: "F",
      units: {
        F: 1,
        mF: 1e-3,
        uF: 1e-6,
        nF: 1e-9,
        pF: 1e-12,
      },
    },
  },
});
```

Here, `store` is the prepared component store, constructed with
`NormalizationProfile.NATIVE` so fractional numeric values are preserved.
Records must already store capacitance in the declared canonical unit.

There is no assumption that a field called "capacitance" magically teaches the
library every unit conversion. The conversion factors are explicit metadata.
The complete application also configures voltage fields and manufacturer and
category aliases.

This keeps interpretation reproducible and inspectable.

## Ambiguity is not a bug to hide

Consider:

```text
25V
```

The source has separate fields for:

- Allowable voltage, exposed as `voltage`.
- Rated voltage, exposed as `ratedVoltage`.
- AC voltage, exposed as `acVoltage`.

The unit identifies a family of plausible fields. It does not identify the
user's intended field.

The interface therefore asks for a choice. It does not select whichever field
appears first in the schema or happens to return more results.

There is a less obvious example too:

```text
0603
```

That is a familiar package code. But this snapshot also contains a stock
quantity of 603. Both interpretations are possible.

Preserving the leading zero in a text condition does not make the alternative
numeric interpretation disappear. The honest response is to ask.

Once the user confirms a field, the UI replaces the ambiguous fragment with an
explicit expression such as:

```text
voltage=25
```

For this field, an unqualified numeric value uses canonical volts. Equality is
not silently changed to "at least." If the user wants a minimum rating, they can
write `voltage>=25V`.

## Never pretend an incomplete query succeeded

Suppose the input is:

```text
cap:10uF unknownword
```

It would be easy to apply the capacitance filter, ignore the unknown fragment,
and display plausible results.

That would also misrepresent what the system understood.

The demo instead:

1. Shows the resolved capacitance chip.
2. Identifies the unresolved fragment.
3. Withholds results until the complete input is resolved.

Kiara's strict `search()` path rejects unresolved interpretations. The example
also checks issues before calling it. A test verifies that blocked input makes
**zero calls** to the interpreter's search method.

A valid query with no matches is different: `stock<0` produces an ordinary empty
result, not an interpretation error.

## Chips and dropdowns should not become competing sources of truth

The interface includes both the single input and an expandable traditional
filter panel.

They operate on the same query state.

Typing updates the chips and traditional controls. Removing a chip edits the
original input. Editing a chip selects its source fragment so the user can
change it directly. Changing a traditional field rewrites that field's
constraints and reinterprets the input.

Kiara exposes source spans through its interpretation results and provides
`editQueryFragment` for editing or removing a fragment.

The database library does not render the controls. The website owns the DOM,
interaction, and presentation. That separation makes the interpreter reusable
without coupling the search engine to a UI framework.

## Run the example

With Node.js 24 or newer:

```bash
git clone https://github.com/kapoor-labs/kiara-ts-examples.git
cd kiara-ts-examples
npm install
npm run dev
```

Open Vite's local URL and select **Filterless Parts Finder** in the sidebar.

To exercise the same engine outside the UI, save the following as
`parts-demo.mjs` in the repository root:

```javascript
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { editQueryFragment } from "@kapoorlabs/kiara-ts";
import { buildStore, parseDatasetCsv } from "./src/datasets.ts";
import { PARTS_DEFINITION, PartsFinder } from "./src/parts-finder.ts";

const csv = readFileSync(
  new URL("./public/data/capacitors.csv", import.meta.url),
  "utf8",
);
const dataset = parseDatasetCsv(PARTS_DEFINITION, csv);
const finder = new PartsFinder(buildStore(dataset));

const microfarads = finder.interpreter.search("cap:10uF voltage>=25V");
const nanofarads = finder.interpreter.search("cap:10000nF voltage>=25V");
assert.equal(microfarads.length, 272);
assert.deepEqual(nanofarads, microfarads);
console.log("Equivalent units:", microfarads.length, "matches");

const ambiguous = finder.interpreter.interpret("25V");
assert.equal(ambiguous.issues[0].kind, "ambiguous");
console.log(
  "Choose a field:",
  ambiguous.issues[0].candidates.map((candidate) => candidate.field),
);

const confirmed = finder.interpreter.interpret("25V", { "0:3": "voltage" });
assert.equal(confirmed.issues.length, 0);
console.log("Confirmed field:", confirmed.filters[0].condition.field);

console.log(editQueryFragment(ambiguous, "0:3", "voltage>=25V"));
// voltage>=25V
```

Run it with:

```bash
node --experimental-strip-types parts-demo.mjs
```

`PartsFinder` is the example's application wrapper. `QueryInterpreter` and
`editQueryFragment` are exports from Kiara itself.

## Real data brings real normalization decisions

The upstream capacitance values sometimes contain binary conversion noise,
such as `1.0000000000000001e-7`. The importer canonicalizes searchable
capacitance to 15 significant digits and preserves the original value in a
separate source column.

One record, C710944, contains the literal string `"NaN"`. That source value is
retained, while its searchable capacitance is null. It is not turned into zero
or silently dropped.

Those choices are documented alongside source revisions, licensing, and
checksums. They are part of making a real-data example trustworthy.

## Verify the behavior, not just the appearance

The example repository's 86-test suite passes. The new finder engine and its
shared editing/serialization helpers have **100% line, branch, and function
coverage**, enforced by:

```bash
npm run test:parts:coverage
```

That statement is scoped to the finder engine, not the entire UI. Browser
checks separately cover ambiguity choices, chip editing and removal, traditional
filter synchronization, mobile layout, caching, and loading failure/retry.

The interface renders at most 50 rows, but match counts cover the full store.
There is no claim of a universal latency or that this workload proves
performance for every hundred-field catalog.

For production, measure preparation time and memory as well as query latency.
Keep authoritative pricing, inventory, and engineering checks on the systems
responsible for them. Rebuild the interpreter when the store snapshot changes.

## The takeaway

The goal is not to make filters invisible.

It is to let users express a requirement without first understanding the
website's filter layout, while making the resulting interpretation visible.

**Recognize what is explicit. Normalize what is declared. Ask when it is
ambiguous. Never hide what was not understood.**

That is a useful foundation for component catalogs, industrial inventory
workbenches, and other websites whose users already know the values they need.

### Source and project

- [Kiara 1.1.0 on npm](https://www.npmjs.com/package/@kapoorlabs/kiara-ts/v/1.1.0)
- [Kiara TypeScript library](https://github.com/kapoorlabs/kiara-ts)
- [Examples repository](https://github.com/kapoor-labs/kiara-ts-examples)
- [Pinned JLCParts data source](https://github.com/dougy83/jlcparts/tree/169e24011b0832d236a76f9a2504016373505db0/data)
