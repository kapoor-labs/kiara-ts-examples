# Your Users Know the Value. Why Must They Find the Filter?

## A practical experiment in making complex catalogs easier to search

Imagine an engineer looking for a capacitor.

They know the capacitance. They know the required voltage. They may also know
the package size, dielectric, and minimum stock quantity.

But before they can find a component, the website asks them to do another job:
find the right controls.

Open the capacitance filter. Scroll through values. Locate the voltage field.
Find the package dropdown. Apply an inventory constraint.

The user understands the requirement. The interface makes them translate it into
its layout.

I wanted to explore a different starting point: **let users type what they know,
then make the interpretation visible.**

## A parts finder with one input

The result is **Filterless Parts Finder**, built with Kiara 1.1.0.

It loads a real CSV containing **16,802 component records** from a historical
JLCParts snapshot.

Instead of hunting through the filter panel, a user can enter:

> cap:10uF voltage>=25V

The interface resolves the capacitance alias, converts the quantity into its
canonical unit, and applies an explicit voltage comparison.

On the bundled dataset, that query returns **272 matches**.

Now change the input to:

> cap:10000nF voltage>=25V

The result is the **same 272 matches**.

Another example needs no field names:

> ceramic samsung X7R

Configured category and manufacturer aliases, together with whole-value
discovery, resolve those terms into filters across different fields. That query
returns **396 matches**.

The application shows active filter chips, matching records, and the generated
Kiara conditions. Users can inspect what happened rather than trusting an
unexplained interpretation.

## The most useful feature may be knowing when to ask

What should happen when someone types:

> 25V

This catalog has separate allowable-voltage, rated-voltage, and AC-voltage
fields.

Choosing one automatically would be convenient, but it would also be a guess.

The interface asks which field the user means. After confirmation, it rewrites
the fragment as an explicit field expression.

Even a familiar value can be ambiguous. `0603` is a package code, but the same
snapshot also has a stock quantity of 603.

That is why I would rather have a small confirmation step than a quietly wrong
filter.

## This is not an LLM guessing at specifications

The interpretation is deterministic and schema-aware.

Field aliases are declared. Unit conversions are declared. Indexed values help
identify candidate fields. Comparisons and ranges use explicit syntax.

For example, `voltage>=25V` means a minimum. A bare `25V` does not silently
become "at least 25 volts."

If part of the input is unresolved, the application withholds results instead
of applying only the clauses it understood.

That boundary is important in industrial software. A plausible-looking answer
is not enough if the system ignored part of the requirement.

## Keep the familiar controls, too

The traditional filter panel is still available.

It shares the same query state with the input and chips:

- Typing updates the interpreted filters.
- Removing a chip edits the input.
- Editing a chip selects the original expression.
- Changing a traditional control rewrites that field's constraints.

This is not about forcing everyone to learn a new interaction. It gives
experienced users a faster way to express a requirement without removing the
familiar alternative.

## A few boundaries worth stating

The demo has **22 fields, 18 searchable**. It does not manufacture a hundred
attributes for a headline.

The data is a **February 23, 2024 snapshot**, not live inventory, and it includes
missing specifications and source outliers. Search results are not a
certification that a component is suitable for a circuit.

The finder engine has **100% line, branch, and function coverage**, and the
repository's 86-test suite passes. That coverage claim is for the new engine
and shared helpers; the UI is browser-checked separately.

There is no universal speed claim here. What matters first is a predictable,
explainable contract between the user's input and the filters applied.

## The bigger opportunity

Many websites make users navigate a filter system before they can express a
requirement.

Component catalogs are one example. Industrial inventory and equipment
directories have the same opportunity.

The principle is simple:

**Let people start with what they know. Show what the system understood. Ask
about the rest.**

That feels like a better direction than adding another dropdown.

Explore the code and run the demo locally:
[Kiara TypeScript examples](https://github.com/kapoor-labs/kiara-ts-examples).

The interpretation API is available in
[Kiara 1.1.0](https://www.npmjs.com/package/@kapoorlabs/kiara-ts/v/1.1.0).
