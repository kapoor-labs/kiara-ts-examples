import assert from "node:assert/strict";
import { test } from "node:test";
import { RuntimeConfigEngine, SAMPLE_CONFIG_RULES, type ConfigRule } from "../src/runtime-config.ts";

for (const [country, originCity, airline, surcharge] of [
  ["us", "", "", 1],
  ["us", "", "dl", 3],
  ["us", "nyc", "dl", 5.5],
  ["us", "bos", "dl", 3],
  ["us", "nyc", "jb", 2.5],
  ["us", "nyc", "aa", 4.5],
  ["in", "bom", "ai", 2],
  ["gb", "lhr", "dl", 6],
] as const) {
  test(`article rule case ${country}/${originCity}/${airline} resolves to ${surcharge}`, () => {
    const result = new RuntimeConfigEngine().resolve({ country, originCity, airline });
    assert.equal(result.status, "matched");
    if (result.status === "matched") assert.equal(result.winner.surcharge, surcharge);
  });
}

test("candidate trace shows most-specific rules first and excludes incompatible dimensions", () => {
  const engine = new RuntimeConfigEngine();
  const result = engine.resolve({ country: " US ", originCity: " NYC ", airline: " DL " });
  assert.equal(result.status, "matched");
  assert.deepEqual(result.candidates.map((candidate) => candidate.specificity), [3, 2, 2, 1, 1]);
  const swapped = engine.resolve({ country: "nyc", originCity: "us", airline: "dl" });
  assert.equal(swapped.status, "matched");
  if (swapped.status === "matched") assert.equal(swapped.winner.id, "worldwide-delta");
  assert.equal(engine.resolve({ country: "u", originCity: "", airline: "" }).status, "no-match");
});

test("no-match is explicit; missing city/airline only match wildcard dimensions", () => {
  const engine = new RuntimeConfigEngine();
  assert.deepEqual(engine.resolve({ country: "gb", originCity: "lhr", airline: "ba" }), {
    status: "no-match", candidates: [], revision: 1,
  });
  const base = engine.resolve({ country: "us", originCity: "", airline: "" });
  assert.deepEqual(base.candidates.map((candidate) => candidate.rule.id), ["us-default"]);
  assert.throws(() => engine.resolve({ country: " ", originCity: "", airline: "" }), /country is required/);
});

test("ties are explicit and independent of source row order", () => {
  const rules = SAMPLE_CONFIG_RULES.filter((rule) => rule.id !== "us-nyc-delta");
  for (const input of [rules, [...rules].reverse()]) {
    const result = new RuntimeConfigEngine(input).resolve({ country: "us", originCity: "nyc", airline: "dl" });
    assert.equal(result.status, "ambiguous");
    if (result.status === "ambiguous") assert.deepEqual(result.tiedRules.map((rule) => rule.id), ["us-delta", "us-nyc"]);
  }
  assert.equal(new RuntimeConfigEngine().resolve({ country: "in", originCity: "bom", airline: "dl" }).status, "ambiguous");
});

test("valid updates atomically replace the store and advance revision without changing past results", () => {
  const engine = new RuntimeConfigEngine();
  const context = { country: "us", originCity: "nyc", airline: "dl" };
  const previous = engine.resolve(context);
  engine.replaceRules(SAMPLE_CONFIG_RULES.map((rule) =>
    rule.id === "us-nyc-delta" ? { ...rule, surcharge: 7.25 } : rule,
  ));
  const next = engine.resolve(context);
  assert.equal(engine.revision, 2);
  assert.equal(previous.status, "matched");
  assert.equal(next.status, "matched");
  if (previous.status === "matched" && next.status === "matched") {
    assert.equal(previous.winner.surcharge, 5.5);
    assert.equal(next.winner.surcharge, 7.25);
    assert.equal(next.revision, 2);
  }
});

test("invalid updates keep the last good store and revision", () => {
  const engine = new RuntimeConfigEngine();
  const rule = SAMPLE_CONFIG_RULES[0];
  const invalid = [
    null, "[]", {}, [null], [{ ...rule, id: "" }], [rule, rule],
    [{ ...rule, country: "" }], [{ ...rule, airline: undefined }],
    [{ ...rule, surcharge: -1 }], [{ ...rule, surcharge: Infinity }],
    [{ ...rule, surcharge: NaN }], [{ ...rule, surcharge: "2.00" }],
    [{ ...rule, surchage: 2 }],
  ];
  for (const rules of invalid) {
    assert.throws(() => engine.replaceRules(rules));
    assert.equal(engine.revision, 1);
    const result = engine.resolve({ country: "us", originCity: "nyc", airline: "dl" });
    assert.equal(result.status, "matched");
    if (result.status === "matched") assert.equal(result.winner.surcharge, 5.5);
  }
});

test("empty configurations and a zero-valued global rule are deliberate, supported states", () => {
  const engine = new RuntimeConfigEngine([]);
  assert.equal(engine.resolve({ country: "us", originCity: "", airline: "" }).status, "no-match");
  const global: ConfigRule = { id: "global", country: null, originCity: null, airline: null, surcharge: 0 };
  engine.replaceRules([global]);
  const result = engine.resolve({ country: "gb", originCity: "", airline: "" });
  assert.equal(result.status, "matched");
  if (result.status === "matched") assert.equal(result.winner.surcharge, 0);
  assert.equal(result.candidates[0].specificity, 0);
  engine.replaceRules([]);
  assert.equal(engine.resolve({ country: "us", originCity: "", airline: "" }).status, "no-match");
});
