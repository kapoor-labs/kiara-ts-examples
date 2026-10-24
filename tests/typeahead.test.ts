import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { BUILT_IN_DATASETS, buildStore, parseDatasetCsv } from "../src/datasets.ts";
import { AirportTypeahead, type AirportScope } from "../src/typeahead.ts";

const definition = BUILT_IN_DATASETS.find((dataset) => dataset.id === "airports")!;
const csv = readFileSync(new URL("../public/data/airports.csv", import.meta.url), "utf8");
const store = buildStore(parseDatasetCsv(definition, csv));
const engine = new AirportTypeahead(store);

test("type-ahead indexes all 7,698 real airport rows once and honors the suggestion limit", () => {
  assert.equal(engine.recordCount, 7698);
  for (const limit of [1, 3, 5]) {
    const predictions = engine.suggest("lon", "airportName", limit);
    assert.equal(predictions.length, limit);
    assert.ok(predictions.every((prediction) => prediction.kind === "prefix" && prediction.word.startsWith("lon")));
    assert.equal(new Set(predictions.map((prediction) => prediction.value)).size, predictions.length);
  }
  assert.deepEqual(engine.suggest("lon"), engine.suggest("lon"));
});

test("countries, codes and names have separate field-specific dictionaries", () => {
  assert.deepEqual(engine.suggest("jf", "airportCode"), [
    { word: "jfk", value: "jfk", kind: "prefix" },
    { word: "jfr", value: "jfr", kind: "prefix" },
  ]);
  assert.deepEqual(engine.suggest("jf", "countryName"), []);
  assert.ok(engine.suggest("united", "countryName").every((prediction) => prediction.word.startsWith("united")));
  assert.ok(engine.suggest("london", "airportName").some((prediction) => prediction.word === "london"));
});

test("multi-word suggestions replace only the last word and normalize whitespace/case", () => {
  assert.deepEqual(engine.suggest("  UNITED   STA ", "countryName"), [
    { word: "states", value: "united states", kind: "prefix" },
  ]);
});

test("one-edit correction is a fallback, and short/nonmatching inputs do not invent suggestions", () => {
  assert.deepEqual(engine.suggest("londn", "airportName"), [
    { word: "london", value: "london", kind: "correction" },
  ]);
  assert.ok(engine.suggest("lond", "airportName").every((prediction) => prediction.kind === "prefix"));
  assert.deepEqual(engine.suggest("?", "airportName"), []);
  assert.deepEqual(engine.suggest("zzzzzzzzzzzz", "airportName"), []);
  assert.deepEqual(engine.suggest("   "), []);
});

test("a chosen completion is resolved to records with a separate keyword search", () => {
  const results = engine.search("london", "airportName");
  assert.ok(results.results.length > 0);
  assert.ok(results.results.every((row) => String(row.airportName).toLowerCase().split(" ").includes("london")));
  assert.deepEqual(engine.search("JFK", "airportCode").results, [
    { airportName: "New York", countryName: "United States", airportCode: "JFK" },
  ]);
  assert.deepEqual(engine.search("zzzzzzzzzzzz", "airportName").results, []);
});

test("type-ahead rejects invalid limits, scopes, excessive input and keyword counts explicitly", () => {
  for (const limit of [0, -1, 11, 1.5, NaN]) {
    assert.throws(() => engine.suggest("lon", "all", limit), /between 1 and 10/);
    assert.throws(() => engine.search("lon", "all", limit), /between 1 and 10/);
  }
  assert.throws(() => engine.suggest("", "missing" as AirportScope), /Unknown airport field/);
  assert.throws(() => engine.search("lon", "missing" as AirportScope), /Unknown airport field/);
  assert.throws(() => engine.suggest("a".repeat(129)), /128 characters/);
  assert.throws(() => engine.search("a b c d e f g h i j k"), /at most 10/);
  assert.doesNotThrow(() => engine.suggest("a".repeat(128)));
});
