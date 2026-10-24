# Kiara TS: restoring Java-style search execution

**Status:** implemented locally as the **1.1.1-search.0** candidate on 2026-10-24.
The TypeScript library now has a production DFS-bound trie executor, ordered
bound search, interval trees, selective materialization, and cached text indexes.
The [candidate package](../vendor/kapoorlabs-kiara-ts-1.1.1-search.0.tgz) contains
execution documentation and measured old/new results. Nothing was published.

Compatibility decision: preserve existing TypeScript keyword scoring, including
`minimumMatch`, rather than silently replacing it with Java's different behavior.
Structured execution follows Java's index/ancestry design while retaining caller
validation order and TypeScript result ordering. Runtime inspector views remain
available lazily. The original plan and acceptance criteria follow below.

**Verified delivery:** 165 library tests, 453 live Java tests, nine cross-browser
worker checks, 2,202 old/new differential checks, and 116 downstream examples
tests passed. Typecheck, builds, and the existing parity/performance gate passed.
The installed tarball's version, portable lockfile reference, SHA-512 integrity,
and included execution/benchmark evidence were checked. Browser smoke checks
covered bounded movie queries, typo-corrected airport search, and exact/fallback
configuration resolution.

Five isolated old/new process pairs at both 10k and 100k rows passed the latency
and prepared-heap budgets for eight workloads, including broad/full results and
exclusions. Snapshot coexistence and process RSS high-water observations are
recorded separately. This is not the entire proposed dimensional sweep below,
an isolated preparation-heap peak measurement, or a Java/Redis comparison.
Production-scale profiling remains release follow-up; no universal latency or
memory guarantee is claimed. The local candidate is not committed or published.

**Prepared:** 2026-10-24.

## 1. Goal and scope

Make TypeScript use Kiara's optimized search architecture, not merely return
similar answers through a different, scan-heavy implementation:

1. Shared field-level trie with parent/child relationships and DFS bounds.
2. Per-field inverted indexes pointing to trie nodes.
3. Ordered-key searches that locate bounds instead of scanning all keys.
4. Prefix-partitioned interval trees for stored-range containment.
5. Same-field intersection and cross-field ancestor/descendant matching.
6. Result construction from qualifying paths, not a sweep of every source row.
7. Text-search integration that reuses prepared structures and retains its
   documented matching, correction, and filtering contracts.

Keep Java-compatible normalization and TypeScript's NATIVE profile, typed
projections, interpreter, workers, and snapshot replacement working.

**Adding binary search alone is an interim improvement, not completion.**
Likewise, building a trie that query execution never uses is not algorithmic
parity.

This is not a proposal for a new database API, automatic composite indexes,
SQL syntax, semantic search, persistence, or a Redis performance claim.

## 2. Implementation location and pinned evidence

The implementation belongs in **kapoorlabs/kiara-ts**, whose local checkout is
`C:\Users\anujkapoor\repos\Kiara-ts`. The current examples repository is a
downstream consumer; do not patch its installed dependency.

| Baseline | Revision or version |
|---|---|
| TypeScript source, local and upstream main | `c410514edd2441ccca887ddaeaa4cda27a2bfb80` |
| Installed TypeScript package in the examples | `@kapoorlabs/kiara-ts` 1.1.0 |
| Java source, local and upstream develop | `5f61c4761bd5ca391fa89dc98897a18f0d81e83f` |
| Java baseline named by existing TS parity documents | `568d1addd15e237a5fa2dfaf7538b193d5564773` |

The Java and TS library worktrees were clean when inspected. The examples
worktree contains article changes; preserve them.

The existing [migration plan](https://github.com/kapoorlabs/kiara-ts/blob/c410514edd2441ccca887ddaeaa4cda27a2bfb80/docs/migration-plan.md)
already requires a faithful algorithmic port, DFS bounds, node-reference
indexes, and interval trees. This plan closes implementation gaps in that
design rather than replacing it with another architecture.

The [parity ledger](https://github.com/kapoorlabs/kiara-ts/blob/c410514edd2441ccca887ddaeaa4cda27a2bfb80/docs/parity-ledger.md)
marks trie/index/range capabilities verified, but its cited result tests do
not prove that the intended algorithms execute. Add separate columns for
**behavioral compatibility**, **algorithm implementation**, and **measured
performance**. Do not erase valid behavioral evidence.

### Observed gaps

| Area | Java reference | Current TypeScript source and gap |
|---|---|---|
| Ordered comparisons | [OrderedKeys](https://github.com/kapoorlabs/kiara/blob/5f61c4761bd5ca391fa89dc98897a18f0d81e83f/src/main/java/com/kapoorlabs/kiara/domain/OrderedKeys.java): BETWEEN binary-searches the lower bound and stops past the upper bound; one-sided scans stop at the boundary | [Search engine](https://github.com/kapoorlabs/kiara-ts/blob/c410514edd2441ccca887ddaeaa4cda27a2bfb80/src/store/search-engine.ts): numeric comparison iterates the complete ordered-key array |
| Stored ranges | [SearchableRange](https://github.com/kapoorlabs/kiara/blob/5f61c4761bd5ca391fa89dc98897a18f0d81e83f/src/main/java/com/kapoorlabs/kiara/domain/SearchableRange.java): balanced interval tree, subtree bounds, temporary build-array release | TS search engine loops over range entries; exclusion additionally searches the entries again for each universe row |
| Prepared storage | [StoreLoader](https://github.com/kapoorlabs/kiara/blob/5f61c4761bd5ca391fa89dc98897a18f0d81e83f/src/main/java/com/kapoorlabs/kiara/loader/StoreLoader.java): DFS bounds and indexes over trie nodes | [Index builder](https://github.com/kapoorlabs/kiara-ts/blob/c410514edd2441ccca887ddaeaa4cda27a2bfb80/src/store/index-builder.ts): builds a separate trie without DFS bounds; indexes contain row IDs; ancestor nodes also retain descendant row IDs |
| Combining conditions | [StoreSearch](https://github.com/kapoorlabs/kiara/blob/5f61c4761bd5ca391fa89dc98897a18f0d81e83f/src/main/java/com/kapoorlabs/kiara/search/StoreSearch.java) and [LogicalUtil](https://github.com/kapoorlabs/kiara/blob/5f61c4761bd5ca391fa89dc98897a18f0d81e83f/src/main/java/com/kapoorlabs/kiara/util/LogicalUtil.java): group conditions by field and compare qualifying nodes using ancestry bounds | TS creates a whole-universe Set, intersects row-ID sets, then visits source row IDs and rechecks predicates |
| Text queries | [Java KeywordSearch](https://github.com/kapoorlabs/kiara/blob/5f61c4761bd5ca391fa89dc98897a18f0d81e83f/src/main/java/com/kapoorlabs/kiara/search/KeywordSearch.java): index lookup and condition-search combinations | [TS KeywordSearch](https://github.com/kapoorlabs/kiara-ts/blob/c410514edd2441ccca887ddaeaa4cda27a2bfb80/src/query/keyword-search.ts): builds a dictionary per request and tokenizes/scores candidate rows |
| Performance evidence | Requires comparable, workload-specific measurements | Existing [benchmark](https://github.com/kapoorlabs/kiara-ts/blob/c410514edd2441ccca887ddaeaa4cda27a2bfb80/scripts/benchmark-worker.mjs) covers a small number of query shapes; it cannot establish interval-tree or high-cardinality bound-search performance |

## 3. Compatibility rules before implementation

Freeze observable behavior before changing execution:

- Exact records, duplicates, supported ordering, and limit behavior, including
  zero, negative, absent, and empty-condition cases.
- JAVA normalization, NATIVE fractions, supported bigints, nulls, sentinels,
  case handling, dates, date-times, and prefix-bearing ranges.
- Collection membership versus full-collection equality/exclusion semantics.
- Errors, error details, and validation precedence. Optimizer reordering must
  not incidentally change which invalid condition is reported.
- Source-model/projection behavior, ignored payload fields, class-backed
  schemas, immutable query input, and diagnostic serialization.
- Preparation failure, replacement isolation, and old-snapshot readability.

There are two references, not one:

1. **Pinned Java oracle** for intended Java compatibility.
2. **Current TS behavior** for existing consumers and NATIVE extensions.

Where they disagree, create a minimal failing fixture and classify the
difference. A semantic correction needs an explicit release decision and
migration note; do not hide it inside a performance change. Preserve existing
TS behavior in compatibility-preserving stages.

In particular, current Java and TS `minimumMatch` implementations use different
selection rules. Existing passing fixtures do not justify declaring universal
equivalence. Expand this corpus before deciding to change that public behavior.
Configuration precedence must remain explicit application policy.

## 4. Target execution model

```text
Schema + records
  -> existing normalization
  -> shared field-value trie with DFS entry/exit bounds
  -> per-field key -> ordered node-ID postings
       + sorted comparable keys
       + collection full-key postings
       + prefix-specific interval trees

Conditions
  -> validated, normalized query representation
  -> same-field node intersection / union / exclusion
  -> cross-field ancestry joins using DFS bounds
  -> qualifying terminal paths
  -> matching source identities or projected values
  -> preserved ordering and limits
```

Use node IDs and normal arrays/maps first. Packed arrays are a later,
measurement-driven optimization, not a prerequisite or a reason to narrow
numeric precision.

Keep field order stable: it determines trie structure. Do not reorder the
schema for compression without a separate compatibility decision.

Store terminal record identities once, with one source-record table where
needed to preserve public behavior. Avoid copying every descendant row ID
into every execution node. Duplicate input rows and ignored fields must not
be lost when searchable paths are shared.

## 5. Delivery sequence

### P0 - Baseline, contracts, and test instrumentation

**Prerequisite:** none.

- Reconcile the older oracle baseline with the inspected Java revision.
  Preserve old fixtures and generate additional version-labelled fixtures;
  do not silently regenerate expected results to make failures pass.
- Run existing TS unit, type, Java-oracle, scale, and benchmark checks.
  Run Java tests with a compatible JDK/Maven setup and record any baseline
  failures separately.
- Capture result hashes, order/multiplicity, preparation time, heap/RSS, and
  query latency before changes.
- Add lightweight test/benchmark-only counters for keys examined, interval
  nodes visited, posting entries inspected, candidate/terminal visits, source
  rows visited, normalization calls, and dictionary builds.
- Extend the existing Vitest/oracle and benchmark tools rather than adding a
  separate framework.

**Exit:** baselines are reproducible; mismatches are classified; algorithmic
tests fail against the known scan paths for the intended reason.

### P1 - Ordered-key and interval primitives

**Prerequisite:** P0. Ordered-key and interval work can proceed independently.

**Ordered keys**

- Add shared, typed `lowerBound`/`upperBound` helpers and one numeric comparator
  used by index preparation and search. Reuse existing normalization.
- Map `<`, `<=`, `>`, `>=`, and inclusive BETWEEN to the correct slices.
  Seek the lower bound, stop at the upper bound, and enumerate only qualifying
  postings.
- Preserve supported number/bigint behavior. Do not introduce precision loss
  by converting all keys to Number for comparison.
- Cover dates/date-times through their normalized numeric representations and
  all currently supported scalar/collection operator combinations.

**Interval trees**

- Partition by normalized range prefix.
- Build a balanced immutable tree sorted by lower endpoint, with subtree
  maximum upper endpoints; discard temporary arrays after preparation.
- Map each interval to qualifying node/record postings, sharing repeated
  intervals where valid.
- Preserve inclusive boundaries, point ranges, prefixes, date/time ranges,
  and multiple intervals per row.
- Implement ANY as union; ALL as intersection of identities matching each
  requested point. The same record may satisfy different points through
  different intervals; do not invent continuous coverage across a gap.
- Implement NOT_CONTAINS as exclusion with explicit missing-range membership.
  Remove the nested universe-row/range-entry search. Broad complements may
  necessarily cost O(N); selective positive queries should not.

These primitives may initially serve the old row-posting executor for an
independently testable improvement. That executor is transitional.

**Exit:** differential correctness and operation-count gates pass; no complete
key/range scan remains in the selective primitive fixtures.

### P2 - Make the shared trie an execution structure

**Prerequisite:** P0; integrates P1 indexes before P3.

- Extend preparation with parent/child links and iterative DFS entry/exit
  numbering, following Java's ancestry-bound design.
- Make per-field equality, full-collection, ordered-key, and interval postings
  reference execution nodes, ordered by DFS position.
- Use collision-safe normalized edge identities for null, scalar types,
  collections, and ranges. Delimiter concatenation must not accidentally
  merge distinct values.
- Maintain terminal identities/multiplicity and enough payload access for
  typed results. Test shared prefixes, completely duplicated rows, ignored
  values, and differing source representations that normalize equally.
- Keep the old evaluator only as a test-side differential reference, not a
  permanent silent production fallback.

**Public inspection boundary:** the library exports prepared-data/index types
and exposes `getPreparedData()` and trie snapshots through
[Store](https://github.com/kapoorlabs/kiara-ts/blob/c410514edd2441ccca887ddaeaa4cda27a2bfb80/src/store/store.ts).
Preserve their documented shapes through readonly diagnostic views where
possible. Measure the additional memory when such a view is requested.
If compatibility requires a breaking shape or identity change, stop and make
that a versioned release decision before removing old fields.

**Exit:** node-sharing and DFS invariants pass; indexes actually reference
those nodes; diagnostics and public inspection contracts remain covered.

### P3 - Java-style condition execution and selective materialization

**Prerequisites:** P1 and P2.

- Normalize condition values once per query and compile a validated copy;
  never mutate caller-owned conditions.
- Group conditions by schema column. Intersect restrictions on the same
  column before joining across columns.
- Port the ancestry-bound matching strategy from Java's logical utilities,
  including choosing the traversal direction based on collection sizes.
  Test exact-boundary comparisons, not just happy-path intersections.
- Handle OR-like multi-value equality, ALL/ANY membership, complements, and
  null cases without rebuilding a whole-universe Set for every selective query.
- Follow only surviving branches to terminal identities. Stop constructing
  source-row results for records that cannot match.
- Preserve TS output order explicitly. If DFS order differs from source
  order, order only matched terminal IDs or merge ordered terminal postings;
  do not restore ordering by sweeping the entire source table.
- Apply limits only when correctness and ordering allow it. Never truncate
  an intermediate candidate list before all conditions are satisfied.
- Remove redundant per-row fallback evaluation once every supported
  condition has an exact indexed path. If a residual check is genuinely
  required, name it, instrument it, and restrict it to surviving candidates.
  Unsupported combinations must fail explicitly.
- Produce typed/legacy projections from qualifying paths or matched source
  identities while preserving their distinct value/key contracts.

**Exit:** selective end-to-end queries pass without whole-dataset source-row
scans; all condition combinations and projection/limit contracts match the
approved oracles.

### P4 - Text, interpreter, and lifecycle integration

**Prerequisites:** P0 text contract; P3 optimized executor.

- Prepare reusable token/stem postings and dictionary structures per snapshot
  and eligible field instead of rebuilding/tokenizing the corpus per request.
- Characterize Java's keyword-to-field condition search against TS token
  scoring, including ambiguity, ties, partial matches, keyword caps, and
  matched/corrected keyword metadata.
- Wire Java-compatible keyword condition searches to the optimized executor.
  Preserve existing TS semantics where documented; any different ranking or
  `minimumMatch` contract is a separately gated semantic change, not a hidden
  optimization.
- Bound and measure keyword-to-field combination growth. A faithful Java
  strategy is not automatically faster for every text workload. A different
  posting-based optimization needs explicit evidence and documentation rather
  than an unqualified "same algorithm" label.
- Preserve candidate-scoped corrections: a global cached dictionary must not
  suggest a word available only in records excluded by hard conditions.
  Intersect token postings with eligible candidates before accepting it.
- Preserve English stemming, one insertion/deletion/substitution correction,
  short-word exclusions, prefix ordering, and field scoping. Suggestions remain
  separate from record retrieval.
- Exercise the interpreter's whole-value discovery, aliases, NATIVE unit
  conversion, ambiguity, strict rejection, and editing after the engine swap.
- Bind all prepared structures/caches to the snapshot. Rebuild the interpreter
  and caches for replacements; failed preparation must leave the old store
  usable.
- Validate worker results, projections, progress/error envelopes, browser
  responsiveness, and cancellation's existing limits. Do not claim arbitrary
  synchronous work becomes preemptible.

**Exit:** structured and text paths use prepared search structures; existing
search UX and replacement semantics remain intact, with explicit handling of
any Java/TS behavior gaps.

### P5 - Memory, performance gates, and rollout

**Prerequisites:** P1-P4.

- Remove obsolete duplicate execution storage after checking diagnostics and
  inspection consumers. Release build-time maps/arrays that are no longer used.
- Measure steady-state memory, preparation peak, and coexistence of old/new
  snapshots. Shared tries must show actual sharing; report memory separately
  for high-cardinality data with little prefix reuse.
- Run the correctness matrix and performance suite below. Publish actual
  results with fixture seeds, machine/runtime versions, and source SHAs.
- Keep changes as focused reviewable commits: primitives, prepared structures,
  executor, text/lifecycle, evidence/docs. Avoid a second permanent public
  engine mode solely to hide incomplete migration.
- Build/package a candidate locally and test that package in the examples
  project. Only then release and update the examples dependency/lockfile using
  the package manager.
- Update migration/parity/performance documentation and any article claims
  only after their corresponding evidence gates pass.

**Exit:** the complete definition of done below passes. Publishing the package
is a separate authorized release action, not part of this planning task.

## 6. Correctness matrix

Use existing tests plus deterministic differential/property-style cases:

| Dimension | Required cases |
|---|---|
| Key bounds | Empty/singleton indexes, missing endpoints, inclusive/exclusive boundaries, reversed bounds, repeated values, first/last key |
| Numeric profiles | JAVA truncation and sentinels; NATIVE fractions; negative values; safe-integer boundaries and supported bigints; invalid values |
| Ranges | Disjoint, nested, identical, touching, overlapping, zero-width; prefixes; dates/date-times; multiple intervals and missing intervals |
| Conditions | Every allowed operator/type pair and rejection; repeated-field conditions; 2-5 fields; mixed positive/negative clauses; permutations |
| Records | Shared prefixes, unique prefixes, duplicate records, ignored fields, null/blank/list variants, normalization collisions |
| Results | Values and types, identity where promised, multiplicity, order where promised, projection shape, limits, no-match, empty query |
| Text | Whole words versus prefixes, stemming, correction ties, unknown tokens, partial best matches, caps, hard filters, minimumMatch gaps |
| Integration | Decorators/builders, query helpers, interpreter, diagnostics, worker adapters, replacement failures and old snapshot retention |

Keep a simple scan implementation as an independent **test oracle**. Do not
share all new indexing helpers with it, which would let both sides reproduce
the same bug. Java-generated fixtures remain a separate comparison source.

## 7. Algorithmic and performance acceptance

### Deterministic gates

These verify the algorithm directly, independently of noisy wall-clock timing:

1. With **100,000 distinct numeric keys** and a BETWEEN selecting **20 keys**,
   boundary lookup uses at most `2 * ceil(log2(U + 1)) + 4` comparisons, and only
   the 20 matching key postings are enumerated. Track boundary probes separately.
2. With **100,000 disjoint intervals** in one prefix bucket, a query inside one
   interval visits at most **128 interval nodes** and returns that interval.
   Add nested/all-overlapping cases without imposing a false logarithmic bound
   when the output itself is large.
3. A selective equality/combined query matching one terminal record at the end
   of a 100,000-row input does **not** visit 100,000 source rows or allocate a
   100,000-entry universe Set. Count source visits and universe materialization.
4. Query execution consumes DFS bounds/node postings; serializing a trie after
   a row-scan query does not satisfy this gate.
5. Repeating a keyword query against an unchanged prepared snapshot does not
   rebuild its vocabulary or retokenize the complete corpus.
6. NOT_CONTAINS missing-range membership performs no nested per-row scan of
   all interval entries.

### Measurement suite

Extend the existing benchmark tooling with:

- 1,000, 10,000, and 100,000 rows; 1,000,000 only in an explicitly provisioned,
  memory-budgeted benchmark run, not an uncontrolled shared-machine check.
- Numeric cardinality independent of row count; low/high trie prefix sharing.
- Selectivity of one result, approximately 0.1%, 10%, and all results.
- Equality, BETWEEN, range containment, 2-5-field combinations, exclusions,
  keyword refinement, and small/full projections with and without limits.
- Warmed p50/p95/p99 query latency, returned counts/hashes, preparation time,
  steady/peak memory, allocation/GC observations, and worker round-trip cost.
- Separate in-process Java and Node measurements from browser/network tests.
  Pin JVM/Node/browser versions and run old/new variants on the same hardware.
- At least five isolated old/new process pairs with warmup and alternating
  execution order. Do not collect comparative timings concurrently.

**Proposed release budgets:** no unexplained regression greater than 10% in
median per-run p95 on the established workload matrix; no unexplained increase
greater than 15% in retained prepared-store memory. Target at least 2x lower p95
for the selective high-cardinality numeric and disjoint-range fixtures versus
TS 1.1.0. These are acceptance targets, not achieved results. Revisit a budget
only through a documented trade-off with evidence, not by silently increasing
the baseline after a failure.

Measure preparation separately: replacing flat entries with trees can cost
more to build while reducing repeated query cost. Record that break-even point.
For tiny timings near the measurement floor, rely on operation counts and
batch measurements rather than unstable percentages.

## 8. Existing commands and downstream verification

In the TS library checkout, use focused Vitest selectors for each stage. At
integration time, reuse:

```powershell
npm run typecheck
npm test
npm run test:parity:gate
npm run test:playwright
```

The parity gate already includes the build, Java fixture suites, scale cases,
operator matrix, Java-test accounting, and a benchmark check. Extend its
underlying coverage; do not mistake the current smoke workload for the new
algorithmic gates. Avoid rerunning its constituent commands unnecessarily.

For downstream validation after installing the candidate package, run the
examples project's existing:

```powershell
npm test
npm run build
```

Also exercise typeahead, the Philips keyword progression, hierarchical rule
selection/ties, unit-equivalent interpretation, and replacement/worker flows
in the browser. Preserve the current article examples' published outputs.

## 9. Definition of done

- [x] Java-style trie/node execution is the production path, not an unused index.
- [x] Bound search and interval pruning pass their operation-count gates.
- [x] Selective queries avoid whole-universe allocation and source-row sweeps.
- [x] All supported operators have exact indexed paths or explicit, measured
      candidate-only residual checks.
- [x] Java and TS/NATIVE compatibility suites pass; known differences are
      documented and not hidden by set-only or count-only assertions.
- [x] Public types, result ordering/multiplicity, inspection, and lifecycle
      contracts are preserved or explicitly versioned.
- [x] Text/interpreter/worker integrations do not restore full scans or stale
      dictionaries through another entry point.
- [x] Memory and latency evidence meets the budgets on the measured workload
      matrix, including broad queries and snapshot replacement. See the scope
      limitations in the delivery status above.
- [x] Obsolete runtime scan/fallback structures are removed; the reference scan
      exists only in tests.
- [x] Library documentation distinguishes behavioral, algorithmic, and measured
      performance parity.
- [x] The packaged candidate passes downstream tests/build and browser checks
      before any release or new performance claim.

**Recommended first implementation step:** P0, followed by P1's bound-search
helpers and interval tree. Those deliver reviewable improvements while the
trie executor is developed, without mislabelling an interim patch as completion.
