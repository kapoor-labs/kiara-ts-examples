# Build a Runtime Configuration Engine with Kiara and TypeScript

## Explicit wildcard rules, predictable fallbacks, safe updates, and no arbitrary tie-breaking

A configuration value is rarely just a key and a value.

Imagine an airline application calculating a surcharge. There may be a
country default, an airline-specific override, a city-specific override,
and a rule for one exact combination.

An `if` chain can express that today. The harder questions arrive tomorrow:
Which rule won? What happens when two overrides are equally specific?
Can operations replace the configuration without leaving half the rules
updated?

This tutorial builds a small, inspectable runtime configuration engine
with `@kapoorlabs/kiara-ts`. Kiara finds applicable rules. Application code
defines precedence and reports ambiguity explicitly.

The example revisits
[Varun Kapoor's original Java dynamic-configuration article](https://kapoorconsciousnes.medium.com/make-a-runtime-config-engine-with-kiara-in-5-minutes-fb2686dfd848).
The TypeScript version preserves the rule-selection idea, not an
assumption that similarly named Java and TypeScript APIs behave identically.

## Run the interactive version

Clone the
[Kiara TypeScript examples project](https://github.com/kapoor-labs/kiara-ts-examples)
with a current Node.js release:

```bash
git clone https://github.com/kapoor-labs/kiara-ts-examples.git
cd kiara-ts-examples
npm install
npm run dev
```

Open Vite's local URL and choose **Runtime configuration** under
**Application examples**.

You can change country, origin city, and airline; inspect every candidate;
edit the rules as JSON; and apply a complete replacement. There are also
buttons for fallback, global matching, no match, and a deliberate tie.

This is a rules example, not a bulk-data benchmark. Its seven meaningful
configuration rows are intentionally small. The separate movie and
airport query playgrounds still load their complete real CSV datasets.

## Start with an explicit rule model

Each rule contains three matching dimensions and one payload:

```typescript
interface ConfigRule {
  readonly id: string;
  readonly country: string | null;
  readonly originCity: string | null;
  readonly airline: string | null;
  readonly surcharge: number;
}
```

A null dimension means "any value" in this application's rule language.
A non-null dimension must match the corresponding context field.

That wildcard meaning is an application convention. We still need to
express it as a query; Kiara does not infer it from the business domain.

The initial rule set is:

| Rule ID | Country | Origin city | Airline | Surcharge |
|---|---|---|---|---:|
| `india-default` | `in` | null | null | 2.00 |
| `us-default` | `us` | null | null | 1.00 |
| `us-delta` | `us` | null | `dl` | 3.00 |
| `us-nyc` | `us` | `nyc` | null | 2.50 |
| `us-nyc-american` | `us` | `nyc` | `aa` | 4.50 |
| `us-nyc-delta` | `us` | `nyc` | `dl` | 5.50 |
| `worldwide-delta` | null | null | `dl` | 6.00 |

The first six follow the original article's code. The seventh implements
the worldwide Delta rule described in its prose.

Identifiers follow that article: `us`, `nyc`, and `dl`. They are separate
from the airport CSV's country labels. Surcharge units are deliberately
not invented here; the consuming application must define them.

## Index matching dimensions, not the payload

The implementation uses nullable text fields for the three dimensions.
The rule ID and numeric surcharge are retained in records but excluded
from indexes:

```typescript
const ruleSchema = defineSchema<ConfigRule>([
  textField("id", { ignoreIndex: true }),
  textField("country", { nullable: true, caseInsensitive: true }),
  textField("originCity", { nullable: true, caseInsensitive: true }),
  textField("airline", { nullable: true, caseInsensitive: true }),
  numberField("surcharge", { ignoreIndex: true }),
]);
```

This is a schema excerpt; the complete module imports these helpers from
`@kapoorlabs/kiara-ts` and uses the native normalization profile.
That profile retains decimal payloads such as `2.5` and `5.5`.

The payload must not influence rule selection. A surcharge of `6` is not
more specific than a surcharge of `3`, and a descriptive rule ID is not a
matching dimension.

## Find all applicable rules first

For this context:

```json
{
  "country": "us",
  "originCity": "nyc",
  "airline": "dl"
}
```

a rule is applicable when:

```text
(country is "us" OR null)
AND (originCity is "nyc" OR null)
AND (airline is "dl" OR null)
```

Kiara's equality condition accepts multiple alternative values. For
example, the country part is:

```typescript
createCondition<ConfigRule, "country">({
  field: "country",
  values: ["us", null],
});
```

The engine builds one such condition per dimension and passes the array
to `store.search`. Conditions are ANDed; values within each equality
condition are alternatives.

An empty optional city or airline becomes `[null]`, not an unconstrained
dimension. We do not have enough context to apply a city-specific rule
when no city was supplied.

Country is required. Inputs are trimmed and case-normalized. Invalid
context produces an explicit error rather than a guessed answer.

## Then rank by specificity

Specificity is the number of non-null matching dimensions:

```text
us / nyc / dl    -> 3
us / null / dl   -> 2
us / nyc / null  -> 2
us / null / null -> 1
null / null / dl -> 1
```

The engine sorts applicable candidates by decreasing specificity.
Exactly one highest-scoring rule means a match.

This policy is intentionally simple: every dimension contributes one.
There is no hidden preference for airline over city, no priority based on
the surcharge amount, and no "last row wins."

The worked outcomes are:

| Country | City | Airline | Result |
|---|---|---|---|
| `us` | omitted | omitted | `us-default`: 1.00 |
| `us` | omitted | `dl` | `us-delta`: 3.00 |
| `us` | `nyc` | `dl` | `us-nyc-delta`: 5.50 |
| `us` | `bos` | `dl` | `us-delta`: 3.00 |
| `us` | `nyc` | `jb` | `us-nyc`: 2.50 |
| `gb` | `lhr` | `dl` | `worldwide-delta`: 6.00 |
| `gb` | `lhr` | `ba` | No match |

The response includes the winning rule, every applicable candidate with
its specificity, and the active configuration revision. That trace is
what makes "why did this value apply?" answerable.

## A tie is a result, not permission to guess

Remove `us-nyc-delta` and resolve `us / nyc / dl` again.

Two candidates now share the highest specificity:

- `us-delta`, with surcharge `3.00`
- `us-nyc`, with surcharge `2.50`

The engine returns `status: "ambiguous"` and both `tiedRules`. It does not
choose a cheaper rule, a more expensive rule, or the row loaded first.

Rule IDs sort equal-scoring candidates for readable, stable diagnostics.
They do not break a business-rule tie.

The worldwide rule introduces another revealing case: `in / bom / dl`
matches both the India default and worldwide Delta rule at specificity
one. That is also ambiguous under this policy.

If your domain requires a different hierarchy, define it explicitly and
test it. Do not let CSV order become an accidental policy engine.

## Why not call `minimumMatch`?

The Java article uses Java's keyword-matching behavior to select
applicable configuration rules. The TypeScript
`KeywordSearch.minimumMatch` instead selects the lowest positive keyword
score. It is not a drop-in hierarchical resolver.

Keyword search would also obscure field identity: a city token is not a
country merely because the same word appears somewhere in a rule.

Structured conditions preserve that distinction. Specificity ranking
then implements the business policy in plain, inspectable TypeScript.

## A complete script you can run

Save this as `runtime-config-demo.mjs` in the cloned repository's root.
Use Node.js 22.18 or newer for the TypeScript imports.

```javascript
import {
  RuntimeConfigEngine, SAMPLE_CONFIG_RULES,
} from "./src/runtime-config.ts";

const engine = new RuntimeConfigEngine();
const context = { country: "us", originCity: "nyc", airline: "dl" };

const exact = engine.resolve(context);
if (exact.status !== "matched") {
  throw new Error(`Expected a unique match, got ${exact.status}.`);
}
console.log(exact.winner.id, exact.winner.surcharge);
// us-nyc-delta 5.5

const fallback = engine.resolve({
  country: "us", originCity: "bos", airline: "dl",
});
if (fallback.status !== "matched") {
  throw new Error(`Expected a fallback, got ${fallback.status}.`);
}
console.log(fallback.winner.id, fallback.winner.surcharge);
// us-delta 3

const tied = new RuntimeConfigEngine(
  SAMPLE_CONFIG_RULES.filter((rule) => rule.id !== "us-nyc-delta"),
);
console.log(tied.resolve(context).status);
// ambiguous
```

Run it with:

```bash
node --experimental-strip-types runtime-config-demo.mjs
```

`RuntimeConfigEngine` is the example application's policy wrapper, not
an export from the Kiara package itself.

## Replace configuration without partial updates

Runtime editing is not safe if validation mutates the active store one
row at a time.

The example takes a different approach:

1. Validate the complete proposed array.
2. Call `StoreLoader.replaceAll` to construct a new prepared store.
3. Swap the active store only after replacement succeeds.
4. Advance the revision after the swap.

The implementation's update method is:

```typescript
replaceRules(rules: unknown): void {
  const validated = validateRules(rules);
  const replacement = new StoreLoader(this.store).replaceAll(validated);
  this.store = replacement;
  this.currentRevision += 1;
}
```

`validateRules` checks unique nonempty IDs, known property names, explicit
string-or-null dimensions, and finite nonnegative numeric surcharges.
Empty strings are not an alternative spelling of a wildcard; use null.

You can append this to the runnable script:

```javascript
engine.replaceRules(engine.rules.map((rule) =>
  rule.id === "us-nyc-delta" ? { ...rule, surcharge: 7.25 } : rule,
));

const updated = engine.resolve(context);
if (updated.status !== "matched") {
  throw new Error(`Expected an updated match, got ${updated.status}.`);
}
console.log(updated.winner.surcharge, engine.revision);
// 7.25 2

try {
  engine.replaceRules([{ ...SAMPLE_CONFIG_RULES[0], surcharge: -1 }]);
} catch (error) {
  console.error(`Update rejected: ${error.message}`);
}

console.log(engine.revision);
// 2: the rejected update did not advance the revision
```

An empty array is allowed and deliberately produces no matches. A global
all-null rule is also allowed, including a surcharge of zero. Neither
state is silently replaced with a convenient default.

"Atomic" here means a synchronous, in-memory replacement of one engine's
store reference. It does not mean a distributed transaction across
servers or browser tabs.

## What this example does not provide

Changes survive switching between examples in the current page, but not
a reload. This is not a persistence service or a production configuration
control plane.

For a production system, add the pieces your deployment requires:

- Authenticated, authorized updates and an audit trail.
- Durable versioned configuration and rollback.
- A defined policy for no match and ambiguity.
- Validation and publication checks before activating new rules.
- Consistent rollout and version visibility across application instances.
- Server-side enforcement for decisions clients must not override.

Do not put secrets in a browser configuration store. Likewise, a flight
pricing decision that must be authoritative should not trust a
user-editable client calculation.

## Test the policy, not just the happy path

Run:

```bash
npm test
npm run build
```

The configuration tests verify the original worked outcomes, the global
fallback, field-specific matching, normalization, ties independent of row
order, invalid updates retaining the old revision, empty configurations,
and zero-valued payloads.

Those edge cases are part of the engine's contract. A rule system that
only works when every input has one obvious answer is not yet a useful
rule system.

## The takeaway

Kiara handles indexed candidate retrieval. The application remains
responsible for the meaning of a wildcard, precedence, ambiguity, and
safe activation of new rules.

Keeping those responsibilities explicit gives us a runtime
configuration engine that is small enough to understand and predictable
enough to test.

### Further reading

- [Kiara TypeScript on npm](https://www.npmjs.com/package/@kapoorlabs/kiara-ts)
- [Companion examples project](https://github.com/kapoor-labs/kiara-ts-examples)
- [Original Java dynamic-configuration article](https://kapoorconsciousnes.medium.com/make-a-runtime-config-engine-with-kiara-in-5-minutes-fb2686dfd848)
