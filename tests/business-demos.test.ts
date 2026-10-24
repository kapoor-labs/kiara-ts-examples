import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { InMemoryWorkerAdapter, KeywordSearch } from "@kapoorlabs/kiara-ts";
import {
  FEATURE_DEMOS, RETAIL_DEFINITION, CatalogSnapshots, benchmarkRequest, connectorStore,
  discoverProducts, importCsv, inspectCsv, isFeatureDemo, isRecord, matchConnectors,
  matchOperatingRange, operatingStore, productInterpreter, validateIterations, validateRetailRows,
} from "../src/business-demos.ts";
import { buildStore, parseDatasetCsv } from "../src/datasets.ts";
import { PARTS_DEFINITION } from "../src/parts-finder.ts";

const retailCsv = readFileSync(new URL("../public/data/retail-products.csv", import.meta.url), "utf8");
const retail = parseDatasetCsv(RETAIL_DEFINITION, retailCsv);
const store = buildStore(retail);
const products = store.queryAll();
const search = new KeywordSearch(store);
const names = (rows: readonly Record<string, unknown>[]) => rows.map((row) => row.name);

test("all seven distinct demos are registered", () => {
  assert.equal(FEATURE_DEMOS.length, 7);
  assert.equal(new Set(FEATURE_DEMOS.map((demo) => demo.id)).size, 7);
  assert.equal(isFeatureDemo("product-discovery"), true);
  assert.equal(isFeatureDemo("not-a-demo"), false);
  assert.equal(isRecord({}), true);
  for (const value of [null, [], "", 2]) assert.equal(isRecord(value), false);
});
test("retail provenance, complete projection, and source identity are pinned", () => {
  const metadata = JSON.parse(readFileSync(new URL("../public/data/retail-products.metadata.json", import.meta.url), "utf8"));
  assert.equal(metadata.transactions, 541909);
  assert.equal(metadata.includedTransactions, 525462);
  assert.equal(metadata.products, 3788);
  assert.equal(metadata.csvSha256, "08ee2f3bd9316c8f158c0dc78b00e171ee0302b6c3797d0aa1ea259d2f9d7253");
  assert.equal(createHash("sha256").update(retailCsv).digest("hex"), metadata.csvSha256);
  assert.equal(products.length, 3788);
  assert.equal(new Set(products.map((row) => row.sku)).size, 3788);
  assert.equal(products.reduce((sum, row) => sum + Number(row.salesRows), 0), 525462);
  assert.deepEqual(validateRetailRows(products), products);
});
test("product discovery combines strict clauses, full keyword totals, and real market membership", () => {
  assert.equal(productInterpreter(store), productInterpreter(store));
  const result = discoverProducts(store, "bag", "price<5GBP sold>=100");
  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;
  assert.ok(result.rows.length > 100, "Totals must not be silently capped by KeywordSearch's default 100.");
  assert.ok(result.rows.every((row) => Number(row.unitPrice) < 5 && Number(row.unitsSold) >= 100));
  const german = discoverProducts(store, "bag", "price<5GBP", "Germany");
  assert.equal(german.status, "ready");
  if (german.status === "ready") {
    assert.ok(german.rows.length > 0);
    assert.ok(german.rows.every((row) => String(row.markets).split(",").includes("Germany")));
  }
  const exact = discoverProducts(store, "", "price:1GBP");
  assert.equal(exact.status, "ready");
  if (exact.status === "ready") assert.ok(exact.rows.every((row) => row.unitPrice === 1));
  const all = discoverProducts(store, " ", "");
  assert.equal(all.status, "ready");
  if (all.status === "ready") assert.equal(all.rows.length, 3788);
});
test("unresolved strict filters block search rather than showing partial results", (context) => {
  const spy = context.mock.method(store, "search");
  for (const input of ["nonesuch:3", "price:banana", "price<5GBP unknownword"]) {
    const result = discoverProducts(store, "bag", input);
    assert.equal(result.status, "blocked");
    assert.equal("rows" in result, false);
  }
  assert.equal(spy.mock.callCount(), 0);
  assert.throws(() => discoverProducts(store, "one two three four five six seven eight nine ten eleven", ""), /10 distinct/);
});
test("real title corpus demonstrates actual correction and stemming, not semantic guesses", () => {
  const typo = search.bestMatch("latern", { fields: ["title"], limit: products.length });
  assert.deepEqual(typo.correctedKeywords, { latern: "lantern" });
  assert.equal(typo.results.length, 20);
  const stemmed = search.bestMatch("decorating", { fields: ["title"], limit: products.length });
  assert.deepEqual(stemmed.correctedKeywords, {});
  assert.ok(stemmed.results.length > 100);
  assert.ok(stemmed.results.some((row) => String(row.title).includes("DECORATION")));
  assert.equal(search.bestMatch("zzzzzzzx", { fields: ["title"] }).results.length, 0);
});
test("set requirements distinguish ALL, ANY, exclusion, missing, and unconstrained", () => {
  const connectors = connectorStore();
  assert.deepEqual(names(matchConnectors(connectors, ["OAuth", "Webhooks"], "all", ["On-prem agent"]).rows), ["Aster", "Birch"]);
  assert.deepEqual(names(matchConnectors(connectors, ["OAuth", "Webhooks"], "any", ["On-prem agent"]).rows), ["Aster", "Birch", "Delta", "Grove"]);
  assert.equal(matchConnectors(connectors, [], "all", []).rows.length, 8);
  assert.ok(matchConnectors(connectors, [], "all", ["On-prem agent"]).rows.every((row) => !String(row.capabilities).includes("On-prem agent")));
  assert.throws(() => matchConnectors(connectors, ["Invented"], "all", []), /supported capability/);
  assert.throws(() => Reflect.apply(matchConnectors, undefined, [connectors, [], "invalid", []]), /ALL or ANY/);
});
test("actual source ranges preserve missing values and match inclusive endpoints", () => {
  const parts = parseDatasetCsv(PARTS_DEFINITION, readFileSync(new URL("../public/data/capacitors.csv", import.meta.url), "utf8"));
  const ranges = operatingStore(parts.rows);
  assert.equal(ranges.store.getLoadedRowCount(), 16802);
  assert.deepEqual([ranges.parsed, ranges.missing, ranges.unrecognized], [15, 16787, 0]);
  assert.equal(matchOperatingRange(ranges.store, -55).rows.length, 15);
  assert.equal(matchOperatingRange(ranges.store, -40, 125).rows.length, 14);
  assert.equal(matchOperatingRange(ranges.store, 150).rows.length, 1);
  assert.equal(matchOperatingRange(ranges.store, 155).rows.length, 1);
  assert.equal(matchOperatingRange(ranges.store, 156).rows.length, 0);
  for (const [lower, upper] of [[NaN, 1], [0, Infinity], [2, 1]]) {
    assert.throws(() => matchOperatingRange(ranges.store, lower, upper), /finite temperatures/);
  }
});
test("unsupported source range notation is reported, never guessed", () => {
  const ranges = operatingStore([{ id: "unknown", temperatureRange: "approximately warm" }, { id: "missing" }]);
  assert.deepEqual([ranges.parsed, ranges.missing, ranges.unrecognized], [0, 1, 1]);
  assert.equal(matchOperatingRange(ranges.store, 20).rows.length, 0);
  assert.throws(() => operatingStore([{ id: "reversed", temperatureRange: "+125\u2103~-55\u2103" }]), /Reversed/);
});
test("prepared replacement is isolated until explicit activation, including interpreters", () => {
  const snapshots = new CatalogSnapshots(store);
  assert.equal(snapshots.hasStaged, false);
  assert.throws(() => snapshots.activate(), /Prepare a valid/);
  const previousInterpreter = snapshots.interpreter;
  const originalPrice = products[0].unitPrice;
  const changed = products.map((row, index) => index === 0 ? { ...row, unitPrice: 0.5 } : row);
  snapshots.stage(changed);
  assert.equal(snapshots.hasStaged, true);
  assert.equal(snapshots.revision, 1);
  assert.equal(snapshots.store.queryAll()[0].unitPrice, originalPrice);
  snapshots.activate();
  assert.equal(snapshots.revision, 2);
  assert.equal(snapshots.hasStaged, false);
  assert.equal(snapshots.store.queryAll()[0].unitPrice, 0.5);
  assert.equal(store.queryAll()[0].unitPrice, originalPrice);
  assert.notEqual(snapshots.interpreter, previousInterpreter);
  assert.equal(previousInterpreter.search('sku:"10002"')[0].unitPrice, originalPrice);
  assert.equal(snapshots.interpreter.search('sku:"10002"')[0].unitPrice, 0.5);
  snapshots.stage(changed);
  assert.throws(() => snapshots.stage([{ ...products[0], unitPrice: "wrong" }]), /positive finite/);
  assert.equal(snapshots.hasStaged, false);
  assert.equal(snapshots.revision, 2);
});
test("invalid replacement shapes and fields are rejected before changing active data", () => {
  for (const value of [null, {}, [], [null], [42]]) assert.throws(() => validateRetailRows(value));
  for (const name of ["sku", "title", "markets"]) {
    for (const value of ["", " ", null, 4]) assert.throws(() => validateRetailRows([{ ...products[0], [name]: value }]), /nonempty text/);
  }
  for (const name of ["unitPrice", "maxUnitPrice", "salesRows", "unitsSold"]) {
    for (const value of [-1, 0, NaN, Infinity, "1"]) assert.throws(() => validateRetailRows([{ ...products[0], [name]: value }]), /positive finite/);
  }
  assert.throws(() => validateRetailRows([products[0], products[0]]), /Duplicate SKU/);
  for (const patch of [{ salesRows: 1.5 }, { unitsSold: 1.5 }, { unitPrice: 1000 }]) {
    assert.throws(() => validateRetailRows([{ ...products[0], ...patch }]), /invalid counts or reversed/);
  }
});
test("worker benchmark requests execute through the actual Kiara adapter", async () => {
  const adapter = new InMemoryWorkerAdapter(new Map([["retail", store]]));
  assert.equal(validateIterations(1), 1);
  assert.equal(validateIterations(2000), 2000);
  assert.equal(benchmarkRequest(3, "second-run").requestId, "second-run-3");
  for (const value of [0, -1, 2001, 1.5, NaN, Infinity]) assert.throws(() => validateIterations(value), /repetitions/);
  const first = await adapter.execute(benchmarkRequest(0));
  const second = await adapter.execute(benchmarkRequest(1));
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  if (first.ok && second.ok) {
    assert.deepEqual(first.result, second.result);
    assert.equal(Array.isArray(first.result) && first.result.length, 25);
    assert.deepEqual(Object.keys(first.result[0]), ["sku", "unitPrice"]);
  }
});
test("CSV inference examines the full column and preserves identifiers", () => {
  const inspected = inspectCsv('id,large,amount,active,tags,blank,mixed\n00123,9007199254740993,1.25,TRUE,"a,b",,1\n00456,9007199254740994,-2,false,a,\\N,text');
  assert.deepEqual(inspected.guesses.map((mapping) => mapping.type), ["text", "text", "number", "boolean", "text", "text", "text"]);
  const mappings = inspected.guesses.map((mapping) => mapping.header === "tags" ? { ...mapping, type: "strings" as const } : mapping);
  const dataset = importCsv(inspected, mappings, "Private file.csv");
  assert.equal(dataset.id, "uploaded-dataset");
  assert.equal(dataset.rows[0].id, "00123");
  assert.equal(dataset.rows[0].large, "9007199254740993");
  assert.equal(dataset.rows[0].active, true);
  assert.equal(dataset.rows[1].active, false);
  assert.equal(dataset.rows[0].blank, null);
  assert.equal(dataset.rows[1].blank, null);
  const prepared = buildStore(dataset);
  assert.equal(prepared.search([{ field: "tags", operator: "CONTAINS_ALL", values: ["a", "b"] }]).length, 1);
  assert.deepEqual(prepared.searchProjection([{ field: "amount", operator: "LESS_THAN", values: [0] }], ["id", "active"]), [{ id: "00456", active: false }]);
});
test("CSV schema review is explicit and malformed rows fail with useful errors", () => {
  for (const csv of ["", "a", "a,a\n1,2", "a, a \n1,2", "a,\n1,2", 'a,b\n"unclosed,2', "a,b\n1"]) assert.throws(() => inspectCsv(csv));
  for (const header of ["__proto__", "constructor", "prototype"]) assert.throws(() => inspectCsv(`${header}\nx`), /reserved/);
  assert.throws(() => inspectCsv("x".repeat(10 * 1024 * 1024 + 1)), /10 MiB/);
  assert.throws(() => inspectCsv("a\n" + "1\n".repeat(50001)), /50,000/);
  assert.throws(() => inspectCsv(Array.from({ length: 101 }, (_, i) => `c${i}`).join(",") + "\n1"), /1-100/);
  const inspected = inspectCsv("n,flag\n0x10,yes");
  assert.throws(() => importCsv(inspected, [], "Bad"), /one valid mapping/);
  assert.throws(() => importCsv(inspected, [...inspected.guesses].reverse(), "Bad"), /one valid mapping/);
  assert.throws(() => Reflect.apply(importCsv, undefined, [inspected, inspected.guesses.map((mapping) => ({ ...mapping, type: "bad" })), "Bad"]), /one valid mapping/);
  assert.throws(() => Reflect.apply(importCsv, undefined, [inspected, inspected.guesses.map((mapping) => ({ ...mapping, indexed: "yes" })), "Bad"]), /one valid mapping/);
  assert.throws(() => importCsv(inspected, inspected.guesses.map((mapping) => ({ ...mapping, type: "number" })), "Bad"), /finite, safely represented/);
  assert.throws(() => importCsv(inspected, inspected.guesses.map((mapping) => ({ ...mapping, type: "boolean" })), "Bad"), /use true or false/);
});
test("empty cells, ignored fields, valid decimals, booleans, and deliberate text types survive import", () => {
  const inspected = inspectCsv("n,flag,note\n1.5,true,hello\nnull,null,world\n\\N,false,42\n.5,TRUE,bye");
  const mappings = inspected.guesses.map((mapping) => mapping.header === "note" ? { ...mapping, indexed: false } : mapping);
  const dataset = importCsv(inspected, mappings, "Local");
  assert.equal(dataset.rows[1].n, null);
  assert.equal(dataset.rows[1].flag, null);
  assert.equal(dataset.rows[3].n, 0.5);
  const prepared = buildStore(dataset);
  assert.deepEqual(prepared.searchProjection([{ field: "flag", operator: "EQUAL", values: [false] }], ["note"]), [{ note: "42" }]);
  assert.throws(() => prepared.search([{ field: "note", operator: "EQUAL", values: ["42"] }]), /ignored|index/i);
  const text = inspectCsv("amount\n001");
  assert.equal(importCsv(text, text.guesses, "ID").rows[0].amount, "001");
  assert.equal(importCsv(text, [{ ...text.guesses[0], type: "number" }], "Number").rows[0].amount, 1);
  for (const raw of ["Infinity", "9007199254740993", "1e400"]) {
    const invalid = inspectCsv(`amount\n${raw}`);
    assert.throws(() => importCsv(invalid, [{ ...invalid.guesses[0], type: "number" }], "Bad"), /safely represented/);
  }
});
