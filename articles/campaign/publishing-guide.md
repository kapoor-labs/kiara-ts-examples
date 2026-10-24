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
  action, and cites the 2020 paper. It names no other database products. Check
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
| A7 | [Your Data Has 100 Attributes. How Many Indexes Do You Need?](../kiaradb-local-search-hackernoon.md) | Owned blog / HackerNoon editorial submission | [PNG](../images/hackernoon-index-explosion.png) / [SVG](../images/hackernoon-index-explosion.svg) |

- [Visual gallery](./graphics.html)
- [All covers and the engine explainer on one contact sheet](../images/campaign-contact-sheet.png),
  including the DEV [filter-combinations cover](../images/devto-filter-combinations.png)
- HackerNoon inline diagram: [DFS bounds PNG](../images/hackernoon-trie-bounds.png) /
  [SVG](../images/hackernoon-trie-bounds.svg)
- [Evidence-backed feature inventory](./capability-inventory.md)
- [Editorial plan and capability allocation](./editorial-plan.md)

## DEV-oriented educational draft

[Your Filter UI Has 10 Fields. That's 1,023 Possible Queries.](../kiaradb-composable-filters-devto.md)
is a separate tutorial, not a copy of the HackerNoon story. It follows the same
problem-first arc (the `2^n - 1` growth, the author's travel and e-commerce
experience, the per-field intersection objection, then KiaraDB), but its core
is hands-on: an advanced-filter example checked against a plain JavaScript
filter, and a 40-line plain JavaScript implementation of the paper's numbered
trie whose printed numbers match the reused DFS-bounds diagram. Its benchmark
rows differ from HackerNoon's, and it names no other database products.
It omits the campaign CTA and includes explicit AI disclosures.

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

**Your Data Has 100 Attributes. How Many Indexes Do You Need?**

Alternative hooks for author review:

- **Search by Any Combination of Attributes Without an Index for Each One**
- **The Index Explosion Nobody Warns You About**
- **Ten Attributes, 1,023 Indexes: Why Combination Search Breaks Key-Value Lookups**
- **I Hit the Same Search Problem at Two Global Companies. So I Built a Database.**

The article works backward from the problem: many attributes, unpredictable
combinations, and the `2^n - 1` growth of per-combination lookups. It then
addresses the experienced reader's first objection, "why not one index per
attribute and intersect?", before introducing KiaraDB. The contrast is with
lookup and intersection designs, not a named database product.

Reader-review fixes in this revision:

- Added the per-attribute intersection objection and why ID-set size hurts.
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

Suggested meta description:

> Hundreds of attributes make an index per combination impossible, and
> intersecting per-attribute indexes still builds huge ID sets. A trie with
> numbered paths answers any combination, with Java and TypeScript examples.

The technical foundation is Anuj Kapoor's
[Efficient Storage and Retrieval of In-Memory Static Data](https://journal.ut.ac.ir/article_76227_7508c12200be2eb3f9f16a97aac23a44.pdf),
Journal of Algorithms and Computation, 52(1), 2020, pages 83-96.
Sections 2-4 support the trie, DFS-bound, pairwise reduction, and complexity
explanation. Do not import the paper's cross-database comparisons or equate its
analysis with the current TS benchmark. The inline schematic is original, not a
copied paper figure.

Suggested eight tags, subject to the editor's available tags:

`databases`, `database-indexing`, `typescript`, `java`, `open-source`,
`software-development`, `search`, `software-architecture`.

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
