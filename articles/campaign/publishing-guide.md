# KiaraDB campaign: publication guide and asset index

Policy research checked **2026-10-24**. Platform rules and editorial discretion
can change. These are recommendations, not guarantees of acceptance or reach.
No articles have been submitted or published by this task.

## Package and performance status

The [1.2.0 GitHub release](https://github.com/kapoorlabs/kiara-ts/releases/tag/v1.2.0)
includes the optimized TypeScript engine, but its release notes report npm
publication blocked. The public-registry check in this environment failed its
TLS handshake; it did not independently establish availability.

The drafts therefore keep their **1.1.0 npm installation instructions** and
note that the same outputs passed on **1.1.1-search.0**, the candidate behind
1.2.0. Before publishing, verify the actual distribution path; only update npm
pins after the version is available and the snippets pass against that package.

The DEV and HackerNoon performance tables come from the
[recorded candidate comparison](https://github.com/kapoorlabs/kiara-ts/blob/v1.2.0/docs/search-execution.md#measured-comparison-with-typescript-110).
It is synthetic, old/new TypeScript evidence, not a fresh 1.2.0 benchmark or a
cross-product comparison. Preserve the p95, warm-cache, and memory qualifications.
HackerNoon compares the earlier per-attribute ID-set engine with the tree engine
on the same synthetic four-attribute, 100,000-record dataset. It is framed as
evidence that tree-based combination beats that ID-set implementation, not every
possible intersection strategy. Java was not benchmarked; do not imply that a
hundred-attribute workload was measured.

## Recommended channel order

**Start with an owned blog, LinkedIn, and a substantive Hashnode series.**
Use Medium selectively with AI disclosures. Treat HackerNoon as an editorial
submission. Do not bulk-post this AI-assisted promotional campaign to DEV or
use Hacker News as a marketing feed.

| Priority | Website | Best use for this campaign | Requirements and limits |
|---|---|---|---|
| 1 | Your own project/company blog | Canonical home for A7 and the complete series | Full editorial control. State actual affiliation, keep the technical claims grounded, and make the runnable examples easy to find. Choose a real canonical URL only after publication |
| 1 | [LinkedIn](https://www.linkedin.com/) | A1 and A3 as articles or shortened feed posts linking to a tutorial | Best for professional discovery and an existing network. Upload the PNG, keep the reader benefit in the visible opening, and disclose the relationship to KiaraDB. This is a channel-fit recommendation, not a promise about the algorithm |
| 2 | [Hashnode](https://hashnode.com/) | A2, A4, A5, A6 as a genuine technical series; A7 as overview | Its [Code of Conduct](https://hashnode.com/code-of-conduct) permits reviewed AI-generated content and useful technical references, but prohibits bulk/automated posting, engagement farming, and primarily self-promotional use without community contribution |
| 3 | [Medium](https://medium.com/) | A2/A4 as tutorials; A5/A6 for publications that accept the topic | Its [AI content policy](https://help.medium.com/hc/en-us/articles/22576852947223-Artificial-Intelligence-AI-content-policy) requires disclosure of generated text and image captions. Undisclosed AI text is restricted to network-only distribution. AI-generated writing cannot be paywalled in the Partner Program. Individual publications may be stricter |
| 4 | [HackerNoon](https://hackernoon.com/) | A7, after author review and an editorial-policy check | Use the [submission checklist](https://help.hackernoon.com/submit-a-story-checklist): feature image, meta description, eight tags, rights and vested-interest disclosure. Its [backlink rules](https://help.hackernoon.com/backlinks-guideline) require source diversity and limit promotional links. Confirm how the editor classifies the project/demo links and this AI-assisted draft |
| Hold for these drafts | [DEV Community](https://dev.to/) | Potential future author-led educational contributions, not this promotional rollout unchanged | Its [published AI guidelines](https://dev.to/guidelines-for-ai-assisted-articles-on-dev) say AI-assisted/generated articles should not promote a business, program, or course or primarily build a brand. The [new disclosure controls](https://dev.to/devteam/introducing-ai-disclosure-on-dev-tools-for-nuance-clarity-and-better-feeds-34mk) do not override those standards. Disclosure alone does not make promotional campaign copy compliant |
| Separate launch only | [Hacker News](https://news.ycombinator.com/) | A personally built, usable project submitted by its actual maker, if appropriate | [Guidelines](https://news.ycombinator.com/newsguidelines.html) reject primarily promotional use and generated/AI-edited discussion text. [Show HN](https://news.ycombinator.com/showhn.html) is for something people can try, not a blog post. Do not use generated submission/comment copy or solicit votes |

**DZone:** a plausible audience for Java and backend material, but its
[contributor page](https://dzone.com/pages/contribute) returned HTTP 403 during
this research. Treat it as an unverified future pitch, not a policy-approved
destination. This campaign's runnable samples are TypeScript-library examples;
a Java-specific pitch deserves a genuinely tested Java walkthrough first.

## Important corrections to earlier assumptions

- A catchy article or a particular word count is not "HackerNoon-safe."
  The inspected primary pages establish editorial review, disclosure, and backlink
  requirements; they do **not** establish automatic acceptance of this AI-assisted
  draft. Ask the editor rather than relying on third-party blanket AI claims.
- HackerNoon's inspected backlink guidance says **one promotional brand/personal
  link per 500 words**, not the often-repeated 300-word advice. It also calls for
  reputable external sources and relevant internal HackerNoon links.
- The flagship links the Java and TypeScript repositories as its call to
  action, and cites the 2020 paper and PostgreSQL's documentation on bitmap
  index combination. Its text names no other database product and makes no
  speed comparison. Check
  whether the editor counts both repository links as promotional links.
  Review source diversity and choose genuinely relevant references;
  do not add unrelated citations to satisfy a quota.
- HackerNoon distinguishes personal-blog canonical links from brand accounts
  and does not generally allow canonical links to other blogging/social platforms.
  Do not assume a DEV/Medium-first cross-post can retain its preferred canonical URL.
- DEV explicitly supports [cross-posting and canonical URLs](https://dev.to/help/writing-editing-scheduling),
  but that feature does not exempt a post from its AI/promotion policies.
- This work was substantially drafted with AI assistance. Do not describe it as
  entirely human-written or hide that fact to qualify for a publisher.

## Article-to-channel and asset index

All covers are **1600 x 840 PNGs** with editable SVG counterparts.
Upload the PNG to the publishing platform; a relative repository image URL
will not resolve after pasting Markdown into another site's editor.

| ID | Article | Recommended destination | Cover |
|---|---|---|---|
| A1 | [New Filter Combination? You Shouldn't Need a New Index.](../seven-business-features-with-kiara-linkedin.md) | LinkedIn / owned blog | [PNG](../images/seven-features-linkedin.png) / [SVG](../images/seven-features-linkedin.svg) |
| A2 | [Tags, Dates, and Ranges: Build Richer Filters with KiaraDB](../seven-business-features-with-kiara-medium.md) | Hashnode / Medium | [PNG](../images/seven-features-medium.png) / [SVG](../images/seven-features-medium.svg) |
| A3 | [Type the Value. Let KiaraDB Find the Field.](../filterless-parts-finder-linkedin.md) | LinkedIn / owned blog | [PNG](../images/query-interpretation-linkedin.png) / [SVG](../images/query-interpretation-linkedin.svg) |
| A4 | [500ms or 0.5s? Make Equivalent Queries Return the Same Results.](../filterless-parts-finder-medium.md) | Hashnode / Medium | [PNG](../images/query-interpretation-medium.png) / [SVG](../images/query-interpretation-medium.svg) |
| A5 | [Fix the Typo, Keep the Filter: Better Text Search with KiaraDB](../airport-typeahead-with-kiara-typescript.md) | Hashnode / suitable Medium publication | [PNG](../images/typeahead.png) / [SVG](../images/typeahead.svg) |
| A6 | [Which Rule Won? Query, Explain, and Refresh Configuration with KiaraDB](../runtime-config-with-kiara-typescript.md) | Owned blog / Hashnode | [PNG](../images/runtime-config.png) / [SVG](../images/runtime-config.svg) |
| A7 | [Key-Value Lookups Break Down at 100 Attributes. Here's What I Built Instead.](../kiaradb-local-search-hackernoon.md) | Owned blog / HackerNoon editorial submission | [PNG](../images/hackernoon-index-explosion.png) / [SVG](../images/hackernoon-index-explosion.svg) |

- [Visual gallery](./graphics.html)
- [All covers and the engine explainer on one contact sheet](../images/campaign-contact-sheet.png),
  including the DEV [filter-combinations cover](../images/devto-filter-combinations.png)
- HackerNoon inline diagram: [DFS bounds PNG](../images/hackernoon-trie-bounds.png) /
  [SVG](../images/hackernoon-trie-bounds.svg)
- [Evidence-backed feature inventory](./capability-inventory.md)
- [Editorial plan and capability allocation](./editorial-plan.md)

## DEV-oriented educational draft

[10 Indexes, 1,023 Filter Combinations: Build the Numbered-Tree Trick in JavaScript](../kiaradb-composable-filters-devto.md)
is a separate tutorial, not a copy of the HackerNoon story. It follows a
similar problem-first arc, but its core is hands-on: an advanced-filter example
checked against a plain JavaScript filter, and a 40-line plain JavaScript
implementation of the paper's numbered trie whose printed numbers match the
reused DFS-bounds diagram. Its benchmark rows differ from HackerNoon's.
It omits the campaign CTA and includes explicit AI disclosures.

Technical-accuracy revision: the article no longer implies that 10 fields need
1,023 indexes in general. That holds only for exact-key lookups (hash maps,
key-value caches). Its table compares three strategies for 10 and 20 fields:
exact keys (1,023 / 1,048,575), prefix-only composite ordered indexes with
equality filters (at least 252 / 184,756, the size of the middle layer of
field subsets, which no two indexes can share), and per-field indexes combined
per query (10 / 20). It cites
[PostgreSQL's bitmap index combination](https://www.postgresql.org/docs/current/indexes-bitmap-scans.html)
as a factual example of the per-field approach, not as a performance comparison,
and answers "why not just use the database?" with three reasons: in-process
location, combination cost, and search features that live with the data
(typeahead on every keystroke, stemming, typo correction, and search by value
alone). It concedes that databases offer full-text search too; the argument is
the per-keystroke round trip, not a missing feature. A runnable "Beyond
filters" snippet demonstrates all four on one prepared store. The benchmark caveat states the earlier engine used
JavaScript `Set`s, not compressed bitmaps, and was not compared with a planner.
The article tests verify the 252 lower bound by constructing a covering
decomposition for 10 fields.

**It is not pre-approved for DEV.** The platform's published AI guidelines,
rechecked on 2026-10-24, restrict promoting a business, program, or course.
An educational treatment of KiaraDB does not guarantee an exemption, and
disclosure alone does not resolve the issue. Before publishing, review it
personally and confirm with DEV whether this product-centered tutorial is
acceptable. If not, use an owned blog or another suitable destination instead.
Do not remove the disclosure or misrepresent its authorship.

Suggested editor setup, only if appropriate to publish:

- Tags: `javascript`, `database`, `tutorial`, `algorithms`.
- Use the title field for the article heading; paste the body without a duplicate H1.
- Upload the [filter-combinations PNG](../images/devto-filter-combinations.png)
  as the cover and the [DFS-bounds PNG](../images/hackernoon-trie-bounds.png)
  inline, replacing both local image paths.
- Retain the image caption and AI disclosure; select an accurate AI-disclosure
  tier for the final authorship process, not "Hand Written."
- Add the author's true KiaraDB affiliation, if applicable.
- Set a canonical URL only if a real original publication already exists.

## Benchmark article for developer communities

[KiaraDB vs Fuse.js: Faster Queries or Faster Builds? A Side-by-Side Benchmark](../kiaradb-vs-fusejs-benchmark.md)
is a neutral, third-person comparison of the two libraries only. It discloses
that the author created KiaraDB and that the draft is AI-assisted, gives each
library's advantages and limits equal space, and takes every number from
[the generated benchmark report](../../docs/fuse-comparison.md).

Before publishing:

- **Commit and push** the benchmark scripts, report, and results. The article's
  clone command and report link point to the `main` branch of
  `kapoor-labs/kiara-ts-examples`, which does not contain them yet.
- Numbers cited: typo search 1.95 ms vs 422/601 ms (tuned/default Fuse.js) at
  100,000 products; KiaraDB faster in all 26 exact scenarios Fuse.js can express
  (1.3×-515×); filtered typo search about 4×; build 4.3-7.5 s and 489-871 MB vs
  about 0.3 s and 101-110 MB at 100,000 records (11-25× faster builds, 3-9× less
  memory for Fuse.js). Rerun the benchmark and update these if the engine changes.
- Deliberately excluded: the "lanterns" ratio (KiaraDB returned only two
  records) and the as-you-type ratio (the engines return words versus records).
- Upload the [cover PNG](../images/kiaradb-vs-fusejs.png) and keep the
  disclosure line.

## Launch article: introducing KiaraDB

[Meet KiaraDB: Client-Side Search Up to 500× Faster Than Fuse.js. It's Not Even Close.](../introducing-kiaradb-vs-fusejs.md)
is the openly promotional companion to the neutral comparison. It introduces
KiaraDB's strengths with one runnable snippet, then makes the bold claim on
query speed only, and keeps a short "What the speed costs" section (build time,
memory, snapshots, one-edit correction) so readers who open the report find no
surprises. The title says "client-side search" rather than "typo search" to
reach domain readers who filter structured data; "up to 500×" is the largest
measured gain (515×), so do not shorten it to a flat "500× faster".

- Same prerequisite: **commit and push** the benchmark before publishing.
- Numbers cited, all at 100,000 records against the faster Fuse.js
  configuration: first 20 active 0.15 vs 75 ms (515×; the "up to 500×" title), stemming 1.0 vs 363 ms
  (365×), typo 1.95 vs 422 ms (216×), date equality 0.28 vs
  45 ms (163×), three fields 0.37 vs 47 ms (128×), contains all of two tags 3.2 vs 40 ms (12×);
  26 of 26 shared exact scenarios won, 24-65× per-dataset geometric mean; 66 of
  92 scenarios Fuse.js cannot express; default Fuse.js 0 of 10 relevant on
  `wireles lamp`; build 4.3 s / 489 MB vs 0.27 s / 110 MB, repaid after about
  ten typo searches.
- The snippet runs unchanged on kiara-ts 1.1.0 from npm; the benchmark used
  1.2.0 from GitHub.
- Upload the [hero PNG](../images/kiaradb-vs-fusejs-hero.png) as the cover
  (the [speedup chart](../images/introducing-kiaradb.png) sits inside the
  article) and keep the disclosure line. The same DEV and Reddit self-promotion rules apply, more
  strictly here because the post is promotional.

Channel notes:

- **Owned blog, Hashnode, Medium:** suitable with the disclosure; Medium also
  requires labeling AI-assisted text.
- **DEV:** its AI guidelines restrict AI-assisted posts that promote a project.
  Rewrite substantially in your own words, or confirm with DEV first.
- **Reddit** (r/javascript, r/node, r/typescript): follow each subreddit's
  self-promotion rules, post as the author, and answer questions personally.
- **Hacker News:** submit the runnable repository as a Show HN only if you write
  the post and comments yourself; HN rejects generated or AI-edited discussion.

Suggested tags: `javascript`, `typescript`, `performance`, `search`,
`benchmark`, `opensource`.

## Suggested release sequence

This is a suggested cadence, not an automated posting schedule.

1. **Launch:** publish the reviewed flagship (A7), then share A1 with its diagram
   and one destination link.
2. **Practical proof:** publish A2, focusing on its exact query/output.
3. **Discovery:** share A3, linking to the runnable playground rather than
   repeating the overview pitch.
4. **Precision:** publish A4 and invite real unit/ambiguity use cases.
5. **Search experience:** publish A5, demonstrating typo recovery without
   relaxing requirements.
6. **Operational depth:** publish A6 and explain application/library ownership.

Space the pieces over two to three weeks. Adjust to actual reader questions.
Participate genuinely; do not manufacture testimonials, engagement, or comments.

## HackerNoon submission preparation

Working title:

**Key-Value Lookups Break Down at 100 Attributes. Here's What I Built Instead.**

The breakdown is specific to exact-key lookups, where every combination needs
its own key. The title deliberately does not say databases need `2^n` indexes;
relational databases combine per-attribute indexes, as the article explains.

Alternative hooks for author review, each consistent with the corrected body:

- **100 Attributes, Any Combination, No Database Round Trip**
- **Every New Filter Doubles Your Lookup Keys. Here's How I Stopped Adding Them.**
- **I Hit the Same Search Problem at Two Global Companies. So I Built a Database.**

Retired hooks, because they implied a combinatorial index count in general:
"Your Data Has 100 Attributes. How Many Indexes Do You Need?", "The Index
Explosion Nobody Warns You About", and "Ten Attributes, 1,023 Indexes."

The article works backward from the problem: many attributes, unpredictable
combinations, and the `2^n - 1` growth of exact-key lookups. It then concedes
what databases actually do, one index per attribute combined per query, and
explains why that still did not fit an in-process hot path, before introducing
KiaraDB.

Technical-accuracy revision (matching the DEV fix):

- The `2^n - 1` count is scoped to exact-key lookups. The table adds the
  minimum number of prefix-only composite indexes for equality filters
  (252 / 184,756 / 155,117,520 for 10 / 20 / 30 attributes).
- "The obvious fix" became "What databases do instead," citing documented
  bitmap index combination and calling it the right answer for most
  applications. The reasons it did not fit are location and combination cost.
- The overstated "materialize hundreds of thousands of record IDs" and the
  inconsistent "a million IDs" were replaced with a consistent 400,000-match
  example.
- The benchmark heading and caveat now say the earlier engine used JavaScript
  `Set`s, not compressed bitmaps, and was not compared with a query planner.
- The meta description and TL;DR no longer claim indexing every combination is
  impossible or that per-attribute intersection always builds huge ID sets.

Reader-review fixes in the earlier revision:

- Added the per-attribute index objection and the database alternative.
- Added the in-process latency and read-mostly constraints behind the design.
- Moved code before the algorithm, and explained the algorithm with a
  table-of-contents analogy and a hotel diagram matching the code.
- Reordered example fields so the unique `id` is the last trie level, per the
  Java README's cardinality guidance.
- Replaced isolated timings with a same-library before/after comparison.
- Added update cadence, memory, and package coordinates.

The travel and e-commerce experience is **author-supplied**; employers remain
unnamed by choice. Example queries in that section are framed as illustrative.
Do not add unverified specifics, metrics, or production claims.

Story Settings fields live at the top of the
[HackerNoon draft](../kiaradb-local-search-hackernoon.md), above the title.
Copy them into Story Settings, then paste the body starting from the H1:

- **Meta description** ("Description for Internet Distribution"): 155
  characters. HackerNoon's
  [editors recommend 155-160](https://hackernoon.com/using-hackernoons-story-settings-to-your-advantage-tips-from-hackernoon-editors),
  and it doubles as the social caption.
- **TL;DR:** 450 characters, within the recommended 300-500. It appears in
  HackerNoon newsletters beside the featured image.
- **Story Tags:** all eight were checked against HackerNoon's tag data on
  2026-10-24 (story counts: `database` 730, `data-structures` 173,
  `algorithms` 553, `system-design` 251, `software-architecture` 1,353,
  `java` 980, `typescript` 686, `performance` 440). Narrower tags such as
  `in-memory-database` (2) and `database-indexing` (3) have little audience;
  `trie` does not exist.
- **Emoji Credibility Indicators:** select **Vested Interest** and
  **AI-assisted**, both required for honest disclosure, plus **Academic
  Research Paper** for the cited journal paper. **Code License** is optional.
  Options are from HackerNoon's
  [indicator list](https://help.hackernoon.com/emoji-credibility-indicators).

The technical foundation is Anuj Kapoor's
[Efficient Storage and Retrieval of In-Memory Static Data](https://journal.ut.ac.ir/article_76227_7508c12200be2eb3f9f16a97aac23a44.pdf),
Journal of Algorithms and Computation, 52(1), 2020, pages 83-96.
Sections 2-4 support the trie, DFS-bound, pairwise reduction, and complexity
explanation. Do not import the paper's cross-database comparisons or equate its
analysis with the current TS benchmark. The inline schematic is original, not a
copied paper figure.

The author should supply their real background and connection to the project.
The article includes only the author-supplied travel and e-commerce background.
Explain AI involvement to the editor and confirm whether this draft is acceptable.
Use an actual human-authored contribution if the publisher requires one, rather
than disguising generated prose with cosmetic edits.

## Disclosure and caption templates

Choose wording that accurately describes what the author has actually done.
Do not claim a human review has happened before completing one.

- **Affiliation:** "Disclosure: I [maintain / contribute to / work on] KiaraDB."
  Select only a role that is true; do not publish the bracketed alternatives.
- **AI involvement:** "This article was drafted with AI assistance. The examples
  were executed against the Kiara TS versions identified in the article."
- **After personal review, if true:** "I reviewed the technical claims and
  examples and am responsible for the final text."
- **Graphic caption:** "Original technical illustration created with AI
  assistance; diagram source and PNG export are included in the examples repository."

For Medium, place the writing disclosure within the first two paragraphs,
as its policy recommends, and add an image caption. Preserve the reader-benefit
opening rather than replacing it with a large disclaimer banner.

These graphics are original diagrams, not third-party stock images, product
screenshots, benchmarks, or an official KiaraDB logo.

## Pre-publication checklist

- Confirm the human author's identity, expertise, affiliation, and AI disclosures.
- Read the entire article; verify it reflects what the author can explain.
- Recheck the destination's current rules and any publication-specific restrictions.
- Upload the matched PNG and transfer its descriptive alt text.
- Check the real title/opening at mobile width; source-line tests do not measure
  actual reader attention or a platform's truncation rules.
- Preserve code indentation and run the downloaded example unchanged.
- Keep one primary CTA, not a collection of marketing links.
- Set a canonical URL only when a real source page exists and the destination allows it.
- Keep promotional tracking parameters out of code; no invented traffic claims.

## Reproduction and checks

Regenerate editable graphics and the gallery:

```text
node scripts\generate-article-graphics.mjs
```

The PNGs were rendered with resvg using Segoe UI fonts; no renderer dependency
was added to the application. To update images later, rasterize the regenerated
SVGs at their declared dimensions with resvg or an SVG-capable editor, then
recheck the PNGs. Do not assume a screenshot's CSS size equals its pixel size.

Validate the publication assets and exact code examples:

```text
node --experimental-strip-types --test tests\articles.test.ts
```

The campaign checks are also included in the repository's existing `npm test`
pattern. They execute each article's JavaScript or TypeScript blocks together in
reading order and compare every emitted JSON line with the article's expected
outputs. They also cover short queries, opening placement, Markdown references,
README titles, and every embedded PNG's dimensions, including inline diagrams.
SVG text bounds were checked in a browser; the rasterized illustrations were
visually inspected.

Latest full integration verification: **116 tests passed, zero failed** against
the optimized local candidate, comprising 100 application tests and 16 campaign
checks. The production build also passed with the existing large-chunk warning.
That count predates the later HackerNoon rewrites.

The HackerNoon Java snippet is not run by `npm test`, which has no JDK. It was
compiled for Java 8 and executed against a jar built from the current Java
source (`2.0.13-SNAPSHOT`), with the Hotel class's full constructors and
accessors and `id` declared last. It printed `[h1, h5] [h1, h4]`, matching the
article. The diagram's "Paris + free cancellation" walkthrough (h1, h2) is
asserted against the TypeScript library in the article tests.
