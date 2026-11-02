# Historical gift catalog

Source: Chen, D. (2015), **Online Retail**, UCI Machine Learning Repository,
[DOI: 10.24432/C5BW33](https://doi.org/10.24432/C5BW33).
The dataset covers December 1, 2010 through December 9, 2011 and is distributed
under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
This CSV is an attributed, transformed projection, not the original dataset.

`retail-products.csv` contains **3,788 genuine stock codes**, derived from all
541,909 source transaction rows. It is not generated, padded, or sampled.

Included transactions must have a five-digit product code with an optional
uppercase suffix, a nonempty description, positive quantity and unit price,
and a non-cancellation invoice. Nonmerchandise codes, returns, adjustments,
missing descriptions, and zero-price rows are excluded. 525,462 transactions
remain. Customer and invoice identifiers are not bundled.

For each stock code:
- `title`: first included source description, not a manufactured product name.
- `unitPrice` / `maxUnitPrice`: minimum/maximum observed positive GBP unit prices.
- `salesRows`: count of included transaction rows, not distinct orders.
- `unitsSold`: sum of included positive quantities, **not stock or net sales**.
- `markets`: distinct countries observed on included transactions, **not current shipping availability**.

There are no invented categories, stock quantities, product images, or live prices.
The UI is a storefront interaction demonstration, not a transactional shop.
Prices are historical floating-point source measurements, not an accounting ledger.

Reproduce with Node.js 24+:

```sh
npm run data:retail
```

The importer uses the official UCI CSV export, checks its pinned SHA-256 and
source row count, and writes the projection plus checksums to
`retail-products.metadata.json`. An optional local source path can be passed to
`node scripts/import-retail.mjs PATH`. No additional import dependencies are required.
