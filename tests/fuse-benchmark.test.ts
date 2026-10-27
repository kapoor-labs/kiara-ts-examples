import assert from "node:assert/strict";
import { test } from "node:test";
import Fuse from "fuse.js";
import { KeywordSearch, NormalizationProfile, Store, defineSchema, textField } from "@kapoorlabs/kiara-ts";
import {
  catalog, fuzzyPrecision, prefixPrecision, retailCatalog, schedule,
} from "../scripts/fuse-benchmark/datasets.mjs";
import { ENGINES, createMatcher, describe, referenceIds } from "../scripts/fuse-benchmark/engines.mjs";

type Clause = { op: string; values?: unknown[] };
type Workload = { id: string; kind: string; limit?: number; where?: Clause[]; interpret?: string; mode?: string; expected?: string };

const sorted = (ids: readonly string[]) => [...ids].sort();
const FUSE_OPS = new Set(["eq", "any", "all"]);
const FUSE_TYPES = new Set(["text", "enum", "list", "date", "datetime", "dateList", "datetimeList"]);

for (const dataset of [catalog(3000), schedule(3000), retailCatalog()]) {
  test(`benchmark engines agree with the reference semantics: ${dataset.name}`, () => {
    const engines = Object.fromEntries(Object.entries(ENGINES).map(([name, engine]) => [name, engine.build(dataset)]));
    const matches = createMatcher(dataset);
    for (const workload of dataset.workloads as Workload[]) {
      if (workload.kind === "exact") {
        const reference = referenceIds(dataset, workload, matches);
        const check = describe(workload, { ids: reference }, dataset, matches);
        assert.ok(check.valid && check.total > 0, `${workload.id} reference must match records`);
        const kiara = engines.kiara.run(workload);
        assert.deepEqual(kiara.ids, reference, `KiaraDB ${workload.id} must match the reference in source order`);
        const fieldTypes = new Map(dataset.fields.map((field: { name: string; type: string; indexed?: boolean }) =>
          [field.name, field.indexed === false ? "unindexed" : field.type]));
        const expressible = !workload.interpret && workload.where!.every((clause: Clause & { field?: string }) =>
          FUSE_OPS.has(clause.op) && FUSE_TYPES.has(fieldTypes.get(clause.field!)!)
          && clause.values!.every((value) => typeof value === "string"));
        for (const name of ["fuse", "fuse-tuned"]) {
          const output = engines[name].run(workload);
          if (!expressible) {
            assert.equal(output, null, `${name} must decline ${workload.id}`);
            continue;
          }
          assert.ok(output && describe(workload, output, dataset, matches).valid, `${name} ${workload.id}`);
          if (!workload.limit) assert.deepEqual(sorted(output.ids), sorted(reference), `${name} ${workload.id}`);
        }
        continue;
      }
      const kiara = engines.kiara.run(workload);
      assert.ok(kiara.items.length > 0, `KiaraDB ${workload.id}`);
      if (workload.kind === "correction") assert.equal(kiara.items[0], workload.expected);
      for (const name of ["fuse", "fuse-tuned"]) {
        const output = engines[name].run(workload);
        if (workload.kind === "correction" || workload.mode === "minimum") assert.equal(output, null);
        else assert.ok(output.items.length > 0, `${name} ${workload.id}`);
      }
    }
  });
}

test("Fuse.js-only capabilities listed in the report are absent from KiaraDB", () => {
  const rows = [
    { title: "Wireless Desk Lamp", id: "lamp" },
    { title: "Pink Candleholder Set", id: "holder" },
    { title: "Garden Lantern", id: "lantern" },
    { title: "Résumé Template", id: "resume" },
  ];
  const store = new Store(defineSchema([
    textField("title", { caseInsensitive: true, stemmedIndex: true }), textField("id", { ignoreIndex: true }),
  ]), { normalizationProfile: NormalizationProfile.NATIVE });
  store.loadRows(rows);
  store.prepare();
  const kiara = new KeywordSearch(store);
  const fuse = new Fuse(rows, { keys: ["title"], ignoreLocation: true, ignoreDiacritics: true, includeScore: true, includeMatches: true });
  const cases = {
    "two typos in one word": ["wirleess", "lamp"],
    "swapped letters": ["lmap", "lamp"],
    "match inside a word": ["holder", "holder"],
    "partial word": ["lan", "lantern"],
    "accents": ["resume", "resume"],
  };
  for (const [label, [query, expected]] of Object.entries(cases)) {
    assert.deepEqual(kiara.bestMatch(query, { fields: ["title"] }).results, [], `KiaraDB ${label}`);
    assert.ok(fuse.search(query).some((result) => result.item.id === expected), `Fuse.js ${label}`);
  }
  const [first] = fuse.search("holder");
  assert.equal(typeof first.score, "number", "Fuse.js exposes relevance scores");
  assert.ok(first.matches?.[0].indices.length, "Fuse.js exposes match positions");
  assert.ok(!("score" in kiara.bestMatch("lamp", { fields: ["title"] })), "KiaraDB results carry no score");
  for (const method of ["add", "remove", "removeAt", "toJSON"]) {
    assert.equal(typeof (store as unknown as Record<string, unknown>)[method], "undefined", `KiaraDB Store has no ${method}`);
  }
});

test("benchmark datasets are deterministic", () => {
  assert.deepEqual(catalog(50).rows, catalog(50).rows);
  assert.deepEqual(schedule(50).rows, schedule(50).rows);
  assert.notDeepEqual(catalog(50, 1).rows, catalog(50, 2).rows);
});

test("benchmark quality metrics", () => {
  assert.equal(fuzzyPrecision(["CANDLEHOLDER PINK", "TEA SET"], ["candle", "holder"]), 0.5);
  assert.equal(prefixPrecision(["LANTERN CREAM", "BLUE POT PLANT"], "lant"), 0.5);
  assert.equal(prefixPrecision([], "lant"), 0);
});
