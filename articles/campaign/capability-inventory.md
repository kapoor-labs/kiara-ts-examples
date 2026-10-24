# KiaraDB: evidence-backed capability inventory

Audited 2026-10-24. This is the source of claims for the promotional campaign,
not a claim that every capability is exclusive to KiaraDB.

## Audit scope and confidence

- Read all 14 files in [src](../../src), all six [test files](../../tests),
  both [import scripts](../../scripts), and the HTML/build configuration.
- Inspected installed `@kapoorlabs/kiara-ts` **1.1.0** documentation, public types,
  preparation/index construction, store lifecycle, and search execution.
- Checked the [Java project's documentation](https://github.com/kapoorlabs/kiara)
  at revision `5f61c4761bd5ca391fa89dc98897a18f0d81e83f` for cross-language
  claims. Java implementation tests were **not** run here.
- Ran the repository's full test suite: **100 passed, 0 failed**.
  `npm run build` also passed, with Vite's existing large-chunk warning.
- Test results establish the specified behaviors, not universal speed, complete
  UI coverage, production readiness, or an advantage over every competing engine.

**Evidence labels:** **Tested** = asserted by this repository's tests;
**Inspected** = verified in the installed package's implementation/docs;
**Java-doc** = documented by the Java project, not locally executed.

## The strongest campaign promise

> Define your data, prepare it once, and search by changing combinations of
> searchable fields without designing a composite index for each combination.
> Add collection, range, date, and text-search behavior through the same query layer.

This is a stronger lead than "a database in the browser." Java and TypeScript
are implementation choices, not the reader's primary reason to care.

## A. Search architecture and data modeling

| ID | Distinguishable characteristic | What the reader gains | Evidence and scope |
|---|---|---|---|
| C01 | Automatic internal indexing of declared searchable fields | Change filter combinations without manually defining a composite index for every query shape | Inspected: `buildPreparedStoreData` creates indexes for every field not marked `ignoreIndex`; [schema builder](../../src/datasets.ts), [combined-query tests](../../tests/query.test.ts); Java-doc explicitly describes no manual composite indexes |
| C02 | One condition representation across field combinations | Reuse query composition instead of writing a dedicated filtering path for each field | Tested: [query adapter](../../src/query.ts), [44 guided queries](../../src/examples.ts), [query tests](../../tests/query.test.ts) |
| C03 | Java and TypeScript implementations | Use a prepared, read-oriented query model in different application stacks | [Java docs](https://github.com/kapoorlabs/kiara), [TypeScript docs](https://github.com/kapoorlabs/kiara-ts); API/behavior parity must not be assumed |
| C04 | Typed schema builders or standard TypeScript decorators | Choose plain-object schemas or annotated models without changing the TS search engine | Inspected: package README, `dist/decorators/entity.js`, declarations and [usage guide](https://github.com/kapoorlabs/kiara-ts/blob/main/docs/usage.md); this repository uses builders; Java uses POJOs/annotations |
| C05 | Text, number, long, boolean, and enum field kinds | Express field types rather than converting every value into a search string | Tested: [schema definitions](../../src/datasets.ts), [kind coverage](../../tests/query.test.ts); TS long support is not a blanket arbitrary-precision guarantee |
| C06 | Opt-out indexing, with ignored fields still returned/projected | Keep payload fields without allowing them in filters | Tested: ignored-field errors and retained projected links in [query tests](../../tests/query.test.ts); ignoring is not authorization or a promise of zero storage overhead |
| C07 | Configurable normalization | Match case-insensitively and preserve decimals when explicitly using NATIVE mode | Tested: [query tests](../../tests/query.test.ts), [unit equivalence](../../tests/parts-finder.test.ts); inspected default JAVA numeric profile truncates fractions into long-like keys |
| C08 | In-memory prepared-store lifecycle | Pay preparation cost once per snapshot and reuse a read-oriented store | Inspected: store loading/preparing/ready/failed states; tested in all engine modules; no durable storage or unrestricted post-prepare mutation |
| C09 | Trie representation and diagnostic inspection | Inspect prepared structure and learn how shared paths represent repeated values | Tested: bounded trie serialization in [query tests](../../tests/query.test.ts); inspected TS builds a trie plus per-field indexes; Java-doc discusses prefix dedup and field order. Do not equate implementations or infer measured compression |
| C10 | Zero runtime dependencies in the TS library | Embed the library without an additional runtime dependency graph | Inspected: installed package manifest. The playground separately depends on Monaco, Papa Parse, and Vite; the Java library is not covered by this claim |

## B. Advanced filters that deserve more visibility

| ID | Distinguishable characteristic | What the reader gains | Evidence and scope |
|---|---|---|---|
| C11 | AND across conditions; alternative values within equality conditions | Combine requirements while accepting several values for a field | Tested: [query cases](../../tests/query.test.ts), [wildcard candidate retrieval](../../tests/runtime-config.test.ts); not an unrestricted Boolean expression language |
| C12 | Exclusive/inclusive bounds and inclusive BETWEEN | Express numeric thresholds and bands without hand-written comparison chains | Tested: all comparison operators in [guided queries](../../src/examples.ts) and [tests](../../tests/query.test.ts) |
| C13 | Collection ALL, ANY, and exclusions | Distinguish "must have both" from "either is enough" and "must not contain" | Tested: [set fixtures](../../src/business-demos.ts), [ALL/ANY/exclusion assertions](../../tests/business-demos.test.ts); membership is not substring search |
| C14 | Explicit missing-value behavior, including null-or-member collection matching | Make unknown data a deliberate policy instead of inventing defaults | Tested: scalar null and `CONTAINS_EITHER_INCLUDING_NULL` in [query tests](../../tests/query.test.ts); range fields do not support that special null operator |
| C15 | Scalar date and date-time comparisons | Query temporal values as dates/times rather than arbitrary text | Tested: [date examples](../../src/examples.ts), [query tests](../../tests/query.test.ts); supported formats must be configured, not arbitrary Java format patterns |
| C16 | Stored numeric, date, and date-time ranges | Ask which record's interval contains a requested point | Tested: [real stored-range boundary cases](../../tests/business-demos.test.ts) and [date/time cases](../../tests/query.test.ts); not a general overlap/scheduling API |
| C17 | Collections of values and collections of intervals | Represent multiple allowed values/windows in one record, rather than padding rows | Tested: all **12 secondary field types** are exercised in [query tests](../../tests/query.test.ts); all requested points may be covered by different intervals, leaving gaps between them |
| C18 | Prefix-aware numeric ranges (`numericStartPos`) | Keep a namespace prefix while querying the numeric portion | Tested: `yearBand` / `Y2009` in [guided queries](../../src/examples.ts) and [query tests](../../tests/query.test.ts); a specialized capability, not the opening hook |
| C19 | Typed projections, result limits, and legacy projections | Return only needed fields while preserving types, or explicitly use a legacy string-shaped output | Tested: exact projected shapes in [query tests](../../tests/query.test.ts), [worker projection](../../tests/business-demos.test.ts); a result limit is not a total-count API |

## C. Search assistance and query interpretation

| ID | Distinguishable characteristic | What the reader gains | Evidence and scope |
|---|---|---|---|
| C20 | Cross-field whole-value discovery | Let users type a known value without first naming its field | Tested: `ceramic samsung X7R` in [finder tests](../../tests/parts-finder.test.ts); TS 1.1.0 `QueryInterpreter` uses a cached whole-value dictionary, not unrestricted semantic inference |
| C21 | Declared field and value aliases | Accept the user's vocabulary without renaming stored data | Tested: `cap`, manufacturer/category aliases in [finder](../../src/parts-finder.ts) and its [tests](../../tests/parts-finder.test.ts) |
| C22 | Canonical-unit conversion, including equivalent units in ranges | Make equivalent quantities produce equivalent conditions | Tested: `10uF` and `10000nF` return the same **272** real matches; inspected precise decimal multiplication before conversion to JS numbers. Units require NATIVE mode; records already use canonical units |
| C23 | Ambiguity as explicit candidate choices | Avoid guessing which field a shared value or unit belongs to | Tested: three voltage candidates and leading-zero package ambiguity in [finder tests](../../tests/parts-finder.test.ts); bare values mean equality, not an assumed minimum |
| C24 | Strict execution, source spans, and editable fragments | Reject incomplete requests and build editable chips from the actual input | Tested: zero search calls for blocked input, serialization, and fragment rewrites in [finder tests](../../tests/parts-finder.test.ts); library provides results/edit helpers, application renders UI |
| C25 | Keyword retrieval combined with structured conditions | Be forgiving about words while keeping hard requirements strict | Tested: [retail discovery](../../tests/business-demos.test.ts), [keyword-filter queries](../../tests/query.test.ts) |
| C26 | One-edit correction and English stemming | Recover from a small spelling mistake or a related word form | Tested: `apolo`, `latern`, `surviving`, `decorating`; dictionary one-edit supports insertion/deletion/substitution, not transposition, and skips words of three characters or fewer |
| C27 | Reusable prefix dictionaries and field scoping | Build completion from the vocabulary actually present in the data | Tested: [type-ahead tests](../../tests/typeahead.test.ts); suggestions are words, record retrieval is separate. TS application builds the dictionary explicitly; metadata alone does not wire an input |
| C28 | Inspectable token scores, corrections, and truncation | Explain why results appeared and expose query limits | Tested: [keyword metadata assertions](../../tests/query.test.ts); TS `bestMatch` chooses the highest positive token-match group; `minimumMatch` chooses the lowest positive group, not a minimum threshold |

## D. Operational and integration features

| ID | Distinguishable characteristic | What the reader gains | Evidence and scope |
|---|---|---|---|
| C29 | Prepare a replacement while retaining the old snapshot | Activate only a fully prepared dataset, retaining old references until the app switches | Tested: [snapshot and interpreter isolation](../../tests/business-demos.test.ts), [invalid rules retain revision](../../tests/runtime-config.test.ts); TS `replaceAll` prepares a new store; app owns validation, activation, and revision |
| C30 | Worker protocol and browser worker bridge | Move query execution off the browser UI thread with progress/error/cancellation messages | Tested current-thread adapter in [business tests](../../tests/business-demos.test.ts); real worker wiring inspected in [worker](../../src/retail.worker.ts) and [view](../../src/business-demo-view.ts). Actual worker responsiveness was not re-measured in this audit |
| C31 | Structured errors and diagnostics | Handle invalid fields, operators, states, and normalization explicitly | Tested failures across all six test files; inspected error codes/details and worker `ok: false` contract |

## E. Useful demonstrations, not database features

| ID | Application pattern | Reader benefit | Ownership/evidence |
|---|---|---|---|
| D01 | Runtime configuration with wildcards, specificity, and ties | See all applicable rules and why one wins or no unique winner exists | Application logic around Kiara queries; [engine](../../src/runtime-config.ts), [tests](../../tests/runtime-config.test.ts). Do not advertise built-in policy precedence |
| D02 | Typed input, chips, and traditional controls share one state | Offer a shorter path without taking familiar controls away | [Finder UI](../../src/parts-finder-view.ts); engine editing helpers tested separately; no complete DOM-coverage claim |
| D03 | CSV import, type review, export, and JSON loading | Evaluate the library with the reader's own records | [Importer](../../src/business-demos.ts), [CSV tests](../../tests/csv.test.ts), [business tests](../../tests/business-demos.test.ts); Papa Parse/application code, not a Kiara CSV engine |
| D04 | Query-aware IntelliSense and 44 guided examples | Explore field names, operators, projections, and diagnostics interactively | [Monaco integration](../../src/editor.ts), [examples](../../src/examples.ts); editor is not bundled in KiaraDB |
| D05 | Prepared-data caching and visible loading/retry | Reuse prepared stores and expose loading failures | [Application lifecycle](../../src/main.ts), [views](../../src/application-examples.ts); not a built-in caching/network service |
| D06 | Pinned real datasets with preserved provenance | Reproduce tests without trusting synthetic benchmark claims | [Import scripts](../../scripts), hashes in [tests](../../tests/query.test.ts); 5,043 movies, 7,698 airports, 16,802 components, 3,788 derived retail products. Historical data; some helper fields are explicitly derived |

## Boundaries that protect the campaign's credibility

1. Say **automatic indexing**, not "index-free," "no schema," or "query literally
   any property." Fields must be supported, declared, loaded, and searchable.
2. Do not call a query library unique merely because it supports comparisons or
   autocomplete. The campaign differentiator is the useful combination and
   reduced manual index/query setup.
3. No unmeasured promises about constant-time queries, dataset-independent speed,
   a fixed millisecond latency, compression ratios, or beating another database.
   TS search explicitly intersects candidate sets and visits source row IDs.
4. Do not claim shared Java/TypeScript internals, identical APIs, or universal
   parity. TS `QueryInterpreter` is verified here; a Java equivalent is not.
5. The interpreter covers scalar text/enum/number/boolean and string collections.
   Dates, longs, numeric collections, and stored ranges use structured APIs.
   No implicit OR, grouping, arbitrary prose, or general unit registry.
6. Keywords and suggestions do not enforce semantic intent. Best-match is not
   "every query word must occur," and minimum-match is not a confidence threshold.
7. Endpoint containment proves continuous coverage only for one contiguous
   stored interval, not a union of disjoint intervals.
8. Prepared records should be treated as read-only. Replacement is not
   distributed atomicity, durable persistence, authorization, or synchronization.
9. CSV limits (10 MiB / 50,000 rows / 100 columns) belong to the demo, not the
   library's universal capacity. Browser execution is an option, not the brand.
10. Publish the measured behavior, not unsupported history or personal anecdotes.
    Disclose the author's actual relationship to the project and AI assistance
    according to each publisher's requirements.

## Primary references

- [Java project](https://github.com/kapoorlabs/kiara)
- [TypeScript project](https://github.com/kapoorlabs/kiara-ts)
- [Published TypeScript 1.1.0 package](https://www.npmjs.com/package/@kapoorlabs/kiara-ts/v/1.1.0)
- [Repository tests](../../tests) and [guided examples](../../src/examples.ts)

The Java README contains older benchmark descriptions and inconsistent wording
about runtime support. Neither was used for a quantitative campaign claim.
