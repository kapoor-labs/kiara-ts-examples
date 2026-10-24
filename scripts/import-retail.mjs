import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import Papa from "papaparse";

const source = "https://archive.ics.uci.edu/static/public/352/data.csv";
const bytes = process.argv[2] ? await readFile(process.argv[2]) : await download(source);
const sha256 = createHash("sha256").update(bytes).digest("hex");
if (sha256 !== "a2f79bbdd4463df6db8a3f5a50b9c980ae8f645a370bf5e2c0d6097f9e817b05") {
  throw new Error("The official source CSV changed; review its provenance before updating the pinned hash.");
}
const parsed = Papa.parse(Buffer.from(bytes).toString("utf8"), { skipEmptyLines: true });
if (parsed.errors.length) throw new Error(JSON.stringify(parsed.errors.slice(0, 3)));
const [headers, ...transactions] = parsed.data;
if (JSON.stringify(headers) !== JSON.stringify([
  "InvoiceNo", "StockCode", "Description", "Quantity", "InvoiceDate", "UnitPrice", "CustomerID", "Country",
])) throw new Error(`Unexpected Online Retail CSV schema: ${JSON.stringify(headers)}`);
if (transactions.length !== 541909) throw new Error("Expected all 541,909 source transactions.");

const products = new Map();
let includedTransactions = 0;
for (const [invoice, stockCode, description, rawQuantity, , rawPrice, , country] of transactions) {
  const quantity = Number(rawQuantity);
  const price = Number(rawPrice);
  const sku = String(stockCode);
  if (!/^\d{5}[A-Z]?$/.test(sku) || String(invoice).toLowerCase().startsWith("c") ||
      typeof description !== "string" || !description.trim() ||
      typeof quantity !== "number" || quantity <= 0 || typeof price !== "number" || price <= 0) continue;
  if (!Number.isFinite(price) || !Number.isSafeInteger(quantity) || typeof country !== "string") {
    throw new Error(`Invalid product transaction: ${sku}`);
  }
  const product = products.get(sku) ?? {
    sku, title: description.trim(), unitPrice: price, maxUnitPrice: price,
    salesRows: 0, unitsSold: 0, markets: new Set(),
  };
  product.unitPrice = Math.min(product.unitPrice, price);
  product.maxUnitPrice = Math.max(product.maxUnitPrice, price);
  product.salesRows++;
  product.unitsSold += quantity;
  product.markets.add(country);
  products.set(sku, product);
  includedTransactions++;
}
const rows = [...products.values()].sort((a, b) => a.sku.localeCompare(b.sku)).map((product) => ({
  ...product, markets: [...product.markets].sort().join(","),
}));
if (rows.length < 3000) throw new Error("Unexpectedly small product catalog.");
const csv = Papa.unparse(rows, { newline: "\n" }) + "\n";
await writeFile(new URL("../public/data/retail-products.csv", import.meta.url), csv);
const metadata = {
  source, sourceSha256: sha256, transactions: transactions.length, includedTransactions,
  products: rows.length, csvSha256: createHash("sha256").update(csv).digest("hex"),
};
await writeFile(new URL("../public/data/retail-products.metadata.json", import.meta.url), JSON.stringify(metadata, null, 2) + "\n");
console.log(metadata);

async function download(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return new Uint8Array(await response.arrayBuffer());
}
