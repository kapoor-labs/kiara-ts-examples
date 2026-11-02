import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as baseline from "@kapoorlabs/kiara-ts";
import { loadDataset } from "./fuse-benchmark/datasets.mjs";
import { kiaraField, kiaraValue, kiaraCondition } from "./fuse-benchmark/engines.mjs";

if (!process.argv[2]) throw new Error("Usage: node scripts/check-search-candidate.mjs <candidate dist/index.js>");
const candidate = await import(pathToFileURL(resolve(process.argv[2])).href);
const limits = [undefined, 0, 1, 7, 2.5, -1, Infinity, NaN];
let checks = 0;
let seed = 20261101;
function random(size) {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return (seed >>> 8) % size;
}
function capture(action) {
  try { return { value: action() }; }
  catch (error) {
    if (!(error instanceof Error)) throw error;
    return { error: { name: error.name, message: error.message, code: error.code, details: error.details } };
  }
}
function compare(label, oldAction, newAction) {
  assert.deepStrictEqual(capture(newAction), capture(oldAction), label);
  checks++;
}
function pair(schema, rows, profile) {
  return [baseline, candidate].map((api) => {
    const store = new api.Store(schema, { normalizationProfile: profile });
    store.loadRows(rows);
    store.prepare();
    return store;
  });
}

for (const name of ["retail-3788", "catalog-10000", "catalog-100000", "schedule-10000", "schedule-100000"]) {
  const dataset = loadDataset(name);
  const schema = baseline.defineSchema(dataset.fields.map(kiaraField));
  const rows = dataset.rows.map((row) => Object.fromEntries(dataset.fields.map(
    (field) => [field.name, kiaraValue(field, row[field.name])],
  )));
  for (const profile of Object.values(baseline.NormalizationProfile)) {
    const stores = pair(schema, rows, profile);
    for (const workload of dataset.workloads.filter((item) => item.kind === "exact")) {
      const conditions = workload.where.map(kiaraCondition);
      for (const ordered of [conditions, [...conditions].reverse()]) {
        for (const limit of limits) {
          const run = (store) => workload.projection
            ? store.searchProjection(ordered, workload.projection, limit)
            : store.search(ordered, limit).map((row) => row.id);
          compare(`${name}/${profile}/${workload.id}/${limit}`, () => run(stores[0]), () => run(stores[1]));
        }
      }
    }
  }
  console.log(`${name}: ordered results, projections, limits, both profiles agree`);
}

const schema = baseline.defineSchema([
  baseline.textField("a", { nullable: true }),
  baseline.numberField("n", { nullable: true }),
  baseline.textField("tags", { secondaryType: "commaSeparatedStrings", nullable: true }),
  baseline.textField("span", { secondaryType: "numericRange", nullable: true }),
  baseline.textField("spans", { secondaryType: "commaSeparatedNumericRanges", nullable: true }),
  baseline.textField("title", { stemmedIndex: true }),
  baseline.textField("other"),
  baseline.numberField("id"),
  baseline.textField("ignored", { ignoreIndex: true }),
]);
const rows = Array.from({ length: 512 }, (_, id) => ({
  a: id % 9 ? ["red", "blue", "green"][random(3)] : null,
  n: id % 11 ? random(51) - 25 : null,
  tags: id % 7 ? ["red,blue", "blue,red", "red", "blue,blue", "green", ""][random(6)] : null,
  span: id % 13 ? ["-20->0", "0->20", "-10->10", "5->5"][random(4)] : null,
  spans: id % 17 ? ["-20->0,0->20", "0->20,0->20", "5->5,-10->10"][random(3)] : null,
  title: `${["red", "blue", "green"][random(3)]} ${["skies", "running", "news", "run"][random(4)]} item ${id}`,
  other: ["red blue", "red", "green skies", "item"][random(4)],
  id, ignored: "x",
}));
rows.push(rows[4], { ...rows[4] });
const O = baseline.Operator;
const pool = [
  ...["a", "n", "tags", "span", "spans"].flatMap((field) =>
    [O.EQUAL, O.NOT_EQUAL, O.CONTAINS_ALL, O.CONTAINS_EITHER, O.NOT_CONTAINS, O.CONTAINS_EITHER_INCLUDING_NULL]
      .flatMap((operator) => [[], [null], ["red"], ["red", "blue"], [0], [-5, 5]].map((values) =>
        ({ field, operator, values })))),
  ...[O.LESS_THAN, O.LESS_THAN_EQUAL, O.GREATER_THAN, O.GREATER_THAN_EQUAL]
    .flatMap((operator) => [-25, 0, 25].map((value) => ({ field: "n", operator, values: [value] }))),
  ...[[-5, 5], [5, -5], [-100, 100]].map(([lowerValue, upperValue]) =>
    ({ field: "n", operator: O.BETWEEN, lowerValue, upperValue })),
  { field: "a", operator: O.EQUAL, values: ["absent"] },
  { field: "ignored", operator: O.EQUAL, values: ["x"] },
  { field: "unknown", operator: O.EQUAL, values: ["x"] },
];
const schemaOrders = [schema, baseline.defineSchema([...schema.fields].reverse()),
  baseline.defineSchema([...schema.fields.filter((field) => field.name === "id"),
    ...schema.fields.filter((field) => field.name !== "id")])];
const configurations = Object.values(baseline.NormalizationProfile).flatMap((profile) =>
  schemaOrders.map((shape, order) => ({ profile, shape, order })));
for (const { profile, shape, order } of configurations) {
  const stores = pair(shape, rows, profile);
  for (let i = 0; i < 2500; i++) {
    const conditions = Array.from({ length: 1 + random(5) }, () => pool[random(pool.length)]);
    const limit = limits[random(limits.length)];
    compare(`random/${profile}/schema-${order}/${i}/${JSON.stringify(conditions)}`,
      () => stores[0].searchProjection(conditions, ["id", "a", "tags"], limit),
      () => stores[1].searchProjection(conditions, ["id", "a", "tags"], limit));
  }
  const validPool = pool.filter(({ field, operator, values }) => {
    if (field === "n") return [O.EQUAL, O.NOT_EQUAL, O.BETWEEN, O.LESS_THAN, O.LESS_THAN_EQUAL,
      O.GREATER_THAN, O.GREATER_THAN_EQUAL].includes(operator) && (!values || values.every((value) => value === null || typeof value === "number"));
    if (field === "a") return [O.EQUAL, O.NOT_EQUAL].includes(operator);
    if (field === "tags") return [O.CONTAINS_ALL, O.CONTAINS_EITHER, O.NOT_CONTAINS,
      O.CONTAINS_EITHER_INCLUDING_NULL, O.NOT_EQUAL].includes(operator);
    return ["span", "spans"].includes(field) && [O.CONTAINS_ALL, O.CONTAINS_EITHER, O.NOT_CONTAINS].includes(operator)
      && values.every((value) => typeof value === "number");
  });
  for (let i = 0; i < 1500; i++) {
    const conditions = Array.from({ length: 1 + random(5) }, () => validPool[random(validPool.length)]);
    const limit = limits[random(limits.length)];
    compare(`valid-random/${profile}/schema-${order}/${i}/${JSON.stringify(conditions)}`,
      () => stores[0].searchProjection(conditions, ["id", "a", "tags"], limit),
      () => stores[1].searchProjection(conditions, ["id", "a", "tags"], limit));
  }
  const inputs = ["red blue", "item 511", "running run", "skies news", "reed blu", "unknown", "", ["blue", "blue", "green"]];
  for (let i = 0; i < 1200; i++) {
    const input = inputs[random(inputs.length)];
    const options = {
      fields: [["title"], ["other", "title"], [], undefined][random(4)],
      conditions: [[], [{ field: "id", operator: O.GREATER_THAN, values: [500] }],
        [{ field: "a", operator: O.EQUAL, values: ["red"] }],
        [{ field: "a", operator: O.EQUAL, values: ["absent"] }]][random(4)],
      limit: limits[random(limits.length)],
    };
    const max = [1, 2, 10][random(3)];
    for (const method of ["bestMatch", "minimumMatch"]) {
      compare(`keyword/${profile}/schema-${order}/${i}/${method}/${JSON.stringify(options)}`,
        () => new baseline.KeywordSearch(stores[0], max)[method](input, options),
        () => new candidate.KeywordSearch(stores[1], max)[method](input, options));
    }
    }
}
console.log(`PASS: ${checks} old/new differential checks; baseline is installed package, not Java.`);
