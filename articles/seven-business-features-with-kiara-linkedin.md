# Seven Business Features, Not Seven Variations of a Search Box

## What I wanted a Kiara demo to show a developer

A database demonstration can return the right rows and still leave an important
question unanswered:

**"What would I actually build with this in my business application?"**

I wanted the Kiara examples to answer that question.

Not with seven renamed filter forms, but with seven working interactions that
show different capabilities.

The new examples use **Kiara 1.1.0**, TypeScript, and a browser interface where you
can inspect what the system understood and which conditions it applied.

Here is the lineup.

## 1. Product discovery that combines words and requirements

Search the gift catalog for:

> bag

Then add strict filters:

> price<5GBP sold>=100

That returns **115 products** in the bundled snapshot.

The interface combines lexical title matching with explicit numeric constraints,
an optional market facet, and product cards. Unknown strict clauses block the
search rather than being quietly ignored.

**The business use:** help users find products without requiring a separate
navigation journey through every filter.

## 2. Search that does not demand perfect spelling

Type `latern`.

The example shows the correction to `lantern` and returns **20 products**.

Type `decorating`, and English stemming connects it to titles containing words
such as `DECORATION`.

The corrections and tokens are inspectable. This is lexical retrieval, not an
LLM guessing at a customer's meaning.

**The business use:** make product lookup and reference tools more forgiving
without hiding how the search works.

## 3. Compatibility expressed as requirements, not substrings

Suppose an integration must support OAuth and webhooks but must not require an
on-premises agent.

The checker lets users switch between **ALL** and **ANY** required capabilities,
while keeping exclusions explicit.

In its eight fictional teaching fixtures, that switch changes the result from
**2 to 4 connectors** with the same exclusion applied.

**The business use:** compatibility and qualification workflows built around
sets of capabilities.

## 4. Search records whose specifications are ranges

The operating-envelope finder asks a different question:

> Which component ranges cover my entire requested temperature interval?

The source snapshot produces **14 matches** for -40 through 125 Celsius,
**one** at 150, and **none** at 200.

It retains all 16,802 source records, but only 15 have a supported temperature
specification. Missing values remain missing; they are not filled with
plausible defaults. Matches are not engineering certification.

**The business use:** specification lookup where the record describes an
operating interval rather than one measurement.

## 5. Refresh data without activating an incomplete replacement

The catalog-refresh example deliberately tries a broken import.

It is rejected. The active revision remains unchanged.

A valid replacement can then be prepared and explicitly activated together with
a new query interpreter.

Kiara prepares the new store; the application owns validation, the reference
swap, and revision labels. This is not presented as a distributed transaction
system.

**The business use:** refreshable catalogs and imported reference tables with
an understandable failure path.

## 6. Move query execution off the UI thread

The worker example runs the same workload through a main-thread adapter and a
real Web Worker.

Users can compare elapsed time, returned projections, and observed animation
frames. They can also see progress and cancel a worker run.

There is no automatic claim that workers are faster: messaging has overhead,
and workload and tab visibility affect the measurements.

**The business use:** explore browser-side execution trade-offs with actual data
instead of relying on a generic performance claim.

## 7. Try the library with your own CSV

This is the adoption path I find most interesting.

Drop a CSV, review column types, choose indexed fields, prepare a store, and
query it.

Then select projected columns, export matching records, or open the schema in
the IntelliSense-enabled query editor.

Chosen files are processed in the page's memory without uploading their
contents. Leading-zero identifiers stay text by default, and invalid typed
values produce explicit errors.

**The business use:** find out whether Kiara helps with a real export from your
own workflow, not just someone else's sample.

## Real data, with its limitations visible

The retail examples share **3,788 genuine product codes**, derived from all
**541,909 UCI Online Retail transactions**.

The source is from 2010-2011. Prices are historical observed GBP bounds, not live
offers. Units sold are not inventory, and observed countries are not shipping
promises.

The compatibility fixtures are deliberately small and fictional. They do not
claim that real vendors support those capabilities.

Those boundaries make the examples more useful, not less.

The repository's **100 tests pass**, with **100% line, branch, and function
coverage for the new business engine and import helpers**. Browser interactions
and the real worker are checked separately; that is not a blanket claim of
complete UI coverage or production readiness.

## Start with the feature you need to build

Kiara is not being positioned here as a replacement for every primary database,
authorization system, or transactional backend.

The examples show what it can contribute to applications that need useful
querying over an appropriate prepared dataset.

My suggested starting point:

**Try the storefront to understand the experience. Try your own CSV to judge
the relevance.**

Explore and run the examples locally:
[Kiara TypeScript examples](https://github.com/kapoor-labs/kiara-ts-examples).

Install the library:
[Kiara on npm](https://www.npmjs.com/package/@kapoorlabs/kiara-ts).

Retail data attribution:
[Chen, D. (2015), Online Retail, UCI Machine Learning Repository](https://doi.org/10.24432/C5BW33),
licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
