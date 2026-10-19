import assert from "node:assert/strict";
import { test } from "node:test";
import { BUILT_IN_DATASETS, parseDatasetCsv } from "../src/datasets.ts";

const definition = { ...BUILT_IN_DATASETS[1], recordCount: undefined };

test("CSV parser supports BOM, CRLF, quoted commas, escaped quotes and embedded newlines", () => {
  const csv = '\ufeffairportName,country,airportCode\r\n"Alpha, International","A ""quoted"" country",AAA\r\n"Two\nLines",Example,BBB\r\n\r\n';
  assert.deepEqual(parseDatasetCsv(definition, csv).rows, [
    { airportName: "Alpha, International", countryName: 'A "quoted" country', airportCode: "AAA" },
    { airportName: "Two\nLines", countryName: "Example", airportCode: "BBB" },
  ]);
});

test("blank, null and backslash-N cells normalize to null without dropping records", () => {
  assert.deepEqual(parseDatasetCsv(definition, "airportName,country,airportCode\n,null,\\N\n,,\n").rows, [
    { airportName: null, countryName: null, airportCode: null },
    { airportName: null, countryName: null, airportCode: null },
  ]);
});

test("empty, incomplete, duplicate-header and malformed CSVs produce explicit errors", () => {
  assert.throws(() => parseDatasetCsv(definition, ""), /header/);
  assert.throws(() => parseDatasetCsv(definition, "airportName,country\nAlpha,Example"), /missing required column/);
  assert.throws(() => parseDatasetCsv(definition, "airportName,country,country\nAlpha,A,B"), /unique/);
  assert.throws(() => parseDatasetCsv(definition, "airportName,country,airportCode\nAlpha,Example"), /columns/);
  assert.throws(() => parseDatasetCsv(definition, 'airportName,country,airportCode\n"unclosed,Example,AAA'), /Invalid/);
});

test("truncated snapshots fail the required record count instead of loading a small sample", () => {
  assert.throws(() => parseDatasetCsv(BUILT_IN_DATASETS[1], "airportName,country,airportCode\nAlpha,Example,AAA\n"), /Expected 7698 records/);
});

test("invalid numeric source data is rejected, not coerced to zero", () => {
  const numeric = {
    ...definition,
    fields: [{ name: "count", kind: "number" as const, csvColumn: "count" }],
  };
  for (const raw of ["not-a-number", "Infinity", "NaN"]) {
    assert.throws(() => parseDatasetCsv(numeric, `count\n${raw}`), /Invalid number/);
  }
});
