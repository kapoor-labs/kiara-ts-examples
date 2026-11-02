# Electronic component snapshot

## Source and license

- Project: [dougy83/jlcparts](https://github.com/dougy83/jlcparts), a fork of
  [yaqwsx/jlcparts](https://github.com/yaqwsx/jlcparts).
- Source category: `Capacitors / Multilayer Ceramic Capacitors MLCC - SMD/SMT`.
- Pinned data revision: `169e24011b0832d236a76f9a2504016373505db0`.
- Snapshot commit date: **2024-02-23**.
- [Component source](https://github.com/dougy83/jlcparts/blob/169e24011b0832d236a76f9a2504016373505db0/data/CapacitorsMultilayer_Ceramic_Capacitors_MLCC___SMDakaSMT.json.gz).
- [Stock source](https://github.com/dougy83/jlcparts/blob/169e24011b0832d236a76f9a2504016373505db0/data/CapacitorsMultilayer_Ceramic_Capacitors_MLCC___SMDakaSMT.stock.json).
- The source project's [MIT license](./LICENSE-jlcparts.txt) is retained, from
  source revision `bb27194fdddd416b951a467bff0aa90e54c378ba`.
- Catalog facts originate from JLCPCB/LCSC, as described by the source project.
  No component images or datasheets are bundled.

This is an educational historical snapshot. It is not live stock, an endorsement
of a supplier, a certified specification, or an assertion that a component is
interchangeable or safe for a particular design. The source category contains
outliers; their records are preserved.

## What is bundled

[capacitors.csv](./capacitors.csv) contains **16,802 unique source component IDs**,
one row per source record, without synthetic rows, repetition to inflate counts,
or sampling. Stock is joined by source ID, not fabricated. The importer rejects
missing, negative, or non-integer stock.

The CSV is a projection into 22 fields. All records are retained, but not all
upstream attributes or price tiers are exported. Eighteen fields participate in
query interpretation; description, datasheet URL, original capacitance, and
original allowable-voltage text are retained but not indexed.

| CSV field | Origin / representation |
|---|---|
| `id`, `partNumber` | Source `lcsc`, `mfr` |
| `manufacturer`, `package` | Manufacturer and Package attributes |
| `category` | Source subcategory label, unchanged |
| `capacitance` | Capacitance in canonical farads, normalized as below |
| `voltage` | Allowable voltage attribute, converted to volts |
| `ratedVoltage` | Separate Voltage - rated attribute, converted to volts |
| `acVoltage` | Separate Voltage(ac) attribute, converted to volts |
| `stock` | Quantity in the pinned stock snapshot |
| `dielectric`, `tolerance`, `status`, `library` | Temperature coefficient, Tolerance, Status, Basic/Extended |
| `temperatureRange` | Operating temperature, or Operating temperature range where supplied |
| `subclass`, `packaging`, `minimumOrderQuantity` | Subclass, Packaging, MOQ; absent values stay null |
| `description`, `datasheet` | Source text / URL; no remote resources are fetched by the view |
| `sourceCapacitance`, `sourceVoltage` | Original capacitance value / allowable-voltage text |

## Explicit normalization

The source already converts capacitance to farads, sometimes with binary
multiplication noise such as `1.0000000000000001e-7`. The generated searchable
number uses **15 significant decimal digits** so an exact input such as `100nF`
matches the intended nominal value. The original value is retained separately.
This is representation normalization, not a measured tolerance calculation.

The known record **C710944** contains the literal source string `"NaN"` for
capacitance. Its original string is retained, its searchable capacitance is null,
and the importer emits an explicit warning. Unexpected non-finite values fail
the import. Missing source attributes remain null; the UI identifies unavailable
capacitances rather than replacing them with zero.

Voltage strings are converted from `V`, `mV`, `kV`, or the source's uppercase `KV`.
Source `-` / `null` values are unavailable measurements, not zero.
Outlandish source values are not quietly corrected: users should inspect the
source and verify actual manufacturer specifications.

## Reproduce

From the repository root, with dependencies installed:

```bash
npm run data:capacitors
```

The [import script](../../scripts/import-capacitors.mjs) downloads the immutable
sources, verifies the schema and record count, and writes the CSV and license.
Normal app use fetches only the bundled local CSV, not the upstream service.

SHA-256 checksums:

| File | SHA-256 |
|---|---|
| Generated CSV | `90081bc3bc9b597473ad7dda63b703acedbe1344a5aa095acb566d4d1d2c208c` |
| Compressed source category | `c3806e617c4d59bdcc535fb9fea64cfbf2cfc1149da9e238435624b0252e23a6` |
| Source stock JSON | `f4dc52fc6c40b641cee7d63fb51f905026a0864cc3ad304d34af261a9aa8b344` |

The test suite checks the CSV checksum, row/unique-ID counts, preserved missing
values, exact query counts, unit equivalence, ambiguity handling, and helpers.
