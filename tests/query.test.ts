import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Operator, type Store } from "@kapoorlabs/kiara-ts";
import { BUILT_IN_DATASETS, buildStore, parseDatasetCsv, type PlaygroundDataset } from "../src/datasets.ts";
import { evaluateScript, executeScriptRequest, type AnyRow } from "../src/query.ts";
import { EXAMPLES, exampleScript } from "../src/examples.ts";

const loaded = new Map<string, { dataset: PlaygroundDataset; store: Store<AnyRow> }>();
for (const definition of BUILT_IN_DATASETS) {
  const csv = readFileSync(new URL(`../public/data/${definition.csvFile}`, import.meta.url), "utf8");
  const dataset = parseDatasetCsv(definition, csv);
  loaded.set(definition.id, { dataset, store: buildStore(dataset) });
}
const movie = loaded.get("movie-basic")!;
const airports = loaded.get("airports")!;
const run = (datasetId: string, id: string): unknown => {
  const example = EXAMPLES[datasetId].find((item) => item.id === id);
  assert.ok(example, `Missing example ${datasetId}/${id}`);
  return executeScriptRequest(loaded.get(datasetId)!.store, evaluateScript(exampleScript(example)));
};

test("every built-in loads all original CSV records, not a generated sample", () => {
  assert.equal(loaded.size, 2);
  assert.equal(movie.dataset.rows.length, 5043);
  assert.equal(airports.dataset.rows.length, 7698);
  for (const { dataset, store } of loaded.values()) {
    assert.ok(dataset.rows.length >= 2000);
    assert.equal(store.getLoadedRowCount(), dataset.recordCount);
    assert.equal(store.queryAll().length, dataset.recordCount);
    assert.equal(store.queryAll(20).length, 20);
  }
});

test("bundled CSVs are byte-for-byte upstream snapshots", () => {
  const hashes = {
    "movie_metadata.csv": "a556d7202d9d721e517a18683e87f02706ad9c89527cf85b98c8a5f6487f91f1",
    "airports.csv": "5ed2908a51251940cdd3cd0ef29abc4e4f466a13f9e073945e239509c50bee45",
  };
  for (const [file, expected] of Object.entries(hashes)) {
    const bytes = readFileSync(new URL(`../public/data/${file}`, import.meta.url));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), expected);
  }
});

for (const [datasetId, examples] of Object.entries(EXAMPLES)) {
  for (const example of examples) {
    test(`${datasetId}/${example.id} executes against the complete real dataset`, () => {
      assert.deepEqual(evaluateScript(exampleScript(example)), example.request);
      if (example.error) {
        assert.throws(() => run(datasetId, example.id), /ignoreIndex/);
        return;
      }
      const result = run(datasetId, example.id);
      if (example.request.operation === "diagnostics") {
        const diagnostics = result as { rowCount: number; trie: string; trieLength: number; trieTruncated: boolean };
        assert.equal(diagnostics.rowCount, 5043);
        assert.equal(diagnostics.trie.length, 10_000);
        assert.ok(diagnostics.trieLength > diagnostics.trie.length);
        assert.equal(diagnostics.trieTruncated, true);
      } else if (example.request.operation === "oneEditAway") {
        assert.equal(result, "apollo");
      } else {
        const rows = Array.isArray(result) ? result : (result as { results: unknown[] }).results;
        assert.ok(rows.length > 0, `${example.id} should teach with real matches`);
        if (example.request.limit !== undefined) assert.ok(rows.length <= example.request.limit);
      }
    });
  }
}

test("real movie values and both projection formats are accurate", () => {
  const rows = run("movie-basic", "equal") as AnyRow[];
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, "Cast Away");
  assert.equal(rows[0].rating, 7.7);
  assert.equal(rows[0].year, 2000);
  assert.deepEqual(run("movie-basic", "projection"), [{
    title: "Cast Away", rating: 7.7, imdbLink: rows[0].imdbLink,
  }]);
  assert.deepEqual(run("movie-basic", "legacy"), [{ TITLE: "Cast Away", RATING: "7.7" }]);
  const between = run("movie-basic", "between") as AnyRow[];
  assert.equal(between.length, 11);
  assert.ok(between.some((row) => row.title === "Cast Away"));
  assert.ok(between.some((row) => row.title === "Apollo 13"));
  for (const row of between) {
    assert.ok(Number(row.year) >= 1990 && Number(row.year) <= 2000);
    assert.ok(String(row.actors).split(",").includes("Tom Hanks"));
  }
});

test("keyword examples preserve correction, scoring, stemming and truncation metadata", () => {
  const typo = run("movie-basic", "typo") as { results: AnyRow[]; correctedKeywords: object };
  assert.deepEqual(typo.correctedKeywords, { apolo: "apollo" });
  assert.deepEqual(typo.results.map((row) => row.title), ["Apollo 13", "Apollo 18"]);
  for (const [id, count] of [["keyword-best", 2], ["keyword-minimum", 1]] as const) {
    const result = run("movie-basic", id) as { results: AnyRow[] };
    for (const row of result.results) {
      const tags = String(row.tags).toLowerCase().split(",");
      assert.equal(["adventure", "history"].filter((tag) => tags.includes(tag)).length, count);
    }
  }
  const stemmed = run("movie-basic", "stemming") as { results: AnyRow[]; correctedKeywords: object };
  assert.equal(stemmed.results[0].title, "Cast Away");
  assert.deepEqual(stemmed.correctedKeywords, {});
  const cap = run("movie-basic", "keyword-cap") as { truncated: boolean; usedKeywords: string[] };
  assert.equal(cap.truncated, true);
  assert.deepEqual(cap.usedKeywords, ["adventure", "drama"]);
});

test("derived helpers preserve source facts and calendar-year precision", () => {
  const avatar = movie.dataset.rows[0];
  assert.equal(avatar.title, "Avatar");
  assert.equal(avatar.year, 2009);
  assert.equal(avatar.calendarYearRange, "2009-01-01->2009-12-31");
  assert.equal(avatar.reviewCounts, "723,3054");
  assert.equal(avatar.reviewCountRange, "723->3054");
  assert.equal(avatar.reviewCountRanges, "723->723,3054->3054");
  assert.equal(avatar.yearBand, "Y2009->2009");
  const numeric = run("movie-basic", "numeric-ranges") as AnyRow[];
  assert.deepEqual(numeric.map((row) => row.title), ["Avatar"]);
  for (const id of ["date-between", "date-range", "datetime-range", "date-list", "datetime-list", "date-ranges", "datetime-ranges"]) {
    const rows = run("movie-basic", id) as AnyRow[];
    assert.equal(rows.length, 20);
    assert.ok(rows.every((row) => row.year === 2000), id);
  }
  const missingYear = movie.dataset.rows.find((row) => row.year === null);
  assert.ok(missingYear);
  assert.equal(missingYear.calendarYearStart, null);
  assert.equal(missingYear.yearBand, null);
});

test("source enum, boolean, long, and missing-value examples return the taught values", () => {
  const colors = run("movie-basic", "enum") as AnyRow[];
  assert.ok(colors.every((row) => row.color === "Black and White" && row.isColor === false));
  const gross = run("movie-basic", "long") as AnyRow[];
  assert.equal(gross.length, 6);
  assert.ok(gross.every((row) => typeof row.gross === "number" && row.gross > 500_000_000));
  assert.ok((run("movie-basic", "null") as AnyRow[]).every((row) => row.director === null));
  assert.ok((run("movie-basic", "not-null") as AnyRow[]).every((row) => row.country !== null));
});

test("airport examples reflect source city labels instead of inventing airport names", () => {
  assert.deepEqual(run("airports", "code"), [{ airportName: "New York", countryName: "United States", airportCode: "JFK" }]);
  assert.deepEqual(run("airports", "and"), [{ airportName: "London", countryName: "United Kingdom", airportCode: "LHR" }]);
  assert.ok((run("airports", "country") as AnyRow[]).every((row) => row.countryName === "India"));
  assert.ok((run("airports", "exclude") as AnyRow[]).every((row) => row.countryName !== "United States"));
});

test("dictionary operations return words and respect optional filters", () => {
  const predictions = run("movie-basic", "predict") as string[];
  assert.ok(predictions.includes("apollo"));
  assert.ok(predictions.every((word) => word.startsWith("apo")));
  assert.deepEqual(executeScriptRequest(movie.store, {
    operation: "predict", input: "apo", keywordFields: ["title"],
    conditions: [{ field: "title", values: ["Cast Away"] }],
  }), []);
  assert.throws(() => executeScriptRequest(movie.store, {
    operation: "predict", input: "a", keywordFields: ["imdbLink"],
  }), /indexed text/);
});

test("all operators, field kinds and secondary types remain taught with real rows", () => {
  const examples = Object.values(EXAMPLES).flat();
  assert.equal(examples.length, 44);
  const operators = new Set(examples.flatMap((example) =>
    example.request.conditions?.map((condition) => condition.operator ?? Operator.EQUAL) ?? [],
  ));
  for (const operator of Object.values(Operator)) assert.ok(operators.has(operator), operator);
  const fields = BUILT_IN_DATASETS.flatMap((dataset) => dataset.fields);
  assert.equal(new Set(fields.map((field) => field.kind)).size, 5);
  assert.equal(new Set(fields.flatMap((field) => field.options?.secondaryType ? [field.options.secondaryType] : [])).size, 12);
  const usedFields = new Set(examples.flatMap((example) => example.request.conditions?.map((condition) => condition.field) ?? []));
  for (const field of fields.filter((field) => field.options?.secondaryType)) assert.ok(usedFields.has(field.name), field.name);
});

test("existing script forms, query limits and error reporting remain supported", () => {
  assert.deepEqual(evaluateScript('return [{field:"year", operator:Operator.EQUAL, values:[2000]}];'), {
    operation: "search", conditions: [{ field: "year", operator: "EQUAL", values: [2000] }],
  });
  assert.deepEqual(executeScriptRequest(movie.store, { operation: "queryAll", limit: 0 }), []);
  assert.throws(() => evaluateScript("return 3;"), /must return/);
  assert.throws(() => evaluateScript("return {"), SyntaxError);
  assert.throws(() => executeScriptRequest(movie.store, { operation: "projection" }), /fields/);
  assert.throws(() => executeScriptRequest(movie.store, { operation: "keywordBestMatch" }), /input/);
  assert.throws(() => executeScriptRequest(movie.store, { operation: "search" }), /at least one condition/);
});
