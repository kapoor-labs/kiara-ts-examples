# KiaraDB promotional campaign: editorial plan

Created after the [capability audit](./capability-inventory.md), 2026-10-24.

## Positioning

**Search changing combinations of fields without manually designing composite
indexes; express richer requirements through one prepared-data query layer.**

Lead with what the reader can build or stop doing. Java/TypeScript availability
supports adoption; "runs in a browser" is not the central value proposition.
Make the work educational enough to stand without a product pitch.

## The first-ten-line contract

Every publishable draft must deliver this before its first section:

1. **Title:** a specific outcome tied to a real capability.
2. **Opening:** a recognizable developer/user problem, with no invented anecdote.
3. **Payoff:** what the reader will learn or be able to do.
4. **Mechanism:** one sentence naming the relevant KiaraDB capability.
5. **Concrete evidence:** a query, before/after, or explicit example appears early.

Keep the initial prose under approximately 70 words. Place the hero image
**after** the opening, so an image embed does not displace the reader benefit.
Preview at mobile width; the first ten source lines are only an editorial proxy.

## Seven articles, seven useful entry points

Preserve existing filenames and links. The old filename may name the original
demo; the new article itself must remain domain-neutral.

| ID | Draft / proposed headline | Reader payoff and opening proof | Distinct scope | Target prose length |
|---|---|---|---|---|
| A1 | [LinkedIn overview](../seven-business-features-with-kiara-linkedin.md): **New Filter Combination? You Shouldn't Need a New Index.** | Changing fields does not require manually designing another composite index; show status + score + tags | Short discovery post; automatic indexing, advanced filters, read-mostly fit | 280-400 words |
| A2 | [Medium filters](../seven-business-features-with-kiara-medium.md): **Tags, Dates, and Ranges: Build Richer Filters with KiaraDB** | Express all-of tags plus a numeric band and a date point inside a stored window | Structured filtering tutorial; ALL/ANY/NOT, null policy, 12 secondary types, projection | 500-700 words |
| A3 | [LinkedIn discovery](../filterless-parts-finder-linkedin.md): **Type the Value. Let KiaraDB Find the Field.** | `active emea` becomes two field conditions without selecting two dropdowns | Whole-value discovery, declared aliases, ambiguity instead of guessing | 280-400 words |
| A4 | [Medium interpreter](../filterless-parts-finder-medium.md): **500ms or 0.5s? Make Equivalent Queries Return the Same Results.** | Show two inputs returning identical records, then expose an ambiguous duration | Unit metadata, numeric ranges, strict interpretation, editable source spans | 500-700 words |
| A5 | [Text search](../airport-typeahead-with-kiara-typescript.md): **Fix the Typo, Keep the Filter: Better Text Search with KiaraDB** | A misspelling can recover while an exact status/score filter still excludes rows | Prefix completion vs record retrieval; typo/stemming; best/minimum scores; metadata | 500-700 words |
| A6 | [Rules](../runtime-config-with-kiara-typescript.md): **Which Rule Won? Query, Explain, and Refresh Configuration with KiaraDB** | Find candidate rules, expose a tie, and keep the last good snapshot after rejection | Wildcards + application ranking, projections, replacement lifecycle, ownership boundary | 500-750 words |
| A7 | [HackerNoon](../kiaradb-local-search-hackernoon.md): **Key-Value Lookups Break Down at 100 Attributes. Here's What I Built Instead.** | Work backward from the problem: many attributes, unpredictable combinations, exploding per-combination lookups, and costly ID-set intersection | Author's travel/e-commerce origin story, verified Java and TypeScript snippets before a paper-backed algorithm walkthrough, same-library before/after measurements; KiaraDB absent from title and opening | 1,000-1,300 prose words, plus snippets |

## Capability allocation

Every audited library capability has an editorial home; not every detail belongs
in every article. Primary hooks receive examples, supporting features receive
concise explanation. The inventory retains details too specialized for a headline.

| Article | Capability IDs | Application-pattern IDs |
|---|---|---|
| A1 | C01-C03, C08, C10-C13, C16, C19 | D03-D04 |
| A2 | C05-C07, C11-C19 | D06 |
| A3 | C20-C21, C23-C24 | D02 |
| A4 | C07, C20-C24, C31 | D02 |
| A5 | C25-C28, C11, C19 | D05 |
| A6 | C06, C08, C11, C14, C19, C29, C31 | D01 |
| A7 | C01, C03, C08-C09, C11-C13, C15-C16, C20-C23, C25-C29 | D01-D02, D05 |

## Proof and editorial rules

- Use small **explicitly fictional records** with expected output. Keep the
  lessons domain-neutral; the flagship uses a familiar light-search example
  without restricting the product's positioning to retail.
- Technical tutorials get one complete runnable JavaScript example using the
  TypeScript library. Keep npm instructions pinned to 1.1.0 until newer registry
  availability is verified. State that outputs also passed on the optimized
  1.1.1-search.0 candidate behind the 1.2.0 GitHub release; do not confuse that
  release with successful npm publication. HackerNoon instead pairs one Java
  example with one TypeScript example over identical data; the TypeScript block
  is executed by the article tests, and the Java block is compiled separately.
- Extract and execute the actual Markdown code blocks in automated checks;
  compare emitted JSON with the published JSON, not a separate approximation.
- Test the short articles' illustrative queries too.
- Explain internal indexing in the flagship: preparation builds indexes;
  developers do not manually create an index for every query combination.
- Do not conflate no manual composite indexes with unlimited scale, no memory
  cost, schema-free ingestion, or a row-count-independent complexity guarantee.
- State TypeScript-only API scope. Both engines use the core optimized
  structured-search design, but keyword ranking and other semantics still
  differ. Do not imply that Java exports `QueryInterpreter`.
- Keep performance evidence out of every opening. HackerNoon and DEV both lead
  with the problem and the author's experience, then the per-field intersection
  objection, KiaraDB, code, the paper's algorithm, and measurements. DEV makes
  the algorithm hands-on with a runnable plain JavaScript implementation. Use the
  2020 static-data paper for the trie, DFS-bound, and pairwise-reduction design,
  not as evidence for every current TS feature.
- HackerNoon and DEV may show sourced TS measurements, labeled with version,
  workload size, p95 methodology, and trade-offs, using different benchmark
  rows so the pieces are not duplicates. Neither makes speed comparisons with
  other databases. Both cite PostgreSQL's documented index combination only to
  explain that per-field indexing is the standard database answer; HackerNoon
  keeps the product name out of its text. Scope any `2^n - 1` index claim to
  exact-key lookup designs.
  Do not turn synthetic results into universal speed guarantees.
- Keep one useful CTA per piece. Do not repeat installation links after every
  section, bury benefits under disclaimers, or publish unsupported superlatives.
- Author must confirm actual affiliation and comply with AI disclosure rules.
  Do not invent personal deployment stories or testimonials.

## Art direction

Keep **seven distinct covers**, plus **two inline HackerNoon engine diagrams**.
Do not turn the diagrams into dense screenshots of source code or paper figures.
Use a consistent dark background, high-contrast type, generous safe margins,
and a different accent/topic per illustration.

| Article | Graphic concept | Proof visible in the image |
|---|---|---|
| A1 | Fields converging on a prepared store and several query paths | One preparation, multiple combinations |
| A2 | Three intersecting requirements feeding a single result | Tags + bounds + stored window |
| A3 | Two bare values resolving into labeled field chips | `active` to status, `emea` to region |
| A4 | Two quantities merging into one canonical condition | `500ms` and `0.5s` to duration <= 0.5 seconds |
| A5 | Correction feeding a filter gate | Corrected keyword does not bypass hard conditions |
| A6 | Ranked candidate cards and separate active/replacement stores | Unique winner vs tie; prepare then activate |
| A7 | Index explosion (combinations vs. per-attribute indexes) cover; inline DFS-bound trie diagram | `2^n - 1` growth; ancestry matching across per-attribute indexes |

Deliver editable SVG and **1600 x 840 PNG** for each. Use PNGs in article embeds
for portability. Check text bounds and render every image; make a contact sheet
for campaign review. These are original technical illustrations, not screenshots.

## Sequence and distribution

1. Publish the flagship on an owned canonical page or submit it to an editorial
   publisher, depending on its current requirements.
2. Release A1 as the short entry point, linking to the flagship or runnable demo.
3. Alternate practical tutorials and short posts: A2, A3, A4, A5, then A6.
4. Avoid posting every near-identical piece to every site at once. Choose relevant
   audiences, adapt intros, disclose affiliation, and use canonical URLs where supported.
5. Measure qualified reading and demo usage, not headline clicks alone: engaged
   reads, repository referrals, CSV-workbench trials where measurable, and useful questions.

Current platform recommendations and policy sources will be researched **after**
the article and graphic production stages, in the [publishing guide](./publishing-guide.md).

## Completion checks

- All C01-C31 claims have a home and a source; unsupported claims are excluded.
- Seven revised articles each pass the first-ten-line contract.
- Runnable snippets reproduce exact output; short query examples are verified.
- Article links, README titles, image paths, and code fences are valid.
- PNGs have exact dimensions and legible, non-overflowing text.
- The final guide names publication options, fit, affiliation/AI rules, and
  what remains for the author before submitting. Nothing is posted automatically.
